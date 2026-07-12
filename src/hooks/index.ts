/**
 * Hook engine — turns the prose "safety gates" and "environmental backpressure"
 * promises into enforced, deterministic behaviour driven by the host IDE's
 * lifecycle hooks (Claude Code today; the payload is host-agnostic).
 *
 * Four events, each mapped to one deterministic decision:
 *   session-start  → inject a compact freshness/drift summary into the session
 *   pre-tool-use   → warn (or, opt-in, deny) edits when intelligence is stale
 *   post-tool-use  → silently record changed source files + validation commands
 *   stop           → (opt-in) block "done" when code changed but nothing verified it
 *
 * Design contract: hooks are FAIL-SAFE. Any error, missing intelligence, or
 * unparseable input resolves to "allow" (exit 0, no output). Enforcement only
 * ever engages when intelligence exists and the user opted into the hard gates.
 * A coding session must never be broken by this engine.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { computeFreshness } from "../freshness/index.js";

export type HookEvent = "session-start" | "pre-tool-use" | "post-tool-use" | "stop";

export const HOOK_EVENTS: readonly HookEvent[] = [
  "session-start",
  "pre-tool-use",
  "post-tool-use",
  "stop",
];

export function isHookEvent(value: string): value is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(value);
}

/** Subset of the Claude Code hook stdin payload we rely on. Extra keys are ignored. */
export interface HookInput {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: { file_path?: string; command?: string; [k: string]: unknown };
  tool_response?: { success?: boolean; [k: string]: unknown };
  stop_hook_active?: boolean;
  [k: string]: unknown;
}

export interface HookResult {
  /** Process exit code. Always 0 for our hooks — decisions travel in stdout JSON. */
  exitCode: number;
  /** JSON to emit on stdout, or undefined to stay silent. */
  stdout?: string;
}

const ALLOW: HookResult = { exitCode: 0 };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface HookConfig {
  freshnessThreshold: number;
  /** When true, PreToolUse denies edits while any intelligence doc scores < 50. */
  blockStaleEdits: boolean;
  /** When true, Stop blocks completion if source changed but no validation ran. */
  requireValidationOnStop: boolean;
}

export const DEFAULT_HOOK_CONFIG: HookConfig = {
  freshnessThreshold: 60,
  blockStaleEdits: false,
  requireValidationOnStop: false,
};

const CONFIG_PATH = ".engineering-intelligence/ei.config.json";

export async function loadHookConfig(root: string): Promise<HookConfig> {
  try {
    const raw = await readFile(path.join(root, CONFIG_PATH), "utf8");
    const parsed = JSON.parse(raw) as { hooks?: Partial<HookConfig> };
    return { ...DEFAULT_HOOK_CONFIG, ...(parsed.hooks ?? {}) };
  } catch {
    return { ...DEFAULT_HOOK_CONFIG };
  }
}

/** Base command the host invokes for a hook event (matches the repo's `npx` convention). */
export function hookCommand(event: HookEvent): string {
  return `npx engineering-intelligence hook ${event}`;
}

/**
 * `.claude/settings.json` content wiring all four lifecycle hooks to the CLI.
 * Rendered as a whole managed file; if the user already owns settings.json the
 * installer preserves theirs and `doctor` surfaces this snippet to merge.
 */
export function claudeCodeHookSettings(): string {
  return JSON.stringify(
    {
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: hookCommand("session-start") }] }],
        PreToolUse: [
          { matcher: "Edit|Write|NotebookEdit|MultiEdit", hooks: [{ type: "command", command: hookCommand("pre-tool-use") }] },
        ],
        PostToolUse: [
          { matcher: "Edit|Write|NotebookEdit|MultiEdit|Bash", hooks: [{ type: "command", command: hookCommand("post-tool-use") }] },
        ],
        Stop: [{ hooks: [{ type: "command", command: hookCommand("stop") }] }],
      },
    },
    null,
    2,
  ) + "\n";
}

/** The default config file the installer seeds. Exported so the adapter renders it. */
export function defaultConfigFile(): string {
  return JSON.stringify(
    {
      hooks: {
        freshnessThreshold: DEFAULT_HOOK_CONFIG.freshnessThreshold,
        blockStaleEdits: DEFAULT_HOOK_CONFIG.blockStaleEdits,
        requireValidationOnStop: DEFAULT_HOOK_CONFIG.requireValidationOnStop,
      },
    },
    null,
    2,
  ) + "\n";
}

// ---------------------------------------------------------------------------
// Source / validation classification
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".c", ".h", ".cc", ".cpp", ".hpp", ".cs", ".swift", ".kt",
  ".scala", ".sql", ".vue", ".svelte",
]);

/** True for product/source files whose change should be verified — excludes the
 *  intelligence layer, IDE config, and vendored/build output. */
export function isSourceFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  if (
    normalized.startsWith(".engineering-intelligence/") ||
    normalized.startsWith(".claude/") ||
    normalized.includes("node_modules/") ||
    normalized.startsWith("dist/") ||
    normalized.startsWith("build/")
  ) {
    return false;
  }
  return SOURCE_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

const VALIDATION_PATTERN =
  /\b(test|tests|spec|jest|vitest|mocha|ava|pytest|tox|nox|unittest|lint|eslint|ruff|flake8|pylint|tsc|typecheck|type-check|mypy|pyright|build|check|cargo\s+(test|check|clippy)|go\s+(test|vet|build)|gradle|mvn|rspec|phpunit|dotnet\s+test)\b/i;

/** True when a shell command looks like it exercises the code (tests/types/lint/build). */
export function isValidationCommand(command: string): boolean {
  return VALIDATION_PATTERN.test(command);
}

/** Best-effort discovery of the project's own check commands, for guidance text. */
async function detectProjectCheckCommands(root: string): Promise<string[]> {
  const commands: string[] = [];
  try {
    const pkgRaw = await readFile(path.join(root, "package.json"), "utf8");
    const scripts = (JSON.parse(pkgRaw) as { scripts?: Record<string, string> }).scripts ?? {};
    for (const key of ["test", "lint", "typecheck", "type-check", "build", "check", "ci"]) {
      if (scripts[key]) commands.push(key === "test" ? "npm test" : `npm run ${key}`);
    }
  } catch { /* no package.json */ }
  if (commands.length === 0) {
    for (const [file, cmd] of [
      ["pyproject.toml", "pytest"],
      ["setup.cfg", "pytest"],
      ["Cargo.toml", "cargo test"],
      ["go.mod", "go test ./..."],
    ] as const) {
      try { await readFile(path.join(root, file), "utf8"); commands.push(cmd); break; } catch { /* next */ }
    }
  }
  return commands;
}

// ---------------------------------------------------------------------------
// Session-scoped state (pending changes + validation evidence)
// ---------------------------------------------------------------------------

interface SessionState {
  changedFiles: string[];
  validationCommands: string[];
}

const STATE_DIR = ".engineering-intelligence/.hooks-state";

function sessionId(input: HookInput): string {
  const raw = input.session_id ?? "default";
  return raw.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128) || "default";
}

function statePath(root: string, input: HookInput): string {
  return path.join(root, STATE_DIR, `${sessionId(input)}.json`);
}

async function readState(root: string, input: HookInput): Promise<SessionState> {
  try {
    const raw = await readFile(statePath(root, input), "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return {
      changedFiles: Array.isArray(parsed.changedFiles) ? parsed.changedFiles : [],
      validationCommands: Array.isArray(parsed.validationCommands) ? parsed.validationCommands : [],
    };
  } catch {
    return { changedFiles: [], validationCommands: [] };
  }
}

async function writeState(root: string, input: HookInput, state: SessionState): Promise<void> {
  const dir = path.join(root, STATE_DIR);
  await mkdir(dir, { recursive: true });
  await ensureStateGitignored(root);
  await writeFile(statePath(root, input), JSON.stringify(state), "utf8");
}

/** Keep ephemeral session state out of version control in the target repo. */
async function ensureStateGitignored(root: string): Promise<void> {
  const gitignorePath = path.join(root, ".engineering-intelligence", ".gitignore");
  let existing = "";
  try { existing = await readFile(gitignorePath, "utf8"); } catch { /* new file */ }
  if (!existing.includes(".hooks-state/")) {
    const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
    await writeFile(gitignorePath, existing + prefix + ".hooks-state/\n", "utf8");
  }
}

// ---------------------------------------------------------------------------
// Output helpers (Claude Code hook JSON contract)
// ---------------------------------------------------------------------------

function sessionStartContext(text: string): HookResult {
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text },
    }),
  };
}

function preToolUseContext(text: string): HookResult {
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: text },
    }),
  };
}

function preToolUseDeny(reason: string): HookResult {
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  };
}

function stopBlock(reason: string): HookResult {
  return { exitCode: 0, stdout: JSON.stringify({ decision: "block", reason }) };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function onSessionStart(root: string, input: HookInput, config: HookConfig): Promise<HookResult> {
  // Fresh session: clear any stale evidence from a previous session id collision.
  await writeState(root, input, { changedFiles: [], validationCommands: [] }).catch(() => {});

  const report = await computeFreshness(root, config.freshnessThreshold);
  if (report.scores.length === 0) {
    // No intelligence initialized — nudge, but never block.
    return sessionStartContext(
      "Engineering Intelligence: no persisted intelligence found. Run `initialize-engineering-intelligence` to document this codebase so future work reuses it instead of re-exploring.",
    );
  }

  const stale = report.scores.filter((s) => s.action !== "none").sort((a, b) => a.score - b.score);
  const lines = [
    `Engineering Intelligence — freshness: ${report.driftDecision} (threshold ${report.threshold}).`,
    `${report.scores.length} intelligence docs; ${stale.length} need attention.`,
  ];
  if (stale.length > 0) {
    const top = stale.slice(0, 5).map((s) => `  - ${s.docPath} (score ${s.score}, ${s.action})`);
    lines.push("Stale artifacts:", ...top);
    lines.push("Run `sync-engineering-intelligence` to refresh before relying on these.");
  } else {
    lines.push("All intelligence is fresh — prefer it over re-reading source.");
  }
  return sessionStartContext(lines.join("\n"));
}

async function onPreToolUse(root: string, input: HookInput, config: HookConfig): Promise<HookResult> {
  const targetPath = input.tool_input?.file_path;
  if (!targetPath) return ALLOW;
  const rel = path.relative(root, path.resolve(root, targetPath));
  if (!isSourceFile(rel)) return ALLOW; // editing docs/config/intelligence is always fine

  const report = await computeFreshness(root, config.freshnessThreshold);
  if (report.scores.length === 0 || report.driftDecision === "Proceed") return ALLOW;

  const stale = report.scores
    .filter((s) => s.action !== "none")
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((s) => `  - ${s.docPath} (score ${s.score})`);
  const detail = [
    `Engineering Intelligence flags stale documentation (${report.driftDecision}).`,
    "Affected artifacts:",
    ...stale,
    "Sync with `sync-engineering-intelligence` (or `npx engineering-intelligence freshness .`) so this change is guided by accurate intelligence.",
  ].join("\n");

  if (config.blockStaleEdits && report.driftDecision === "Block implementation") {
    return preToolUseDeny(detail);
  }
  return preToolUseContext(detail);
}

async function onPostToolUse(root: string, input: HookInput): Promise<HookResult> {
  const tool = input.tool_name ?? "";
  const state = await readState(root, input);
  let dirty = false;

  if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(tool)) {
    const targetPath = input.tool_input?.file_path;
    if (targetPath) {
      const rel = path.relative(root, path.resolve(root, targetPath));
      if (isSourceFile(rel) && !state.changedFiles.includes(rel)) {
        state.changedFiles.push(rel);
        dirty = true;
      }
    }
  } else if (tool === "Bash") {
    const command = input.tool_input?.command ?? "";
    // Only credit commands that actually succeeded, when the host reports it.
    const succeeded = input.tool_response?.success !== false;
    if (command && succeeded && isValidationCommand(command)) {
      const trimmed = command.slice(0, 200);
      if (!state.validationCommands.includes(trimmed)) {
        state.validationCommands.push(trimmed);
        dirty = true;
      }
    }
  }

  if (dirty) await writeState(root, input, state).catch(() => {});
  return ALLOW; // tracking is invisible
}

async function onStop(root: string, input: HookInput, config: HookConfig): Promise<HookResult> {
  if (!config.requireValidationOnStop) return ALLOW;
  // Avoid infinite loops: if we already blocked and the model is re-stopping, let it go.
  if (input.stop_hook_active) return ALLOW;

  const state = await readState(root, input);
  if (state.changedFiles.length === 0) return ALLOW; // no code changed
  if (state.validationCommands.length > 0) return ALLOW; // something was run

  const checks = await detectProjectCheckCommands(root);
  const suggestion = checks.length > 0
    ? `Run one of: ${checks.join(", ")}.`
    : "Run this project's tests / type-check / lint before finishing.";
  const changed = state.changedFiles.slice(0, 8).map((f) => `  - ${f}`).join("\n");
  return stopBlock(
    [
      "Engineering Intelligence: source files changed but no validation command ran this session.",
      "Environmental backpressure requires the environment — not inspection — to confirm the change.",
      "Changed files:",
      changed,
      suggestion,
      "If validation is genuinely unavailable, say so explicitly, then stop again.",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function parseHookInput(raw: string): HookInput {
  try {
    const parsed = JSON.parse(raw) as HookInput;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Run a single hook event. Never throws: on any failure it resolves to ALLOW so
 * the host session is never broken by the intelligence layer.
 */
export async function runHook(event: HookEvent, root: string, input: HookInput): Promise<HookResult> {
  try {
    const config = await loadHookConfig(root);
    switch (event) {
      case "session-start": return await onSessionStart(root, input, config);
      case "pre-tool-use":  return await onPreToolUse(root, input, config);
      case "post-tool-use": return await onPostToolUse(root, input);
      case "stop":          return await onStop(root, input, config);
      default:              return ALLOW;
    }
  } catch {
    return ALLOW;
  }
}
