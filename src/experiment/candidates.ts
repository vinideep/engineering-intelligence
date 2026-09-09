import path from "node:path";
import { loadExistingGraph, buildGraph, analyzeImpact } from "../graph/index.js";
import { computeChurn } from "../git-analysis/index.js";
import type { CandidateOpportunity, CandidateCategory } from "./types.js";

export interface CandidateOptions {
  focusFile?: string;
  topN?: number;
}

export async function generateExperimentCandidates(
  root: string,
  options: CandidateOptions = {},
): Promise<CandidateOpportunity[]> {
  const graphPath = path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json");
  let graph = await loadExistingGraph(graphPath);

  if (!graph) {
    await buildGraph(root, { write: true });
    graph = await loadExistingGraph(graphPath);
  }

  if (!graph) {
    return [];
  }

  // Count incoming edges (fan-in / in-degree)
  const inDegree = new Map<string, number>();
  for (const edge of graph.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Compute git churn if available
  let churnMap = new Map<string, number>();
  try {
    churnMap = computeChurn(root, 90);
  } catch {
    // Non-git or error fallback
  }

  const opportunities: CandidateOpportunity[] = [];
  const topN = options.topN ?? 10;
  const focusNorm = options.focusFile ? options.focusFile.replace(/\\/g, "/") : undefined;

  for (const node of graph.nodes) {
    if (node.kind !== "module" && node.kind !== "symbol") continue;
    const filePath = node.path || (node.metadata?.file as string | undefined);
    if (!filePath) continue;

    const normFile = filePath.replace(/\\/g, "/");
    if (focusNorm && normFile !== focusNorm && !normFile.endsWith(focusNorm)) {
      continue;
    }

    const fanIn = inDegree.get(node.id) ?? 0;
    const churn = churnMap.get(normFile) ?? 0;

    let category: CandidateCategory = "fan_in";
    let score = 0;
    let rationale = "";
    let suggestedHypothesis = "";

    const isSymbol = node.kind === "symbol";
    const name = node.label || node.id;

    if (churn >= 5 && fanIn >= 2) {
      category = "hotspot";
      score = Math.min(95, 50 + churn * 3 + fanIn * 5);
      rationale = `High churn (${churn} commits) and high dependency fan-in (${fanIn} incoming relations).`;
      suggestedHypothesis = isSymbol
        ? `Optimize ${name} to reduce overhead across ${fanIn} call-sites.`
        : `Streamline critical paths in ${normFile} to eliminate redundant processing.`;
    } else if (fanIn >= 3) {
      category = "fan_in";
      score = Math.min(90, 40 + fanIn * 8);
      rationale = `Architectural bottleneck with ${fanIn} dependents relying on this node.`;
      suggestedHypothesis = isSymbol
        ? `Introduce memoization or early-exit in ${name} to eliminate repeated work.`
        : `Decompose ${normFile} to isolate hot dependencies and minimize re-execution.`;
    } else if (churn >= 8) {
      category = "hotspot";
      score = Math.min(85, 30 + churn * 4);
      rationale = `Frequent change hotspot (${churn} commits in 90 days), prone to regressions.`;
      suggestedHypothesis = `Refactor complex logic in ${normFile} to simplify control flow.`;
    } else if (/(db|repo|query|fetch|api|client|service|cache)/i.test(name)) {
      category = "caller_chain";
      score = 65;
      rationale = `I/O and data access boundary detected in ${name}.`;
      suggestedHypothesis = `Batch or cache operations in ${name} to eliminate sequential latency overhead.`;
    } else {
      continue;
    }

    // Identify scoped tests
    let testsToRun: string[] = [];
    try {
      const impact = await analyzeImpact(root, [normFile]);
      testsToRun = impact.testsToRun;
    } catch {
      // Impact analysis non-fatal fallback
    }

    opportunities.push({
      id: `opp-${opportunities.length + 1}`,
      targetNodeId: node.id,
      targetFile: normFile,
      symbol: isSymbol ? name : undefined,
      category,
      score,
      rationale,
      suggestedHypothesis,
      testsToRun,
      directDependents: fanIn,
    });
  }

  // Sort opportunities by score descending
  opportunities.sort((a, b) => b.score - a.score);

  return opportunities.slice(0, topN);
}
