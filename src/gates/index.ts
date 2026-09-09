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

import { readFile } from "node:fs/promises";
import path from "node:path";
import { collectProjectFiles, ProjectFilePolicy } from "../project-files/index.js";
import { runProcess } from "../process/index.js";

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
  /**
   * Minimum severity that makes a gate FAIL (exit 1). Defaults to "error".
   *
   * Without this, `env-vars` and `dead-exports` could never fail anything: they
   * emit only warning/info findings, so their status was always pass/warn and
   * the CLI always exited 0 — advisory checks wearing a gate's name. Setting
   * `failOn: "warning"` lets a team promote them to real blocking gates.
   */
  failOn?: Severity;
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, error: 2 };

export const GATE_NAMES = ["env-vars", "dead-exports", "api-diff", "migration-lint"] as const;
export type GateName = (typeof GATE_NAMES)[number];

export function isGateName(value: string): value is GateName {
  return (GATE_NAMES as readonly string[]).includes(value);
}

/**
 * Derive a gate status from its findings. `failOn` is the threshold at or above
 * which a finding fails the gate (default "error"); anything below it that is
 * still a warning downgrades to "warn".
 */
export function statusFromFindings(findings: GateFinding[], failOn: Severity = "error"): GateStatus {
  const threshold = SEVERITY_RANK[failOn];
  if (findings.some((f) => SEVERITY_RANK[f.severity] >= threshold)) return "fail";
  if (findings.some((f) => f.severity === "warning")) return "warn";
  return "pass";
}

// ---------------------------------------------------------------------------
// Shared filesystem helpers
// ---------------------------------------------------------------------------

/** Recursively collect files under `dir` matching `accept(relPath)`. */
export async function walkFiles(
  root: string,
  accept: (relPath: string) => boolean,
  dir: string = root,
  out: string[] = [],
): Promise<string[]> {
  const policy = await ProjectFilePolicy.load(root);
  const relativeRoot = path.relative(root, dir).replace(/\\/g, "/") || ".";
  const collected = await collectProjectFiles(policy, { accept, roots: [relativeRoot] });
  out.push(...collected);
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
  const result = await runProcess({ command: "git", args: ["show", `${ref}:${relPath}`], cwd: root, maxBuffer: 10 * 1024 * 1024 });
  return result.exitCode === 0 ? result.stdout : null;
}

/** Files changed between `base` and the working tree (added/modified/renamed). */
export async function gitChangedFiles(root: string, base: string): Promise<string[]> {
  const result = await runProcess({ command: "git", args: ["diff", "--name-only", base, "--"], cwd: root, maxBuffer: 10 * 1024 * 1024 });
  return result.exitCode === 0 ? result.stdout.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

export async function gitAvailable(root: string): Promise<boolean> {
  return (await runProcess({ command: "git", args: ["rev-parse", "--is-inside-work-tree"], cwd: root })).exitCode === 0;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function runGate(name: GateName, root: string, options: GateOptions = {}): Promise<GateResult> {
  const result = await dispatch(name, root, options);
  // Re-derive status against the caller's threshold so a team can promote
  // advisory gates to blocking ones without changing each gate's severities.
  return { ...result, status: statusFromFindings(result.findings, options.failOn ?? "error") };
}

async function dispatch(name: GateName, root: string, options: GateOptions): Promise<GateResult> {
  switch (name) {
    case "env-vars":       return (await import("./env-vars.js")).envVarsGate(root);
    case "dead-exports":   return (await import("./dead-exports.js")).deadExportsGate(root);
    case "api-diff":       return (await import("./api-diff.js")).apiDiffGate(root, options.base ?? "HEAD");
    case "migration-lint": return (await import("./migration-lint.js")).migrationLintGate(root, options);
    default:               return { gate: name, status: "pass", summary: "unknown gate", findings: [] };
  }
}
