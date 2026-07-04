import { mkdir, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { validateGraph, type DependencyGraph, type GraphNode } from "./schema.js";
import { buildDependencyGraph, loadExistingGraph, mergeIncrementalUpdate } from "./builders/dependency.js";

export type { DependencyGraph, GraphNode, GraphEdge, Confidence } from "./schema.js";
export { validateGraph, SchemaValidationError } from "./schema.js";

const SOURCE_EXT_RE = /\.(ts|tsx|js|mjs|cjs|py|go|rs|rb|java|kt)$/;

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

// Current git HEAD sha, or undefined for non-git dirs.
function gitHead(root: string): string | undefined {
  try {
    return execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 10_000 }).trim() || undefined;
  } catch {
    return undefined;
  }
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

  // Stamp the graph with the current commit for freshness checks.
  const head = gitHead(root);
  if (head) result.graph.commit = head;

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

// ---------------------------------------------------------------------------
// Freshness: keep the on-disk graph in sync with the working tree before a query
// ---------------------------------------------------------------------------

export interface FreshnessResult {
  refreshed: boolean;
  staleWarning?: string;
}

function graphFilePath(root: string): string {
  return path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json");
}

// Files changed between the graph's stamped commit and HEAD, plus uncommitted
// changes. Returns null if git can't answer (e.g. unknown commit) so the caller
// can decide to full-rebuild.
function changedSinceStamp(root: string, stampCommit: string | undefined): string[] | null {
  try {
    const files = new Set<string>();
    if (stampCommit) {
      const head = gitHead(root);
      if (head && head !== stampCommit) {
        const out = execSync(`git diff --name-only ${stampCommit} ${head}`, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 15_000 });
        for (const f of out.split("\n")) if (f.trim()) files.add(f.trim());
      }
    }
    // Uncommitted (working tree + staged) changes.
    const porcelain = execSync("git status --porcelain", { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 15_000 });
    for (const line of porcelain.split("\n")) {
      const f = line.slice(3).trim();
      if (f) files.add(f.includes(" -> ") ? f.split(" -> ")[1] : f);
    }
    return [...files].filter((f) => SOURCE_EXT_RE.test(f));
  } catch {
    return null;
  }
}

// Ensure the on-disk graph reflects the current working tree. Best-effort: any
// failure degrades to the existing (possibly stale) graph with a warning rather
// than blocking the query.
export async function ensureFreshGraph(root: string): Promise<FreshnessResult> {
  const existing = await loadExistingGraph(graphFilePath(root));
  if (!existing) {
    // No graph yet — build one from scratch.
    try {
      await buildGraph(root, { write: true });
      return { refreshed: true };
    } catch (e) {
      return { refreshed: false, staleWarning: `could not build graph: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const changed = changedSinceStamp(root, existing.commit);
  if (changed === null) {
    // Git couldn't answer (unknown commit / not a repo). If there was a stamp,
    // history may have diverged — rebuild fully; otherwise leave as-is.
    if (existing.commit) {
      try {
        await buildGraph(root, { write: true });
        return { refreshed: true };
      } catch {
        return { refreshed: false, staleWarning: "graph may be stale; full rebuild failed" };
      }
    }
    return { refreshed: false };
  }
  if (changed.length === 0) return { refreshed: false };

  try {
    if (changed.length <= 200) {
      await buildGraph(root, { update: true, files: changed, write: true });
    } else {
      await buildGraph(root, { write: true });
    }
    return { refreshed: true };
  } catch (e) {
    return { refreshed: false, staleWarning: `incremental refresh failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// Impact analysis
// ---------------------------------------------------------------------------

export interface ImpactDetail {
  id: string;
  kind: string;
  label: string;
  evidence: string[];
  churn?: number;
  isTest?: boolean;
  hop: "direct" | "indirect";
}

export interface ImpactResult {
  direct: string[];
  indirect: string[];
  details: ImpactDetail[];
  testsToRun: string[];
  riskNotes: string[];
  unknowns: string[];
}

const CHURN_RISK_THRESHOLD = 8;

export async function analyzeImpact(root: string, changedFiles: string[]): Promise<ImpactResult> {
  const existing = await loadExistingGraph(graphFilePath(root));
  if (!existing) {
    return { direct: [], indirect: [], details: [], testsToRun: [], riskNotes: [], unknowns: changedFiles.map((f) => `no graph found for ${f}`) };
  }

  const nodeById = new Map<string, GraphNode>(existing.nodes.map((n) => [n.id, n]));

  // Normalize changed files to module node IDs, and seed with every symbol
  // defined in those files so impact resolves at the function level too.
  const changedIds = new Set<string>();
  const changedRels = new Set<string>();
  for (const f of changedFiles) {
    const rel = path.relative(root, path.resolve(root, f)).replace(SOURCE_EXT_RE, "").replace(/\\/g, "/");
    changedIds.add(`module:${rel}`);
    changedRels.add(rel);
  }
  for (const node of existing.nodes) {
    if (node.kind !== "symbol") continue;
    const rel = node.id.startsWith("symbol:") ? node.id.slice("symbol:".length).split("#")[0] : node.path;
    if (rel && changedRels.has(rel)) changedIds.add(node.id);
  }

  // Reverse adjacency capturing the edge evidence that links importer -> target.
  const reverseAdj = new Map<string, Array<{ from: string; evidence: string[] }>>();
  for (const edge of existing.edges) {
    if (!reverseAdj.has(edge.to)) reverseAdj.set(edge.to, []);
    reverseAdj.get(edge.to)!.push({ from: edge.from, evidence: edge.evidence });
  }

  const direct = new Set<string>();
  const indirect = new Set<string>();
  const unknowns: string[] = [];
  const visited = new Set<string>(changedIds);
  // Evidence from the edge that first surfaced each impacted node.
  const linkEvidence = new Map<string, string[]>();

  for (const id of changedIds) {
    for (const { from, evidence } of reverseAdj.get(id) ?? []) {
      if (!visited.has(from)) {
        direct.add(from);
        visited.add(from);
        linkEvidence.set(from, evidence);
      }
    }
    if (!nodeById.has(id)) unknowns.push(`no graph node for ${id}`);
  }

  const queue = [...direct];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { from, evidence } of reverseAdj.get(current) ?? []) {
      if (!visited.has(from)) {
        indirect.add(from);
        visited.add(from);
        linkEvidence.set(from, evidence);
        queue.push(from);
      }
    }
  }

  // Build detail records + derived signals.
  const details: ImpactDetail[] = [];
  const testsToRun = new Set<string>();
  const riskNotes: string[] = [];

  const toDetail = (id: string, hop: "direct" | "indirect"): ImpactDetail => {
    const node = nodeById.get(id);
    const churn = typeof node?.metadata.churn === "number" ? (node.metadata.churn as number) : undefined;
    const isTest = node?.metadata.isTest === true;
    const detail: ImpactDetail = {
      id,
      kind: node?.kind ?? "unknown",
      label: node?.label ?? id,
      evidence: linkEvidence.get(id) ?? node?.evidence ?? [],
      hop,
      ...(churn !== undefined ? { churn } : {}),
      ...(isTest ? { isTest: true } : {}),
    };
    if (isTest) {
      const file = node?.path ?? node?.evidence[0]?.split(":")[0];
      if (file) testsToRun.add(file);
    }
    if (churn !== undefined && churn >= CHURN_RISK_THRESHOLD) {
      riskNotes.push(`${node?.label ?? id} is a high-churn file (${churn} changes in 90d) — review carefully.`);
    }
    return detail;
  };

  for (const id of direct) details.push(toDetail(id, "direct"));
  for (const id of indirect) details.push(toDetail(id, "indirect"));

  return {
    direct: [...direct],
    indirect: [...indirect],
    details,
    testsToRun: [...testsToRun],
    riskNotes,
    unknowns: [...unknowns, ...existing.unknowns.slice(0, 5)],
  };
}

// ---------------------------------------------------------------------------
// Symbol queries
// ---------------------------------------------------------------------------

export interface SymbolMatch {
  id: string;
  label: string;
  kind: string;
  symbolKind?: string;
  path?: string;
  evidence: string[];
}

// Match symbol nodes by exact label, bare method name, then case-insensitive.
export async function findSymbol(root: string, name: string): Promise<SymbolMatch[]> {
  const existing = await loadExistingGraph(graphFilePath(root));
  if (!existing) return [];
  const symbols = existing.nodes.filter((n) => n.kind === "symbol");

  const exact = symbols.filter((n) => n.label === name || n.label.split(".").pop() === name);
  const pool = exact.length > 0
    ? exact
    : symbols.filter((n) => n.label.toLowerCase() === name.toLowerCase() || n.label.split(".").pop()?.toLowerCase() === name.toLowerCase());

  return pool.map((n) => ({
    id: n.id,
    label: n.label,
    kind: n.kind,
    symbolKind: typeof n.metadata.symbolKind === "string" ? (n.metadata.symbolKind as string) : undefined,
    path: n.path,
    evidence: n.evidence,
  }));
}

export interface CallerInfo {
  id: string;
  label: string;
  kind: string;
  confidence: string;
  evidence: string[];
  path?: string;
}

export interface WhoCallsResult {
  target: string;
  matched: SymbolMatch[];
  callers: CallerInfo[];
  unresolved?: string;
}

// Who calls the symbol(s) named `name`. Reverse-walks `calls` edges into the
// matched symbols. With { transitive }, keeps walking to indirect callers.
export async function whoCalls(root: string, name: string, options: { transitive?: boolean } = {}): Promise<WhoCallsResult> {
  const existing = await loadExistingGraph(graphFilePath(root));
  if (!existing) return { target: name, matched: [], callers: [], unresolved: "no graph found" };

  const matched = await findSymbol(root, name);
  if (matched.length === 0) return { target: name, matched: [], callers: [], unresolved: `no symbol named "${name}" in graph` };

  const nodeById = new Map<string, GraphNode>(existing.nodes.map((n) => [n.id, n]));

  // Reverse index of `calls` edges: callee -> [caller edge].
  const callersOf = new Map<string, Array<{ from: string; confidence: string; evidence: string[] }>>();
  for (const edge of existing.edges) {
    if (edge.relation !== "calls") continue;
    if (!callersOf.has(edge.to)) callersOf.set(edge.to, []);
    callersOf.get(edge.to)!.push({ from: edge.from, confidence: edge.confidence, evidence: edge.evidence });
  }

  const seen = new Set<string>();
  const callers: CallerInfo[] = [];
  const queue: string[] = matched.map((m) => m.id);
  const targets = new Set(queue);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const c of callersOf.get(cur) ?? []) {
      if (targets.has(c.from) || seen.has(c.from)) continue;
      seen.add(c.from);
      const node = nodeById.get(c.from);
      callers.push({
        id: c.from,
        label: node?.label ?? c.from,
        kind: node?.kind ?? "unknown",
        confidence: c.confidence,
        evidence: c.evidence,
        path: node?.path,
      });
      if (options.transitive) queue.push(c.from);
    }
  }

  return { target: name, matched, callers };
}
