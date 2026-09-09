import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadExistingGraph, type DependencyGraph } from "../graph/index.js";
import type { ExperimentRecord } from "./types.js";

function graphFilePath(root: string): string {
  return path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json");
}

export async function attachExperimentToGraph(root: string, record: ExperimentRecord): Promise<boolean> {
  const filePath = graphFilePath(root);
  const graph = await loadExistingGraph(filePath);
  if (!graph) return false;

  const experimentNodeId = `experiment:${record.id}`;

  // Find target node in graph (matching targetFile or targetSymbol)
  let targetNodeId: string | null = null;
  const normTarget = record.targetFile.replace(/\\/g, "/");

  for (const node of graph.nodes) {
    if (record.targetSymbol && node.kind === "symbol" && (node.label === record.targetSymbol || node.id.endsWith(record.targetSymbol))) {
      targetNodeId = node.id;
      break;
    }
    const nodeFile = (node.path || (node.metadata?.file as string | undefined))?.replace(/\\/g, "/");
    if (nodeFile && (nodeFile === normTarget || nodeFile.endsWith(normTarget))) {
      targetNodeId = node.id;
      if (!record.targetSymbol) break;
    }
  }

  if (!targetNodeId) {
    targetNodeId = `module:${normTarget.replace(/\.[^/.]+$/, "")}`;
  }

  // Check if node already exists
  const exists = graph.nodes.some((n) => n.id === experimentNodeId);
  if (!exists) {
    graph.nodes.push({
      id: experimentNodeId,
      kind: "experiment",
      label: `${record.id} (${record.verdict})`,
      confidence: "verified",
      metadata: {
        verdict: record.verdict,
        deltaPercent: record.deltaPercent,
        baseline: record.baselineValue,
        measured: record.measuredValue,
        hypothesis: record.hypothesis,
        targetFile: record.targetFile,
        timestamp: record.closedAt,
      },
      evidence: [record.targetFile],
    });

    graph.edges.push({
      from: experimentNodeId,
      to: targetNodeId,
      relation: "evaluated",
      confidence: "verified",
      metadata: {
        verdict: record.verdict,
        improved: record.verdict === "KEEP",
        revertReason: record.revertReason,
      },
      evidence: [record.targetFile],
    });

    await writeFile(filePath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
    return true;
  }

  return false;
}
