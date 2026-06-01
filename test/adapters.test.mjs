import assert from "node:assert/strict";
import test from "node:test";
import { renderAdapters } from "../dist/adapters/index.js";
import { validateRender } from "../dist/validation/index.js";

test("all V2 IDE adapters render internally valid native destinations and workflows", async () => {
  const ides = ["antigravity", "antigravity-cli", "codex", "claude-code", "cursor", "github-copilot", "gemini-cli", "generic"];
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
  assert.deepEqual(analystJson.skills, ["requirement-scoper", "aidlc-lifecycle-engine"]);
  const architectJson = JSON.parse(files.find((item) => item.path === ".agent/agents/system-architect/agent.json").content);
  assert.ok(architectJson.skills.includes("nfr-adr-governor"));
  assert.deepEqual(await validateRender(ides), []);
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
