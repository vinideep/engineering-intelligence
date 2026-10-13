/**
 * The installed instructions are what coding agents act on. Every tool, command,
 * path and count they cite must exist — these tests derive the truth from code
 * and fail when the instructions drift from it.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { renderAdapters } from "../dist/adapters/index.js";
import { MCP_TOOL_SUMMARY } from "../dist/mcp/index.js";
import { createConsolidatedRegistry } from "../dist/mcp/consolidated.js";
import { SKILL_NAMES } from "../dist/templates.js";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli", "index.js");

test("MCP_TOOL_SUMMARY lists exactly the tools the server advertises", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gw-docs-"));
  const registry = await createConsolidatedRegistry(root);
  const advertised = registry.list().map((tool) => tool.name).sort();
  assert.deepEqual(MCP_TOOL_SUMMARY.map(([name]) => name).sort(), advertised);
});

test("every CLI equivalent cited in the instructions is a real command", () => {
  const help = execFileSync(process.execPath, [CLI, "--help", "--all"], { encoding: "utf8" });
  for (const [, , cli] of MCP_TOOL_SUMMARY) {
    if (!cli) continue;
    const command = cli.split(" ")[0];
    assert.match(help, new RegExp(`\\b${command}\\b`), `${command} is documented in --help --all`);
  }
});

test("installed CLAUDE.md/AGENTS.md cite real counts, tools and config keys", async () => {
  const files = await renderAdapters(["claude-code", "codex"]);
  for (const target of ["CLAUDE.md", "AGENTS.md"]) {
    const content = files.find((item) => item.path === target)?.content;
    assert.ok(content, `${target} is rendered`);
    for (const [name] of MCP_TOOL_SUMMARY) assert.match(content, new RegExp(`\`${name}\``), `${target} lists ${name}`);
    assert.match(content, new RegExp(`advertises ${MCP_TOOL_SUMMARY.length} tools`));
    assert.doesNotMatch(content, /context\|claims verify\|git-analysis \./, "no bogus pipe-joined CLI line");
    assert.doesNotMatch(content, /\$EI\b|\$AIDLC/, "no removed path aliases");
  }
  const claude = files.find((item) => item.path === "CLAUDE.md").content;
  assert.match(claude, /hooks\.blockStaleEdits/);
  assert.match(claude, new RegExp(`all ${SKILL_NAMES.length} skills`));
});

test("skill routing never points at SKILL-BRIEF.md files that are not rendered", async () => {
  for (const ide of ["antigravity", "codex", "claude-code", "gemini-cli", "generic"]) {
    const files = await renderAdapters([ide]);
    const paths = new Set(files.map((item) => item.path));
    const mentionsBriefs = files.some((item) => /(?:SKILLS-INDEX|WORKFLOW-ROUTING)\.md$/.test(item.path) && /SKILL-BRIEF/.test(item.content));
    const hasBriefs = [...paths].some((p) => p.endsWith("/SKILL-BRIEF.md"));
    assert.equal(mentionsBriefs, hasBriefs, `${ide}: brief references match emitted brief files`);
  }
});

test("no installed file tells an agent to run an unpinned `npx graphward`", async () => {
  const { IDE_IDS } = await import("../dist/types.js");
  const files = await renderAdapters([...IDE_IDS]);
  const offenders = files.filter((item) => /\bnpx (?:-y |--yes )?graphward(?![@\w-])/.test(item.content)).map((item) => item.path);
  assert.deepEqual(offenders, []);
});
