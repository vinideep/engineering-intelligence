/**
 * Hook engine unit tests — drive `runHook` at the library level (deterministic,
 * no CLI spawn). They prove the enforcement contract:
 *  - source vs non-source classification
 *  - validation-command detection
 *  - PostToolUse records changed files and successful validation commands
 *  - Stop blocks unvalidated code changes only when opted in, and never loops
 *  - every path is fail-safe (missing intelligence → allow)
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { execFileSync } from "node:child_process";
import {
  runHook,
  parseHookInput,
  normalizeInput,
  isSourceFile,
  looksLikeValidationCommand,
  isHookHost,
  loadHookConfig,
  DEFAULT_HOOK_CONFIG,
  claudeCodeHookSettings,
  cursorHookSettings,
  defaultConfigFile,
} from "../dist/hooks/index.js";
import { runVerification } from "../dist/verify/index.js";

async function tmpRoot(config) {
  const root = await mkdtemp(path.join(tmpdir(), "ei-hooks-"));
  await mkdir(path.join(root, ".engineering-intelligence"), { recursive: true });
  if (config) {
    await writeFile(
      path.join(root, ".engineering-intelligence", "ei.config.json"),
      JSON.stringify({ hooks: config }),
      "utf8",
    );
  }
  return root;
}

/** A real git repo with a committed baseline and a passing `npm test`, so the
 *  receipt-based Stop gate has genuine change detection to work against. */
async function gitRoot(config) {
  const root = await tmpRoot(config);
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init");
  git("config", "user.email", "t@t.co");
  git("config", "user.name", "t");
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node -e \"0\"" } }), "utf8");
  await mkdir(path.join(root, "src"), { recursive: true });
  git("add", "-A");
  git("commit", "-m", "base");
  return root;
}

async function readState(root, sid) {
  const raw = await readFile(
    path.join(root, ".engineering-intelligence", ".hooks-state", `${sid}.json`),
    "utf8",
  );
  return JSON.parse(raw);
}

test("isSourceFile classifies product code but excludes intelligence/config/vendored", () => {
  assert.equal(isSourceFile("src/app.ts"), true);
  assert.equal(isSourceFile("lib/handler.py"), true);
  assert.equal(isSourceFile("README.md"), false);
  assert.equal(isSourceFile(".engineering-intelligence/knowledge-base/00.md"), false);
  assert.equal(isSourceFile(".claude/settings.json"), false);
  assert.equal(isSourceFile("node_modules/x/index.js"), false);
  assert.equal(isSourceFile("dist/app.js"), false);
});

test("looksLikeValidationCommand is a UX hint only, and no longer gates anything", () => {
  assert.equal(looksLikeValidationCommand("npm test"), true);
  assert.equal(looksLikeValidationCommand("npx tsc --noEmit"), true);
  assert.equal(looksLikeValidationCommand("pytest -q"), true);
  assert.equal(looksLikeValidationCommand("cargo test"), true);
  assert.equal(looksLikeValidationCommand("ls -la"), false);
  assert.equal(looksLikeValidationCommand("git status"), false);
  // These defeated the OLD gate. They may still look test-shaped to a human, but
  // nothing about this function can satisfy the Stop gate any more — only a receipt can.
  assert.equal(looksLikeValidationCommand("rm -rf build"), false);
  assert.equal(looksLikeValidationCommand("echo check"), false);
  assert.equal(looksLikeValidationCommand("git commit -m 'add tests'"), false);
});

test("loadHookConfig merges overrides onto defaults and falls back safely", async () => {
  const root = await tmpRoot({ requireValidationOnStop: true });
  const config = await loadHookConfig(root);
  assert.equal(config.requireValidationOnStop, true);
  assert.equal(config.blockStaleEdits, DEFAULT_HOOK_CONFIG.blockStaleEdits);
  assert.equal(config.freshnessThreshold, DEFAULT_HOOK_CONFIG.freshnessThreshold);

  const bare = await mkdtemp(path.join(tmpdir(), "ei-hooks-noconf-"));
  assert.deepEqual(await loadHookConfig(bare), DEFAULT_HOOK_CONFIG);
});

test("PostToolUse records changed source files and check-shaped commands", async () => {
  const root = await tmpRoot();
  const sid = "sess";
  const base = { session_id: sid };

  await runHook("post-tool-use", root, { ...base, tool_name: "Write", tool_input: { file_path: path.join(root, "src/a.ts") } });
  await runHook("post-tool-use", root, { ...base, tool_name: "Edit", tool_input: { file_path: path.join(root, "README.md") } });
  await runHook("post-tool-use", root, { ...base, tool_name: "Bash", tool_input: { command: "ls" } });
  await runHook("post-tool-use", root, { ...base, tool_name: "Bash", tool_input: { command: "npm test" } });

  const state = await readState(root, sid);
  assert.deepEqual(state.changedFiles, ["src/a.ts"], "only source files are tracked");
  assert.deepEqual(state.validationCommands, ["npm test"], "check-shaped commands recorded as a hint");
});

test("Stop is a no-op unless requireValidationOnStop is enabled", async () => {
  const root = await gitRoot(); // default config: gate off
  await writeFile(path.join(root, "src/a.ts"), "export const a = 1;\n", "utf8");
  const result = await runHook("stop", root, { session_id: "off" });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, undefined, "gate off → never blocks");
});

test("Stop requires a passing receipt covering the current bytes", async () => {
  const root = await gitRoot({ requireValidationOnStop: true });
  const sid = "gate";
  const stop = async (extra = {}) => runHook("stop", root, { session_id: sid, ...extra });

  // Clean tree → allow.
  assert.equal((await stop()).stdout, undefined, "no source change → allow");

  // Source changed, nothing verified → block.
  await writeFile(path.join(root, "src/a.ts"), "export const a = 1;\n", "utf8");
  const blocked = await stop();
  assert.ok(blocked.stdout, "unverified change must block");
  const decision = JSON.parse(blocked.stdout);
  assert.equal(decision.decision, "block");
  assert.match(decision.reason, /src\/a\.ts/, "names the unverified file");
  assert.match(decision.reason, /npm test/, "surfaces the real project check command");

  // THE OLD BYPASS: a test-shaped shell command must no longer satisfy the gate.
  await runHook("post-tool-use", root, { session_id: sid, tool_name: "Bash", tool_input: { command: "rm -rf build" } });
  await runHook("post-tool-use", root, { session_id: sid, tool_name: "Bash", tool_input: { command: "npm test" } });
  assert.ok((await stop()).stdout, "claiming to have run tests must not satisfy the gate");

  // The stop_hook_active guard still prevents an infinite block loop.
  assert.equal((await stop({ stop_hook_active: true })).stdout, undefined);

  // A real verification run produces a receipt → allow.
  const { receipt } = await runVerification(root);
  assert.equal(receipt.verdict, "pass");
  assert.equal((await stop()).stdout, undefined, "passing receipt → allow");

  // Editing after verification invalidates the receipt → block again.
  await writeFile(path.join(root, "src/a.ts"), "export const a = 2;\n", "utf8");
  assert.ok((await stop()).stdout, "receipt must not vouch for bytes it never saw");
});

test("Stop stays blocked when verification actually fails", async () => {
  const root = await gitRoot({ requireValidationOnStop: true });
  // A check command that always fails.
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node -e \"process.exit(1)\"" } }), "utf8");
  await writeFile(path.join(root, "src/a.ts"), "export const a = 1;\n", "utf8");

  const { receipt } = await runVerification(root);
  assert.equal(receipt.verdict, "fail", "a failing command must never produce a passing receipt");

  const blocked = await runHook("stop", root, { session_id: "failing" });
  assert.ok(blocked.stdout, "failed verification must still block");
  assert.match(JSON.parse(blocked.stdout).reason, /FAILED/, "surfaces the failure");
});

test("SessionStart resets session state and injects context", async () => {
  const root = await tmpRoot();
  const sid = "start";
  // Seed stale state from a previous session with the same id.
  await runHook("post-tool-use", root, { session_id: sid, tool_name: "Write", tool_input: { file_path: path.join(root, "src/a.ts") } });
  assert.deepEqual((await readState(root, sid)).changedFiles, ["src/a.ts"]);

  const result = await runHook("session-start", root, { session_id: sid });
  assert.equal(result.exitCode, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(out.hookSpecificOutput.additionalContext, /Engineering Intelligence/);
  assert.deepEqual((await readState(root, sid)).changedFiles, [], "session state reset on start");
});

test("PreToolUse allows non-source edits and is fail-safe without intelligence", async () => {
  const root = await tmpRoot();
  const allowDoc = await runHook("pre-tool-use", root, { session_id: "p", tool_name: "Write", tool_input: { file_path: path.join(root, "README.md") } });
  assert.equal(allowDoc.stdout, undefined, "editing docs is always allowed");

  const allowSrc = await runHook("pre-tool-use", root, { session_id: "p", tool_name: "Write", tool_input: { file_path: path.join(root, "src/a.ts") } });
  assert.equal(allowSrc.stdout, undefined, "no intelligence → Proceed → allow");
});

test("runHook never throws on malformed input", async () => {
  const root = await tmpRoot();
  const result = await runHook("post-tool-use", root, parseHookInput("not json"));
  assert.equal(result.exitCode, 0);
});

test("rendered Claude settings and default config are valid JSON with hook wiring", () => {
  const settings = JSON.parse(claudeCodeHookSettings());
  assert.ok(settings.hooks.SessionStart, "SessionStart wired");
  assert.ok(settings.hooks.Stop, "Stop wired");
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /engineering-intelligence hook pre-tool-use/);

  const config = JSON.parse(defaultConfigFile());
  assert.equal(config.hooks.blockStaleEdits, false);
  assert.equal(config.hooks.requireValidationOnStop, false);
});

// --- Cross-IDE: Cursor host --------------------------------------------------

test("isHookHost recognizes claude-code and cursor only", () => {
  assert.equal(isHookHost("claude-code"), true);
  assert.equal(isHookHost("cursor"), true);
  assert.equal(isHookHost("copilot"), false);
});

test("cursorHookSettings renders Cursor's schema with --host cursor commands", () => {
  const s = JSON.parse(cursorHookSettings());
  assert.equal(s.version, 1);
  // Cursor's granular edit/shell events both route to our post-tool-use handler.
  for (const e of ["sessionStart", "preToolUse", "afterFileEdit", "afterShellExecution", "stop"]) {
    assert.ok(Array.isArray(s.hooks[e]), `missing cursor event ${e}`);
  }
  assert.match(s.hooks.sessionStart[0].command, /hook session-start --host cursor/);
  assert.match(s.hooks.afterShellExecution[0].command, /hook post-tool-use --host cursor/);
});

test("normalizeInput maps Cursor field names and granular events to the neutral shape", () => {
  const edit = normalizeInput("cursor", JSON.stringify({
    conversation_id: "c1", workspace_roots: ["/repo"], hook_event_name: "afterFileEdit", file_path: "/repo/src/a.ts",
  }));
  assert.equal(edit.session_id, "c1");
  assert.equal(edit.cwd, "/repo");
  assert.equal(edit.tool_name, "Edit");
  assert.equal(edit.tool_input.file_path, "/repo/src/a.ts");

  const shellOk = normalizeInput("cursor", JSON.stringify({ conversation_id: "c1", hook_event_name: "afterShellExecution", command: "npm test", exit_code: 0 }));
  assert.equal(shellOk.tool_name, "Bash");
  assert.equal(shellOk.tool_response.success, true);
  const shellFail = normalizeInput("cursor", JSON.stringify({ hook_event_name: "afterShellExecution", command: "npm test", exit_code: 1 }));
  assert.equal(shellFail.tool_response.success, false);

  // Claude passthrough is unchanged.
  const claude = normalizeInput("claude-code", JSON.stringify({ session_id: "s", tool_name: "Write" }));
  assert.equal(claude.session_id, "s");
  assert.equal(claude.tool_name, "Write");
});

test("runHook formats output in Cursor's contract (agent_message / followup_message / permission)", async () => {
  const root = await tmpRoot({ requireValidationOnStop: true, blockStaleEdits: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
  const sid = "cur";

  // session-start → Cursor uses agent_message, not Claude's hookSpecificOutput.
  const start = await runHook("session-start", root, { session_id: sid }, "cursor");
  const startOut = JSON.parse(start.stdout);
  assert.ok("agent_message" in startOut, "cursor session-start should use agent_message");
  assert.ok(!("hookSpecificOutput" in startOut));

  // Record a source change (Cursor afterFileEdit → Edit), then stop must block via followup_message.
  const edit = normalizeInput("cursor", JSON.stringify({ session_id: sid, hook_event_name: "afterFileEdit", file_path: path.join(root, "src/a.ts") }));
  await runHook("post-tool-use", root, edit, "cursor");
  const stop = await runHook("stop", root, { session_id: sid }, "cursor");
  const stopOut = JSON.parse(stop.stdout);
  assert.ok(typeof stopOut.followup_message === "string", "cursor stop-block uses followup_message");
  assert.match(stopOut.followup_message, /npm test/);
});

test("Cursor edits with no discoverable file path fail safe (no false block)", async () => {
  const root = await tmpRoot();
  // preToolUse without a resolvable file path → allow, never a spurious deny.
  const input = normalizeInput("cursor", JSON.stringify({ session_id: "x", hook_event_name: "preToolUse" }));
  const res = await runHook("pre-tool-use", root, input, "cursor");
  assert.equal(res.stdout, undefined, "no file path → allow (fail-safe)");
});
