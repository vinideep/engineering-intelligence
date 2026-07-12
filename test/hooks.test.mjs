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

import {
  runHook,
  parseHookInput,
  isSourceFile,
  isValidationCommand,
  loadHookConfig,
  DEFAULT_HOOK_CONFIG,
  claudeCodeHookSettings,
  defaultConfigFile,
} from "../dist/hooks/index.js";

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

test("isValidationCommand recognizes test/type/lint/build commands", () => {
  assert.equal(isValidationCommand("npm test"), true);
  assert.equal(isValidationCommand("npx tsc --noEmit"), true);
  assert.equal(isValidationCommand("pytest -q"), true);
  assert.equal(isValidationCommand("cargo test"), true);
  assert.equal(isValidationCommand("npm run lint"), true);
  assert.equal(isValidationCommand("ls -la"), false);
  assert.equal(isValidationCommand("git status"), false);
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

test("PostToolUse records changed source files and successful validation commands", async () => {
  const root = await tmpRoot();
  const sid = "sess";
  const base = { session_id: sid };

  await runHook("post-tool-use", root, { ...base, tool_name: "Write", tool_input: { file_path: path.join(root, "src/a.ts") } });
  await runHook("post-tool-use", root, { ...base, tool_name: "Edit", tool_input: { file_path: path.join(root, "README.md") } });
  await runHook("post-tool-use", root, { ...base, tool_name: "Bash", tool_input: { command: "ls" } });
  await runHook("post-tool-use", root, { ...base, tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: { success: true } });
  await runHook("post-tool-use", root, { ...base, tool_name: "Bash", tool_input: { command: "npm run lint" }, tool_response: { success: false } });

  const state = await readState(root, sid);
  assert.deepEqual(state.changedFiles, ["src/a.ts"], "only source files are tracked");
  assert.deepEqual(state.validationCommands, ["npm test"], "only successful validation commands count");
});

test("Stop is a no-op unless requireValidationOnStop is enabled", async () => {
  const root = await tmpRoot(); // default config: gate off
  const sid = "off";
  await runHook("post-tool-use", root, { session_id: sid, tool_name: "Write", tool_input: { file_path: path.join(root, "src/a.ts") } });
  const result = await runHook("stop", root, { session_id: sid });
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, undefined, "gate off → never blocks");
});

test("Stop blocks unvalidated code change, allows after validation, and never loops", async () => {
  const root = await tmpRoot({ requireValidationOnStop: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
  const sid = "gate";

  // No changes yet → allow.
  assert.equal((await runHook("stop", root, { session_id: sid })).stdout, undefined);

  // Source changed, nothing run → block.
  await runHook("post-tool-use", root, { session_id: sid, tool_name: "Write", tool_input: { file_path: path.join(root, "src/a.ts") } });
  const blocked = await runHook("stop", root, { session_id: sid });
  assert.ok(blocked.stdout, "should block");
  const decision = JSON.parse(blocked.stdout);
  assert.equal(decision.decision, "block");
  assert.match(decision.reason, /npm test/, "reason surfaces the real project check command");

  // The stop_hook_active guard prevents an infinite block loop.
  assert.equal((await runHook("stop", root, { session_id: sid, stop_hook_active: true })).stdout, undefined);

  // Validation runs → allow.
  await runHook("post-tool-use", root, { session_id: sid, tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: { success: true } });
  assert.equal((await runHook("stop", root, { session_id: sid })).stdout, undefined, "validated → allow");
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
