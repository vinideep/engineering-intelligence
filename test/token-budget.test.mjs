/**
 * Data-layer token budgets (v2.4 — Headroom-style frugality).
 *
 * The skills layer is measured in token-reduction.test.mjs. This guards the
 * *MCP response* layer: the graph is large, but what we hand the agent per tool
 * call must stay small. Regression floors below, with a printed before/after.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildGraph, loadExistingGraph, analyzeImpact, whoCalls, findSymbol } from "../dist/graph/index.js";
import { shape, terseNode, terseEdge, estimateTokens } from "../dist/mcp/shaper.js";
import { generateBrief } from "../dist/brief/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const GRAPH_PATH = path.join(REPO_ROOT, ".engineering-intelligence", "graph", "dependency-graph.json");

// Budgets the MCP handlers apply (must match src/mcp/index.ts).
const BUDGET = { map_dependencies: 150, get_graph: 2500, analyze_impact: 1500, who_calls: 1500, find_symbol: 1500, brief: 800 };

test("MCP data-layer responses stay within token budgets (with before/after table)", async () => {
  await buildGraph(REPO_ROOT);
  const graph = await loadExistingGraph(GRAPH_PATH);
  assert.ok(graph, "graph should exist");

  // BEFORE: the naive full pretty-printed graph (what get_graph used to return).
  const beforeGraph = estimateTokens(JSON.stringify(graph, null, 2));

  // AFTER — replicate each handler's response construction.
  const mapResp = shape({ nodeCount: graph.nodes.length, edgeCount: graph.edges.length, fileCount: 0, wasIncremental: false, graphPath: ".engineering-intelligence/graph/dependency-graph.json", note: "Graph written to disk. Query it with get_graph / analyze_impact / who_calls / find_symbol." });
  const getGraphResp = shape(
    { scope: graph.scope, nodeCount: graph.nodes.length, edgeCount: graph.edges.length, nodes: graph.nodes.slice(0, 100).map(terseNode), edges: graph.edges.slice(0, 100).map(terseEdge) },
    { budget: BUDGET.get_graph, hints: { nodes: { hint: "get_graph pattern=<id>", priority: 6 }, edges: { hint: "get_graph relation=<rel>", priority: 4 } } },
  );
  const impact = await analyzeImpact(REPO_ROOT, ["src/graph/index.ts"]);
  const impactResp = shape({ ...impact }, { budget: BUDGET.analyze_impact, hints: { details: { hint: "get_graph pattern=<id>", priority: 7 } } });
  const who = await whoCalls(REPO_ROOT, "buildGraph");
  const whoResp = shape({ ...who }, { budget: BUDGET.who_calls });
  const find = await findSymbol(REPO_ROOT, "buildGraph");
  const findResp = shape({ matches: find }, { budget: BUDGET.find_symbol });
  const brief = (await generateBrief(REPO_ROOT)).markdown;

  const measured = {
    map_dependencies: estimateTokens(mapResp),
    get_graph: estimateTokens(getGraphResp),
    analyze_impact: estimateTokens(impactResp),
    who_calls: estimateTokens(whoResp),
    find_symbol: estimateTokens(findResp),
    brief: estimateTokens(brief),
  };

  // Print before/after.
  console.log("\n  MCP response token budgets (this repo):");
  console.log("  ┌────────────────────┬───────────┬───────────┐");
  console.log("  │ Tool                │ Tokens    │ Budget    │");
  console.log("  ├────────────────────┼───────────┼───────────┤");
  for (const [k, v] of Object.entries(measured)) {
    console.log(`  │ ${k.padEnd(18)} │ ${String(v).padStart(9)} │ ${String(BUDGET[k]).padStart(9)} │`);
  }
  console.log("  └────────────────────┴───────────┴───────────┘");
  console.log(`  get_graph before (full pretty graph): ${beforeGraph} tokens → after ${measured.get_graph} (−${Math.round((1 - measured.get_graph / beforeGraph) * 100)}%)`);
  console.log(`  map_dependencies before (embedded graph): ~${beforeGraph} → after ${measured.map_dependencies}\n`);

  // Assert budgets.
  for (const [k, budget] of Object.entries(BUDGET)) {
    assert.ok(measured[k] <= budget, `${k} response ${measured[k]}t exceeds budget ${budget}t`);
  }
  // The compact get_graph must be a large win over the full graph.
  assert.ok(measured.get_graph < beforeGraph * 0.2, `get_graph should be <20% of full graph (${measured.get_graph} vs ${beforeGraph})`);
});

test("shaper truncates over-budget lists with an explicit marker (nothing silently dropped)", () => {
  const big = { items: Array.from({ length: 500 }, (_, i) => `item-${i}-with-some-length-to-cost-tokens`) };
  const out = JSON.parse(shape(big, { budget: 100, hints: { items: { hint: "get_more" } } }));
  assert.ok(out.items.length < 500, "items should be capped");
  assert.ok(out.truncated && typeof out.truncated.items === "string", "a truncated marker must be present");
  assert.match(out.truncated.items, /\+\d+ more/, "marker should say how many were omitted");
  assert.match(out.truncated.items, /get_more/, "marker should carry the expand hint");
});

test("shaper prunes empty arrays and undefined fields", () => {
  const out = JSON.parse(shape({ a: [], b: undefined, c: "keep", d: [1], e: {} }));
  assert.ok(!("a" in out) && !("b" in out) && !("e" in out), "empty/undefined fields pruned");
  assert.equal(out.c, "keep");
  assert.deepEqual(out.d, [1]);
});
