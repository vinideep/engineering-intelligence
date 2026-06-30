import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { DependencyGraph, GraphEdge, GraphNode } from "../schema.js";
import { parseManifests } from "../parsers/manifest.js";
import { extractImports } from "../parsers/imports.js";
import { extractSymbols, resolvePendingCalls, buildGlobalSymbolTable, type PendingCall } from "../parsers/symbols.js";

// Directories to skip when walking source files
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", "__pycache__", ".venv", "venv", "vendor", "target", ".gradle"]);
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".go", ".rs", ".rb", ".java", ".kt"]);

async function walkSourceFiles(dir: string, root: string, files: string[] = []): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let s;
    try { s = await stat(full); } catch { continue; }
    if (s.isDirectory()) {
      await walkSourceFiles(full, root, files);
    } else if (SOURCE_EXTS.has(path.extname(entry).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function deduplicateNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (!seen.has(node.id)) {
      seen.set(node.id, node);
    } else {
      // Merge evidence
      const existing = seen.get(node.id)!;
      for (const ev of node.evidence) {
        if (!existing.evidence.includes(ev)) existing.evidence.push(ev);
      }
    }
  }
  return [...seen.values()];
}

function deduplicateEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Map<string, GraphEdge>();
  for (const edge of edges) {
    const key = `${edge.from}→${edge.to}→${edge.relation}`;
    if (!seen.has(key)) {
      seen.set(key, { ...edge });
    } else {
      // Merge evidence
      const existing = seen.get(key)!;
      for (const ev of edge.evidence) {
        if (!existing.evidence.includes(ev)) existing.evidence.push(ev);
      }
    }
  }
  return [...seen.values()];
}

export interface BuildOptions {
  scope?: string;
  files?: string[];
}

export interface BuildResult {
  graph: DependencyGraph;
  nodeCount: number;
  edgeCount: number;
  fileCount: number;
}

export async function buildDependencyGraph(root: string, options: BuildOptions = {}): Promise<BuildResult> {
  const scope = options.scope ?? path.basename(root);

  // Parse package manifests first
  const { nodes: manifestNodes, devNodeIds } = await parseManifests(root);

  // Walk source files (or use provided file list for incremental)
  const sourceFiles = options.files ?? await walkSourceFiles(root, root);

  // Extract imports and symbols from all source files in parallel (batched to avoid fd limit)
  const BATCH = 50;
  const allNodes: GraphNode[] = [...manifestNodes];
  const allEdges: GraphEdge[] = [];
  const symbolNodes: GraphNode[] = [];
  const pendingCalls: PendingCall[] = [];

  for (let i = 0; i < sourceFiles.length; i += BATCH) {
    const batch = sourceFiles.slice(i, i + BATCH);
    const [importResults, symbolResults] = await Promise.all([
      Promise.all(batch.map((f) => extractImports(f, root))),
      Promise.all(batch.map((f) => extractSymbols(f, root))),
    ]);
    for (const { nodes, edges } of importResults) {
      allNodes.push(...nodes);
      allEdges.push(...edges);
    }
    for (const { nodes, edges, pendingCalls: pc } of symbolResults) {
      allNodes.push(...nodes);
      symbolNodes.push(...nodes);
      allEdges.push(...edges);
      pendingCalls.push(...pc);
    }
  }

  // Resolve cross-file call edges against the global symbol table
  const globalSymbols = buildGlobalSymbolTable(symbolNodes);
  allEdges.push(...resolvePendingCalls(pendingCalls, globalSymbols));

  // Mark dev dependency edges
  for (const edge of allEdges) {
    if (devNodeIds.has(edge.to) && edge.relation === "imports") {
      edge.metadata = { ...edge.metadata, dev: true };
    }
  }

  const nodes = deduplicateNodes(allNodes);
  const edges = deduplicateEdges(allEdges);

  // Remove edges referencing nodes that don't exist (can happen with relative imports to non-source files)
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.from));

  // Collect unknowns: edges whose target is not in our node set (external packages not in manifests)
  const unknowns: string[] = [];
  for (const edge of validEdges) {
    if (!nodeIds.has(edge.to)) {
      unknowns.push(`unresolved target "${edge.to}" referenced from "${edge.from}"`);
    }
  }

  const graph: DependencyGraph = {
    schemaVersion: 1,
    graphType: "dependency",
    generatedAt: new Date().toISOString(),
    scope,
    nodes,
    edges: validEdges,
    unknowns,
  };

  return { graph, nodeCount: nodes.length, edgeCount: validEdges.length, fileCount: sourceFiles.length };
}

export async function loadExistingGraph(graphPath: string): Promise<DependencyGraph | null> {
  try {
    const content = await readFile(graphPath, "utf8");
    return JSON.parse(content) as DependencyGraph;
  } catch {
    return null;
  }
}

export async function mergeIncrementalUpdate(existing: DependencyGraph, updated: DependencyGraph, changedFiles: string[]): Promise<DependencyGraph> {
  // Remove all nodes and edges whose evidence overlaps with changed files
  const changedSet = new Set(changedFiles.map((f) => f.replace(/\\/g, "/")));
  const affectedNodeIds = new Set<string>();
  for (const node of existing.nodes) {
    if (node.evidence.some((e) => changedSet.has(e.split(":")[0]))) {
      affectedNodeIds.add(node.id);
    }
  }

  const keptNodes = existing.nodes.filter((n) => !affectedNodeIds.has(n.id));
  const keptEdges = existing.edges.filter((e) => !affectedNodeIds.has(e.from) && !affectedNodeIds.has(e.to));

  const merged: DependencyGraph = {
    ...existing,
    generatedAt: new Date().toISOString(),
    nodes: [...keptNodes, ...updated.nodes],
    edges: [...keptEdges, ...updated.edges],
    unknowns: [...new Set([...existing.unknowns, ...updated.unknowns])],
  };

  // Re-deduplicate
  merged.nodes = deduplicateNodes(merged.nodes);
  merged.edges = deduplicateEdges(merged.edges);
  return merged;
}
