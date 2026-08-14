import { existsSync } from "node:fs";
import path from "node:path";
import { doctor } from "../validation/index.js";
import { loadExistingGraph } from "../graph/index.js";
import { verifyKnowledge } from "../verify/index.js";
import { checkEvidenceHashes } from "../evidence/index.js";

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
  if (!graph) {
    lines.push("✗ Graph: not built — run `setup`");
    json.graph = null;
    ok = false;
  } else {
    const symbols = graph.nodes.filter((n) => n.kind === "symbol").length;
    const modules = graph.nodes.filter((n) => n.kind === "module").length;
    const hotspots = graph.nodes
      .filter((n) => n.kind === "module" && typeof n.metadata.churn === "number")
      .sort((a, b) => (b.metadata.churn as number) - (a.metadata.churn as number))
      .slice(0, 3)
      .map((n) => `${n.path ?? n.id.replace(/^module:/, "")} (${n.metadata.churn})`);
    json.graph = { modules, symbols, edges: graph.edges.length, commit: graph.commit };
    lines.push(`✓ Graph: ${modules} modules, ${symbols} symbols, ${graph.edges.length} edges${graph.commit ? ` @ ${graph.commit.slice(0, 7)}` : ""}`);
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
      lines.push("• Evidence hashes: none recorded (run `setup` or evidence-record)");
    } else if (ev.stale > 0) {
      ok = false;
      lines.push(`✗ Evidence: ${ev.stale} stale citation(s) of ${ev.checked}`);
    } else {
      lines.push(`✓ Evidence: ${ev.checked} citation(s) still match the code`);
    }
  } else {
    lines.push("• Knowledge base: not initialized (run /initialize-engineering-intelligence)");
  }

  lines.push("");
  lines.push(ok ? "Overall: ✓ healthy" : "Overall: ✗ needs attention");
  return { text: lines.join("\n") + "\n", ok, json };
}
