import assert from "node:assert/strict";
import test from "node:test";
import { generateDashboardHTML } from "../dist/visualizer/index.js";

test("generateDashboardHTML returns dashboard HTML content with key components", () => {
  const html = generateDashboardHTML();
  
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

  // Workflow pipelines
  assert.match(html, /initialize-engineering-intelligence/);
  assert.match(html, /engineering-intelligence/);
});
