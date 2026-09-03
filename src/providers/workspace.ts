import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { collectProjectFiles, ProjectFilePolicy } from "../project-files/index.js";

export const PROVIDER_DIR = ".engineering-intelligence/providers";
export const PROVIDER_WORKSPACE = `${PROVIDER_DIR}/workspace`;

export async function ensureProviderCacheIgnored(root: string): Promise<void> {
  const ignorePath = path.join(root, ".engineering-intelligence", ".gitignore");
  let current = "";
  try { current = await readFile(ignorePath, "utf8"); } catch { /* create below */ }
  const lines = current.split("\n").map((line) => line.trim());
  if (lines.includes("providers/")) return;
  await mkdir(path.dirname(ignorePath), { recursive: true });
  const prefix = current && !current.endsWith("\n") ? "\n" : "";
  await writeFile(ignorePath, `${current}${prefix}providers/\n`, "utf8");
}

export interface SourceManifest {
  schemaVersion: 1;
  root: string;
  generatedAt: string;
  files: Array<{ path: string; hash: string; size: number }>;
  workspaceHash: string;
}

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".py", ".go", ".rs", ".rb", ".java", ".kt",
  ".json", ".yaml", ".yml", ".toml", ".xml", ".sql", ".graphql", ".proto", ".md", ".txt", ".sh", ".ps1", ".css", ".scss", ".html",
]);
const SPECIAL_FILES = new Set(["Dockerfile", "Makefile", "Procfile", "Gemfile", "Rakefile"]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function hash(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function readManifest(location: string): Promise<SourceManifest | undefined> {
  try { return JSON.parse(await readFile(location, "utf8")) as SourceManifest; } catch { return undefined; }
}

export interface ProviderSourceSnapshot {
  files: SourceManifest["files"];
  sourceHashes: Record<string, string>;
  workspaceHash: string;
  skippedLarge: string[];
}

/** Compute the exact provider source universe without modifying the project. */
export async function computeProviderSourceSnapshot(root: string): Promise<ProviderSourceSnapshot> {
  const policy = await ProjectFilePolicy.load(root);
  const candidates = await collectProjectFiles(policy, {
    accept: (relative) => TEXT_EXTENSIONS.has(path.extname(relative).toLowerCase()) || SPECIAL_FILES.has(path.basename(relative)),
  });
  const files: SourceManifest["files"] = [];
  const skippedLarge: string[] = [];
  for (const absolute of candidates) {
    const relative = path.relative(root, absolute).replace(/\\/g, "/");
    let content: Buffer;
    try { content = await readFile(absolute); } catch { continue; }
    if (content.byteLength > MAX_FILE_BYTES) {
      skippedLarge.push(relative);
      continue;
    }
    files.push({ path: relative, hash: hash(content), size: content.byteLength });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    files,
    sourceHashes: Object.fromEntries(files.map((file) => [file.path, file.hash])),
    workspaceHash: hash(files.map((file) => `${file.path}:${file.hash}`).join("\n")),
    skippedLarge,
  };
}

export interface ProviderWorkspaceResult {
  path: string;
  manifestPath: string;
  workspaceHash: string;
  files: string[];
  copied: number;
  removed: number;
  skippedLarge: string[];
}

/**
 * Mirror only policy-approved text/code files into an EI-owned provider scope.
 * Third-party tools can mutate this mirror without touching the user's source,
 * hooks, MCP configuration, or agent instructions.
 */
export async function syncProviderWorkspace(root: string, workspaceRelative = PROVIDER_WORKSPACE): Promise<ProviderWorkspaceResult> {
  await ensureProviderCacheIgnored(root);
  const normalizedRelative = workspaceRelative.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalizedRelative !== PROVIDER_DIR && !normalizedRelative.startsWith(`${PROVIDER_DIR}/`)) {
    throw new Error("Provider workspaces must remain inside EI's ignored provider directory.");
  }
  const workspace = path.join(root, normalizedRelative);
  const manifestPath = path.join(workspace, ".ei-source-manifest.json");
  const prior = await readManifest(manifestPath);
  const snapshot = await computeProviderSourceSnapshot(root);
  const entries = snapshot.files;
  let copied = 0;
  for (const entry of entries) {
    const old = prior?.files.find((candidate) => candidate.path === entry.path);
    if (old?.hash === entry.hash) continue;
    const absolute = path.join(root, entry.path);
    const destination = path.join(workspace, entry.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(absolute, destination);
    copied += 1;
  }

  const currentPaths = new Set(entries.map((entry) => entry.path));
  let removed = 0;
  for (const entry of prior?.files ?? []) {
    if (currentPaths.has(entry.path)) continue;
    try {
      await unlink(path.join(workspace, entry.path));
      removed += 1;
    } catch { /* already absent */ }
  }
  const workspaceHash = snapshot.workspaceHash;
  const manifest: SourceManifest = { schemaVersion: 1, root: path.resolve(root), generatedAt: new Date().toISOString(), files: entries, workspaceHash };
  await mkdir(workspace, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { path: workspace, manifestPath, workspaceHash, files: entries.map((entry) => entry.path), copied, removed, skippedLarge: snapshot.skippedLarge };
}
