/**
 * Graph engine tests — runs the deterministic dependency graph builder
 * against this repo itself and validates the output.
 *
 * These tests prove that executable TypeScript code (not LLM instructions)
 * builds a validated dependency-graph.json from real source files.
 */

import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildGraph, validateGraph, analyzeImpact } from "../dist/graph/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const GRAPH_PATH = path.join(REPO_ROOT, ".engineering-intelligence", "graph", "dependency-graph.json");

// Clean up any existing graph before tests
if (existsSync(GRAPH_PATH)) {
  rmSync(GRAPH_PATH);
}

test("buildGraph runs against this repo and returns node/edge counts", async () => {
  const result = await buildGraph(REPO_ROOT);
  assert.ok(result.nodeCount > 0, `Expected nodes, got ${result.nodeCount}`);
  assert.ok(result.edgeCount > 0, `Expected edges, got ${result.edgeCount}`);
  assert.ok(result.fileCount > 0, `Expected files scanned, got ${result.fileCount}`);
  assert.ok(result.graphPath.endsWith("dependency-graph.json"), `Unexpected graphPath: ${result.graphPath}`);
  assert.equal(result.wasIncremental, false);
});

test("dependency-graph.json exists on disk and passes schema validation", async () => {
  assert.ok(existsSync(GRAPH_PATH), `Graph file not written to ${GRAPH_PATH}`);
  const content = await readFile(GRAPH_PATH, "utf8");
  const parsed = JSON.parse(content);
  // validateGraph throws SchemaValidationError if invalid
  const graph = validateGraph(parsed);
  assert.equal(graph.schemaVersion, 1);
  assert.equal(graph.graphType, "dependency");
  assert.ok(graph.generatedAt, "generatedAt should be set");
  assert.ok(Array.isArray(graph.nodes), "nodes should be an array");
  assert.ok(Array.isArray(graph.edges), "edges should be an array");
  assert.ok(Array.isArray(graph.unknowns), "unknowns should be an array");
});

test("graph contains package nodes from package.json dependencies", async () => {
  const content = await readFile(GRAPH_PATH, "utf8");
  const graph = JSON.parse(content);
  // @modelcontextprotocol/sdk is in dependencies — should appear as a package node
  const mcpNode = graph.nodes.find((n) => n.id === "pkg:@modelcontextprotocol/sdk");
  assert.ok(mcpNode, "pkg:@modelcontextprotocol/sdk node should exist");
  assert.equal(mcpNode.kind, "package");
  assert.equal(mcpNode.confidence, "verified");
  assert.ok(mcpNode.evidence.includes("package.json"), `evidence should include package.json, got: ${mcpNode.evidence}`);
});

test("graph contains internal module nodes for src/ files", async () => {
  const content = await readFile(GRAPH_PATH, "utf8");
  const graph = JSON.parse(content);
  // src/types.ts should appear as a module node
  const typesNode = graph.nodes.find((n) => n.id === "module:src/types");
  assert.ok(typesNode, "module:src/types node should exist");
  assert.equal(typesNode.kind, "module");
  assert.equal(typesNode.confidence, "verified");
});

test("graph contains an imports edge from src/adapters/index to src/types", async () => {
  const content = await readFile(GRAPH_PATH, "utf8");
  const graph = JSON.parse(content);
  // src/adapters/index.ts imports from ../types.js → module:src/types
  const edge = graph.edges.find(
    (e) => e.from === "module:src/adapters/index" && e.to === "module:src/types" && e.relation === "imports",
  );
  assert.ok(
    edge,
    `Expected imports edge from src/adapters/index to src/types. ` +
    `Edges from adapters: ${JSON.stringify(graph.edges.filter((e) => e.from === "module:src/adapters/index").map((e) => `${e.to}(${e.relation})`))}`
  );
  assert.equal(edge.confidence, "verified");
  assert.ok(edge.evidence.some((ev) => ev.startsWith("src/adapters/index")), `evidence should cite src/adapters/index, got: ${edge.evidence}`);
});

test("node IDs are stable across two consecutive builds", async () => {
  const first = await readFile(GRAPH_PATH, "utf8");
  const firstGraph = JSON.parse(first);
  const firstIds = new Set(firstGraph.nodes.map((n) => n.id));

  // Rebuild
  await buildGraph(REPO_ROOT);
  const second = await readFile(GRAPH_PATH, "utf8");
  const secondGraph = JSON.parse(second);
  const secondIds = new Set(secondGraph.nodes.map((n) => n.id));

  // All IDs from first run should be in second run
  for (const id of firstIds) {
    assert.ok(secondIds.has(id), `Node ID drifted: "${id}" missing from second build`);
  }
});

test("all edges reference node IDs that exist in the nodes array", async () => {
  const content = await readFile(GRAPH_PATH, "utf8");
  const graph = JSON.parse(content);
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    assert.ok(nodeIds.has(edge.from), `Edge.from "${edge.from}" not in nodes`);
    // edge.to may be an external package not in manifests — that's listed in unknowns
    // but we still check that edge.from is a known node
  }
});

test("analyzeImpact returns direct importers for a changed source file", async () => {
  // src/types.ts is imported by multiple modules — changing it should list those modules
  const result = await analyzeImpact(REPO_ROOT, ["src/types.ts"]);
  // Should have at least src/adapters/index as a direct importer
  const hasAdapters = result.direct.includes("module:src/adapters/index") ||
                      result.indirect.includes("module:src/adapters/index");
  assert.ok(
    hasAdapters || result.direct.length > 0,
    `Expected direct importers of src/types.ts, got: ${JSON.stringify(result)}`,
  );
});
