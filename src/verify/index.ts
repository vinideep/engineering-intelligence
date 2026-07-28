/**
 * Verification receipts.
 *
 * The Stop hook previously decided "was this change validated?" by regex-matching
 * the agent's shell history. That was defeatable to the point of being theatre:
 * `rm -rf build`, `ls build`, `cat x.test.mjs` and `git commit -m "add tests"`
 * all matched, so an agent satisfied the gate within its first few tool calls,
 * permanently, for the whole session. It also credited FAILING commands, because
 * the host's Bash payload carries no success flag.
 *
 * A receipt replaces belief with evidence. `runVerification` actually executes
 * the project's own check commands, records their real exit codes, and binds the
 * result to the exact bytes it verified — a sha256 per changed file. A receipt
 * only satisfies the gate while every one of those files still hashes the same,
 * so editing a file after validating it invalidates the receipt automatically.
 *
 * Changed files come from `git status --porcelain` rather than the hook's own
 * bookkeeping, so edits made via `sed -i`, `patch`, a subagent, or any tool the
 * PostToolUse matcher never saw are still covered.
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const RECEIPT_SCHEMA_VERSION = 1;
const RECEIPT_DIR = ".engineering-intelligence/.verify";
const RECEIPT_FILE = "receipts.json";
const MAX_RECEIPTS = 20;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export interface CommandRun {
  command: string;
  exitCode: number;
  durationMs: number;
  /** Tail of combined output, for the failure message. Truncated. */
  outputTail?: string;
}

export interface Receipt {
  schemaVersion: number;
  createdAt: string;
  /** git HEAD at verification time, or null outside a repo. */
  head: string | null;
  commands: CommandRun[];
  /** relative path -> sha256 of the bytes that were verified. */
  files: Record<string, string>;
  /**
   * False when git could not enumerate the change set, so `files` is not a
   * complete record of what was verified. Coverage then degrades to an mtime
   * comparison — weaker than hashing, and labelled as such rather than pretending.
   */
  gitAvailable: boolean;
  verdict: "pass" | "fail";
}

export interface VerifyOptions {
  /** Explicit commands to run. Overrides detection. */
  commands?: string[];
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Hashing and change detection
// ---------------------------------------------------------------------------

export function hashContent(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function hashFile(root: string, relPath: string): Promise<string | null> {
  try {
    return hashContent(await readFile(path.join(root, relPath)));
  } catch {
    return null; // deleted between detection and hashing
  }
}

async function fileMtime(root: string, relPath: string): Promise<number | null> {
  try {
    const { stat } = await import("node:fs/promises");
    return (await stat(path.join(root, relPath))).mtimeMs;
  } catch {
    return null;
  }
}

async function git(root: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: root, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Files modified relative to HEAD, including untracked. Porcelain v1 format:
 * `XY path` (rename entries carry ` -> `, where the post-rename path is what exists).
 *
 * `-uall` is essential: the default collapses an untracked directory to a single
 * `src/` entry, so a brand-new source file would never be seen — and the gate
 * would pass a change it never verified.
 */
export async function changedFiles(root: string): Promise<string[]> {
  const out = await git(root, ["status", "--porcelain", "-uall"]);
  if (out === null) return [];
  const files: string[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    let p = line.slice(3).trim();
    const arrow = p.indexOf(" -> ");
    if (arrow >= 0) p = p.slice(arrow + 4);
    if (p.startsWith('"') && p.endsWith('"')) {
      try { p = JSON.parse(p) as string; } catch { /* keep raw */ }
    }
    // Never record our own state in a receipt — it would invalidate itself.
    if (p.startsWith(".engineering-intelligence/")) continue;
    files.push(p);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Command discovery
// ---------------------------------------------------------------------------

/** The project's own check commands, in the order they should run. */
export async function detectCheckCommands(root: string): Promise<string[]> {
  const commands: string[] = [];
  try {
    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    // Prefer a single aggregate check when the project defines one.
    for (const key of ["check", "ci"]) {
      if (scripts[key]) return [`npm run ${key}`];
    }
    for (const key of ["typecheck", "type-check", "lint", "test"]) {
      if (scripts[key]) commands.push(key === "test" ? "npm test" : `npm run ${key}`);
    }
    if (commands.length > 0) return commands;
  } catch { /* not a node project */ }

  for (const [marker, cmd] of [
    ["pyproject.toml", "pytest"],
    ["setup.cfg", "pytest"],
    ["tox.ini", "pytest"],
    ["Cargo.toml", "cargo test"],
    ["go.mod", "go test ./..."],
    ["Gemfile", "bundle exec rspec"],
  ] as const) {
    try { await readFile(path.join(root, marker), "utf8"); return [cmd]; } catch { /* next */ }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Receipt storage
// ---------------------------------------------------------------------------

function receiptPath(root: string): string {
  return path.join(root, RECEIPT_DIR, RECEIPT_FILE);
}

export async function readReceipts(root: string): Promise<Receipt[]> {
  try {
    const parsed = JSON.parse(await readFile(receiptPath(root), "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as Receipt[]) : [];
  } catch {
    return [];
  }
}

async function ensureGitignored(root: string): Promise<void> {
  const gitignorePath = path.join(root, ".engineering-intelligence", ".gitignore");
  let existing = "";
  try { existing = await readFile(gitignorePath, "utf8"); } catch { /* new file */ }
  if (!existing.includes(".verify/")) {
    const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
    await writeFile(gitignorePath, `${existing}${prefix}.verify/\n`, "utf8");
  }
}

export async function writeReceipt(root: string, receipt: Receipt): Promise<void> {
  await mkdir(path.join(root, RECEIPT_DIR), { recursive: true });
  await ensureGitignored(root);
  const all = [receipt, ...(await readReceipts(root))].slice(0, MAX_RECEIPTS);
  await writeFile(receiptPath(root), JSON.stringify(all, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Coverage check — the question the Stop gate actually asks
// ---------------------------------------------------------------------------

export interface CoverageResult {
  covered: boolean;
  /** Files with no passing receipt matching their current bytes. */
  uncovered: string[];
  receipt?: Receipt;
}

/**
 * Is there a passing receipt whose recorded digests still match the CURRENT bytes
 * of every file in `files`? Hash equality is the whole point: a receipt earned
 * before an edit cannot vouch for the file after it.
 */
export async function coverageFor(root: string, files: string[]): Promise<CoverageResult> {
  if (files.length === 0) return { covered: true, uncovered: [] };

  const current = new Map<string, string>();
  for (const f of files) {
    const h = await hashFile(root, f);
    if (h) current.set(f, h);
  }
  if (current.size === 0) return { covered: true, uncovered: [] };

  for (const receipt of await readReceipts(root)) {
    if (receipt.verdict !== "pass") continue;

    if (receipt.gitAvailable === false) {
      // Degraded mode: without git we never learned which files changed, so fall
      // back to "was this verified after the file was last written?". Still
      // expires on edit, just via mtime rather than content.
      const verifiedAt = Date.parse(receipt.createdAt);
      const mtimes = await Promise.all(files.map((f) => fileMtime(root, f)));
      if (Number.isFinite(verifiedAt) && mtimes.every((m) => m !== null && m <= verifiedAt)) {
        return { covered: true, uncovered: [], receipt };
      }
      continue;
    }

    const missing = [...current.entries()].filter(([f, h]) => receipt.files[f] !== h).map(([f]) => f);
    if (missing.length === 0) return { covered: true, uncovered: [], receipt };
  }

  // Report against the most recent passing receipt for a useful message.
  const latestPass = (await readReceipts(root)).find((r) => r.verdict === "pass");
  const uncovered = [...current.entries()]
    .filter(([f, h]) => !latestPass || latestPass.files[f] !== h)
    .map(([f]) => f);
  return { covered: false, uncovered };
}

// ---------------------------------------------------------------------------
// Running verification
// ---------------------------------------------------------------------------

async function runOne(root: string, command: string, timeoutMs: number): Promise<CommandRun> {
  const started = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(command, {
      cwd: root, shell: true, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024,
    } as never) as unknown as { stdout: string; stderr: string };
    return {
      command,
      exitCode: 0,
      durationMs: Date.now() - started,
      outputTail: `${stdout}${stderr}`.slice(-800) || undefined,
    };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string; killed?: boolean };
    return {
      command,
      // A killed (timed-out) process has no numeric code; treat as failure.
      exitCode: typeof e.code === "number" ? e.code : 1,
      durationMs: Date.now() - started,
      outputTail: `${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-800) || undefined,
    };
  }
}

export interface VerifyResult {
  receipt: Receipt;
  /** True when there was nothing to verify (no commands discovered). */
  noCommands: boolean;
}

/**
 * Execute the project's checks and write a receipt binding the outcome to the
 * exact bytes verified. Hashes are captured AFTER the commands run, so a receipt
 * always describes the tree the checks actually saw.
 */
export async function runVerification(root: string, options: VerifyOptions = {}): Promise<VerifyResult> {
  const commands = options.commands?.length ? options.commands : await detectCheckCommands(root);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const runs: CommandRun[] = [];
  for (const command of commands) {
    const run = await runOne(root, command, timeoutMs);
    runs.push(run);
    if (run.exitCode !== 0) break; // stop at first failure — the tree is not verified
  }

  const inGitRepo = (await git(root, ["rev-parse", "--is-inside-work-tree"])) === "true";
  const files: Record<string, string> = {};
  for (const rel of await changedFiles(root)) {
    const h = await hashFile(root, rel);
    if (h) files[rel] = h;
  }

  const receipt: Receipt = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    head: await git(root, ["rev-parse", "HEAD"]),
    commands: runs,
    files,
    gitAvailable: inGitRepo,
    // No commands means nothing was proven — never a pass.
    verdict: runs.length > 0 && runs.every((r) => r.exitCode === 0) ? "pass" : "fail",
  };

  await writeReceipt(root, receipt);
  return { receipt, noCommands: commands.length === 0 };
}
