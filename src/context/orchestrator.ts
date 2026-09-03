import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadClaims, verifyClaims } from "../claims/index.js";
import { checkEvidenceHashes } from "../evidence/index.js";
import { analyzeImpact, ensureFreshGraph, loadExistingGraph } from "../graph/index.js";
import type { DependencyGraph, GraphEdge } from "../graph/schema.js";
import { ProjectFilePolicy } from "../project-files/index.js";
import { readProviderManifest } from "../providers/manager.js";
import { searchCodeContext, type RetrievedCodeChunk } from "../providers/cce.js";
import { inspectProjectProviderRuns } from "../providers/project-status.js";
import type { ProcessRunner } from "../process/index.js";
import { estimateTokens } from "../token-optimizer.js";
import { verifyKnowledge } from "../verify/index.js";

export type TaskKind = "simple" | "bug" | "feature" | "api-change" | "database-change" | "architecture-change" | "security-change";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type KnowledgeTrust = "healthy" | "degraded" | "unverifiable" | "empty";

export interface ContextPackV2Request {
  task: string;
  files?: string[];
  budget?: number;
}

export interface TaskClassification {
  kind: TaskKind;
  risk: RiskLevel;
  domains: string[];
  modes: string[];
  route: Array<"ei-knowledge" | "ei-graph" | "cce" | "native-retrieval" | "security-gates" | "api-gates" | "migration-gates" | "design-first">;
}

export interface KnowledgeContextItem {
  path: string;
  title: string;
  excerpt: string;
  trust: "verified" | "recorded";
}

export interface ArchitectureContextNode {
  id: string;
  kind: string;
  label: string;
  path?: string;
  confidence: string;
  trustState: string;
}

export interface ArchitectureContextEdge {
  from: string;
  to: string;
  relation: string;
  confidence: string;
  trustState: string;
  evidence: string[];
}

export interface ContextPackV2 {
  schemaVersion: 2;
  generatedAt: string;
  task: string;
  classification: TaskClassification;
  knowledge: {
    trust: KnowledgeTrust;
    citationDrift: number;
    staleEvidence: number;
    documents: KnowledgeContextItem[];
    decisions: KnowledgeContextItem[];
    constraints: string[];
  };
  architecture: {
    seeds: string[];
    nodes: ArchitectureContextNode[];
    edges: ArchitectureContextEdge[];
    approvedScope: string[];
  };
  code: {
    primary: RetrievedCodeChunk[];
    secondary: RetrievedCodeChunk[];
    tests: RetrievedCodeChunk[];
  };
  evidence: Array<{ path: string; lines: [number, number]; hash: string; provider: string; current: true }>;
  claims: Array<{ id: string; statement: string; evidence: string[] }>;
  conflicts: string[];
  unknowns: string[];
  risk: { level: RiskLevel; requiredGates: string[]; testsToRun: string[] };
  tokenAllocation: { budget: number; knowledge: number; architecture: number; code: number; reserve: number; used: number };
  overallConfidence: number;
  stopReason: string;
  providers: {
    graphify: { version?: string; health: string; fallback: boolean };
    cce: { version?: string; health: string; fallback: boolean };
  };
  markdown: string;
}

function words(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9_]+/g) ?? [])].filter((word) => word.length > 2);
}

function classify(task: string, files: string[]): TaskClassification {
  const text = `${task} ${files.join(" ")}`.toLowerCase();
  const security = /auth|security|credential|secret|token|encrypt|permission|rate.?limit|vulnerab/.test(text);
  const database = /database|migration|schema|sql|table|column|index/.test(text);
  const api = /\bapi\b|endpoint|route|controller|contract|graphql|openapi/.test(text);
  const architecture = /architecture|cross.?service|new service|replatform|redesign|monorepo/.test(text);
  const bug = /\bbug\b|\bfix\b|broken|failure|incorrect|regression|exception/.test(text);
  const simple = /typo|spelling|comment|rename label/.test(text) && files.length <= 1;
  const kind: TaskKind = security ? "security-change" : database ? "database-change" : api ? "api-change" : architecture ? "architecture-change" : simple ? "simple" : bug ? "bug" : "feature";
  const risk: RiskLevel = security ? "critical" : database || api || architecture ? "high" : simple ? "low" : "medium";
  const domains = [security && "security", database && "database", api && "api", architecture && "architecture"].filter((value): value is string => Boolean(value));
  if (domains.length === 0) domains.push("application");
  const modes = ["standard", security && "adversarial", architecture && "design-first"].filter((value): value is string => Boolean(value));
  const route: TaskClassification["route"] = ["ei-knowledge", "ei-graph", "cce", "native-retrieval"];
  if (security) route.push("security-gates");
  if (api) route.push("api-gates");
  if (database) route.push("migration-gates");
  if (architecture) route.push("design-first");
  return { kind, risk, domains, modes, route };
}

function dynamicBudget(classification: TaskClassification): number {
  if (classification.risk === "critical") return 15_000;
  if (classification.kind === "architecture-change") return 15_000;
  if (classification.risk === "high") return 10_000;
  if (classification.risk === "low") return 2_000;
  return 6_000;
}

async function walkMarkdown(directory: string): Promise<string[]> {
  const output: string[] = [];
  const visit = async (current: string): Promise<void> => {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md")) output.push(absolute);
    }
  };
  await visit(directory);
  return output.sort();
}

function relevance(text: string, taskWords: string[]): number {
  const lower = text.toLowerCase();
  return taskWords.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
}

function excerpt(markdown: string, maxLines = 28): string {
  return markdown.split("\n").filter((line) => line.trim()).slice(0, maxLines).join("\n");
}

async function loadKnowledge(root: string, task: string) {
  const [verification, evidence] = await Promise.all([verifyKnowledge(root), checkEvidenceHashes(root)]);
  const files = await walkMarkdown(path.join(root, ".engineering-intelligence", "knowledge-base"));
  const taskWords = words(task);
  const brokenDocs = new Set(verification.details.map((detail) => detail.file.replace(/\\/g, "/")));
  const documents: KnowledgeContextItem[] = [];
  // A document is promoted to verified context only when the repository has a
  // citation snapshot and no material line drift. In degraded states the file
  // remains canonical storage, but source retrieval wins for this request.
  if (evidence.checked > 0 && evidence.stale === 0) {
    const ranked: Array<KnowledgeContextItem & { score: number }> = [];
    for (const absolute of files) {
      const relative = path.relative(root, absolute).replace(/\\/g, "/");
      if (brokenDocs.has(relative)) continue;
      let content: string;
      try { content = await readFile(absolute, "utf8"); } catch { continue; }
      const score = relevance(`${relative}\n${content}`, taskWords);
      if (taskWords.length > 0 && score === 0) continue;
      ranked.push({ path: relative, title: content.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(relative), excerpt: excerpt(content), trust: "verified", score });
    }
    ranked.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    documents.push(...ranked.slice(0, 5).map(({ score: _score, ...item }) => item));
  }
  const decisionFiles = [
    ...(await walkMarkdown(path.join(root, ".engineering-intelligence", "aidlc", "decisions"))),
    ...(await walkMarkdown(path.join(root, ".engineering-intelligence", "knowledge-base", "decisions"))),
  ];
  const decisions: KnowledgeContextItem[] = [];
  for (const absolute of decisionFiles.slice(0, 10)) {
    let content: string;
    try { content = await readFile(absolute, "utf8"); } catch { continue; }
    if (taskWords.length > 0 && relevance(`${absolute}\n${content}`, taskWords) === 0) continue;
    decisions.push({ path: path.relative(root, absolute).replace(/\\/g, "/"), title: content.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(absolute), excerpt: excerpt(content, 16), trust: "recorded" });
  }
  const trust: KnowledgeTrust = files.length === 0 ? "empty" : verification.drift > 0 || evidence.stale > 0 ? "degraded" : evidence.checked === 0 ? "unverifiable" : "healthy";
  return { trust, citationDrift: verification.drift, staleEvidence: evidence.stale, documents, decisions };
}

function safeTrust(metadata: Record<string, unknown>): string {
  return typeof metadata.trustState === "string" ? metadata.trustState : "fresh";
}

function usableEdge(edge: GraphEdge): boolean {
  const trust = safeTrust(edge.metadata);
  return trust === "fresh";
}

function selectSeeds(graph: DependencyGraph | null, root: string, task: string, requestedFiles: string[]): string[] {
  if (!graph) return [];
  const direct = requestedFiles.flatMap((file) => {
    const relative = path.relative(root, path.resolve(root, file)).replace(/\\/g, "/");
    return graph.nodes.filter((node) => node.path === relative || node.evidence.some((item) => item.split(":")[0] === relative)).map((node) => node.id);
  });
  if (direct.length > 0) return [...new Set(direct)];
  const taskWords = words(task);
  return graph.nodes
    .map((node) => ({ id: node.id, score: relevance(`${node.id} ${node.label} ${node.path ?? ""}`, taskWords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 8)
    .map((item) => item.id);
}

interface ArchitectureNeighborhoodResult {
  seeds: string[];
  nodes: ArchitectureContextNode[];
  edges: ArchitectureContextEdge[];
  approvedScope: string[];
  graph: DependencyGraph | null;
}

async function architectureNeighborhood(root: string, task: string, requestedFiles: string[]): Promise<ArchitectureNeighborhoodResult> {
  await ensureFreshGraph(root);
  const graph = await loadExistingGraph(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"));
  if (!graph) return { seeds: [], nodes: [], edges: [], approvedScope: [], graph: null as DependencyGraph | null };
  const seeds = selectSeeds(graph, root, task, requestedFiles);
  const selected = new Set(seeds);
  const seedSet = new Set(seeds);
  for (const edge of graph.edges) {
    if (!usableEdge(edge)) continue;
    if (seedSet.has(edge.from) || seedSet.has(edge.to)) {
      selected.add(edge.from);
      selected.add(edge.to);
    }
  }
  const edges = graph.edges.filter((edge) => usableEdge(edge) && selected.has(edge.from) && selected.has(edge.to));
  const nodes = graph.nodes.filter((node) => selected.has(node.id) && safeTrust(node.metadata) === "fresh");
  const policy = await ProjectFilePolicy.load(root);
  const requestedApproved: string[] = [];
  for (const file of requestedFiles) {
    const decision = await policy.explainExisting(file);
    if (decision.included) requestedApproved.push(decision.path);
  }
  const approvedScope = [...new Set([...requestedApproved, ...nodes.map((node) => node.path).filter((value): value is string => Boolean(value))])];
  return {
    seeds,
    nodes: nodes.map((node) => ({ id: node.id, kind: node.kind, label: node.label, path: node.path, confidence: node.confidence, trustState: safeTrust(node.metadata) })),
    edges: edges.map((edge) => ({ from: edge.from, to: edge.to, relation: edge.relation, confidence: edge.confidence, trustState: safeTrust(edge.metadata), evidence: edge.evidence })),
    approvedScope,
    graph,
  };
}

function chunkTokens(chunks: RetrievedCodeChunk[]): number {
  return chunks.reduce((total, chunk) => total + estimateTokens(`${chunk.path}:${chunk.startLine}-${chunk.endLine}\n${chunk.content}`), 0);
}

function dedupeChunks(chunks: RetrievedCodeChunk[]): RetrievedCodeChunk[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const key = `${chunk.path}:${chunk.startLine}-${chunk.endLine}:${chunk.contentHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function trimChunks(chunks: RetrievedCodeChunk[], budget: number): RetrievedCodeChunk[] {
  const kept: RetrievedCodeChunk[] = [];
  let used = 0;
  for (const chunk of chunks) {
    const cost = estimateTokens(`${chunk.path}:${chunk.startLine}-${chunk.endLine}\n${chunk.content}`);
    if (used + cost > budget) continue;
    kept.push(chunk);
    used += cost;
  }
  return kept;
}

function trimKnowledge(items: KnowledgeContextItem[], budget: number): KnowledgeContextItem[] {
  const kept: KnowledgeContextItem[] = [];
  let used = 0;
  for (const item of items) {
    const cost = estimateTokens(JSON.stringify(item));
    if (used + cost > budget) continue;
    kept.push(item);
    used += cost;
  }
  return kept;
}

function trimArchitecture(
  nodes: ArchitectureContextNode[],
  edges: ArchitectureContextEdge[],
  seeds: string[],
  budget: number,
): { nodes: ArchitectureContextNode[]; edges: ArchitectureContextEdge[] } {
  const seedSet = new Set(seeds);
  const orderedNodes = [...nodes].sort((a, b) => Number(seedSet.has(b.id)) - Number(seedSet.has(a.id)) || a.id.localeCompare(b.id));
  const keptNodes: ArchitectureContextNode[] = [];
  let used = 0;
  for (const node of orderedNodes) {
    const cost = estimateTokens(JSON.stringify(node));
    if (used + cost > budget) continue;
    keptNodes.push(node);
    used += cost;
  }
  const ids = new Set(keptNodes.map((node) => node.id));
  const keptEdges: ArchitectureContextEdge[] = [];
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    const cost = estimateTokens(JSON.stringify(edge));
    if (used + cost > budget) continue;
    keptEdges.push(edge);
    used += cost;
  }
  return { nodes: keptNodes, edges: keptEdges };
}

function renderMarkdown(pack: Omit<ContextPackV2, "markdown">): string {
  const lines = [`# Engineering context: ${pack.task}`, "", `Route: ${pack.classification.kind}; risk ${pack.classification.risk}; confidence ${pack.overallConfidence.toFixed(2)}.`, `Knowledge trust: ${pack.knowledge.trust}. Retrieval: ${pack.providers.cce.fallback ? "EI native fallback" : "CCE"}.`, ""];
  if (pack.knowledge.documents.length > 0) {
    lines.push("## Verified EI knowledge");
    for (const item of pack.knowledge.documents) lines.push(`- ${item.title} (${item.path})`);
    lines.push("");
  }
  if (pack.architecture.nodes.length > 0) {
    lines.push("## Architecture neighborhood");
    for (const node of pack.architecture.nodes.slice(0, 30)) lines.push(`- ${node.id}${node.path ? ` (${node.path})` : ""} [${node.trustState}]`);
    lines.push("");
  }
  const allChunks = [...pack.code.primary, ...pack.code.secondary, ...pack.code.tests];
  if (allChunks.length > 0) {
    lines.push("## Current source evidence");
    for (const chunk of allChunks) lines.push(`- ${chunk.path}:${chunk.startLine}-${chunk.endLine} [${chunk.provider}, ${chunk.contentHash.slice(0, 12)}]`);
    lines.push("");
  }
  if (pack.claims.length > 0) {
    lines.push("## Verified claims");
    for (const claim of pack.claims.slice(0, 30)) lines.push(`- ${claim.id}: ${claim.statement}`);
    lines.push("");
  }
  if (pack.conflicts.length > 0) lines.push("## Conflicts", ...pack.conflicts.map((item) => `- ${item}`), "");
  if (pack.unknowns.length > 0) lines.push("## Unknowns", ...pack.unknowns.map((item) => `- ${item}`), "");
  lines.push("## Required validation", `- Gates: ${pack.risk.requiredGates.join(", ") || "project defaults"}`, `- Tests: ${pack.risk.testsToRun.join(", ") || "targeted tests must be identified"}`, "", `Stop: ${pack.stopReason}`);
  return lines.join("\n");
}

export async function getEngineeringContext(
  root: string,
  request: ContextPackV2Request,
  options: { runner?: ProcessRunner; providerHome?: string } = {},
): Promise<ContextPackV2> {
  if (!request.task.trim()) throw new Error("task is required");
  const requestedFiles = request.files ?? [];
  const classification = classify(request.task, requestedFiles);
  const budget = request.budget && request.budget > 0 ? request.budget : dynamicBudget(classification);
  // Establish one current structural snapshot before claims and neighborhood
  // reads begin; otherwise concurrent derivation can race a graph refresh.
  await ensureFreshGraph(root);
  const [knowledge, architecture, claimStore, claimReport, providerManifest, providerRuns] = await Promise.all([
    loadKnowledge(root, request.task),
    architectureNeighborhood(root, request.task, requestedFiles),
    loadClaims(root),
    verifyClaims(root),
    readProviderManifest(root),
    inspectProjectProviderRuns(root),
  ]);
  let approvedScope = architecture.approvedScope;
  if (approvedScope.length === 0) {
    const policy = await ProjectFilePolicy.load(root);
    approvedScope = policy.configuredRoots();
  }
  const fullApprovedScope = approvedScope;
  const codeBudget = Math.max(0, Math.floor(budget * 0.55));
  let retrieval = await searchCodeContext(root, request.task, approvedScope, { topK: 5, runner: options.runner, providerHome: options.providerHome });
  const testsInitially = retrieval.chunks.filter((chunk) => /(?:^|\/)(?:test|tests|__tests__)(?:\/|\b)|\.(?:test|spec)\./i.test(chunk.path));
  const preliminary = Math.min(1, (architecture.nodes.length > 0 ? 0.25 : 0) + (retrieval.chunks.length > 0 ? 0.35 : 0) + (testsInitially.length > 0 ? 0.15 : 0) + (knowledge.trust === "healthy" ? 0.15 : 0));
  if (preliminary < 0.85 && retrieval.chunks.length >= 5 && codeBudget > chunkTokens(retrieval.chunks)) {
    const expanded = await searchCodeContext(root, request.task, approvedScope, { topK: 10, runner: options.runner, providerHome: options.providerHome });
    retrieval = { ...expanded, chunks: dedupeChunks([...retrieval.chunks, ...expanded.chunks]) };
  }
  const trimmed = trimChunks(retrieval.chunks, codeBudget);
  const requestedSet = new Set(requestedFiles.map((file) => path.relative(root, path.resolve(root, file)).replace(/\\/g, "/")));
  const tests = trimmed.filter((chunk) => /(?:^|\/)(?:test|tests|__tests__)(?:\/|\b)|\.(?:test|spec)\./i.test(chunk.path));
  const primary = trimmed.filter((chunk) => !tests.includes(chunk) && (requestedSet.has(chunk.path) || architecture.seeds.some((id) => architecture.graph?.nodes.find((node) => node.id === id)?.path === chunk.path)));
  const secondary = trimmed.filter((chunk) => !tests.includes(chunk) && !primary.includes(chunk));

  const relevantPaths = new Set([...approvedScope, ...trimmed.map((chunk) => chunk.path)]);
  const claims = claimReport.results.flatMap((result) => {
    if (result.status !== "verified") return [];
    const claim = claimStore.claims.find((candidate) => candidate.id === result.id);
    if (!claim || !claim.evidence.some((item) => relevantPaths.has(item.path))) return [];
    return [{ id: result.id, statement: result.statement, evidence: claim.evidence.map((item) => item.lines ? `${item.path}:${item.lines[0]}-${item.lines[1]}` : item.path) }];
  });
  const conflicts = [
    ...claimReport.results.filter((result) => ["refuted", "stale", "missing"].includes(result.status)).map((result) => `${result.id} is ${result.status}: ${result.statement}`),
    ...architecture.edges.filter((edge) => edge.trustState === "contested").map((edge) => `Contested ${edge.relation}: ${edge.from} -> ${edge.to}`),
  ];
  const graphUnknowns = architecture.graph?.unknowns ?? [];
  const unknowns = [
    ...(knowledge.trust === "degraded" ? [`EI knowledge has ${knowledge.citationDrift} missing reference(s) and ${knowledge.staleEvidence} stale citation(s); affected prose was not loaded.`] : []),
    ...(knowledge.trust === "unverifiable" ? ["EI knowledge has no recorded citation snapshot; prose was not promoted as verified context."] : []),
    ...graphUnknowns.slice(0, 20),
    ...(retrieval.staleRejected > 0 ? [`CCE returned ${retrieval.staleRejected} stale span(s), which were rejected.`] : []),
    ...(retrieval.scopeRejected > 0 ? [`CCE returned ${retrieval.scopeRejected} out-of-scope span(s), which were rejected.`] : []),
  ];
  const impact = requestedFiles.length > 0 ? await analyzeImpact(root, requestedFiles) : undefined;
  const requiredGates = [
    classification.kind === "security-change" && "security review",
    classification.kind === "api-change" && "api-diff",
    classification.kind === "database-change" && "migration-lint",
    "type-check",
    "targeted tests",
  ].filter((value): value is string => Boolean(value));
  const testsToRun = [...new Set([...(impact?.testsToRun ?? []), ...tests.map((chunk) => chunk.path)])];
  const confidence = Math.min(1,
    (architecture.nodes.length > 0 ? 0.25 : 0) +
    (trimmed.length > 0 ? 0.30 : 0) +
    (testsToRun.length > 0 ? 0.15 : 0) +
    (claims.length > 0 ? 0.15 : 0) +
    (knowledge.trust === "healthy" ? 0.15 : knowledge.trust === "empty" ? 0.05 : 0),
  );
  const stopConditions = [architecture.nodes.length > 0, trimmed.length > 0, testsToRun.length > 0, conflicts.length === 0];
  const stopReason = stopConditions.every(Boolean) && confidence >= 0.85
    ? "Required components, current implementation evidence, dependency paths, and tests were resolved above the confidence threshold."
    : `Stopped at the token/scope boundary with confidence ${confidence.toFixed(2)}; unresolved items are explicit and must be checked before implementation.`;
  const statuses = providerManifest?.providers ?? [];
  const graphify = statuses.find((status) => status.name === "graphify");
  const cce = statuses.find((status) => status.name === "cce");
  const graphifyRun = providerRuns.find((status) => status.name === "graphify");
  const knowledgeBudget = Math.max(0, Math.floor(budget * 0.15));
  knowledge.documents = trimKnowledge(knowledge.documents, Math.floor(knowledgeBudget * 0.75));
  knowledge.decisions = trimKnowledge(knowledge.decisions, Math.floor(knowledgeBudget * 0.25));
  const visibleArchitecture = trimArchitecture(architecture.nodes, architecture.edges, architecture.seeds, Math.max(0, Math.floor(budget * 0.20)));
  architecture.nodes = visibleArchitecture.nodes;
  architecture.edges = visibleArchitecture.edges;
  architecture.approvedScope = fullApprovedScope.filter((scope) => architecture.nodes.some((node) => node.path === scope) || requestedSet.has(scope)).slice(0, 50);
  const knowledgeTokens = knowledge.documents.reduce((total, item) => total + estimateTokens(item.excerpt), 0);
  const architectureTokens = estimateTokens(JSON.stringify({ nodes: architecture.nodes, edges: architecture.edges }));
  const codeTokens = chunkTokens(trimmed);
  const base: Omit<ContextPackV2, "markdown"> = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    task: request.task,
    classification,
    knowledge: { ...knowledge, constraints: knowledge.decisions.map((decision) => decision.title) },
    architecture: { seeds: architecture.seeds, nodes: architecture.nodes, edges: architecture.edges, approvedScope },
    code: { primary, secondary, tests },
    evidence: trimmed.map((chunk) => ({ path: chunk.path, lines: [chunk.startLine, chunk.endLine], hash: chunk.contentHash, provider: chunk.provider, current: true })),
    claims,
    conflicts,
    unknowns: [...new Set(unknowns)],
    risk: { level: classification.risk, requiredGates, testsToRun },
    tokenAllocation: { budget, knowledge: knowledgeTokens, architecture: architectureTokens, code: codeTokens, reserve: Math.max(0, budget - knowledgeTokens - architectureTokens - codeTokens), used: knowledgeTokens + architectureTokens + codeTokens },
    overallConfidence: confidence,
    stopReason,
    providers: {
      graphify: {
        version: graphify?.detectedVersion ?? graphify?.requiredVersion,
        health: graphify?.health === "healthy" && graphifyRun?.health === "current" ? "healthy" : graphifyRun?.health ?? graphify?.health ?? "unrecorded",
        fallback: !graphify || graphify.health !== "healthy" || graphifyRun?.fallback !== false,
      },
      cce: { version: cce?.detectedVersion ?? cce?.requiredVersion, health: retrieval.providerHealth, fallback: retrieval.fallbackUsed },
    },
  };
  return { ...base, markdown: renderMarkdown(base) };
}
