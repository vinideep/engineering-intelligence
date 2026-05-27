import assert from "node:assert/strict";
import test from "node:test";
import { readTemplate, validateCanonicalTemplates } from "../dist/templates.js";

test("V2 canonical templates define graph, report, and read-only workflow contracts", async () => {
  assert.deepEqual(await validateCanonicalTemplates(), []);
  const graph = await readTemplate("skills", "graph-engine");
  for (const artifact of [
    "dependency-graph.json",
    "service-graph.json",
    "runtime-graph.json",
    "business-flow-graph.json",
    "architecture-map.md",
  ]) {
    assert.match(graph, new RegExp(artifact.replace(".", "\\.")));
  }
  assert.match(graph, /Mermaid/);
  assert.match(graph, /evidence/);
  assert.match(graph, /unknowns/);
  const implementation = await readTemplate("workflows", "engineering-intelligence");
  assert.match(implementation, /IMP-XXX/);
  assert.match(implementation, /graph artifacts/);
  assert.match(implementation, /validate/i);
  assert.match(implementation, /CHG-XXX/);
  const scoping = await readTemplate("workflows", "scope-requirement");
  assert.match(scoping, /requirement-scoper/);
  assert.match(scoping, /19-requirements\.md/);
});
