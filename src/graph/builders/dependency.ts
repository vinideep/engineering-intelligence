import { readFile } from "node:fs/promises";
import path from "node:path";
import { runProcessSync } from "../../process/index.js";
import type { DependencyGraph, GraphEdge, GraphNode } from "../schema.js";
import { parseManifests } from "../parsers/manifest.js";
import { extractImports } from "../parsers/imports.js";
import { extractSymbols, resolvePendingCalls, buildGlobalSymbolTable, type PendingCall } from "../parsers/symbols.js";
import { collectProjectFiles, ProjectFilePolicy } from "../../project-files/index.js";

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".go", ".rs", ".rb", ".java", ".kt"]);

function getGitChurn(root: string): Map<string, number> {
  const churn = new Map<string, number>();
  const result = runProcessSync({ command: "git", args: ["log", "--name-only", "--format=", "-n", "200"], cwd: root, timeoutMs: 10_000 });
  if (result.exitCode !== 0) return churn;
  for (const rawLine of result.stdout.split("\n")) {
    const line = rawLine.trim().replace(/\\/g, "/");
    if (!line) continue;
    churn.set(line, (churn.get(line) ?? 0) + 1);
  }
  return churn;
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
      if (node.metadata) {
        existing.metadata = { ...node.metadata, ...existing.metadata };
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
  policy?: ProjectFilePolicy;
}

export interface BuildResult {
  graph: DependencyGraph;
  nodeCount: number;
  edgeCount: number;
  fileCount: number;
}

export async function buildDependencyGraph(root: string, options: BuildOptions = {}): Promise<BuildResult> {
  const scope = options.scope ?? path.basename(root);
  const policy = options.policy ?? await ProjectFilePolicy.load(root);

  // Parse package manifests first
  const { nodes: manifestNodes, devNodeIds } = await parseManifests(root);

  // Walk source files (or use provided file list for incremental)
  const sourceFiles = options.files
    ? (await Promise.all(options.files.map(async (file) => {
        const absolute = path.resolve(root, file);
        const decision = await policy.explainExisting(absolute);
        return decision.included && SOURCE_EXTS.has(path.extname(absolute).toLowerCase()) ? absolute : undefined;
      }))).filter((file): file is string => typeof file === "string")
    : await collectProjectFiles(policy, { accept: (rel) => SOURCE_EXTS.has(path.extname(rel).toLowerCase()) });

  // Extract imports from all source files in parallel (batched to avoid fd limit)
  const BATCH = 50;
  const allNodes: GraphNode[] = [...manifestNodes];
  const allEdges: GraphEdge[] = [];
  const symbolNodes: GraphNode[] = [];
  const allPendingCalls: PendingCall[] = [];

  const parserUnknowns: string[] = [];
  for (let i = 0; i < sourceFiles.length; i += BATCH) {
    const batch = sourceFiles.slice(i, i + BATCH);
    const [importResults, symbolResults] = await Promise.all([
      Promise.all(batch.map((f) => extractImports(f, root))),
      Promise.all(batch.map((f) => extractSymbols(f, root))),
    ]);
    for (const { nodes, edges, unknowns } of importResults) {
      const replacements = new Map<string, string>();
      const normalizedNodes = nodes.map((node) => {
        if (node.kind !== "module" || !node.path) return node;
        const decision = policy.explain(node.path);
        if (decision.included) return node;
        const id = `external:${node.path}`;
        replacements.set(node.id, id);
        return {
          ...node,
          id,
          kind: "external",
          label: path.basename(node.path),
          path: undefined,
          metadata: {
            ...node.metadata,
            external: true,
            excludedPath: node.path,
            policySource: decision.source,
            policyPattern: decision.pattern,
            policyReason: decision.reason,
          },
        } satisfies GraphNode;
      });
      const normalizedEdges = edges.map((edge) => ({
        ...edge,
        from: replacements.get(edge.from) ?? edge.from,
        to: replacements.get(edge.to) ?? edge.to,
      }));
      allNodes.push(...normalizedNodes);
      allEdges.push(...normalizedEdges);
      if (unknowns) parserUnknowns.push(...unknowns);
    }
    for (const { nodes, edges, pendingCalls } of symbolResults) {
      allNodes.push(...nodes);
      symbolNodes.push(...nodes);
      allEdges.push(...edges);
      allPendingCalls.push(...pendingCalls);
    }
  }

  // Build module import index for scoped call resolution
  const importsByModule = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    if (edge.relation === "imports") {
      if (!importsByModule.has(edge.from)) importsByModule.set(edge.from, new Set());
      importsByModule.get(edge.from)!.add(edge.to);
    }
  }

  const globalSymbols = buildGlobalSymbolTable(symbolNodes);
  const callEdges = resolvePendingCalls(allPendingCalls, globalSymbols, importsByModule);
  allEdges.push(...callEdges);

  // Mark dev dependency edges
  for (const edge of allEdges) {
    if (devNodeIds.has(edge.to) && edge.relation === "imports") {
      edge.metadata = { ...edge.metadata, dev: true };
    }
  }

  // Tag test files and attach churn metadata to module nodes
  const churnMap = getGitChurn(root);
  const TEST_PATTERN = /(?:^|[\\/])(test|tests|__tests__|spec)(?:[\\/]|\.|\b)|(?:\.test|\.spec)\.[a-z]+$/i;

  for (const node of allNodes) {
    const relPath = node.path ? node.path.replace(/\\/g, "/") : node.id.replace(/^module:/, "");
    const isTest = TEST_PATTERN.test(relPath) || TEST_PATTERN.test(node.evidence[0] ?? "");
    if (isTest) {
      node.metadata = { ...node.metadata, isTest: true };
    }
    if (node.kind === "module") {
      let churnCount = churnMap.get(relPath);
      if (churnCount === undefined) {
        for (const ext of [".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".go", ".rs", ".rb", ".java", ".kt"]) {
          churnCount = churnMap.get(`${relPath}${ext}`);
          if (churnCount !== undefined) break;
        }
      }
      if (churnCount !== undefined) {
        node.metadata = { ...node.metadata, churn: churnCount };
      }
    }
  }

  const nodes = deduplicateNodes(allNodes);
  const edges = deduplicateEdges(allEdges);

  // Remove edges referencing nodes that don't exist (can happen with relative imports to non-source files)
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.from));

  // Unknowns are what the graph does NOT know. The previous check
  // (`!nodeIds.has(edge.to)`) was structurally dead — every parser pushes the
  // target node before the edge, so it always returned an empty list and the
  // graph claimed total knowledge. Real unknowns come from the parsers, which
  // report specifiers they could not resolve to a file on disk.
  const unknowns = [...new Set(parserUnknowns)];
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
  // Recompute outgoing relationships for changed sources, but preserve inbound
  // relationships from unchanged sources. A target implementation change does
  // not make its importers stop importing it. If a target was actually removed,
  // the endpoint filter below removes the now-dangling relationship.
  const keptEdges = existing.edges.filter((e) => !affectedNodeIds.has(e.from));

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
  const nodeIds = new Set(merged.nodes.map((node) => node.id));
  merged.edges = merged.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  return merged;
}
