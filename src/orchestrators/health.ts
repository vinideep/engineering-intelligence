import { existsSync } from "node:fs";
import path from "node:path";
import { doctor } from "../validation/index.js";
import { loadExistingGraph } from "../graph/index.js";
import { verifyKnowledge } from "../verify/index.js";
import { checkEvidenceHashes } from "../evidence/index.js";
import { verifyClaims } from "../claims/index.js";
import { computeFreshness } from "../freshness/index.js";
import { loadEiConfig } from "../config/index.js";
import { ProjectFilePolicy } from "../project-files/index.js";
import { providerStatus } from "../providers/manager.js";
import { PROVIDER_NAMES } from "../providers/types.js";
import { inspectProjectProviderRuns } from "../providers/project-status.js";

// ---------------------------------------------------------------------------
// `health` — one trust sweep. Aggregates install integrity (doctor), graph
// stats + freshness, knowledge-base drift (verify), and stale evidence into a
// single report with one exit code. Replaces running doctor + verify +
// evidence-check + freshness separately.
// ---------------------------------------------------------------------------

export interface HealthResult {
  text: string;
  ok: boolean; // false if any hard problem (install errors, drift, stale evidence)
  json: unknown;
}

export async function runHealth(root: string): Promise<HealthResult> {
  const lines: string[] = ["Engineering Intelligence — health check", ""];
  let ok = true;
  const json: Record<string, unknown> = {};

  // 1. Install integrity.
  const actions = await doctor(root);
  const errors = actions.filter((a) => a.status === "error");
  json.install = { total: actions.length, errors: errors.length };
  if (errors.length > 0) {
    ok = false;
    lines.push(`✗ Install: ${errors.length} problem(s)`);
    for (const e of errors.slice(0, 5)) lines.push(`    ${e.path}${e.message ? ` — ${e.message}` : ""}`);
  } else {
    lines.push(`✓ Install: OK (${actions.length} checks)`);
  }

  // 2. Graph presence + stats.
  const graph = await loadExistingGraph(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"));
  let sourceModules = 0;
  if (!graph) {
    lines.push("✗ Graph: not built — run `setup`");
    json.graph = null;
    ok = false;
  } else {
    const symbols = graph.nodes.filter((n) => n.kind === "symbol").length;
    const modules = graph.nodes.filter((n) => n.kind === "module").length;
    sourceModules = modules;
    const policy = await ProjectFilePolicy.load(root);
    const disallowed = graph.nodes
      .filter((node) => node.kind !== "external" && typeof node.path === "string")
      .map((node) => ({ node, decision: policy.explain(node.path!) }))
      .filter(({ decision }) => !decision.included)
      .map(({ node, decision }) => ({ id: node.id, path: node.path, reason: decision.reason }));
    const hotspots = graph.nodes
      .filter((n) => n.kind === "module" && typeof n.metadata.churn === "number")
      .sort((a, b) => (b.metadata.churn as number) - (a.metadata.churn as number))
      .slice(0, 3)
      .map((n) => `${n.path ?? n.id.replace(/^module:/, "")} (${n.metadata.churn})`);
    json.graph = { modules, symbols, edges: graph.edges.length, commit: graph.commit, disallowed };
    lines.push(`✓ Graph: ${modules} modules, ${symbols} symbols, ${graph.edges.length} edges${graph.commit ? ` @ ${graph.commit.slice(0, 7)}` : ""}`);
    if (disallowed.length > 0) {
      ok = false;
      lines.push(`✗ Graph scope: ${disallowed.length} source node(s) violate the shared file policy`);
      for (const item of disallowed.slice(0, 5)) lines.push(`    ${item.path} — ${item.reason}`);
    } else {
      lines.push("✓ Graph scope: no disallowed source nodes");
    }
    if (hotspots.length) lines.push(`    hotspots: ${hotspots.join(", ")}`);
  }

  // 3. Knowledge-base drift (only if a KB exists).
  if (existsSync(path.join(root, ".engineering-intelligence", "knowledge-base"))) {
    const verify = await verifyKnowledge(root);
    json.verify = { checked: verify.referencesChecked, drift: verify.drift };
    if (verify.filesScanned === 0) {
      lines.push("• Knowledge base: present but no markdown to verify yet");
    } else if (verify.drift > 0) {
      ok = false;
      lines.push(`✗ Knowledge base: ${verify.drift} drifted reference(s) of ${verify.referencesChecked}`);
    } else {
      lines.push(`✓ Knowledge base: ${verify.referencesChecked} reference(s) resolve`);
    }

    // 4. Evidence freshness.
    const ev = await checkEvidenceHashes(root);
    json.evidence = { checked: ev.checked, stale: ev.stale };
    if (ev.checked === 0) {
      ok = false;
      lines.push("✗ Evidence hashes: none recorded (run `evidence-record` after validating the knowledge base)");
    } else if (ev.stale > 0) {
      ok = false;
      lines.push(`✗ Evidence: ${ev.stale} stale citation(s) of ${ev.checked}`);
    } else {
      lines.push(`✓ Evidence: ${ev.checked} citation(s) still match the code`);
    }
  } else {
    lines.push("• Knowledge base: not initialized (run /initialize-engineering-intelligence)");
  }

  // Freshness covers canonical knowledge, memory, context and graph artifacts.
  // Unverifiable generated JSON remains visible but does not masquerade as
  // drift; any actual sync/block decision is a hard health failure.
  const freshness = await computeFreshness(root);
  const actionableFreshness = freshness.scores.filter((score) => score.status !== "unverifiable" && score.action !== "none");
  json.freshness = {
    decision: freshness.driftDecision,
    documents: freshness.scores.length,
    actionable: actionableFreshness.length,
    unverifiable: freshness.scores.filter((score) => score.status === "unverifiable").length,
  };
  if (freshness.driftDecision !== "Proceed") {
    ok = false;
    lines.push(`✗ Freshness: ${freshness.driftDecision} (${actionableFreshness.length} artifact(s) need synchronization)`);
  } else {
    lines.push(`✓ Freshness: Proceed (${freshness.scores.length} artifact(s) assessed)`);
  }

  // 6. Claim trust. A non-empty source graph without any derived facts is not a
  // publishable intelligence baseline, even if the prose happens to resolve.
  const claims = await verifyClaims(root);
  json.claims = {
    total: claims.total,
    verified: claims.verified,
    refuted: claims.refuted,
    unverified: claims.unverified,
    stale: claims.stale,
    missing: claims.missing,
  };
  const badClaims = claims.refuted + claims.unverified + claims.stale + claims.missing;
  if (sourceModules > 0 && claims.total === 0) {
    ok = false;
    lines.push("✗ Claims: non-empty repository has no derived claim baseline");
  } else if (badClaims > 0) {
    ok = false;
    lines.push(`✗ Claims: ${badClaims} untrusted claim(s) of ${claims.total}`);
  } else if (claims.total > 0) {
    lines.push(`✓ Claims: ${claims.verified}/${claims.total} re-derived and verified`);
  } else {
    lines.push("• Claims: no source modules and no claims");
  }

  // 7. Live provider handshake. Missing optional providers are an explicit
  // degraded state with native fallback; they become a hard failure only when
  // the project requires providers.
  const config = await loadEiConfig(root);
  const providersDisabled = config.providers.policy === "native";
  const [statuses, projectRuns] = await Promise.all([
    Promise.all(PROVIDER_NAMES.map((name) => providerStatus(name, { disabled: providersDisabled }))),
    inspectProjectProviderRuns(root, { disabled: providersDisabled }),
  ]);
  const unavailable = statuses.filter((status) => status.health !== "healthy" && status.health !== "disabled");
  const unavailableRuns = projectRuns.filter((status) => status.health !== "current" && status.health !== "disabled");
  json.providers = {
    policy: config.providers.policy,
    requireProviders: config.providers.requireProviders,
    fallbackActive: unavailable.length > 0 || unavailableRuns.length > 0,
    statuses,
    projectRuns,
  };
  if (config.providers.policy === "native") {
    lines.push("✓ Providers: intentionally disabled; native graph and retrieval active");
  } else if (unavailable.length === 0 && unavailableRuns.length === 0) {
    lines.push("✓ Providers: binaries and project-local Graphify/CCE evidence are current");
  } else {
    if (config.providers.requireProviders) ok = false;
    lines.push(`${config.providers.requireProviders ? "✗" : "•"} Providers: ${unavailable.length} binary and ${unavailableRuns.length} project evidence problem(s); native fallback active${config.providers.requireProviders ? " (providers required)" : ""}`);
    for (const status of unavailable) lines.push(`    ${status.displayName}: ${status.health} — ${status.message}`);
    for (const status of unavailableRuns) lines.push(`    ${status.name} project state: ${status.health} — ${status.message}`);
  }

  lines.push("");
  lines.push(ok ? "Overall: ✓ healthy" : "Overall: ✗ needs attention");
  return { text: lines.join("\n") + "\n", ok, json };
}
