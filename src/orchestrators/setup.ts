import { existsSync } from "node:fs";
import path from "node:path";
import { install, update } from "../installer/index.js";
import { buildGraph } from "../graph/index.js";
import { generateBrief } from "../brief/index.js";
import type { IdeId, OperationResult } from "../types.js";

// ---------------------------------------------------------------------------
// `setup` — one command that stands a project up (or brings it current). It
// detects the IDE(s) from what's already on disk, installs/updates the adapters,
// builds the real graph, seeds git-derived signals + the orientation brief, and
// snapshots evidence hashes if a knowledge base exists. Idempotent: run it again
// any time to refresh everything. Absorbs install/create/update/map/
// git-analysis/user-profile/evidence-record so users don't chain commands.
// ---------------------------------------------------------------------------

// Map on-disk marker directories/files to IDE adapter ids.
const IDE_MARKERS: Array<{ marker: string; ide: IdeId }> = [
  { marker: ".claude", ide: "claude-code" },
  { marker: ".cursor", ide: "cursor" },
  { marker: ".github/copilot-instructions.md", ide: "github-copilot" },
  { marker: ".github/prompts", ide: "github-copilot" },
  { marker: ".gemini", ide: "gemini-cli" },
  { marker: ".commandcode", ide: "commandcode" },
  { marker: ".agent", ide: "antigravity" },
];

export function detectIdes(root: string): IdeId[] {
  const found = new Set<IdeId>();
  for (const { marker, ide } of IDE_MARKERS) {
    if (existsSync(path.join(root, marker))) found.add(ide);
  }
  return [...found];
}

export interface SetupResult {
  ides: IdeId[];
  installOp: OperationResult;
  wasUpdate: boolean;
  graph?: { nodeCount: number; edgeCount: number; fileCount: number };
  briefPath?: string;
  gitAnalyzed: boolean;
  evidenceRecorded: boolean;
  logs: string[];
}

export interface SetupOptions {
  ides?: IdeId[]; // explicit override; else auto-detect (fallback generic)
  packageVersion: string;
  dryRun?: boolean;
  force?: boolean;
  promptOverwrite?: (filePath: string) => Promise<boolean>;
  /** Initialization orchestrator installs adapters first, then builds once after providers. */
  deferIntelligenceBuild?: boolean;
}

export async function runSetup(root: string, options: SetupOptions): Promise<SetupResult> {
  const logs: string[] = [];
  const log = (m: string) => logs.push(m);

  // 1. Resolve IDEs: explicit → provided; else detect; else generic.
  const alreadyInstalled = existsSync(path.join(root, ".engineering-intelligence", "install-manifest.json"));
  let ides = options.ides && options.ides.length > 0 ? options.ides : detectIdes(root);
  if (ides.length === 0) {
    ides = ["generic"];
    log("No IDE markers detected — installed the generic adapter (re-run with a specific IDE any time).");
  } else {
    log(`IDE adapter(s): ${ides.join(", ")}${options.ides?.length ? "" : " (auto-detected)"}`);
  }

  // 2. Install or update the adapters.
  let installOp: OperationResult;
  let wasUpdate = false;
  if (alreadyInstalled) {
    installOp = await update(root, { dryRun: options.dryRun, force: options.force, packageVersion: options.packageVersion, promptOverwrite: options.promptOverwrite });
    wasUpdate = true;
    log(`Updated adapters: ${installOp.changed} changed, ${installOp.conflicts} conflict(s).`);
  } else {
    installOp = await install(root, ides, { dryRun: options.dryRun, force: options.force, packageVersion: options.packageVersion, promptOverwrite: options.promptOverwrite });
    log(`Installed adapters: ${installOp.changed} changed, ${installOp.conflicts} conflict(s).`);
  }

  const result: SetupResult = { ides, installOp, wasUpdate, gitAnalyzed: false, evidenceRecorded: false, logs };
  if (options.dryRun || options.deferIntelligenceBuild) return result;

  // 3. Build the real dependency + call graph (also regenerates the brief).
  try {
    const g = await buildGraph(root, {});
    result.graph = { nodeCount: g.nodeCount, edgeCount: g.edgeCount, fileCount: g.fileCount };
    log(`Graph built: ${g.nodeCount} nodes, ${g.edgeCount} edges (${g.fileCount} files).`);
  } catch (e) {
    log(`Graph build skipped: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 4. Git-derived risk signals (best-effort; no-op outside a git repo).
  try {
    const { runGitAnalysis } = await import("../git-analysis/index.js");
    await runGitAnalysis(root, 90);
    result.gitAnalyzed = true;
    log("Git analysis written (hotspots, ownership, coupling).");
  } catch { /* not a git repo or no history — fine */ }

  // 5. Orientation brief (ensure it exists even if graph build above failed).
  try {
    const brief = await generateBrief(root);
    result.briefPath = brief.path;
    log(`Repo brief: ${brief.path}`);
  } catch { /* best-effort */ }

  // 6. Snapshot evidence hashes if a knowledge base already exists.
  if (existsSync(path.join(root, ".engineering-intelligence", "knowledge-base")) &&
      !existsSync(path.join(root, ".engineering-intelligence", "knowledge-base", ".evidence-hashes.json"))) {
    try {
      const { recordEvidenceHashes } = await import("../evidence/index.js");
      const snap = await recordEvidenceHashes(root);
      result.evidenceRecorded = true;
      log(`Evidence hashes recorded (${snap.hashes.length} citation(s)).`);
    } catch { /* best-effort */ }
  }

  return result;
}

// Registration hint shown after setup so the user can wire the MCP server.
export function mcpRegistrationHint(root: string, ides: IdeId[]): string {
  const lines = ["", "Next steps:"];
  if (ides.includes("claude-code")) {
    lines.push(`  • Register the MCP server:  claude mcp add engineering-intelligence -- ei-mcp ${root}`);
  } else {
    lines.push(`  • Start the MCP server for your IDE:  ei-mcp ${root}`);
  }
  lines.push("  • In your IDE, run: /initialize-engineering-intelligence");
  lines.push("  • Ask the codebase anything:  engineering-intelligence ask \"who calls <fn>\"");
  return lines.join("\n") + "\n";
}
