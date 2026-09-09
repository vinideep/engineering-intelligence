/**
 * Reachability and tool-backing tests.
 *
 * Two failure modes this pins:
 *
 *  1. A skill that ships but is named by no workflow route and no agent is dead
 *     weight — it costs install size and index tokens while the retrieval path
 *     the toolkit tells the model to obey can never surface it.
 *
 *  2. A skill whose work is already done deterministically by a CLI/MCP command,
 *     but which does not SAY SO in its opening lines, invites the model to
 *     re-derive the answer by hand. That is precisely what small models do worst.
 *     Tool-backing — not skill count — is the property that makes them reliable.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { WORKFLOW_SKILL_ROUTING } from "../dist/token-optimizer.js";
import { SKILL_NAMES, AGENT_NAMES, WORKFLOW_NAMES } from "../dist/templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const skillPath = (name) => path.join(REPO_ROOT, "templates/canonical/skills", name, "SKILL.md");

/** Skills named in any agent's `skills:` list in the adapter metadata. */
async function agentRoutedSkills() {
  const src = await readFile(path.join(REPO_ROOT, "src/adapters/index.ts"), "utf8");
  const named = new Set();
  for (const block of src.matchAll(/skills:\s*\[([^\]]*)\]/g)) {
    for (const m of block[1].matchAll(/"([^"]+)"/g)) named.add(m[1]);
  }
  return named;
}

function workflowRoutedSkills() {
  const named = new Set();
  for (const route of Object.values(WORKFLOW_SKILL_ROUTING)) {
    route.primary.forEach((s) => named.add(s));
    route.optional.forEach((s) => named.add(s));
  }
  return named;
}

test("every shipped skill is reachable from a workflow route or an agent", async () => {
  const workflow = workflowRoutedSkills();
  const agents = await agentRoutedSkills();
  const unreachable = SKILL_NAMES.filter((s) => !workflow.has(s) && !agents.has(s));
  assert.deepEqual(
    unreachable,
    [],
    `these skills ship but nothing can route to them:\n  ${unreachable.join("\n  ")}`,
  );
});

test("the routing table and agent metadata name only skills that exist", async () => {
  const known = new Set(SKILL_NAMES);
  const ghosts = [...workflowRoutedSkills(), ...(await agentRoutedSkills())].filter((s) => !known.has(s));
  assert.deepEqual([...new Set(ghosts)], [], "routing must not point at deleted skills");
});

test("the routing table covers every workflow", () => {
  assert.deepEqual(
    Object.keys(WORKFLOW_SKILL_ROUTING).sort(),
    [...WORKFLOW_NAMES].sort(),
    "every command needs a route or the three-tier protocol has nothing to read",
  );
});

/**
 * Skills whose core procedure is already implemented as a deterministic command.
 * Each must name that command near the top so the model runs it instead of
 * reasoning the answer out by hand.
 */
const TOOL_BACKED = {
  "environment-variable-auditor": /gate env-vars/,
  "dead-code-detector": /gate dead-exports/,
  "api-backward-compatibility-engine": /gate api-diff/,
  "database-migration-safety-engine": /gate migration-lint/,
  "environmental-backpressure-engine": /engineering-intelligence verify/,
  "staleness-detector": /engineering-intelligence freshness/,
  "git-intelligence-engine": /engineering-intelligence git-analysis/,
  "graph-engine": /engineering-intelligence map/,
  "user-intelligence-engine": /engineering-intelligence user-profile/,
};

test("every tool-backed skill names its backing command in its opening lines", async () => {
  const failures = [];
  for (const [name, pattern] of Object.entries(TOOL_BACKED)) {
    assert.ok(SKILL_NAMES.includes(name), `${name} is listed as tool-backed but does not ship`);
    const content = await readFile(skillPath(name), "utf8");
    // Frontmatter plus the first few body lines — the part a model reads before
    // deciding how to proceed. A command buried on line 90 does not change behaviour.
    const head = content.split("\n").slice(0, 16).join("\n");
    if (!pattern.test(head)) failures.push(`${name} must reference \`${pattern.source}\` within its first 16 lines`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("agents reference only skills and agents that exist", async () => {
  const src = await readFile(path.join(REPO_ROOT, "src/adapters/index.ts"), "utf8");
  const metadata = src.slice(src.indexOf("const AGENT_METADATA"));
  const named = new Set();
  for (const block of metadata.matchAll(/agents:\s*\[([^\]]*)\]/g)) {
    for (const m of block[1].matchAll(/"([^"]+)"/g)) named.add(m[1]);
  }
  const ghosts = [...named].filter((a) => !AGENT_NAMES.includes(a));
  assert.deepEqual(ghosts, [], "an agent must not delegate to an agent that does not ship");
});
