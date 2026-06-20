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
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, "../dist/cli/index.js");
const REPO_ROOT = path.resolve(__dirname, "..");

function cli(args, cwd) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: cwd ?? REPO_ROOT,
    encoding: "utf8",
    timeout: 30_000,
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

test("CLI applies path aliases ($AIDLC) to skill files written on disk", async () => {
  const root = await tmpProject();
  const result = cli(["install", root, "--ide", "claude-code", "--yes"]);
  assert.equal(result.status, 0, `CLI exited ${result.status}:\n${result.stderr}`);

  // The aidlc-lifecycle-engine skill heavily references the $AIDLC path
  const skill = await read(root, ".claude/skills/aidlc-lifecycle-engine/SKILL.md");
  assert.match(skill, /\$AIDLC/, "on-disk SKILL.md must contain $AIDLC alias (pipeline ran end-to-end)");
  // The alias preamble defines "$AIDLC"=".engineering-intelligence/aidlc/" on the first line;
  // subsequent lines in the body must use the alias, not the raw path.
  const bodyLines = skill.split("\n").slice(1).join("\n");
  assert.doesNotMatch(
    bodyLines,
    /\.engineering-intelligence\/aidlc\//,
    "SKILL.md body (after preamble) must not contain the raw path — aliasing must have run",
  );
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
  assert.match(cmd, /\$AIDLC/, "command file should also have path aliases applied");
});
