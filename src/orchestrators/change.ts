import { checkEvidenceHashes } from "../evidence/index.js";
import { runGate, GATE_NAMES } from "../gates/index.js";
import { analyzeImpact, buildGraph, ensureFreshGraph } from "../graph/index.js";
import { runCceIndex } from "../providers/cce.js";
import { runGraphifyExtraction } from "../providers/graphify.js";
import { prepareProviders } from "../providers/manager.js";
import { deriveClaims, verifyClaims } from "../claims/index.js";
import { changedFiles } from "../verify/index.js";
import { verifyKnowledge } from "../verify/index.js";

export async function validateChange(root: string, files?: string[], base = "HEAD") {
  const changed = files && files.length > 0 ? files : await changedFiles(root);
  const freshness = await ensureFreshGraph(root);
  const [impact, claims, knowledge, evidence, ...gates] = await Promise.all([
    analyzeImpact(root, changed),
    verifyClaims(root),
    verifyKnowledge(root),
    checkEvidenceHashes(root),
    ...GATE_NAMES.map((gate) => runGate(gate, root, { base })),
  ]);
  const blocking = gates.filter((gate) => gate.status === "fail");
  return {
    changedFiles: changed,
    freshness,
    impact,
    claims,
    knowledge,
    evidence,
    gates,
    verdict: blocking.length === 0 && claims.refuted + claims.stale + claims.missing === 0 && knowledge.drift === 0 && evidence.stale === 0 ? "pass" : "needs-attention",
    blocking: [...blocking.map((gate) => gate.gate), ...(claims.refuted + claims.stale + claims.missing > 0 ? ["claims"] : []), ...(knowledge.drift > 0 || evidence.stale > 0 ? ["knowledge"] : [])],
  };
}

export async function syncEngineeringKnowledge(root: string, files?: string[]) {
  const changed = files && files.length > 0 ? files : await changedFiles(root);
  const providers = await prepareProviders(root, { installMissing: false });
  const graphifyHealthy = providers.statuses.some((status) => status.name === "graphify" && status.health === "healthy");
  const cceHealthy = providers.statuses.some((status) => status.name === "cce" && status.health === "healthy");
  const graphify = graphifyHealthy ? await runGraphifyExtraction(root) : { ok: false, degraded: providers.policy !== "native", message: "Graphify unavailable or disabled; native graph synchronization used." };
  const graph = await buildGraph(root, changed.length > 0 && changed.length <= 200 ? { update: true, files: changed, providerEvidence: graphify.ok } : { providerEvidence: graphify.ok });
  const cce = cceHealthy ? await runCceIndex(root) : { ok: false, degraded: providers.policy !== "native", message: "CCE unavailable or disabled; native retrieval remains active." };
  const derived = await deriveClaims(root);
  const [claims, knowledge, evidence] = await Promise.all([verifyClaims(root), verifyKnowledge(root), checkEvidenceHashes(root)]);
  return {
    changedFiles: changed,
    providers,
    graphify,
    graph,
    cce,
    derived,
    claims,
    knowledge,
    evidence,
    requiresModelKnowledgeSync: knowledge.drift > 0 || evidence.stale > 0,
    note: "Code, graph, provider index, and derived claims are synchronized. Canonical prose is never rewritten without evidence-aware model synthesis.",
  };
}
