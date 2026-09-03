import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildGraph, loadExistingGraph } from "../dist/graph/index.js";
import { buildDependencyGraph } from "../dist/graph/builders/dependency.js";
import { reconcileGraphifyEvidence } from "../dist/graph/provider-evidence.js";

const digest = (value) => createHash("sha256").update(value).digest("hex");

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-graphify-"));
  const provider = path.join(root, ".engineering-intelligence", "providers");
  const workspace = path.join(provider, "workspace");
  const graphify = path.join(provider, "graphify");
  const a = `import { answer } from "./b.js";\nexport const result = answer;\n`;
  const b = `export const answer = 42;\n`;
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(workspace, "src"), { recursive: true });
  await mkdir(graphify, { recursive: true });
  const mcp = '{"mcpServers":{"engineering-intelligence":{"command":"npx"}}}\n';
  await writeFile(path.join(root, "src", "a.ts"), a);
  await writeFile(path.join(root, "src", "b.ts"), b);
  await writeFile(path.join(root, ".mcp.json"), mcp);
  await writeFile(path.join(workspace, "src", "a.ts"), a);
  await writeFile(path.join(workspace, "src", "b.ts"), b);
  const sourceHashes = { ".mcp.json": digest(mcp), "src/a.ts": digest(a), "src/b.ts": digest(b) };
  const run = {
    schemaVersion: 1,
    provider: "graphify",
    providerVersion: "0.9.29",
    generatedAt: new Date().toISOString(),
    workspaceHash: digest(JSON.stringify(sourceHashes)),
    sourceHashes,
    command: ["graphify", "extract"],
    graphPath: ".engineering-intelligence/providers/graphify/graph.json",
  };
  await writeFile(path.join(graphify, "run.json"), JSON.stringify(run));
  return { root, workspace, graphify, a, b };
}

test("Graphify agreement corroborates the EI-native relationship", async () => {
  const fx = await fixture();
  await writeFile(path.join(fx.graphify, "graph.json"), JSON.stringify({
    nodes: [
      { id: "a", label: "a", source_file: path.join(fx.workspace, "src", "a.ts"), confidence: "EXTRACTED" },
      { id: "b", label: "b", source_file: path.join(fx.workspace, "src", "b.ts"), confidence: "EXTRACTED" },
    ],
    edges: [{ source: "a", target: "b", relation: "IMPORTS_FROM", confidence: "EXTRACTED", source_file: "src/a.ts", source_location: "L1" }],
  }));
  const native = await buildDependencyGraph(fx.root);
  const result = await reconcileGraphifyEvidence(fx.root, native.graph);
  assert.equal(result.available, true);
  assert.equal(result.corroboratedEdges, 1);
  const edge = result.graph.edges.find((candidate) => candidate.from === "module:src/a" && candidate.to === "module:src/b" && candidate.relation === "imports");
  assert.ok(edge);
  assert.equal(edge.metadata.corroborated, true);
  assert.equal(edge.metadata.trustState, "fresh");
  assert.deepEqual(edge.metadata.providers, ["native", "graphify"]);
});

test("stale Graphify evidence is excluded instead of presented as current", async () => {
  const fx = await fixture();
  await writeFile(path.join(fx.graphify, "graph.json"), JSON.stringify({
    nodes: [
      { id: "a", label: "a", source_file: "src/a.ts", confidence: "EXTRACTED" },
      { id: "b", label: "b", source_file: "src/b.ts", confidence: "EXTRACTED" },
    ],
    edges: [{ source: "a", target: "b", relation: "imports", confidence: "EXTRACTED", source_file: "src/a.ts" }],
  }));
  await writeFile(path.join(fx.root, "src", "b.ts"), "export const answer = 43;\n");
  const native = await buildDependencyGraph(fx.root);
  const result = await reconcileGraphifyEvidence(fx.root, native.graph);
  assert.ok(result.staleEvidence > 0);
  const edge = result.graph.edges.find((candidate) => candidate.from === "module:src/a" && candidate.to === "module:src/b" && candidate.relation === "imports");
  assert.ok(edge, "native EI edge remains available");
  assert.equal(edge.metadata.corroborated, undefined, "stale provider evidence must not decorate the native edge");
  assert.ok(result.graph.unknowns.some((item) => item.includes("excluded as stale")));
});

test("out-of-scope Graphify nodes never enter the canonical graph", async () => {
  const fx = await fixture();
  await writeFile(path.join(fx.graphify, "graph.json"), JSON.stringify({
    nodes: [{ id: "generated", label: "generated", source_file: "dist/generated.js", confidence: "EXTRACTED" }],
    edges: [],
  }));
  const native = await buildDependencyGraph(fx.root);
  const result = await reconcileGraphifyEvidence(fx.root, native.graph);
  assert.equal(result.acceptedNodes, 0);
  assert.ok(result.rejectedEvidence > 0);
  assert.ok(!result.graph.nodes.some((node) => node.id.includes("generated")));
});

test("duplicate Graphify rows cannot self-corroborate a contested relationship", async () => {
  const fx = await fixture();
  await writeFile(path.join(fx.graphify, "graph.json"), JSON.stringify({
    nodes: [
      { id: "a", label: "a", source_file: "src/a.ts", confidence: "EXTRACTED" },
      { id: "b", label: "b", source_file: "src/b.ts", confidence: "EXTRACTED" },
    ],
    edges: [
      { source: "a", target: "b", relation: "references", confidence: "EXTRACTED", source_file: "src/a.ts" },
      { source: "a", target: "b", relation: "references", confidence: "EXTRACTED", source_file: "src/a.ts" },
    ],
  }));
  const native = await buildDependencyGraph(fx.root);
  const result = await reconcileGraphifyEvidence(fx.root, native.graph);
  assert.equal(result.contestedEdges, 1);
  assert.equal(result.corroboratedEdges, 0);
  const edge = result.graph.edges.find((candidate) => candidate.from === "module:src/a" && candidate.to === "module:src/b" && candidate.relation === "references");
  assert.equal(edge.metadata.trustState, "contested");
  assert.equal(edge.metadata.corroborated, false);
});

test("incremental builds replace provider-only evidence instead of duplicating it", async (t) => {
  const fx = await fixture();
  t.after(async () => rm(fx.root, { recursive: true, force: true }));
  await writeFile(path.join(fx.graphify, "graph.json"), JSON.stringify({
    nodes: [{ id: "mcp", label: "engineering-intelligence", source_file: ".mcp.json", confidence: "EXTRACTED" }],
    edges: [],
  }));

  await buildGraph(fx.root);
  const full = await loadExistingGraph(path.join(fx.root, ".engineering-intelligence", "graph", "dependency-graph.json"));
  const providerOnly = (graph) => graph.nodes.filter((node) => node.metadata?.provider === "graphify" && !node.metadata?.providers?.includes("native"));
  assert.equal(providerOnly(full).length, 1);

  const incremental = await buildGraph(fx.root, { update: true, files: ["src/a.ts"] });
  assert.equal(incremental.wasIncremental, true);
  const incrementalGraph = await loadExistingGraph(path.join(fx.root, ".engineering-intelligence", "graph", "dependency-graph.json"));
  assert.equal(providerOnly(incrementalGraph).length, 1, "provider-only nodes must be replaced, not appended");
  assert.equal(incrementalGraph.nodes.filter((node) => node.id.startsWith("graphify:mcp:")).length, 0, "provider-only node IDs must not accumulate suffixes");
});
