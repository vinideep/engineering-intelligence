/**
 * engineering-intelligence → GraphWard rename compatibility.
 *
 * A project installed by a pre-rename release must upgrade with one `update`:
 * state moves to `.graphward/`, the old hook/MCP/managed-block entries are
 * replaced (never duplicated), and old-named skills/workflows are removed.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { install, update } from "../dist/installer/index.js";
import { migrateLegacyLayout, envWithLegacy } from "../dist/config/legacy.js";
import { loadGwConfig } from "../dist/config/index.js";
import { mergeHookConfig, removeOurEntries } from "../dist/installer/json-merge.js";
import { adoptLegacyBlock, readManagedBlock } from "../dist/installer/blocks.js";
import { ProjectFilePolicy } from "../dist/project-files/index.js";
import { mcpServerRegistration } from "../dist/mcp/index.js";

const options = { packageVersion: "6.0.0" };
const hash = (content) => createHash("sha256").update(content.trimEnd()).digest("hex");

async function project() {
  return mkdtemp(path.join(tmpdir(), "gw-rename-"));
}

test("migrateLegacyLayout moves .engineering-intelligence/ and ei.config.json once", async () => {
  const root = await project();
  await mkdir(path.join(root, ".engineering-intelligence", "graph"), { recursive: true });
  await writeFile(path.join(root, ".engineering-intelligence", "ei.config.json"), JSON.stringify({ hooks: { blockStaleEdits: true } }));
  await writeFile(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"), "{}");

  const first = migrateLegacyLayout(root);
  assert.equal(first.migrated, true);
  assert.ok(existsSync(path.join(root, ".graphward", "gw.config.json")));
  assert.ok(existsSync(path.join(root, ".graphward", "graph", "dependency-graph.json")));
  assert.ok(!existsSync(path.join(root, ".engineering-intelligence")));
  assert.equal((await loadGwConfig(root)).hooks.blockStaleEdits, true);

  assert.equal(migrateLegacyLayout(root).migrated, false, "idempotent");
});

test("migrateLegacyLayout never merges when both layouts exist", async () => {
  const root = await project();
  await mkdir(path.join(root, ".engineering-intelligence"), { recursive: true });
  await mkdir(path.join(root, ".graphward"), { recursive: true });
  const result = migrateLegacyLayout(root);
  assert.equal(result.migrated, false);
  assert.match(result.message ?? "", /Both/);
  assert.ok(existsSync(path.join(root, ".engineering-intelligence")), "legacy dir left for the user");
});

test("GW_* environment variables fall back to EI_*", () => {
  const saved = { gw: process.env.GW_TEST_VAR, ei: process.env.EI_TEST_VAR };
  try {
    delete process.env.GW_TEST_VAR;
    process.env.EI_TEST_VAR = "legacy";
    assert.equal(envWithLegacy("TEST_VAR"), "legacy");
    process.env.GW_TEST_VAR = "current";
    assert.equal(envWithLegacy("TEST_VAR"), "current");
  } finally {
    if (saved.gw === undefined) delete process.env.GW_TEST_VAR; else process.env.GW_TEST_VAR = saved.gw;
    if (saved.ei === undefined) delete process.env.EI_TEST_VAR; else process.env.EI_TEST_VAR = saved.ei;
  }
});

test(".eiignore is honoured when no .gwignore exists", async () => {
  const root = await project();
  await writeFile(path.join(root, ".eiignore"), "vendor-x/\n");
  const policy = await ProjectFilePolicy.load(root);
  assert.equal(policy.explain("vendor-x/a.ts").included, false);
  await writeFile(path.join(root, ".gwignore"), "other/\n");
  const next = await ProjectFilePolicy.load(root);
  assert.equal(next.explain("vendor-x/a.ts").included, true, ".gwignore takes precedence");
  assert.equal(next.explain("other/a.ts").included, false);
});

test("hook merge replaces pre-rename hook entries and MCP key instead of duplicating", () => {
  const legacySettings = JSON.stringify({
    permissions: { allow: ["Bash(ls)"] },
    hooks: {
      SessionStart: [
        { hooks: [{ type: "command", command: "engineering-intelligence hook session-start" }] },
        { hooks: [{ type: "command", command: "my-own-hook" }] },
      ],
    },
  });
  const ours = JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "graphward hook session-start" }] }] } });
  const merged = JSON.parse(mergeHookConfig(legacySettings, ours));
  const commands = merged.hooks.SessionStart.flatMap((e) => e.hooks.map((h) => h.command));
  assert.deepEqual(commands.sort(), ["graphward hook session-start", "my-own-hook"]);
  assert.deepEqual(merged.permissions, { allow: ["Bash(ls)"] });

  const legacyMcp = JSON.stringify({ mcpServers: { "engineering-intelligence": { command: "npx" }, other: { command: "x" } } });
  const mergedMcp = JSON.parse(mergeHookConfig(legacyMcp, mcpServerRegistration("6.0.0")));
  assert.deepEqual(Object.keys(mergedMcp.mcpServers).sort(), ["graphward", "other"]);
  assert.deepEqual(mergedMcp.mcpServers.graphward.args, ["-y", "graphward@6.0.0", "mcp"]);

  const removed = JSON.parse(removeOurEntries(legacyMcp));
  assert.deepEqual(Object.keys(removed.mcpServers), ["other"], "uninstall removes legacy key too");
});

test("adoptLegacyBlock relabels an old managed block in place", () => {
  const source = "# Mine\n\n<!-- engineering-intelligence:start -->\nold\n<!-- engineering-intelligence:end -->\n\ntail\n";
  const adopted = adoptLegacyBlock(source, "graphward");
  assert.equal(readManagedBlock(adopted, "graphward"), "old");
  assert.doesNotMatch(adopted, /engineering-intelligence:start/);
  assert.match(adopted, /^# Mine/);
  assert.match(adopted, /tail\n$/);
});

test("update upgrades a pre-rename installation cleanly", async () => {
  const root = await project();
  await writeFile(path.join(root, "CLAUDE.md"), "# My project notes\n");
  await install(root, ["claude-code"], options);

  // Rewrite the fresh install into the shape a pre-rename release left on disk.
  await rename(path.join(root, ".graphward"), path.join(root, ".engineering-intelligence"));
  const manifestPath = path.join(root, ".engineering-intelligence", "install-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  const claudeMd = (await readFile(path.join(root, "CLAUDE.md"), "utf8"))
    .replaceAll("<!-- graphward:start -->", "<!-- engineering-intelligence:start -->")
    .replaceAll("<!-- graphward:end -->", "<!-- engineering-intelligence:end -->");
  await writeFile(path.join(root, "CLAUDE.md"), claudeMd);
  for (const entry of manifest.files) if (entry.path === "CLAUDE.md") entry.blockId = "engineering-intelligence";

  const settingsPath = path.join(root, ".claude", "settings.json");
  await writeFile(settingsPath, (await readFile(settingsPath, "utf8")).replace(/npx graphward@[^ ]+ hook/g, "npx engineering-intelligence hook"));
  const mcpPath = path.join(root, ".mcp.json");
  await writeFile(mcpPath, JSON.stringify({ mcpServers: { "engineering-intelligence": { command: "npx", args: ["-y", "engineering-intelligence", "mcp"] } } }, null, 2));

  const oldSkill = ".claude/skills/engineering-intelligence-skill/SKILL.md";
  const oldSkillContent = "---\nname: engineering-intelligence-skill\ndescription: old\n---\nold body\n";
  await mkdir(path.join(root, path.dirname(oldSkill)), { recursive: true });
  await writeFile(path.join(root, oldSkill), oldSkillContent);
  manifest.files.push({ path: oldSkill, kind: "file", hash: hash(oldSkillContent), owners: ["claude-code"] });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  // What the CLI does before any command, then the documented upgrade step.
  assert.equal(migrateLegacyLayout(root).migrated, true);
  const result = await update(root, options);
  assert.equal(result.conflicts, 0, JSON.stringify(result.actions.filter((a) => a.status === "conflict" || a.status === "error")));

  const finalClaude = await readFile(path.join(root, "CLAUDE.md"), "utf8");
  assert.match(finalClaude, /^# My project notes/);
  assert.equal((finalClaude.match(/:start -->/g) ?? []).length, 1, "exactly one managed block");
  assert.match(finalClaude, /<!-- graphward:start -->/);

  const settings = await readFile(settingsPath, "utf8");
  assert.doesNotMatch(settings, /engineering-intelligence hook/);
  assert.match(settings, /graphward@6\.0\.0 hook/);

  const mcp = JSON.parse(await readFile(mcpPath, "utf8"));
  assert.deepEqual(Object.keys(mcp.mcpServers), ["graphward"]);

  assert.ok(!existsSync(path.join(root, oldSkill)), "old-named skill removed");
  assert.ok(existsSync(path.join(root, ".claude/skills/graphward-skill/SKILL.md")));
  assert.ok(existsSync(path.join(root, ".graphward", "install-manifest.json")));
});

test("CI templates and MCP registration pin the current package version", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  for (const rel of ["../templates/github-action/graphward-impact.yml", "../templates/canonical/ci/gw-drift-check.yml"]) {
    const text = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.match(text, new RegExp(`GRAPHWARD_VERSION: "${pkg.version.replace(/\./g, "\\.")}"`), `${rel} pins ${pkg.version}`);
    assert.doesNotMatch(text, /npx --yes graphward(?!@)/, `${rel} never runs an unpinned CLI`);
  }
  assert.match(mcpServerRegistration(), new RegExp(`graphward@${pkg.version.replace(/\./g, "\\.")}`));
});
