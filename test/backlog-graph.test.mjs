import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  parseTicketTargetNodes,
  extractFilesFromNodeIds,
  validateTicketNodes,
  checkInceptionExit,
} from "../dist/aidlc/index.js";
import { buildGraph } from "../dist/graph/index.js";

function initRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-backlog-graph-"));
  const git = (a) => execSync(`git ${a}`, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
  git("init -q");
  git("config user.email test@example.com");
  git("config user.name Test");
  mkdirSync(path.join(dir, "src"));
  writeFileSync(
    path.join(dir, "src", "compute.js"),
    "export function compute() {\n  return 100;\n}\n",
  );
  writeFileSync(
    path.join(dir, "src", "service.js"),
    "import { compute } from './compute.js';\nexport function run() {\n  return compute();\n}\n",
  );
  git("add -A");
  git('commit -q -m "initial repo setup"');
  return { dir, git };
}

test("parseTicketTargetNodes extracts target nodes from list and inline markdown", () => {
  const markdownList = `
# TKT-001: Implement new caching
- Feature: FEAT-001
- Target Graph Nodes:
  - module:src/compute
  - symbol:src/service#run
  - proposed:src/cache
- Status: todo
`;
  const nodes = parseTicketTargetNodes(markdownList);
  assert.deepEqual(nodes, ["module:src/compute", "symbol:src/service#run", "proposed:src/cache"]);

  const markdownInline = `
# TKT-002: Refactor API
- Target Nodes: [module:src/compute, symbol:src/service#run]
- Status: ready
`;
  const inlineNodes = parseTicketTargetNodes(markdownInline);
  assert.deepEqual(inlineNodes, ["module:src/compute", "symbol:src/service#run"]);
});

test("extractFilesFromNodeIds maps node IDs to relative file paths", () => {
  const files = extractFilesFromNodeIds([
    "module:src/compute",
    "symbol:src/service#run",
    "proposed:src/cache/store",
  ]);
  assert.deepEqual(files, ["src/compute", "src/service", "src/cache/store"]);
});

test("validateTicketNodes verifies nodes against dependency graph", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir, { write: true });

    // Existing nodes in repo
    const res1 = await validateTicketNodes(dir, [
      "module:src/compute",
      "symbol:src/compute#compute",
      "proposed:src/future-module",
    ]);
    assert.equal(res1.valid, true);
    assert.equal(res1.missingNodes.length, 0);

    // Non-existent node
    const res2 = await validateTicketNodes(dir, [
      "module:src/compute",
      "module:src/nonexistent",
    ]);
    assert.equal(res2.valid, false);
    assert.deepEqual(res2.missingNodes, ["module:src/nonexistent"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkInceptionExit blocks when a backlog ticket targets unknown graph nodes", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir, { write: true });

    const aidlcDir = path.join(dir, ".engineering-intelligence", "aidlc");
    const inceptionDir = path.join(aidlcDir, "inception");
    const ticketsDir = path.join(aidlcDir, "agile", "backlog", "tickets");
    mkdirSync(inceptionDir, { recursive: true });
    mkdirSync(ticketsDir, { recursive: true });

    writeFileSync(path.join(inceptionDir, "requirements.md"), "# Requirements\n");

    // Write a ticket that references a hallucinated / nonexistent graph node
    const badTicket = `# TKT-001: Bad Ticket
- Feature: FEAT-001
- Target Graph Nodes:
  - module:src/ghost-module
- Status: ready
`;
    writeFileSync(path.join(ticketsDir, "TKT-001.md"), badTicket);

    const gateResult = await checkInceptionExit(dir);
    assert.equal(gateResult.status, "blocked");
    assert.ok(
      gateResult.missingPrerequisites.some((m) => m.includes("ghost-module")),
      "should report unknown target graph node in gate prerequisites",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
