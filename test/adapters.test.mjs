import assert from "node:assert/strict";
import test from "node:test";
import { renderAdapters } from "../dist/adapters/index.js";
import { validateRender } from "../dist/validation/index.js";

test("all V2 IDE adapters render internally valid native destinations and workflows", async () => {
  const ides = ["antigravity", "codex", "claude-code", "cursor", "github-copilot", "gemini-cli", "generic"];
  const files = await renderAdapters(ides);
  const paths = new Set(files.map((item) => item.path));
  assert.ok(paths.has(".agent/workflows/initialize-engineering-intelligence.md"));
  assert.ok(paths.has(".agent/workflows/map-architecture.md"));
  assert.ok(paths.has(".agent/workflows/analyze-impact.md"));
  assert.ok(paths.has(".agent/workflows/sync-engineering-intelligence.md"));
  assert.ok(paths.has(".agent/workflows/scope-requirement.md"));
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
  assert.deepEqual(await validateRender(ides), []);
});

test("Gemini commands pass arguments only to input-driven workflows", async () => {
  const files = await renderAdapters(["gemini-cli"]);
  const get = (name) => files.find((item) => item.path.endsWith(`/${name}.toml`)).content;
  assert.doesNotMatch(get("initialize-engineering-intelligence"), /\{\{args\}\}/);
  assert.doesNotMatch(get("map-architecture"), /\{\{args\}\}/);
  assert.match(get("engineering-intelligence"), /\{\{args\}\}/);
  assert.match(get("analyze-impact"), /\{\{args\}\}/);
  assert.match(get("sync-engineering-intelligence"), /\{\{args\}\}/);
  assert.match(get("review-engineering-change"), /\{\{args\}\}/);
  assert.match(get("scope-requirement"), /\{\{args\}\}/);
});
