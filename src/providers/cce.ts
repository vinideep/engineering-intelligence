import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectProjectFiles, ProjectFilePolicy } from "../project-files/index.js";
import { runProcess, type ProcessRunner } from "../process/index.js";
import { PROVIDER_COMPATIBILITY } from "./compatibility.js";
import { defaultProviderHome, providerStatus } from "./manager.js";
import { computeProviderSourceSnapshot, PROVIDER_DIR, syncProviderWorkspace } from "./workspace.js";
import type { ProviderStatus } from "./types.js";

export const CCE_DIR = `${PROVIDER_DIR}/cce`;
export const CCE_RUN_PATH = `${CCE_DIR}/run.json`;
const CCE_PROJECT = `${CCE_DIR}/project`;
const CCE_INITIALIZED = `${CCE_DIR}/initialized.json`;
const SEARCHABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".rb", ".java", ".kt", ".sql", ".graphql", ".proto", ".json", ".yaml", ".yml", ".toml"]);

export interface CceRunManifest {
  schemaVersion: 1;
  provider: "cce";
  providerVersion: string;
  generatedAt: string;
  workspaceHash: string;
  sourceHashes: Record<string, string>;
  indexedPath: string;
  storagePath: string;
}

export interface CceIndexResult {
  ok: boolean;
  degraded: boolean;
  status: ProviderStatus;
  workspaceHash?: string;
  manifestPath?: string;
  message: string;
}

export interface RetrievedCodeChunk {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  contentHash: string;
  score: number;
  provider: "cce" | "native";
  current: true;
}

export interface CodeRetrievalResult {
  chunks: RetrievedCodeChunk[];
  provider: "cce" | "native";
  providerHealth: ProviderStatus["health"];
  fallbackUsed: boolean;
  staleRejected: number;
  scopeRejected: number;
  message: string;
}

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function writeAtomic(location: string, value: unknown): Promise<void> {
  const temporary = `${location}.tmp-${randomUUID()}`;
  await mkdir(path.dirname(location), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, location);
}

async function writeTextAtomic(location: string, value: string): Promise<void> {
  const temporary = `${location}.tmp-${randomUUID()}`;
  await mkdir(path.dirname(location), { recursive: true });
  await writeFile(temporary, value, "utf8");
  await rename(temporary, location);
}

async function readJson<T>(location: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(location, "utf8")) as T; } catch { return undefined; }
}

async function sourceHashes(manifestPath: string): Promise<Record<string, string>> {
  const manifest = await readJson<{ files?: Array<{ path: string; hash: string }> }>(manifestPath);
  return Object.fromEntries((manifest?.files ?? []).map((file) => [file.path.replace(/\\/g, "/"), file.hash]));
}

/**
 * Initialize and index CCE in an EI-owned disposable project. `cce init` is
 * intentionally never run in the user's repository because upstream may add
 * hooks, MCP configuration, or agent instructions.
 */
export async function runCceIndex(
  root: string,
  options: { runner?: ProcessRunner; providerHome?: string } = {},
): Promise<CceIndexResult> {
  const runner = options.runner ?? runProcess;
  const status = await providerStatus("cce", { runner, providerHome: options.providerHome });
  if (status.health !== "healthy" || !status.executable) {
    return { ok: false, degraded: true, status, message: `${status.message} EI native scoped retrieval remains active.` };
  }
  const project = path.join(root, CCE_PROJECT);
  const workspace = await syncProviderWorkspace(root, `${CCE_PROJECT}/workspace`);
  await mkdir(project, { recursive: true });
  const storagePath = path.join(project, "storage");
  const modelCache = path.join(options.providerHome ?? defaultProviderHome(), "cce", "models");
  await mkdir(modelCache, { recursive: true });
  await writeTextAtomic(path.join(project, ".context-engine.yaml"), [
    "storage:",
    `  path: ${JSON.stringify(storagePath)}`,
    "embedding:",
    '  model: "BAAI/bge-small-en-v1.5"',
    "indexer:",
    "  watch: false",
    "  redact_secrets: true",
    "memory:",
    "  redact_pii: true",
    "",
  ].join("\n"));
  const cceEnv = { ...process.env, CI: "1", NO_COLOR: "1", CCE_EMBED_BACKEND: "fastembed", CCE_FASTEMBED_CACHE_PATH: modelCache };
  // Do not call `cce init`: upstream initialization installs its own hooks,
  // instructions, and MCP registration. EI needs only the local index, so it
  // invokes the indexer directly against a nested EI-owned mirror.
  const index = await runner({ command: status.executable, args: ["index", "--full", "--path", workspace.path], cwd: project, env: cceEnv, timeoutMs: 15 * 60_000, maxBuffer: 20 * 1024 * 1024 });
  if (index.exitCode !== 0) {
    return { ok: false, degraded: true, status: { ...status, health: "error", message: `CCE indexing failed: ${(index.stderr || index.error || "unknown error").trim().slice(-1000)}` }, workspaceHash: workspace.workspaceHash, message: "CCE index was not refreshed; EI native scoped retrieval remains active." };
  }
  await writeAtomic(path.join(root, CCE_INITIALIZED), { providerVersion: PROVIDER_COMPATIBILITY.cce.version, initializedAt: new Date().toISOString(), mode: "index-only" });
  const manifest: CceRunManifest = {
    schemaVersion: 1,
    provider: "cce",
    providerVersion: PROVIDER_COMPATIBILITY.cce.version,
    generatedAt: new Date().toISOString(),
    workspaceHash: workspace.workspaceHash,
    sourceHashes: await sourceHashes(workspace.manifestPath),
    indexedPath: workspace.path,
    storagePath,
  };
  await writeAtomic(path.join(root, CCE_RUN_PATH), manifest);
  return { ok: true, degraded: false, status, workspaceHash: workspace.workspaceHash, manifestPath: CCE_RUN_PATH, message: "CCE local retrieval index is current for EI's approved source universe." };
}

function normalizeCandidatePath(root: string, workspace: string, cceProject: string, raw: string): string | undefined {
  let value = raw.trim().replace(/^`|`$/g, "").replace(/\\/g, "/");
  if (!path.isAbsolute(value)) {
    value = value.replace(/^\.\//, "");
    if (value.startsWith("../workspace/")) return value.slice("../workspace/".length);
    if (value.startsWith("workspace/")) return value.slice("workspace/".length);
    // CCE reports ordinary hits relative to the indexed directory, even though
    // its process cwd is the isolated EI provider project.
    if (!value.startsWith("../")) return value;
  }
  let absolute: string;
  if (path.isAbsolute(value)) absolute = path.resolve(value);
  else absolute = path.resolve(cceProject, value);
  const normalizedWorkspace = path.resolve(workspace);
  const normalizedRoot = path.resolve(root);
  if (absolute === normalizedWorkspace || absolute.startsWith(`${normalizedWorkspace}${path.sep}`)) {
    return path.relative(normalizedWorkspace, absolute).replace(/\\/g, "/");
  }
  if (absolute === normalizedRoot || absolute.startsWith(`${normalizedRoot}${path.sep}`)) {
    const relative = path.relative(normalizedRoot, absolute).replace(/\\/g, "/");
    const workspacePrefix = `${PROVIDER_DIR}/workspace/`;
    return relative.startsWith(workspacePrefix) ? relative.slice(workspacePrefix.length) : relative;
  }
  // CCE may print paths relative to the indexed directory rather than cwd.
  return undefined;
}

export interface ParsedCceHit { path: string; startLine: number; endLine: number; score?: number }

export function parseCceSearchOutput(output: string): ParsedCceHit[] {
  const trimmed = output.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as { results?: unknown }).results) ? (parsed as { results: unknown[] }).results : [];
    return items.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const file = typeof item.path === "string" ? item.path : typeof item.file === "string" ? item.file : undefined;
      const start = typeof item.startLine === "number" ? item.startLine : typeof item.start_line === "number" ? item.start_line : 1;
      const end = typeof item.endLine === "number" ? item.endLine : typeof item.end_line === "number" ? item.end_line : start;
      return file ? [{ path: file, startLine: Math.max(1, start), endLine: Math.max(start, end), score: typeof item.score === "number" ? item.score : undefined }] : [];
    });
  } catch { /* human-readable CLI output */ }
  const hits: ParsedCceHit[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*\d+[.)]\s+(.+?):(\d+)(?:-(\d+))?(?:\s|$)/);
    if (!match) continue;
    const startLine = Number.parseInt(match[2], 10);
    const endLine = match[3] ? Number.parseInt(match[3], 10) : startLine;
    hits.push({ path: match[1], startLine, endLine });
  }
  return hits;
}

function inApprovedScope(relative: string, approvedPaths: string[]): boolean {
  if (approvedPaths.length === 0) return true;
  const normalized = relative.replace(/\\/g, "/");
  return approvedPaths.some((candidate) => {
    const scope = candidate.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
    return normalized === scope || normalized.startsWith(`${scope}/`);
  });
}

async function verifiedChunk(root: string, relative: string, startLine: number, endLine: number, provider: "cce" | "native", score: number): Promise<RetrievedCodeChunk | undefined> {
  try {
    const content = await readFile(path.join(root, relative), "utf8");
    const lines = content.split("\n");
    const start = Math.max(1, Math.min(startLine, lines.length));
    const end = Math.max(start, Math.min(endLine, lines.length, start + 199));
    const span = lines.slice(start - 1, end).join("\n");
    return { path: relative, startLine: start, endLine: end, content: span, contentHash: sha256(span), score, provider, current: true };
  } catch { return undefined; }
}

function queryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().match(/[a-z0-9_]+/g) ?? [])].filter((word) => word.length > 2);
}

export async function nativeScopedSearch(root: string, query: string, approvedPaths: string[], topK: number): Promise<RetrievedCodeChunk[]> {
  const policy = await ProjectFilePolicy.load(root);
  const terms = queryTerms(query);
  const candidates = await collectProjectFiles(policy, { accept: (relative) => SEARCHABLE_EXTENSIONS.has(path.extname(relative).toLowerCase()) && inApprovedScope(relative, approvedPaths) });
  const scored: Array<{ path: string; start: number; end: number; score: number }> = [];
  for (const absolute of candidates) {
    let content: string;
    try { content = await readFile(absolute, "utf8"); } catch { continue; }
    const relative = path.relative(root, absolute).replace(/\\/g, "/");
    const lines = content.split("\n");
    const pathScore = terms.reduce((score, term) => score + (relative.toLowerCase().includes(term) ? 3 : 0), 0);
    for (let index = 0; index < lines.length; index += 1) {
      const lower = lines[index].toLowerCase();
      const score = pathScore + terms.reduce((total, term) => total + (lower.includes(term) ? 2 : 0), 0);
      if (score > 0) scored.push({ path: relative, start: Math.max(1, index - 3), end: Math.min(lines.length, index + 5), score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.start - b.start);
  const selected: typeof scored = [];
  const perFile = new Map<string, number>();
  for (const item of scored) {
    if ((perFile.get(item.path) ?? 0) >= 2) continue;
    if (selected.some((prior) => prior.path === item.path && Math.abs(prior.start - item.start) < 8)) continue;
    selected.push(item);
    perFile.set(item.path, (perFile.get(item.path) ?? 0) + 1);
    if (selected.length >= topK) break;
  }
  const chunks = await Promise.all(selected.map((item) => verifiedChunk(root, item.path, item.start, item.end, "native", item.score)));
  return chunks.filter((chunk): chunk is RetrievedCodeChunk => Boolean(chunk));
}

export async function searchCodeContext(
  root: string,
  query: string,
  approvedPaths: string[],
  options: { topK?: number; runner?: ProcessRunner; providerHome?: string } = {},
): Promise<CodeRetrievalResult> {
  const topK = Math.max(1, Math.min(options.topK ?? 5, 50));
  const runner = options.runner ?? runProcess;
  const status = await providerStatus("cce", { runner, providerHome: options.providerHome });
  const manifest = await readJson<CceRunManifest>(path.join(root, CCE_RUN_PATH));
  const currentSnapshot = manifest ? await computeProviderSourceSnapshot(root) : undefined;
  const currentIndex = manifest?.provider === "cce" && manifest.providerVersion === PROVIDER_COMPATIBILITY.cce.version && manifest.workspaceHash === currentSnapshot?.workspaceHash;
  if (status.health !== "healthy" || !status.executable || !currentIndex) {
    const chunks = await nativeScopedSearch(root, query, approvedPaths, topK);
    return { chunks, provider: "native", providerHealth: status.health, fallbackUsed: true, staleRejected: 0, scopeRejected: 0, message: manifest ? "CCE index is stale, incompatible, or unavailable; native scoped retrieval used." : "CCE index is unavailable; native scoped retrieval used." };
  }
  const workspace = path.join(root, CCE_PROJECT, "workspace");
  const cceProject = path.join(root, CCE_PROJECT);
  const overfetch = Math.min(200, Math.max(topK * 4, 20));
  const modelCache = path.join(options.providerHome ?? defaultProviderHome(), "cce", "models");
  const result = await runner({ command: status.executable, args: ["search", query, "--top-k", String(overfetch)], cwd: cceProject, env: { ...process.env, CI: "1", NO_COLOR: "1", CCE_EMBED_BACKEND: "fastembed", CCE_FASTEMBED_CACHE_PATH: modelCache }, timeoutMs: 2 * 60_000, maxBuffer: 20 * 1024 * 1024 });
  if (result.exitCode !== 0) {
    const chunks = await nativeScopedSearch(root, query, approvedPaths, topK);
    return { chunks, provider: "native", providerHealth: "error", fallbackUsed: true, staleRejected: 0, scopeRejected: 0, message: `CCE search failed; native scoped retrieval used: ${(result.stderr || result.error || "unknown error").trim().slice(-500)}` };
  }
  const policy = await ProjectFilePolicy.load(root);
  const chunks: RetrievedCodeChunk[] = [];
  let staleRejected = 0;
  let scopeRejected = 0;
  const seen = new Set<string>();
  const hits = parseCceSearchOutput(result.stdout);
  for (let index = 0; index < hits.length && chunks.length < topK; index += 1) {
    const hit = hits[index];
    const relative = normalizeCandidatePath(root, workspace, cceProject, hit.path);
    if (!relative) { scopeRejected += 1; continue; }
    const decision = await policy.explainExisting(relative);
    if (!decision.included || !inApprovedScope(relative, approvedPaths)) { scopeRejected += 1; continue; }
    let current: Buffer;
    try { current = await readFile(path.join(root, relative)); } catch { staleRejected += 1; continue; }
    if (!manifest.sourceHashes[relative] || manifest.sourceHashes[relative] !== sha256(current)) { staleRejected += 1; continue; }
    const key = `${relative}:${hit.startLine}-${hit.endLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const chunk = await verifiedChunk(root, relative, hit.startLine, hit.endLine, "cce", hit.score ?? Math.max(0, 1 - index / Math.max(hits.length, 1)));
    if (chunk) chunks.push(chunk);
  }
  if (chunks.length === 0) {
    const fallback = await nativeScopedSearch(root, query, approvedPaths, topK);
    return { chunks: fallback, provider: "native", providerHealth: status.health, fallbackUsed: true, staleRejected, scopeRejected, message: "CCE returned no current in-scope spans; native scoped retrieval used." };
  }
  return { chunks, provider: "cce", providerHealth: status.health, fallbackUsed: false, staleRejected, scopeRejected, message: `CCE returned ${chunks.length} current source span(s) inside the EI-approved scope.` };
}
