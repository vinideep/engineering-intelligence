/**
 * Safety gates as code.
 *
 * The `engineering-intelligence.md` workflow names ~12 "safety gates", but until
 * now every one was prose the model was asked to perform by hand. This module
 * turns the deterministic, evidence-checkable ones into real commands:
 *
 *   env-vars        — code references vs `.env.example` / declared config
 *   dead-exports    — exported symbols never imported anywhere (JS/TS)
 *   api-diff        — routes/contracts removed or changed vs a git base ref
 *   migration-lint  — destructive / locking / irreversible migration operations
 *
 * Each gate returns a structured GateResult so it composes into the CLI, the MCP
 * server, and CI equally. Gates are advisory-by-severity: findings carry
 * error/warning/info, and only `error` findings make a gate `fail` (exit 1).
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export type Severity = "error" | "warning" | "info";
export type GateStatus = "pass" | "warn" | "fail";

export interface GateFinding {
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  evidence?: string;
}

export interface GateResult {
  gate: string;
  status: GateStatus;
  summary: string;
  findings: GateFinding[];
}

export interface GateOptions {
  /** Git base ref for diff-oriented gates (api-diff). */
  base?: string;
}

export const GATE_NAMES = ["env-vars", "dead-exports", "api-diff", "migration-lint"] as const;
export type GateName = (typeof GATE_NAMES)[number];

export function isGateName(value: string): value is GateName {
  return (GATE_NAMES as readonly string[]).includes(value);
}

/** Derive a gate status from its findings: any error → fail, any warning → warn, else pass. */
export function statusFromFindings(findings: GateFinding[]): GateStatus {
  if (findings.some((f) => f.severity === "error")) return "fail";
  if (findings.some((f) => f.severity === "warning")) return "warn";
  return "pass";
}

// ---------------------------------------------------------------------------
// Shared filesystem helpers
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "coverage", "__pycache__",
  ".venv", "venv", "vendor", "target", ".gradle", ".next", ".engineering-intelligence",
]);

/** Recursively collect files under `dir` matching `accept(relPath)`. */
export async function walkFiles(
  root: string,
  accept: (relPath: string) => boolean,
  dir: string = root,
  out: string[] = [],
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let s;
    try { s = await stat(full); } catch { continue; }
    if (s.isDirectory()) {
      await walkFiles(root, accept, full, out);
    } else if (accept(path.relative(root, full).replace(/\\/g, "/"))) {
      out.push(full);
    }
  }
  return out;
}

export const JS_TS_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

export function isTestFile(relPath: string): boolean {
  return /(^|\/)(test|tests|__tests__|spec|e2e)\//.test(relPath) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(relPath);
}

// ---------------------------------------------------------------------------
// Shared git helpers (diff-oriented gates)
// ---------------------------------------------------------------------------

/** Return a file's contents at a git ref, or null if it did not exist there. */
export async function gitShow(root: string, ref: string, relPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["show", `${ref}:${relPath}`], {
      cwd: root, maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

/** Files changed between `base` and the working tree (added/modified/renamed). */
export async function gitChangedFiles(root: string, base: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["diff", "--name-only", base, "--"], {
      cwd: root, maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function gitAvailable(root: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function runGate(name: GateName, root: string, options: GateOptions = {}): Promise<GateResult> {
  switch (name) {
    case "env-vars":       return (await import("./env-vars.js")).envVarsGate(root);
    case "dead-exports":   return (await import("./dead-exports.js")).deadExportsGate(root);
    case "api-diff":       return (await import("./api-diff.js")).apiDiffGate(root, options.base ?? "HEAD");
    case "migration-lint": return (await import("./migration-lint.js")).migrationLintGate(root, options);
    default:               return { gate: name, status: "pass", summary: "unknown gate", findings: [] };
  }
}
