import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { runProcess, type ProcessRunner } from "../process/index.js";
import { providerStatus } from "./manager.js";
import { PROVIDER_COMPATIBILITY } from "./compatibility.js";
import { PROVIDER_DIR, syncProviderWorkspace } from "./workspace.js";
import type { ProviderStatus } from "./types.js";

export const GRAPHIFY_DIR = `${PROVIDER_DIR}/graphify`;
export const GRAPHIFY_GRAPH_PATH = `${GRAPHIFY_DIR}/graph.json`;
export const GRAPHIFY_RUN_PATH = `${GRAPHIFY_DIR}/run.json`;

export interface GraphifyRunManifest {
  schemaVersion: 1;
  provider: "graphify";
  providerVersion: string;
  generatedAt: string;
  sourceCommit?: string;
  workspaceHash: string;
  sourceHashes: Record<string, string>;
  command: string[];
  graphPath: string;
  reportPath?: string;
}

export interface GraphifyExtractionResult {
  ok: boolean;
  degraded: boolean;
  status: ProviderStatus;
  graphPath?: string;
  reportPath?: string;
  runManifestPath?: string;
  workspaceHash?: string;
  message: string;
}

function gitHead(root: string, runner: ProcessRunner): Promise<string | undefined> {
  return runner({ command: "git", args: ["rev-parse", "HEAD"], cwd: root, timeoutMs: 10_000 })
    .then((result) => result.exitCode === 0 ? result.stdout.trim() || undefined : undefined);
}

async function sourceHashes(manifestPath: string): Promise<Record<string, string>> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { files?: Array<{ path: string; hash: string }> };
  return Object.fromEntries((manifest.files ?? []).map((file) => [file.path.replace(/\\/g, "/"), file.hash]));
}

async function exists(location: string): Promise<boolean> {
  try { await readFile(location); return true; } catch { return false; }
}

async function writeAtomic(location: string, value: unknown): Promise<void> {
  const temporary = `${location}.tmp-${randomUUID()}`;
  await mkdir(path.dirname(location), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, location);
}

/** Run Graphify only against EI's policy-filtered mirror in deterministic code-only mode. */
export async function runGraphifyExtraction(
  root: string,
  options: { runner?: ProcessRunner; providerHome?: string; onProgress?: (message: string) => void } = {},
): Promise<GraphifyExtractionResult> {
  const runner = options.runner ?? runProcess;
  const status = await providerStatus("graphify", { runner, providerHome: options.providerHome });
  if (status.health !== "healthy" || !status.executable) {
    return { ok: false, degraded: true, status, message: `${status.message} Native EI graph extraction remains active.` };
  }

  options.onProgress?.("Syncing provider workspace for Graphify...");
  const workspace = await syncProviderWorkspace(root);
  const outputDir = path.join(root, GRAPHIFY_DIR);
  await mkdir(outputDir, { recursive: true });
  const args = ["extract", workspace.path, "--code-only", "--out", outputDir];
  options.onProgress?.("Extracting structural graph with Graphify...");
  const execution = await runner({
    command: status.executable,
    args,
    cwd: root,
    timeoutMs: 10 * 60_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (execution.exitCode !== 0) {
    return {
      ok: false,
      degraded: true,
      status: { ...status, health: "error", message: `Graphify extraction failed: ${(execution.stderr || execution.error || "unknown error").trim().slice(-1000)}` },
      workspaceHash: workspace.workspaceHash,
      message: "Graphify evidence was not refreshed; native EI graph extraction remains active.",
    };
  }

  const graphAbsolute = path.join(root, GRAPHIFY_GRAPH_PATH);
  const nestedGraphAbsolute = path.join(outputDir, "graphify-out", "graph.json");
  const producedGraph = await exists(graphAbsolute) ? graphAbsolute : await exists(nestedGraphAbsolute) ? nestedGraphAbsolute : undefined;
  if (!producedGraph) {
    return {
      ok: false,
      degraded: true,
      status: { ...status, health: "error", message: `Graphify completed without producing ${GRAPHIFY_GRAPH_PATH}.` },
      workspaceHash: workspace.workspaceHash,
      message: "Graphify output was malformed or incomplete; native EI graph extraction remains active.",
    };
  }
  let rawGraph: unknown;
  try { rawGraph = JSON.parse(await readFile(producedGraph, "utf8")); } catch {
    return {
      ok: false,
      degraded: true,
      status: { ...status, health: "error", message: "Graphify produced invalid JSON." },
      workspaceHash: workspace.workspaceHash,
      message: "Graphify evidence was rejected; native EI graph extraction remains active.",
    };
  }

  // Graphify 0.9.x writes <out>/graphify-out/graph.json while older/fake
  // adapters write <out>/graph.json. Normalize both into EI's stable ignored
  // provider path so reconciliation never depends on an upstream layout quirk.
  if (producedGraph !== graphAbsolute) await writeAtomic(graphAbsolute, rawGraph);

  const reportCandidates = ["GRAPH_REPORT.md", "graph_report.md", "report.md"];
  let reportPath: string | undefined;
  for (const candidate of reportCandidates) {
    const direct = path.join(outputDir, candidate);
    const nested = path.join(outputDir, "graphify-out", candidate);
    const produced = await exists(direct) ? direct : await exists(nested) ? nested : undefined;
    if (produced) {
      if (produced !== direct) await writeFile(direct, await readFile(produced, "utf8"), "utf8");
      reportPath = path.posix.join(GRAPHIFY_DIR, candidate);
      break;
    }
  }
  const manifest: GraphifyRunManifest = {
    schemaVersion: 1,
    provider: "graphify",
    providerVersion: PROVIDER_COMPATIBILITY.graphify.version,
    generatedAt: new Date().toISOString(),
    sourceCommit: await gitHead(root, runner),
    workspaceHash: workspace.workspaceHash,
    sourceHashes: await sourceHashes(workspace.manifestPath),
    command: [status.executable, ...args],
    graphPath: GRAPHIFY_GRAPH_PATH,
    ...(reportPath ? { reportPath } : {}),
  };
  await writeAtomic(path.join(root, GRAPHIFY_RUN_PATH), manifest);
  return {
    ok: true,
    degraded: false,
    status,
    graphPath: GRAPHIFY_GRAPH_PATH,
    reportPath,
    runManifestPath: GRAPHIFY_RUN_PATH,
    workspaceHash: workspace.workspaceHash,
    message: "Graphify code-only structural evidence is current and ready for EI normalization.",
  };
}

export function graphifyContentHash(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}
