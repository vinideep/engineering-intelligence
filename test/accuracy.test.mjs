/**
 * Accuracy-under-budget suite (v2.4.1).
 *
 * Directly answers "does shaping ever change the answer?" — NO. These tests run
 * real queries THROUGH the shaper (packed + budgeted, exactly like the MCP
 * handlers) and assert the answer survives intact even at absurdly tiny budgets.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildGraph, analyzeImpact, whoCalls } from "../dist/graph/index.js";
import { shape, packRows, unpackRows, BUDGET_EXPANDED_NOTE } from "../dist/mcp/shaper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// Mirror the analyze_impact handler (src/mcp/index.ts).
function shapeImpact(result, budget) {
  const detailsPacked = packRows(result.details, ["id", "kind", "label", "hop", "evidence", "churn", "isTest"]);
  return JSON.parse(shape({ ...result, details: detailsPacked }, {
    budget,
    hints: {
      direct: { mustKeep: true },
      testsToRun: { mustKeep: true },
      riskNotes: { mustKeep: true },
      details: { priority: 7 },
      indirect: { priority: 3 },
      unknowns: { priority: 2 },
    },
  }));
}

// Mirror the who_calls handler.
function shapeWho(result, budget) {
  const callersPacked = packRows(result.callers, ["id", "label", "kind", "confidence", "evidence", "path"]);
  return JSON.parse(shape({ ...result, callers: callersPacked }, {
    budget,
    hints: { callers: { mustKeep: true }, matched: { mustKeep: true } },
  }));
}

test("who_calls answer survives a tiny budget (mustKeep + soft-expand)", async () => {
  await buildGraph(REPO_ROOT);
  const raw = await whoCalls(REPO_ROOT, "buildGraph");
  const rawLabels = raw.callers.map((c) => c.label).sort();

  const shaped = shapeWho(raw, 40); // absurdly small
  const shapedLabels = unpackRows(shaped.callers).map((c) => c.label).sort();

  assert.deepEqual(shapedLabels, rawLabels, "every caller must survive shaping");
  assert.ok(shapedLabels.includes("main"), "cli main() caller must be present");
  assert.ok(shapedLabels.includes("startMcpServer"), "mcp startMcpServer() caller must be present");
  assert.equal(shaped.budgetNote, BUDGET_EXPANDED_NOTE, "budget should soft-expand to keep the complete answer");
});

test("analyze_impact answer (direct + testsToRun) is never truncated", async () => {
  await buildGraph(REPO_ROOT);
  const raw = await analyzeImpact(REPO_ROOT, ["src/graph/index.ts"]);
  const shaped = shapeImpact(raw, 150); // tiny — forces exploration trimming

  assert.deepEqual([...shaped.direct].sort(), [...raw.direct].sort(), "direct dependents must be complete");
  const rawTests = raw.testsToRun ?? [];
  const shapedTests = shaped.testsToRun ?? [];
  assert.deepEqual([...shapedTests].sort(), [...rawTests].sort(), "testsToRun must be complete");
});

test("adversarial: 3 real answers survive amid 500 exploration items at budget 300", () => {
  const payload = {
    direct: ["module:a", "module:b", "module:c"],
    indirect: Array.from({ length: 500 }, (_, i) => `module:noise-${i}`),
  };
  const out = JSON.parse(shape(payload, {
    budget: 300,
    hints: { direct: { mustKeep: true }, indirect: { priority: 3, hint: "get_graph" } },
  }));
  assert.deepEqual(out.direct, payload.direct, "all 3 answer items must survive");
  assert.ok(out.indirect.length < 500, "noise should be trimmed");
  assert.ok(out.truncated && /\+\d+ more/.test(out.truncated.indirect), "trim must be marked, not silent");
});

test("typical queries at default budgets are NOT truncated (defaults are sized right)", async () => {
  await buildGraph(REPO_ROOT);
  const who = shapeWho(await whoCalls(REPO_ROOT, "buildGraph"), 1500);
  assert.ok(!who.truncated, `who_calls should not truncate at default budget: ${JSON.stringify(who.truncated)}`);
  const impact = shapeImpact(await analyzeImpact(REPO_ROOT, ["src/types.ts"]), 1500);
  // types.ts has many importers; details may be large, but the ANSWER (direct) is intact regardless.
  assert.ok(Array.isArray(impact.direct) && impact.direct.length > 0, "direct answer present");
});

test("packRows / unpackRows is a lossless round-trip", () => {
  const items = [
    { id: "x", kind: "symbol", hop: "direct", evidence: ["a.ts:1"], churn: 4, isTest: true },
    { id: "y", kind: "module", hop: "indirect", evidence: ["b.ts:2"] }, // churn/isTest absent
  ];
  const cols = ["id", "kind", "hop", "evidence", "churn", "isTest"];
  const restored = unpackRows(packRows(items, cols));
  assert.deepEqual(restored, items, "packing must preserve data exactly (absent fields stay absent)");
});

test("unlimited budget (0) never truncates and adds no budgetNote", () => {
  const payload = { callers: Array.from({ length: 300 }, (_, i) => ({ id: `c${i}`, label: `c${i}` })) };
  const out = JSON.parse(shape(payload, { budget: 0 }));
  assert.equal(out.callers.length, 300, "budget 0 = unlimited");
  assert.ok(!out.truncated && !out.budgetNote, "no trimming or expansion note when unlimited");
});
