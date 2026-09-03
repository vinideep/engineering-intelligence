import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { CCE_RUN_PATH, type CceRunManifest } from "./cce.js";
import { PROVIDER_COMPATIBILITY } from "./compatibility.js";
import { GRAPHIFY_GRAPH_PATH, GRAPHIFY_RUN_PATH, type GraphifyRunManifest } from "./graphify.js";
import { computeProviderSourceSnapshot, PROVIDER_DIR } from "./workspace.js";
import type { ProviderName } from "./types.js";

export type ProjectProviderRunHealth = "current" | "missing" | "stale" | "invalid" | "disabled";

export interface ProjectProviderRunStatus {
  name: ProviderName;
  health: ProjectProviderRunHealth;
  fallback: boolean;
  message: string;
  generatedAt?: string;
  workspaceHash?: string;
}

async function readJson<T>(location: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(location, "utf8")) as T; } catch { return undefined; }
}

function inside(parent: string, candidate: string): boolean {
  const base = path.resolve(parent);
  const target = path.resolve(candidate);
  return target === base || target.startsWith(`${base}${path.sep}`);
}

async function graphifyState(root: string, workspaceHash: string): Promise<ProjectProviderRunStatus> {
  const manifest = await readJson<GraphifyRunManifest>(path.join(root, GRAPHIFY_RUN_PATH));
  if (!manifest) return { name: "graphify", health: "missing", fallback: true, message: "No Graphify extraction manifest exists for this project." };
  if (manifest.schemaVersion !== 1 || manifest.provider !== "graphify" || manifest.providerVersion !== PROVIDER_COMPATIBILITY.graphify.version) {
    return { name: "graphify", health: "invalid", fallback: true, message: "Graphify extraction metadata is invalid or uses an untested version." };
  }
  if (manifest.workspaceHash !== workspaceHash) {
    return { name: "graphify", health: "stale", fallback: true, message: "Graphify evidence does not match the current approved source universe.", generatedAt: manifest.generatedAt, workspaceHash: manifest.workspaceHash };
  }
  const graphLocation = path.resolve(root, manifest.graphPath || GRAPHIFY_GRAPH_PATH);
  if (!inside(path.join(root, PROVIDER_DIR), graphLocation)) {
    return { name: "graphify", health: "invalid", fallback: true, message: "Graphify output path escapes EI's provider directory." };
  }
  const graph = await readJson<{ nodes?: unknown; edges?: unknown; links?: unknown }>(graphLocation);
  if (!graph || !Array.isArray(graph.nodes) || (!Array.isArray(graph.edges) && !Array.isArray(graph.links))) {
    return { name: "graphify", health: "invalid", fallback: true, message: "Graphify output is missing or malformed." };
  }
  return { name: "graphify", health: "current", fallback: false, message: "Graphify structural evidence matches the current approved source universe.", generatedAt: manifest.generatedAt, workspaceHash };
}

async function cceState(root: string, workspaceHash: string): Promise<ProjectProviderRunStatus> {
  const manifest = await readJson<CceRunManifest>(path.join(root, CCE_RUN_PATH));
  if (!manifest) return { name: "cce", health: "missing", fallback: true, message: "No CCE index manifest exists for this project." };
  if (manifest.schemaVersion !== 1 || manifest.provider !== "cce" || manifest.providerVersion !== PROVIDER_COMPATIBILITY.cce.version) {
    return { name: "cce", health: "invalid", fallback: true, message: "CCE index metadata is invalid or uses an untested version." };
  }
  if (manifest.workspaceHash !== workspaceHash) {
    return { name: "cce", health: "stale", fallback: true, message: "CCE index does not match the current approved source universe.", generatedAt: manifest.generatedAt, workspaceHash: manifest.workspaceHash };
  }
  const providerRoot = path.join(root, PROVIDER_DIR);
  if (!inside(providerRoot, manifest.indexedPath) || !inside(providerRoot, manifest.storagePath)) {
    return { name: "cce", health: "invalid", fallback: true, message: "CCE index paths escape EI's provider directory." };
  }
  try {
    const [indexed, storage] = await Promise.all([stat(manifest.indexedPath), stat(manifest.storagePath)]);
    if (!indexed.isDirectory() || !storage.isDirectory()) throw new Error("not directories");
  } catch {
    return { name: "cce", health: "missing", fallback: true, message: "CCE index workspace or storage is missing." };
  }
  return { name: "cce", health: "current", fallback: false, message: "CCE index matches the current approved source universe.", generatedAt: manifest.generatedAt, workspaceHash };
}

/** Read-only validation of project-local provider evidence and indexes. */
export async function inspectProjectProviderRuns(root: string, options: { disabled?: boolean } = {}): Promise<ProjectProviderRunStatus[]> {
  if (options.disabled) {
    return (["graphify", "cce"] as const).map((name) => ({ name, health: "disabled", fallback: false, message: "Disabled by native provider policy." }));
  }
  const snapshot = await computeProviderSourceSnapshot(root);
  return Promise.all([graphifyState(root, snapshot.workspaceHash), cceState(root, snapshot.workspaceHash)]);
}
