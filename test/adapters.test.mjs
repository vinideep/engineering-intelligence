import assert from "node:assert/strict";
import test from "node:test";
import { renderAdapters } from "../dist/adapters/index.js";
import { validateRender } from "../dist/validation/index.js";

test("all V2 IDE adapters render internally valid native destinations and workflows", async () => {
  const ides = ["antigravity", "antigravity-cli", "codex", "claude-code", "cursor", "github-copilot", "gemini-cli", "commandcode", "generic"];
  const files = await renderAdapters(ides);
  const paths = new Set(files.map((item) => item.path));
  assert.ok(paths.has(".agent/workflows/initialize-engineering-intelligence.md"));
  assert.ok(paths.has(".agent/workflows/map-architecture.md"));
  assert.ok(paths.has(".agent/workflows/analyze-impact.md"));
  assert.ok(paths.has(".agent/workflows/sync-engineering-intelligence.md"));
  assert.ok(paths.has(".agent/workflows/scope-requirement.md"));
  assert.ok(paths.has(".agent/workflows/discover-codebase.md"));
  assert.ok(paths.has(".agent/workflows/create-project.md"));
  assert.ok(!paths.has(".agent/workflows/aidlc-default.md"));
  assert.ok(paths.has(".agent/agents/engineering-orchestrator/agent.json"));
  assert.ok(paths.has(".agent/agents/change-agent/agent.json"));
  assert.ok(paths.has(".agent/agents/product-analyst/agent.json"));
  assert.ok(paths.has(".agent/agents/system-architect/agent.json"));
  assert.ok(paths.has(".agent/agents/security-officer/agent.json"));
  assert.ok(paths.has(".agent/agents/site-reliability-engineer/agent.json"));
  assert.ok(paths.has("AGENTS.md"));
  assert.ok(paths.has(".claude/commands/engineering-intelligence.md"));
  assert.ok(paths.has(".claude/commands/map-architecture.md"));
  assert.ok(paths.has(".cursor/commands/scope-requirement.md"));
  assert.ok(paths.has(".cursor/commands/initialize-engineering-intelligence.md"));
  assert.ok(paths.has(".cursor/commands/analyze-impact.md"));
  assert.ok(paths.has(".github/prompts/engineering-intelligence.prompt.md"));
  assert.ok(paths.has(".github/prompts/review-engineering-change.prompt.md"));
  assert.ok(paths.has(".gemini/commands/initialize-engineering-intelligence.toml"));
  assert.ok(paths.has(".gemini/commands/sync-engineering-intelligence.toml"));
  assert.ok(paths.has(".gemini/commands/scope-requirement.toml"));
  assert.ok(paths.has(".commandcode/skills/engineering-intelligence-skill/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/aidlc-lifecycle-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/type-safety-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/database-migration-safety-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/api-backward-compatibility-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/api-snapshot-testing-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/adr-compliance-checker/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/environment-variable-auditor/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/llm-prompt-injection-guard/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/context-budget-optimizer/SKILL.md"));
  assert.ok(paths.has(".commandcode/commands/initialize-engineering-intelligence.md"));
  assert.ok(paths.has(".commandcode/commands/engineering-intelligence.md"));
  assert.ok(paths.has(".commandcode/commands/scope-requirement.md"));
  assert.match(files.find((item) => item.path === "AGENTS.md").content, /map-architecture/);
  // antigravity IDE uses .agent/ (singular)
  assert.ok(paths.has(".agent/agents/engineering-orchestrator/agent.json"));
  assert.ok(paths.has(".agent/agents/engineering-orchestrator/prompt.md"));
  // antigravity-cli uses .agents/ (plural)
  assert.ok(paths.has(".agents/agents/engineering-orchestrator/agent.json"));
  assert.ok(paths.has(".agents/agents/engineering-orchestrator/prompt.md"));
  assert.ok(paths.has(".agents/agents/product-analyst/agent.json"));
  // Verify agent.json content is valid JSON with required fields
  const orchJson = JSON.parse(files.find((item) => item.path === ".agent/agents/engineering-orchestrator/agent.json").content);
  assert.equal(orchJson.name, "engineering-orchestrator");
  assert.ok(orchJson.description.length > 0);
  assert.deepEqual(orchJson.agents, ["product-analyst", "system-architect", "change-agent", "test-engineer", "quality-agent", "knowledge-agent"]);
  const analystJson = JSON.parse(files.find((item) => item.path === ".agent/agents/product-analyst/agent.json").content);
  assert.ok(analystJson.skills.includes("requirement-scoper"));
  assert.ok(analystJson.skills.includes("context-budget-optimizer"));
  assert.ok(analystJson.skills.includes("aidlc-lifecycle-engine"));
  const architectJson = JSON.parse(files.find((item) => item.path === ".agent/agents/system-architect/agent.json").content);
  assert.ok(architectJson.skills.includes("nfr-adr-governor"));
  const changeJson = JSON.parse(files.find((item) => item.path === ".agent/agents/change-agent/agent.json").content);
  assert.ok(changeJson.skills.includes("type-safety-engine"));
  assert.ok(changeJson.skills.includes("api-backward-compatibility-engine"));
  assert.ok(changeJson.skills.includes("context-budget-optimizer"));
  assert.deepEqual(await validateRender(ides), []);
});

test("CommandCode adapter writes native project skills and commands", async () => {
  const files = await renderAdapters(["commandcode"]);
  const paths = new Set(files.map((item) => item.path));
  assert.ok(paths.has(".commandcode/skills/engineering-intelligence-skill/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/requirement-scoper/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/nfr-adr-governor/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/type-safety-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/database-migration-safety-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/api-backward-compatibility-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/api-snapshot-testing-engine/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/contract-test-generator/SKILL.md"));
  assert.ok(paths.has(".commandcode/skills/dead-code-detector/SKILL.md"));
  assert.ok(paths.has(".commandcode/commands/engineering-intelligence.md"));
  assert.ok(paths.has(".commandcode/commands/analyze-impact.md"));
  assert.ok(paths.has(".commandcode/commands/map-architecture.md"));
  const implementation = files.find((item) => item.path === ".commandcode/commands/engineering-intelligence.md").content;
  const mapping = files.find((item) => item.path === ".commandcode/commands/map-architecture.md").content;
  assert.match(implementation, /\$ARGUMENTS/);
  assert.doesNotMatch(mapping, /\$ARGUMENTS/);
  assert.deepEqual(await validateRender(["commandcode"]), []);
});

test("Gemini commands pass arguments only to input-driven workflows", async () => {
  const files = await renderAdapters(["gemini-cli"]);
  const get = (name) => files.find((item) => item.path.endsWith(`/${name}.toml`)).content;
  assert.doesNotMatch(get("initialize-engineering-intelligence"), /\{\{args\}\}/);
  assert.doesNotMatch(get("map-architecture"), /\{\{args\}\}/);
  assert.doesNotMatch(get("discover-codebase"), /\{\{args\}\}/);
  assert.match(get("engineering-intelligence"), /\{\{args\}\}/);
  assert.match(get("analyze-impact"), /\{\{args\}\}/);
  assert.match(get("sync-engineering-intelligence"), /\{\{args\}\}/);
  assert.match(get("review-engineering-change"), /\{\{args\}\}/);
  assert.match(get("scope-requirement"), /\{\{args\}\}/);
  assert.match(get("create-project"), /\{\{args\}\}/);
});

test("Claude Code commands pass $ARGUMENTS and argument-hint only to input-driven workflows", async () => {
  const files = await renderAdapters(["claude-code"]);
  const get = (name) =>
    files.find((item) => item.path === `.claude/commands/${name}.md`).content;

  // Request-driven workflows must forward the user's input and advertise a hint.
  const implementation = get("engineering-intelligence");
  assert.match(implementation, /\$ARGUMENTS/);
  assert.match(implementation, /argument-hint: <implementation request>/);
  for (const name of [
    "analyze-impact",
    "sync-engineering-intelligence",
    "review-engineering-change",
    "scope-requirement",
    "create-project",
  ]) {
    assert.match(get(name), /\$ARGUMENTS/, `${name} should forward arguments`);
    assert.match(get(name), /^---\n[\s\S]*argument-hint:/, `${name} should declare an argument hint`);
  }

  // Non-input workflows stay verbatim with no placeholder injected.
  for (const name of ["initialize-engineering-intelligence", "map-architecture", "discover-codebase"]) {
    assert.doesNotMatch(get(name), /\$ARGUMENTS/, `${name} should not inject arguments`);
    assert.doesNotMatch(get(name), /argument-hint:/, `${name} should not declare an argument hint`);
  }

  // Frontmatter stays well-formed: existing description is preserved alongside the hint.
  assert.match(implementation, /^---\ndescription: [\s\S]*\nargument-hint: <implementation request>\n---\n/);
  assert.deepEqual(await validateRender(["claude-code"]), []);
});

test("backlog decomposition and delivery ship as skills and commands for Claude Code", async () => {
  const files = await renderAdapters(["claude-code"]);
  const paths = new Set(files.map((item) => item.path));

  // New skills are installed.
  assert.ok(paths.has(".claude/skills/backlog-decomposition-engine/SKILL.md"));
  assert.ok(paths.has(".claude/skills/issue-tracker-sync-engine/SKILL.md"));

  // New workflows are installed as slash commands.
  assert.ok(paths.has(".claude/commands/decompose-backlog.md"));
  assert.ok(paths.has(".claude/commands/deliver-backlog.md"));

  const get = (name) => files.find((item) => item.path === `.claude/commands/${name}.md`).content;

  // decompose-backlog is request-driven (forwards arguments) and is read-only.
  assert.match(get("decompose-backlog"), /\$ARGUMENTS/);
  assert.match(get("decompose-backlog"), /argument-hint:/);
  assert.match(get("decompose-backlog"), /not modify product code/);

  // deliver-backlog accepts an optional feature/epic id and enforces the approval gate.
  assert.match(get("deliver-backlog"), /\$ARGUMENTS/);
  assert.match(get("deliver-backlog"), /Approval/);

  // The decomposition skill defines the three-level hierarchy and approval gate.
  const skill = files.find(
    (item) => item.path === ".claude/skills/backlog-decomposition-engine/SKILL.md",
  ).content;
  for (const marker of ["EPIC-", "FEAT-", "TKT-", "Approval: pending", "backlog-index.md"]) {
    assert.match(skill, new RegExp(marker.replace(/[-]/g, "\\$&")));
  }

  // The managed CLAUDE.md block advertises the new workflows.
  const claudeBlock = files.find((item) => item.path === "CLAUDE.md").content;
  assert.match(claudeBlock, /decompose-backlog/);
  assert.match(claudeBlock, /deliver-backlog/);

  assert.deepEqual(await validateRender(["claude-code"]), []);
});

test("antigravity-cli adapter writes agents to .agents/ (plural) matching CLI workspace path", async () => {
  const files = await renderAdapters(["antigravity-cli"]);
  const paths = new Set(files.map((item) => item.path));
  assert.ok(paths.has(".agents/agents/engineering-orchestrator/agent.json"));
  assert.ok(paths.has(".agents/agents/engineering-orchestrator/prompt.md"));
  assert.ok(paths.has(".agents/agents/change-agent/agent.json"));
  assert.ok(paths.has(".agents/agents/product-analyst/agent.json"));
  assert.ok(paths.has(".agents/skills/engineering-intelligence-skill/SKILL.md"));
  assert.ok(paths.has(".agents/workflows/engineering-intelligence.md"));
  assert.ok(!paths.has(".agent/agents/engineering-orchestrator/agent.json"), "CLI must not write to .agent/ (singular)");
});
