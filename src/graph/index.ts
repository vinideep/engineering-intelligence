import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateGraph } from "./schema.js";
import { buildDependencyGraph, loadExistingGraph, mergeIncrementalUpdate } from "./builders/dependency.js";

export type { DependencyGraph, GraphNode, GraphEdge, Confidence } from "./schema.js";
export { validateGraph, SchemaValidationError } from "./schema.js";

export interface BuildGraphOptions {
  update?: boolean;
  files?: string[];
  write?: boolean;
}

export interface BuildGraphResult {
  graphPath: string;
  nodeCount: number;
  edgeCount: number;
  fileCount: number;
  wasIncremental: boolean;
}

export async function buildGraph(root: string, options: BuildGraphOptions = {}): Promise<BuildGraphResult> {
  const graphDir = path.join(root, ".engineering-intelligence", "graph");
  const graphPath = path.join(graphDir, "dependency-graph.json");

  let result: Awaited<ReturnType<typeof buildDependencyGraph>>;
  let wasIncremental = false;

  if (options.update && options.files && options.files.length > 0) {
    // Incremental: build only for changed files, then merge into existing graph
    const existing = await loadExistingGraph(graphPath);
    result = await buildDependencyGraph(root, { files: options.files });
    if (existing) {
      const merged = await mergeIncrementalUpdate(existing, result.graph, options.files);
      result = { ...result, graph: merged, nodeCount: merged.nodes.length, edgeCount: merged.edges.length };
      wasIncremental = true;
    }
  } else {
    // Full build
    result = await buildDependencyGraph(root);
  }

  // Validate before writing
  validateGraph(result.graph);

  if (options.write !== false) {
    await mkdir(graphDir, { recursive: true });
    await writeFile(graphPath, `${JSON.stringify(result.graph, null, 2)}\n`, "utf8");
  }

  return {
    graphPath: path.relative(root, graphPath),
    nodeCount: result.nodeCount,
    edgeCount: result.edgeCount,
    fileCount: result.fileCount,
    wasIncremental,
  };
}

export { loadExistingGraph } from "./builders/dependency.js";

export interface ImpactResult {
  direct: string[];
  indirect: string[];
  unknowns: string[];
}

export async function analyzeImpact(root: string, changedFiles: string[]): Promise<ImpactResult> {
  const graphPath = path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json");
  const existing = await loadExistingGraph(graphPath);
  if (!existing) {
    return { direct: [], indirect: [], unknowns: changedFiles.map((f) => `no graph found for ${f}`) };
  }

  // Normalize changed files to module node IDs
  const changedIds = new Set<string>();
  for (const f of changedFiles) {
    const rel = path.relative(root, path.resolve(root, f)).replace(/\.(ts|tsx|js|mjs|cjs|py)$/, "");
    changedIds.add(`module:${rel}`);
  }

  // Build adjacency: who imports a given node (reverse edges)
  const reverseAdj = new Map<string, string[]>();
  for (const edge of existing.edges) {
    if (!reverseAdj.has(edge.to)) reverseAdj.set(edge.to, []);
    reverseAdj.get(edge.to)!.push(edge.from);
  }

  // BFS from changed nodes following reverse edges
  const direct = new Set<string>();
  const indirect = new Set<string>();
  const unknowns: string[] = [];
  const visited = new Set<string>(changedIds);

  // First hop = direct
  for (const id of changedIds) {
    for (const importer of reverseAdj.get(id) ?? []) {
      if (!visited.has(importer)) {
        direct.add(importer);
        visited.add(importer);
      }
    }
    if (!existing.nodes.find((n) => n.id === id)) {
      unknowns.push(`no graph node for ${id}`);
    }
  }

  // Subsequent hops = indirect
  const queue = [...direct];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const importer of reverseAdj.get(current) ?? []) {
      if (!visited.has(importer)) {
        indirect.add(importer);
        visited.add(importer);
        queue.push(importer);
      }
    }
  }

  return {
    direct: [...direct],
    indirect: [...indirect],
    unknowns: [...unknowns, ...existing.unknowns.slice(0, 5)],
  };
}
