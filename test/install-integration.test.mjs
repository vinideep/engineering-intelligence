/**
 * CLI integration test — runs the real `dist/cli/index.js` binary against a
 * temp directory and asserts that the optimization pipeline is applied
 * end-to-end (not just at the library level).
 *
 * What this proves that the unit tests cannot:
 *  - The CLI arg-parsing → install() → file-writing path works together
 *  - Path aliases ($AIDLC/$EI) appear in files actually written to disk
 *  - WORKFLOW-ROUTING.md and SKILLS-INDEX.md land at the expected on-disk paths
 *  - SKILL-BRIEF.md (tier-2) is smaller than SKILL.md (tier-3) on disk
 *  - A second `update` run is idempotent (no conflicts, no hash drift)
 *
 * What this still cannot prove:
 *  - Real token consumption in a live IDE session
 *  - Whether an LLM agent actually follows WORKFLOW-ROUTING.md
 *  - KV-cache hit rates on a real inference provider
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, "../dist/cli/index.js");
const REPO_ROOT = path.resolve(__dirname, "..");

function cli(args, cwd, stdin) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: cwd ?? REPO_ROOT,
    encoding: "utf8",
    timeout: 30_000,
    input: stdin,
  });
  if (result.error) throw result.error;
  return result;
}

async function tmpProject() {
  return mkdtemp(path.join(tmpdir(), "ei-integ-"));
}

async function read(root, relative) {
  return readFile(path.join(root, relative), "utf8");
}

test("CLI writes WORKFLOW-ROUTING.md and SKILLS-INDEX.md for claude-code", async () => {
  const root = await tmpProject();
  const result = cli(["install", root, "--ide", "claude-code", "--yes"]);
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${result.stderr}`);

  const routing = await read(root, ".claude/WORKFLOW-ROUTING.md");
  assert.match(routing, /Workflow Routing Table/, "routing file should contain its own header");
  assert.match(routing, /engineering-intelligence/, "routing table should list at least one workflow");

  const index = await read(root, ".claude/skills/SKILLS-INDEX.md");
  assert.match(index, /Skills Index/, "index file should contain its own header");
  assert.match(index, /aidlc-lifecycle-engine/, "index should list at least one skill name");
});

test("on-disk skills start with frontmatter and use literal paths", async () => {
  const root = await tmpProject();
  const result = cli(["install", root, "--ide", "claude-code", "--yes"]);
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${result.stderr}`);

  const skill = await read(root, ".claude/skills/aidlc-lifecycle-engine/SKILL.md");
  // Frontmatter must survive the full pipeline to disk — a host that cannot parse
  // `name`/`description` here cannot auto-invoke the skill at all.
  assert.ok(skill.startsWith("---\n"), `on-disk SKILL.md must start with frontmatter, got: ${JSON.stringify(skill.slice(0, 40))}`);
  assert.match(skill.match(/^---\n([\s\S]*?)\n---\n/)[1], /name:\s*aidlc-lifecycle-engine/);
  assert.match(skill, /\.engineering-intelligence\/aidlc\//, "on-disk SKILL.md must carry literal runtime paths");
  assert.doesNotMatch(skill, /\$AIDLC|\$EI/, "aliases must not reach disk");
});

test("CLI writes SKILL-BRIEF.md smaller than SKILL.md for claude-code", async () => {
  const root = await tmpProject();
  const result = cli(["install", root, "--ide", "claude-code", "--yes"]);
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${result.stderr}`);

  // Check tiering for a representative skill
  for (const name of ["aidlc-lifecycle-engine", "engineering-intelligence-skill", "impact-analysis-engine"]) {
    const brief = await read(root, `.claude/skills/${name}/SKILL-BRIEF.md`);
    const full = await read(root, `.claude/skills/${name}/SKILL.md`);
    assert.ok(
      brief.length < full.length * 0.5,
      `${name}: SKILL-BRIEF.md (${brief.length}c) should be < 50% of SKILL.md (${full.length}c)`,
    );
  }
});

test("CLI installs routing directives into CLAUDE.md", async () => {
  const root = await tmpProject();
  const result = cli(["install", root, "--ide", "claude-code", "--yes"]);
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${result.stderr}`);

  const claudeMd = await read(root, "CLAUDE.md");
  assert.match(claudeMd, /WORKFLOW-ROUTING\.md/, "CLAUDE.md should reference WORKFLOW-ROUTING.md");
  assert.match(claudeMd, /SKILLS-INDEX\.md/, "CLAUDE.md should reference SKILLS-INDEX.md");
  assert.match(claudeMd, /Three-tier loading/, "CLAUDE.md should contain the three-tier loading protocol");
});

test("CLI installs enforcement hooks (settings.json + ei.config.json)", async () => {
  const root = await tmpProject();
  const result = cli(["install", root, "--ide", "claude-code", "--yes"]);
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${result.stderr}`);

  const settings = JSON.parse(await read(root, ".claude/settings.json"));
  assert.match(settings.hooks.SessionStart[0].hooks[0].command, /engineering-intelligence hook session-start/);
  assert.match(settings.hooks.Stop[0].hooks[0].command, /engineering-intelligence hook stop/);

  const config = JSON.parse(await read(root, ".engineering-intelligence/ei.config.json"));
  assert.equal(config.hooks.requireValidationOnStop, false, "hard gates are opt-in by default");

  // doctor reports the managed hook files as unchanged (installed and hash-matched).
  const doc = cli(["doctor", root]);
  assert.equal(doc.status, 0, `doctor exited ${doc.status}:\n${doc.stderr}`);
  assert.match(doc.stdout, /unchanged .*settings\.json/);
});

test("hook CLI enforces the Stop validation gate end-to-end", async () => {
  const root = await tmpProject();
  cli(["install", root, "--ide", "claude-code", "--yes"]);
  // Opt into the hard gate and give the project a real check command.
  await writeFile(path.join(root, ".engineering-intelligence/ei.config.json"), JSON.stringify({ hooks: { requireValidationOnStop: true } }), "utf8");
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");

  const sid = JSON.stringify({ session_id: "integ", cwd: root });
  // Record a source change, then Stop must block.
  cli(["hook", "post-tool-use", root], root, JSON.stringify({ session_id: "integ", tool_name: "Write", tool_input: { file_path: path.join(root, "src/x.ts") } }));
  const blocked = cli(["hook", "stop", root], root, sid);
  assert.equal(blocked.status, 0);
  assert.match(blocked.stdout, /"decision":"block"/, `Stop should block unvalidated change:\n${blocked.stdout}`);

  // After a validation command, Stop allows.
  cli(["hook", "post-tool-use", root], root, JSON.stringify({ session_id: "integ", tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: { success: true } }));
  const allowed = cli(["hook", "stop", root], root, sid);
  assert.equal(allowed.stdout.trim(), "", `Stop should allow after validation:\n${allowed.stdout}`);
});

test("second run (update) is idempotent — zero conflicts and zero changes", async () => {
  const root = await tmpProject();
  cli(["install", root, "--ide", "claude-code", "--yes"]);

  const result = cli(["update", root, "--yes"]);
  assert.equal(result.status, 0, `update exited ${result.status}:\n${result.stderr}`);

  // Output should report 0 conflicts and 0 changed
  const combined = result.stdout + result.stderr;
  assert.match(combined, /0 conflict/, `expected 0 conflicts in:\n${combined}`);
  assert.match(combined, /0 changed/, `expected 0 changed in:\n${combined}`);
});

test("CLI applies SmartCrush to command files (no bare 'version:' key in frontmatter)", async () => {
  const root = await tmpProject();
  const result = cli(["install", root, "--ide", "claude-code", "--yes"]);
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${result.stderr}`);

  // SmartCrush strips `version:` from YAML frontmatter in all rendered command files
  const cmd = await read(root, ".claude/commands/engineering-intelligence.md");
  assert.doesNotMatch(cmd, /^version:/m, "version: key should be stripped by SmartCrush");
  assert.ok(cmd.startsWith("---\n"), "command file must start with frontmatter so argument-hint parses");
  assert.doesNotMatch(cmd, /\$AIDLC|\$EI/, "aliases must not reach disk");
});
