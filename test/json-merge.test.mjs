/**
 * Ownership tests for JSON config the user also owns.
 *
 * `.claude/settings.json` holds the user's permissions, model and their own
 * hooks. Treating it as a whole managed file meant the most likely adopter — an
 * existing Claude Code user, who therefore already has one — got a conflict and
 * the entire enforcement layer silently did not install.
 *
 * The rules these tests pin: merge without touching the user's keys, stay
 * idempotent, and on uninstall remove ONLY what we added.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeHookConfig,
  hasOurEntries,
  removeOurEntries,
  parseJsonOrEmpty,
} from "../dist/installer/json-merge.js";
import { claudeCodeHookSettings } from "../dist/hooks/index.js";
import { mcpServerRegistration } from "../dist/mcp/index.js";

const OURS = claudeCodeHookSettings();

test("merging into an existing settings.json preserves every user key", () => {
  const theirs = JSON.stringify({
    permissions: { allow: ["Bash(npm test)"] },
    model: "opus",
    env: { FOO: "bar" },
  });
  const merged = parseJsonOrEmpty(mergeHookConfig(theirs, OURS));
  assert.deepEqual(merged.permissions, { allow: ["Bash(npm test)"] });
  assert.equal(merged.model, "opus");
  assert.deepEqual(merged.env, { FOO: "bar" });
  assert.ok(merged.hooks.SessionStart, "our hooks are added alongside");
});

test("the user's own hooks survive the merge", () => {
  const theirs = JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo mine" }] }] },
  });
  const merged = parseJsonOrEmpty(mergeHookConfig(theirs, OURS));
  const commands = merged.hooks.SessionStart.map((e) => e.hooks[0].command);
  assert.ok(commands.includes("echo mine"), "user hook must not be replaced");
  assert.ok(commands.some((c) => c.includes("engineering-intelligence hook")), "ours is added");
  assert.equal(merged.hooks.SessionStart.length, 2);
});

test("merging is idempotent — re-installing never duplicates our entries", () => {
  const once = mergeHookConfig("{}", OURS);
  const twice = mergeHookConfig(once, OURS);
  assert.equal(twice, once);
  const parsed = parseJsonOrEmpty(twice);
  assert.equal(parsed.hooks.SessionStart.length, 1);
});

test("unparseable user config is never destroyed by a bad parse", () => {
  // Garbage in means we start from empty and write our keys; we must not throw.
  const merged = mergeHookConfig("{ not json", OURS);
  assert.ok(parseJsonOrEmpty(merged).hooks, "still produces a valid config");
});

test("hasOurEntries detects present, missing, and partially-removed wiring", () => {
  assert.equal(hasOurEntries(mergeHookConfig("{}", OURS), OURS), true);
  assert.equal(hasOurEntries(JSON.stringify({ model: "opus" }), OURS), false);

  const stripped = parseJsonOrEmpty(mergeHookConfig("{}", OURS));
  delete stripped.hooks.Stop;
  assert.equal(hasOurEntries(JSON.stringify(stripped), OURS), false, "a removed event must be detected");
});

test("uninstall removes only our hook entries, keeping the user's", () => {
  const theirs = JSON.stringify({
    permissions: { allow: ["Bash(npm test)"] },
    hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo mine" }] }] },
  });
  const remaining = parseJsonOrEmpty(removeOurEntries(mergeHookConfig(theirs, OURS)));
  assert.deepEqual(remaining.permissions, { allow: ["Bash(npm test)"] });
  assert.equal(remaining.hooks.SessionStart.length, 1, "the user's own hook survives");
  assert.equal(remaining.hooks.SessionStart[0].hooks[0].command, "echo mine");
  assert.ok(!remaining.hooks.PreToolUse, "events we added and the user did not are gone");
});

test("uninstall returns null when nothing of the user's is left", () => {
  assert.equal(removeOurEntries(mergeHookConfig("{}", OURS)), null, "file should be deleted, not left empty");
});

test("MCP registration merges beside other servers and is removed cleanly", () => {
  const theirs = JSON.stringify({ mcpServers: { "other-tool": { command: "node", args: ["x.js"] } } });
  const merged = parseJsonOrEmpty(mergeHookConfig(theirs, mcpServerRegistration()));
  assert.ok(merged.mcpServers["other-tool"], "the user's server is untouched");
  assert.ok(merged.mcpServers["engineering-intelligence"], "ours is registered");
  assert.equal(hasOurEntries(JSON.stringify(merged), mcpServerRegistration()), true);

  const remaining = parseJsonOrEmpty(removeOurEntries(JSON.stringify(merged)));
  assert.ok(remaining.mcpServers["other-tool"], "the user's server survives uninstall");
  assert.ok(!remaining.mcpServers["engineering-intelligence"], "ours is gone");
});
