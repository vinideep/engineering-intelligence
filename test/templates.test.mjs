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
    "data-flow-graph.json",
    "architecture-map.md",
  ]) {
    assert.match(graph, new RegExp(artifact.replace(".", "\\.")));
  }
  assert.match(graph, /Mermaid/);
  assert.match(graph, /evidence/);
  assert.match(graph, /unknowns/);
  assert.match(graph, /imports-type/);
  assert.match(graph, /co-change/);
  assert.match(graph, /metadata\.hotness/);
  assert.match(graph, /sensitive data/);
  const implementation = await readTemplate("workflows", "engineering-intelligence");
  assert.match(implementation, /IMP-XXX/);
  assert.match(implementation, /graph artifacts/);
  assert.match(implementation, /validate/i);
  assert.match(implementation, /CHG-XXX/);
  assert.match(implementation, /Safety Gates/);
  const scoping = await readTemplate("workflows", "scope-requirement");
  assert.match(scoping, /requirement-scoper/);
  assert.match(scoping, /19-requirements\.md/);
  const aidlc = await readTemplate("skills", "aidlc-lifecycle-engine");
  assert.match(aidlc, /Discovery/);
  assert.match(aidlc, /Inception/);
  assert.match(aidlc, /Construction/);
  assert.match(aidlc, /Operations/);
  assert.match(aidlc, /environmental backpressure/);
  assert.match(aidlc, /cross-unit-discoveries\.md/);
  assert.match(aidlc, /product-backlog\.md/);
  assert.match(aidlc, /Definition of Ready/);
  const engineering = await readTemplate("workflows", "engineering-intelligence");
  assert.match(engineering, /standard Agile/);
  assert.match(engineering, /AI-DLC/);
  assert.match(engineering, /acceptance criteria/);
  const implementationSkill = await readTemplate("skills", "engineering-intelligence-skill");
  assert.match(implementationSkill, /Pre-Flight Freshness Gate/);
  assert.match(implementationSkill, /Acceptance Criteria Verification Matrix/);
  assert.match(implementationSkill, /type-safety-engine/);
  assert.match(implementationSkill, /database-migration-safety-engine/);
  assert.match(implementationSkill, /api-backward-compatibility-engine/);
  const typeSafety = await readTemplate("skills", "type-safety-engine");
  assert.match(typeSafety, /tsc --listFilesOnly/);
  assert.match(typeSafety, /mypy --show-column-numbers/);
  const migrationSafety = await readTemplate("skills", "database-migration-safety-engine");
  assert.match(migrationSafety, /down migration/);
  assert.match(migrationSafety, /CONCURRENTLY/);
  const apiCompatibility = await readTemplate("skills", "api-backward-compatibility-engine");
  assert.match(apiCompatibility, /additive/);
  assert.match(apiCompatibility, /deprecated/);
  assert.match(apiCompatibility, /breaking/);
  const snapshot = await readTemplate("skills", "api-snapshot-testing-engine");
  assert.match(snapshot, /\.engineering-intelligence\/snapshots\//);
  assert.match(snapshot, /replay/);
  const staleness = await readTemplate("skills", "staleness-detector");
  assert.match(staleness, /Pre-Implementation Drift Trigger/);
  const convention = await readTemplate("skills", "convention-detector");
  assert.match(convention, /Convention Severity/);
  const memory = await readTemplate("skills", "memory-sync-engine");
  assert.match(memory, /Testing Intelligence Engine owns detection/);
  const contextBudget = await readTemplate("skills", "context-budget-optimizer");
  assert.match(contextBudget, /Token Budget/);
  assert.match(contextBudget, /Context Manifest/);
  assert.match(contextBudget, /Lazy Loading/);
  assert.match(contextBudget, /40%/);
  const nfrAdr = await readTemplate("skills", "nfr-adr-governor");
  assert.match(nfrAdr, /ADR/);
  assert.match(nfrAdr, /Superseded/);
});
