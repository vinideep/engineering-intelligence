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
    // argument-hint may appear after an alias preamble line, so check content not position
    assert.match(get(name), /argument-hint:/, `${name} should declare an argument hint`);
  }

  // Non-input workflows stay verbatim with no placeholder injected.
  for (const name of ["initialize-engineering-intelligence", "map-architecture", "discover-codebase"]) {
    assert.doesNotMatch(get(name), /\$ARGUMENTS/, `${name} should not inject arguments`);
    assert.doesNotMatch(get(name), /argument-hint:/, `${name} should not declare an argument hint`);
  }

  // Frontmatter is well-formed with description + argument-hint (may be preceded by alias preamble).
  assert.match(implementation, /description: [\s\S]*argument-hint: <implementation request>/);
  assert.deepEqual(await validateRender(["claude-code"]), []);
});

test("Claude Code adapter generates skills index and workflow routing table with measurable token savings", async () => {
  const files = await renderAdapters(["claude-code"]);
  const paths = new Set(files.map((item) => item.path));

  // Skills index and routing table are generated.
  assert.ok(paths.has(".claude/skills/SKILLS-INDEX.md"), "SKILLS-INDEX.md must be generated");
  assert.ok(paths.has(".claude/WORKFLOW-ROUTING.md"), "WORKFLOW-ROUTING.md must be generated");

  const index = files.find((item) => item.path === ".claude/skills/SKILLS-INDEX.md").content;
  const routing = files.find((item) => item.path === ".claude/WORKFLOW-ROUTING.md").content;

  // Skills index covers all skills with one row each.
  assert.match(index, /backlog-decomposition-engine/);
  assert.match(index, /engineering-intelligence-skill/);
  assert.match(index, /\| Skill \| Purpose \|/);

  // Routing table maps every workflow to primary skills.
  assert.match(routing, /engineering-intelligence/);
  assert.match(routing, /engineering-intelligence-skill/);
  assert.match(routing, /decompose-backlog/);
  assert.match(routing, /backlog-decomposition-engine/);
  assert.match(routing, /Primary Skills/);

  // Token savings: index must be substantially smaller than reading all skill files.
  const indexTokens = Math.ceil(index.length / 4);
  assert.ok(indexTokens < 2000, `SKILLS-INDEX should be under 2,000 tokens, got ${indexTokens}`);

  // Path aliases are applied in command files.
  const engCmd = files.find((item) => item.path === ".claude/commands/engineering-intelligence.md").content;
  assert.match(engCmd, /\$AIDLC/, "command files should use $AIDLC alias");
  assert.match(engCmd, /\$EI/, "command files should use $EI alias");
  assert.match(engCmd, /Path aliases/, "alias preamble must be present");
  // Raw path count in the body should be reduced to only the preamble definition line (≤2 occurrences).
  const rawAidlcCount = (engCmd.match(/\.engineering-intelligence\/aidlc\//g) ?? []).length;
  assert.ok(rawAidlcCount <= 2, `raw $AIDLC path in command should appear only in preamble, got ${rawAidlcCount} occurrences`);

  // Path aliases are applied in skill files — the heavy aidlc-lifecycle-engine has many path refs.
  const skill = files.find((item) => item.path === ".claude/skills/aidlc-lifecycle-engine/SKILL.md").content;
  assert.match(skill, /\$AIDLC/);
  const rawSkillAidlcCount = (skill.match(/\.engineering-intelligence\/aidlc\//g) ?? []).length;
  assert.ok(rawSkillAidlcCount <= 2, `raw $AIDLC path in skill should appear only in preamble, got ${rawSkillAidlcCount} occurrences`);

  // CLAUDE.md managed block directs AI to use the index and routing table.
  const claudeMd = files.find((item) => item.path === "CLAUDE.md").content;
  assert.match(claudeMd, /SKILLS-INDEX/);
  assert.match(claudeMd, /WORKFLOW-ROUTING/);

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

test("Claude Code adapter generates SKILL-BRIEF.md for every skill, substantially smaller than full skills", async () => {
  const files = await renderAdapters(["claude-code"]);
  const paths = new Set(files.map((item) => item.path));

  // Every skill must have both a brief and a full skill file.
  const skillNames = ["engineering-intelligence-skill", "change-detection-engine", "impact-analysis-engine", "context-budget-optimizer", "backlog-decomposition-engine"];
  for (const name of skillNames) {
    assert.ok(paths.has(`.claude/skills/${name}/SKILL-BRIEF.md`), `${name}/SKILL-BRIEF.md must exist`);
    assert.ok(paths.has(`.claude/skills/${name}/SKILL.md`), `${name}/SKILL.md must exist`);
  }

  // Brief must be substantially smaller than full skill.
  for (const name of skillNames) {
    const brief = files.find((item) => item.path === `.claude/skills/${name}/SKILL-BRIEF.md`).content;
    const full  = files.find((item) => item.path === `.claude/skills/${name}/SKILL.md`).content;
    const briefTokens = Math.ceil(brief.length / 4);
    const fullTokens  = Math.ceil(full.length / 4);
    assert.ok(briefTokens < 400, `${name} brief should be under 400t, got ${briefTokens}`);
    assert.ok(briefTokens < fullTokens * 0.5, `${name} brief (${briefTokens}t) must be less than 50% of full skill (${fullTokens}t)`);
  }

  // Briefs contain the loading notice enforcing tier-3 retrieval.
  const brief = files.find((item) => item.path === ".claude/skills/engineering-intelligence-skill/SKILL-BRIEF.md").content;
  assert.match(brief, /Load `SKILL\.md` from this directory before executing/);

  // Briefs contain the overview paragraph (not just frontmatter).
  assert.match(brief, /core implementation skill/);

  // CLAUDE.md instructs three-tier loading.
  const claudeMd = files.find((item) => item.path === "CLAUDE.md").content;
  assert.match(claudeMd, /SKILL-BRIEF\.md/);
  assert.match(claudeMd, /Tier 1/);
  assert.match(claudeMd, /Tier 3/);
});

test("KV-cache pinned files appear before all other claude-code rendered files", async () => {
  const files = await renderAdapters(["claude-code"]);
  const claudeFiles = files.filter((item) => item.path.startsWith(".claude/") || item.path === "CLAUDE.md");
  const idx0 = claudeFiles.findIndex((item) => item.path === ".claude/WORKFLOW-ROUTING.md");
  const idx1 = claudeFiles.findIndex((item) => item.path === ".claude/skills/SKILLS-INDEX.md");

  assert.ok(idx0 !== -1, "WORKFLOW-ROUTING.md must exist");
  assert.ok(idx1 !== -1, "SKILLS-INDEX.md must exist");

  // Both pinned files must come before any non-pinned file.
  const firstNonPinned = claudeFiles.findIndex(
    (item) => item.path !== ".claude/WORKFLOW-ROUTING.md" && item.path !== ".claude/skills/SKILLS-INDEX.md",
  );
  assert.ok(idx0 < firstNonPinned, "WORKFLOW-ROUTING.md must precede non-pinned files");
  assert.ok(idx1 < firstNonPinned, "SKILLS-INDEX.md must precede non-pinned files");
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
