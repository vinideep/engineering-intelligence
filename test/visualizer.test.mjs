import assert from "node:assert/strict";
import test from "node:test";
import { generateDashboardHTML } from "../dist/visualizer/index.js";
import { SKILL_NAMES } from "../dist/templates.js";

test("generateDashboardHTML returns dashboard HTML content with key components", async () => {
  const html = await generateDashboardHTML(process.cwd());
  
  // Basic structure
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<title>Engineering Intelligence/i);
  
  // Tab views
  assert.match(html, /id="skills"/);
  assert.match(html, /id="workflows"/);
  assert.match(html, /id="agents"/);
  assert.match(html, /id="artifacts"/);

  // Enhanced skills catalog contents
  assert.match(html, /initialize-intelligence-skill/);
  assert.match(html, /engineering-intelligence-skill/);
  assert.match(html, /deep-project-knowledge-extractor/);
  assert.match(html, /knowledge-base-validator/);
  assert.match(html, /codebase-discovery-engine/);
  assert.match(html, /convention-detector/);
  assert.match(html, /aidlc-lifecycle-engine/);
  assert.match(html, /type-safety-engine/);
  assert.match(html, /database-migration-safety-engine/);
  assert.match(html, /api-backward-compatibility-engine/);
  assert.match(html, /adr-compliance-checker/);
  assert.match(html, /environment-variable-auditor/);
  assert.match(html, /llm-prompt-injection-guard/);
  assert.match(html, /context-budget-optimizer/);

  // Workflow pipelines
  assert.match(html, /initialize-engineering-intelligence/);
  assert.match(html, /engineering-intelligence/);
  assert.match(html, /discover-codebase/);
  assert.match(html, /create-project/);
});

test("generateDashboardHTML includes the web-based graph view", async () => {
  const html = await generateDashboardHTML(process.cwd());

  // Graph tab and canvas stage
  assert.match(html, /id="graph"/);
  assert.match(html, /id="graphCanvas"/);
  assert.match(html, /id="nodeDrawer"/);
  assert.match(html, /d3@7/);

  // Graph modes: vault, skills, architecture layers
  assert.match(html, /buildVaultGraph/);
  assert.match(html, /buildSkillsGraph/);
  assert.match(html, /buildArchGraph/);
  assert.match(html, /data-layer="dependency"/);
  assert.match(html, /data-layer="service"/);
  assert.match(html, /data-layer="runtime"/);
  assert.match(html, /data-layer="business-flow"/);

  // Command palette
  assert.match(html, /id="paletteOverlay"/);

  // No dependency on the Obsidian desktop app
  assert.doesNotMatch(html, /obsidian:\/\//);
});

test("generateDashboardHTML escapes script-breaking sequences in payload", async () => {
  const html = await generateDashboardHTML(process.cwd());
  const scriptStart = html.indexOf("const TEMPLATES =");
  const payloadRegion = html.slice(scriptStart, html.indexOf("// ── Utilities"));
  // Embedded file contents must not contain a raw closing script tag
  assert.ok(!payloadRegion.includes("</script>"), "payload must not contain raw </script>");
});

test("the dashboard skill catalog is derived from templates and cannot drift", async () => {
  // It used to be 289 hand-maintained lines duplicating every skill, and it had
  // already drifted: user-intelligence-engine shipped as a skill but was absent
  // from the catalog, so the dashboard silently omitted it.
  const html = await generateDashboardHTML(process.cwd());
  const embedded = html.match(/const SKILL_CATALOG = (\{[\s\S]*?\});\n/);
  assert.ok(embedded, "dashboard must embed a skill catalog");
  const catalog = JSON.parse(embedded[1]);

  assert.deepEqual(
    Object.keys(catalog).sort(),
    [...SKILL_NAMES].sort(),
    "catalog must cover exactly the skills that ship — no missing, no ghosts",
  );
  for (const [id, info] of Object.entries(catalog)) {
    assert.ok(info.description, `${id} must carry a description derived from its frontmatter`);
    assert.ok(info.category, `${id} must have a category`);
  }
});
