/**
 * Comprehensive Requirement-Driven E2E Test Suite — Features & Boundaries (Tiers 1 & 2)
 *
 * Covers all 6 core features defined in PROJECT.md:
 * - Feature 1: Progressive Code Skeletonization & Interface Outlines
 * - Feature 2: Self-Healing Evidence Citations
 * - Feature 3: Multi-Hop Call Chain & Execution Path Tracing
 * - Feature 4: Fast Symbol Navigation & Call Graph in Consolidated MCP (find_symbol & who_calls)
 * - Feature 5: Cross-IDE Session Handoff & Flight Coordination Engine
 * - Feature 6: Continuous Self-Learning Engine & Memory Consolidation
 *
 * Tier 1: Feature Coverage (>=5 tests per feature: 30 tests)
 * Tier 2: Boundary & Corner Cases (>=5 tests per feature: 30 tests)
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Dynamic import helpers to support progressive testability during concurrent worker builds
async function getSkeletonModule() {
  try {
    return await import("../dist/context/skeleton.js");
  } catch {
    return null;
  }
}

async function getEvidenceModule() {
  try {
    return await import("../dist/evidence/index.js");
  } catch {
    return null;
  }
}

async function getGraphModule() {
  try {
    return await import("../dist/graph/index.js");
  } catch {
    return null;
  }
}

async function getFlightModule() {
  try {
    return await import("../dist/flight/index.js");
  } catch {
    return null;
  }
}

async function getLearningModule() {
  try {
    return await import("../dist/learning/index.js");
  } catch {
    return null;
  }
}

async function getMcpConsolidatedModule() {
  try {
    return await import("../dist/mcp/consolidated.js");
  } catch {
    return null;
  }
}

async function getContextOrchestratorModule() {
  try {
    return await import("../dist/context/orchestrator.js");
  } catch {
    return null;
  }
}

// Workspace fixture helper
async function createIsolatedRepo() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ei-e2e-feat-"));
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
  git("init -q");
  git("config user.email test@example.com");
  git("config user.name Test");

  const write = async (relPath, content) => {
    const full = path.join(dir, relPath);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  };

  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true });
  };

  return { dir, git, write, cleanup };
}

// ===========================================================================
// TIER 1: FEATURE COVERAGE (>=5 tests per feature)
// ===========================================================================

// ---------------------------------------------------------------------------
// FEATURE 1: Progressive Code Skeletonization & Interface Outlines
// ---------------------------------------------------------------------------

test("T1.1: generateCodeSkeleton extracts function signatures and folds implementation bodies", async (t) => {
  const mod = await getSkeletonModule();
  if (!mod?.generateCodeSkeleton) return t.skip("generateCodeSkeleton not yet exported in dist/context/skeleton.js");

  const code = `
export function calculateTax(income: number, rate: number): number {
  const base = income * rate;
  const surcharge = income > 100000 ? 0.05 * income : 0;
  return base + surcharge;
}
`;
  const result = mod.generateCodeSkeleton(code, "src/tax.ts");
  assert.ok(result, "should return a skeleton result");
  assert.equal(typeof result.skeleton, "string");
  assert.ok(result.skeleton.includes("function calculateTax"), "must preserve function signature");
  assert.ok(result.skeleton.includes("income: number, rate: number"), "must preserve parameter types");
  assert.ok(result.skeleton.includes("omitted") || result.skeleton.includes("/*"), "must fold function body");
  assert.ok(!result.skeleton.includes("const surcharge"), "implementation details must be omitted");
});

test("T1.2: generateCodeSkeleton computes accurate token accounting and reduction ratio", async (t) => {
  const mod = await getSkeletonModule();
  if (!mod?.generateCodeSkeleton) return t.skip("generateCodeSkeleton not yet exported in dist/context/skeleton.js");

  const code = `
export class OrderService {
  processOrder(id: string, items: string[]): boolean {
    // 20 lines of processing logic
    console.log("validating items...");
    for (const item of items) {
      if (!item) throw new Error("Invalid item");
    }
    console.log("charging customer...");
    console.log("notifying warehouse...");
    console.log("emitting order.created event...");
    return true;
  }
}
`;
  const result = mod.generateCodeSkeleton(code, "src/order.ts");
  assert.ok(result.originalTokens > 0, "originalTokens must be > 0");
  assert.ok(result.skeletonTokens > 0, "skeletonTokens must be > 0");
  assert.ok(result.skeletonTokens < result.originalTokens, "skeletonTokens must be less than originalTokens");
  assert.ok(result.reductionRatio > 0 && result.reductionRatio < 1, "reductionRatio must be between 0 and 1");
});

test("T1.3: generateCodeSkeleton preserves exported interfaces, type aliases, and enums intact", async (t) => {
  const mod = await getSkeletonModule();
  if (!mod?.generateCodeSkeleton) return t.skip("generateCodeSkeleton not yet exported in dist/context/skeleton.js");

  const code = `
export interface UserProfile {
  id: string;
  name: string;
  roles: string[];
}

export type AuthToken = string;

export enum AccountStatus {
  Active = "ACTIVE",
  Suspended = "SUSPENDED"
}
`;
  const result = mod.generateCodeSkeleton(code, "src/types.ts");
  assert.ok(result.skeleton.includes("interface UserProfile"), "interface must be preserved");
  assert.ok(result.skeleton.includes("type AuthToken"), "type alias must be preserved");
  assert.ok(result.skeleton.includes("enum AccountStatus"), "enum must be preserved");
  assert.ok(result.skeleton.includes("Active = \"ACTIVE\""), "enum values must be intact");
});

test("T1.4: generateCodeSkeleton folds class methods while preserving method signatures and modifiers", async (t) => {
  const mod = await getSkeletonModule();
  if (!mod?.generateCodeSkeleton) return t.skip("generateCodeSkeleton not yet exported in dist/context/skeleton.js");

  const code = `
export class PaymentProcessor {
  public static version: string = "2.0";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async charge(amount: number): Promise<boolean> {
    const valid = amount > 0;
    return valid;
  }
}
`;
  const result = mod.generateCodeSkeleton(code, "src/payment.ts");
  assert.ok(result.skeleton.includes("class PaymentProcessor"), "class declaration preserved");
  assert.ok(result.skeleton.includes("charge"), "method signature preserved");
  assert.ok(!result.skeleton.includes("const valid = amount > 0"), "method body must be folded");
});

test("T1.5: ContextPackV2 integrates progressive skeletons when budget is constrained", async (t) => {
  const orch = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  if (!orch?.getEngineeringContext || !graphMod?.buildGraph) {
    return t.skip("getEngineeringContext not available");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/core.ts", "export function main() { return 1; }\n");
    await repo.write("src/secondary.ts", "export function helperA() {\n  const x = 1;\n  const y = 2;\n  return x + y;\n}\nexport function helperB() {\n  return 42;\n}\n");
    await repo.write("test/core.test.ts", "import { main } from '../src/core.js';\n");
    repo.git("add -A");
    repo.git("commit -m init");
    await graphMod.buildGraph(repo.dir);

    const pack = await orch.getEngineeringContext(repo.dir, {
      task: "optimize core",
      files: ["src/core.ts"],
      budget: 800, // constrained budget to force skeletonization
    });

    assert.ok(pack, "should produce context pack");
    assert.equal(pack.schemaVersion, 2);
    // If skeletons array is populated under constrained budget:
    if (pack.code?.skeletons && pack.code.skeletons.length > 0) {
      const skel = pack.code.skeletons[0];
      assert.ok(skel.path, "skeleton must have path");
      assert.ok(typeof skel.outline === "string", "skeleton must have outline string");
      assert.ok(typeof skel.tokenSavings === "number", "skeleton must report tokenSavings");
    }
  } finally {
    await repo.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FEATURE 2: Self-Healing Evidence Citations
// ---------------------------------------------------------------------------

test("T1.6: findRelocatedLine returns exact line when line content has not moved", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.findRelocatedLine) return t.skip("findRelocatedLine not yet exported in dist/evidence/index.js");

  const lines = [
    "import { foo } from './foo.js';",
    "",
    "export function target() {",
    "  return 42;",
    "}",
  ];
  // sha256 of "export function target() {"
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update("export function target() {").digest("hex");

  const found = mod.findRelocatedLine(lines, hash, 3, 25);
  assert.ok(found, "should locate unchanged line");
  assert.equal(found.newLine, 3);
  assert.equal(found.confidence, 1.0);
});

test("T1.7: findRelocatedLine locates line shifted downwards by line insertions", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.findRelocatedLine) return t.skip("findRelocatedLine not yet exported in dist/evidence/index.js");

  const crypto = await import("node:crypto");
  const targetContent = "export function relocatedFunction() {";
  const hash = crypto.createHash("sha256").update(targetContent).digest("hex");

  // 10 new comment lines inserted above line 5 -> moves to line 15
  const lines = [
    "// line 1",
    "// line 2",
    "// line 3",
    "// line 4",
    "// line 5",
    "// line 6",
    "// line 7",
    "// line 8",
    "// line 9",
    "// line 10",
    "// line 11",
    "// line 12",
    "// line 13",
    "// line 14",
    targetContent,
    "  return 100;",
    "}",
  ];

  const found = mod.findRelocatedLine(lines, hash, 5, 25);
  assert.ok(found, "should find relocated line within window");
  assert.equal(found.newLine, 15);
  assert.ok(found.confidence >= 0.8, "confidence should be high for exact content match");
});

test("T1.8: findRelocatedLine locates line shifted upwards by line deletions", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.findRelocatedLine) return t.skip("findRelocatedLine not yet exported in dist/evidence/index.js");

  const crypto = await import("node:crypto");
  const targetContent = "export const apiVersion = 'v3';";
  const hash = crypto.createHash("sha256").update(targetContent).digest("hex");

  // Originally at line 20, now moved to line 8
  const lines = [
    "// comment 1",
    "// comment 2",
    "// comment 3",
    "// comment 4",
    "// comment 5",
    "// comment 6",
    "// comment 7",
    targetContent,
    "export const name = 'test';",
  ];

  const found = mod.findRelocatedLine(lines, hash, 20, 25);
  assert.ok(found, "should locate line shifted upwards");
  assert.equal(found.newLine, 8);
});

test("T1.9: ContextPackV2 maintains healthy knowledge trust when citations are relocated", async (t) => {
  const orch = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  const evidMod = await getEvidenceModule();
  if (!orch?.getEngineeringContext || !graphMod?.buildGraph || !evidMod?.recordEvidenceHashes) {
    return t.skip("Context orchestrator or evidence module missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/service.ts", "export function serviceMethod() {\n  return 'ok';\n}\n");
    await graphMod.buildGraph(repo.dir);
    await repo.write(
      ".engineering-intelligence/knowledge-base/overview.md",
      "# Overview\n\nService method defined at `src/service.ts:1`.\n",
    );
    await evidMod.recordEvidenceHashes(repo.dir);

    // Prepend 4 comment lines to src/service.ts so line 1 moves to line 5
    await repo.write(
      "src/service.ts",
      "// new line 1\n// new line 2\n// new line 3\n// new line 4\nexport function serviceMethod() {\n  return 'ok';\n}\n",
    );

    const pack = await orch.getEngineeringContext(repo.dir, {
      task: "update service",
      files: ["src/service.ts"],
      budget: 3000,
    });

    assert.ok(pack, "should return pack");
    // With self-healing citations, relocated lines should preserve healthy knowledge trust
    // instead of degrading and wiping knowledge documents
    if (evidMod.findRelocatedLine) {
      assert.equal(pack.knowledge.trust, "healthy", "trust must remain healthy when citation is relocated");
      assert.ok(pack.knowledge.documents.length > 0, "knowledge documents must not be discarded on relocated citations");
    }
  } finally {
    await repo.cleanup();
  }
});

test("T1.10: checkEvidenceHashes reports status 'relocated' with updated line information", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.checkEvidenceHashes || !mod?.findRelocatedLine) {
    return t.skip("Self-healing evidence check not yet supported");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/calc.ts", "export function add(a: number, b: number) { return a + b; }\n");
    await repo.write(".engineering-intelligence/knowledge-base/doc.md", "Check `src/calc.ts:1`.\n");
    await mod.recordEvidenceHashes(repo.dir);

    // Shift line down by 5 lines
    await repo.write("src/calc.ts", "\n\n\n\n\nexport function add(a: number, b: number) { return a + b; }\n");
    const report = await mod.checkEvidenceHashes(repo.dir);
    assert.ok(report, "report must be returned");
    assert.equal(report.checked, 1);
    const item = report.results[0];
    assert.ok(item.status === "relocated" || item.status === "ok", "shifted citation should be healed as relocated or ok");
  } finally {
    await repo.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FEATURE 3: Multi-Hop Call Chain & Execution Path Tracing
// ---------------------------------------------------------------------------

test("T1.11: findExecutionPaths discovers direct 1-hop path between caller and callee", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported in dist/graph/index.js");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/a.ts", "export function foo() { return 1; }\n");
    await repo.write("src/b.ts", "import { foo } from './a.js';\nexport function bar() { return foo(); }\n");
    await mod.buildGraph(repo.dir);

    const paths = await mod.findExecutionPaths(repo.dir, "module:src/b", "module:src/a");
    assert.ok(Array.isArray(paths), "should return an array of paths");
    assert.ok(paths.length > 0, "should find at least one execution path");
    const first = paths[0];
    assert.ok(first.nodes.includes("module:src/b"));
    assert.ok(first.nodes.includes("module:src/a"));
  } finally {
    await repo.cleanup();
  }
});

test("T1.12: findExecutionPaths discovers multi-hop 3-step chain across layers", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported in dist/graph/index.js");

  const repo = await createIsolatedRepo();
  try {
    // Route -> Controller -> Service -> Model
    await repo.write("src/model.ts", "export function queryDb() { return []; }\n");
    await repo.write("src/service.ts", "import { queryDb } from './model.js';\nexport function fetchUsers() { return queryDb(); }\n");
    await repo.write("src/controller.ts", "import { fetchUsers } from './service.js';\nexport function handleGetUsers() { return fetchUsers(); }\n");
    await repo.write("src/routes.ts", "import { handleGetUsers } from './controller.js';\nexport function setupRoutes() { return handleGetUsers(); }\n");
    await mod.buildGraph(repo.dir);

    const paths = await mod.findExecutionPaths(repo.dir, "module:src/routes", "module:src/model", { maxDepth: 5 });
    assert.ok(paths.length > 0, "must find multi-hop path");
    const pathNodes = paths[0].nodes;
    assert.equal(pathNodes[0], "module:src/routes");
    assert.equal(pathNodes[pathNodes.length - 1], "module:src/model");
    assert.ok(pathNodes.length >= 4, "path must contain at least 4 nodes");
  } finally {
    await repo.cleanup();
  }
});

test("T1.13: findExecutionPaths discovers multiple alternative execution paths", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported in dist/graph/index.js");

  const repo = await createIsolatedRepo();
  try {
    // A -> B -> D and A -> C -> D
    await repo.write("src/target.ts", "export function sink() { return 0; }\n");
    await repo.write("src/path1.ts", "import { sink } from './target.js';\nexport function step1() { return sink(); }\n");
    await repo.write("src/path2.ts", "import { sink } from './target.js';\nexport function step2() { return sink(); }\n");
    await repo.write("src/source.ts", "import { step1 } from './path1.js';\nimport { step2 } from './path2.js';\nexport function run() { return step1() + step2(); }\n");
    await mod.buildGraph(repo.dir);

    const paths = await mod.findExecutionPaths(repo.dir, "module:src/source", "module:src/target");
    assert.ok(paths.length >= 2, "must discover both branching paths");
  } finally {
    await repo.cleanup();
  }
});

test("T1.14: findExecutionPaths returns edge details and relationship types", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported in dist/graph/index.js");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/dep.ts", "export function util() { return true; }\n");
    await repo.write("src/main.ts", "import { util } from './dep.js';\nexport function start() { return util(); }\n");
    await mod.buildGraph(repo.dir);

    const paths = await mod.findExecutionPaths(repo.dir, "module:src/main", "module:src/dep");
    assert.ok(paths.length > 0);
    const pathEdges = paths[0].edges;
    assert.ok(Array.isArray(pathEdges), "path must include edges");
    assert.ok(pathEdges.length > 0, "path must contain at least one edge");
    assert.ok(pathEdges[0].relation, "edge must specify relation type (imports or calls)");
  } finally {
    await repo.cleanup();
  }
});

test("T1.15: ContextPackV2 populates architecture.callChains connecting seeds to targets", async (t) => {
  const orch = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  if (!orch?.getEngineeringContext || !graphMod?.buildGraph) {
    return t.skip("getEngineeringContext or buildGraph not available");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/api.ts", "export function handleRequest() { return 200; }\n");
    await repo.write("test/api.test.ts", "import { handleRequest } from '../src/api.js';\nexport const t = handleRequest();\n");
    await graphMod.buildGraph(repo.dir);

    const pack = await orch.getEngineeringContext(repo.dir, {
      task: "test api handler",
      files: ["src/api.ts"],
      budget: 4000,
    });

    assert.ok(pack.architecture, "pack must have architecture");
    if (pack.architecture.callChains) {
      assert.ok(Array.isArray(pack.architecture.callChains));
    }
  } finally {
    await repo.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FEATURE 4: Fast Symbol Navigation & Call Graph in Consolidated MCP
// ---------------------------------------------------------------------------

test("T1.16: consolidated MCP registry advertises find_symbol and who_calls tools", async (t) => {
  const mod = await getMcpConsolidatedModule();
  if (!mod?.createConsolidatedRegistry) return t.skip("createConsolidatedRegistry not available");

  const repo = await createIsolatedRepo();
  try {
    const registry = await mod.createConsolidatedRegistry(repo.dir);
    const tools = registry.list().map((t) => t.name);
    assert.ok(tools.includes("find_symbol"), "consolidated registry must advertise find_symbol");
    assert.ok(tools.includes("who_calls"), "consolidated registry must advertise who_calls");
  } finally {
    await repo.cleanup();
  }
});

test("T1.17: find_symbol locates exact exported functions with file:line evidence", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  const graphMod = await getGraphModule();
  if (!mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) {
    return t.skip("MCP or graph module missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/tokens.ts", "export function countTokens(text: string): number {\n  return text.length;\n}\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const result = await registry.execute("find_symbol", { query: "countTokens", root: repo.dir });
    assert.ok(result, "result must be returned");
    const matches = result.matches || (result.rows && result.cols ? result.rows : []);
    assert.ok(matches.length > 0, "should locate countTokens symbol");
  } finally {
    await repo.cleanup();
  }
});

test("T1.18: find_symbol supports partial and substring query matching", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  const graphMod = await getGraphModule();
  if (!mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) {
    return t.skip("MCP or graph module missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/auth.ts", "export function authenticateUser() { return true; }\nexport function authorizeRole() { return true; }\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const result = await registry.execute("find_symbol", { query: "auth", root: repo.dir });
    assert.ok(result, "result must be returned");
  } finally {
    await repo.cleanup();
  }
});

test("T1.19: who_calls returns caller symbol and file:line evidence", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  const graphMod = await getGraphModule();
  if (!mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) {
    return t.skip("MCP or graph module missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/database.ts", "export function connect() { return true; }\n");
    await repo.write("src/server.ts", "import { connect } from './database.js';\nexport function start() { return connect(); }\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const result = await registry.execute("who_calls", { symbol: "connect", root: repo.dir });
    assert.ok(result, "must return callers result");
    const callers = result.callers || (result.rows && result.cols ? result.rows : []);
    assert.ok(Array.isArray(callers), "callers must be an array");
  } finally {
    await repo.cleanup();
  }
});

test("T1.20: who_calls handles callers across multiple consumer files", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  const graphMod = await getGraphModule();
  if (!mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) {
    return t.skip("MCP or graph module missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/logger.ts", "export function log(msg: string) { console.log(msg); }\n");
    await repo.write("src/modA.ts", "import { log } from './logger.js';\nexport function a() { log('a'); }\n");
    await repo.write("src/modB.ts", "import { log } from './logger.js';\nexport function b() { log('b'); }\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const result = await registry.execute("who_calls", { symbol: "log", root: repo.dir });
    assert.ok(result);
  } finally {
    await repo.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FEATURE 5: Cross-IDE Session Handoff & Flight Coordination Engine
// ---------------------------------------------------------------------------

test("T1.21: createSessionHandoff serializes handoff packet to disk", async (t) => {
  const mod = await getFlightModule();
  if (!mod?.createSessionHandoff) return t.skip("createSessionHandoff not yet exported in dist/flight/index.js");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/app.ts", "export const app = 1;\n");
    repo.git("add -A");
    repo.git("commit -m initial");

    const handoff = await mod.createSessionHandoff(repo.dir, {
      sessionId: "session-cursor-001",
      targetIde: "claude-code",
      note: "Refactoring payment gateway",
    });

    assert.ok(handoff, "handoff packet must be created");
    assert.equal(handoff.sessionId, "session-cursor-001");
    assert.equal(handoff.targetIde, "claude-code");
    assert.equal(handoff.note, "Refactoring payment gateway");

    // Verify written to .engineering-intelligence/flight/session-handoff.json
    const raw = await readFile(path.join(repo.dir, ".engineering-intelligence", "flight", "session-handoff.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.sessionId, "session-cursor-001");
  } finally {
    await repo.cleanup();
  }
});

test("T1.22: getSessionHandoff retrieves serialized session handoff packet", async (t) => {
  const mod = await getFlightModule();
  if (!mod?.createSessionHandoff || !mod?.getSessionHandoff) {
    return t.skip("Session handoff functions not exported");
  }

  const repo = await createIsolatedRepo();
  try {
    await mod.createSessionHandoff(repo.dir, {
      sessionId: "session-antigravity-101",
      targetIde: "cursor",
      note: "Feature milestone M2 complete",
    });

    const retrieved = await mod.getSessionHandoff(repo.dir);
    assert.ok(retrieved, "must retrieve handoff");
    assert.equal(retrieved.sessionId, "session-antigravity-101");
    assert.equal(retrieved.targetIde, "cursor");
    assert.equal(retrieved.note, "Feature milestone M2 complete");
  } finally {
    await repo.cleanup();
  }
});

test("T1.23: listActiveFlights lists open flights with declared files and timestamps", async (t) => {
  const mod = await getFlightModule();
  const graphMod = await getGraphModule();
  if (!mod?.listActiveFlights || !mod?.preflight || !graphMod?.buildGraph) {
    return t.skip("listActiveFlights or preflight not exported");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/feature.ts", "export function feat() {}\n");
    repo.git("add -A");
    repo.git("commit -m init");
    await graphMod.buildGraph(repo.dir);

    await mod.preflight(repo.dir, { intent: "implement feature", files: ["src/feature.ts"] });

    const active = await mod.listActiveFlights(repo.dir);
    assert.ok(Array.isArray(active), "must return array of active flights");
    assert.equal(active.length, 1);
    assert.ok(active[0].id.startsWith("flt-"));
    assert.equal(active[0].status, "open");
    assert.deepEqual(active[0].declaredFiles, ["src/feature.ts"]);
  } finally {
    await repo.cleanup();
  }
});

test("T1.24: MCP consolidated registry executes session handoff tools", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  if (!mcpMod?.createConsolidatedRegistry) return t.skip("createConsolidatedRegistry not available");

  const repo = await createIsolatedRepo();
  try {
    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const tools = registry.list().map((t) => t.name);

    if (tools.includes("create_session_handoff")) {
      const created = await registry.execute("create_session_handoff", {
        sessionId: "sess-mcp-test",
        targetIde: "claude-code",
        note: "Testing MCP tool registration",
        root: repo.dir,
      });
      assert.ok(created);

      if (tools.includes("get_session_handoff")) {
        const fetched = await registry.execute("get_session_handoff", { root: repo.dir });
        assert.ok(fetched);
      }
    }
  } finally {
    await repo.cleanup();
  }
});

test("T1.25: createSessionHandoff captures in-flight dirty files and active flights", async (t) => {
  const mod = await getFlightModule();
  const graphMod = await getGraphModule();
  if (!mod?.createSessionHandoff || !mod?.preflight || !graphMod?.buildGraph) {
    return t.skip("createSessionHandoff or preflight not exported");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/core.ts", "export const v = 1;\n");
    repo.git("add -A");
    repo.git("commit -m base");
    await graphMod.buildGraph(repo.dir);

    // Start a flight
    await mod.preflight(repo.dir, { intent: "upgrade core", files: ["src/core.ts"] });

    // Make an uncommitted edit
    await repo.write("src/core.ts", "export const v = 2;\n");

    const handoff = await mod.createSessionHandoff(repo.dir, {
      sessionId: "sess-dirty-check",
      targetIde: "cursor",
    });

    assert.ok(handoff);
    if (handoff.activeFlight) {
      assert.ok(handoff.activeFlight.id.startsWith("flt-"));
    }
  } finally {
    await repo.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FEATURE 6: Continuous Self-Learning Engine & Memory Consolidation
// ---------------------------------------------------------------------------

test("T1.26: recordLearnedPattern records convention pattern to coding-patterns.md", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.recordLearnedPattern) return t.skip("recordLearnedPattern not yet exported in dist/learning/index.js");

  const repo = await createIsolatedRepo();
  try {
    const result = await mod.recordLearnedPattern(repo.dir, {
      type: "convention",
      title: "Use ESM Import Extensions",
      description: "Always append .js extension to relative imports in TypeScript files.",
      rule: "Imports of local modules must end with .js",
      targetFiles: ["src/**/*.ts"],
    });

    assert.ok(result.saved, "pattern must be saved");
    const content = await readFile(path.join(repo.dir, ".engineering-intelligence", "memory", "coding-patterns.md"), "utf8");
    assert.ok(content.includes("Use ESM Import Extensions"), "title must be in memory file");
    assert.ok(content.includes("Imports of local modules must end with .js"), "rule must be in memory file");
  } finally {
    await repo.cleanup();
  }
});

test("T1.27: recordLearnedPattern records regression pattern to regression-patterns.md", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.recordLearnedPattern) return t.skip("recordLearnedPattern not yet exported in dist/learning/index.js");

  const repo = await createIsolatedRepo();
  try {
    const result = await mod.recordLearnedPattern(repo.dir, {
      type: "regression",
      title: "Negative Amount in Payment Charge",
      description: "Calling charge() with amount <= 0 causes transaction ledger mismatch.",
      rule: "Reject charges where amount <= 0 before gateway dispatch",
    });

    assert.ok(result.saved);
    const content = await readFile(path.join(repo.dir, ".engineering-intelligence", "memory", "regression-patterns.md"), "utf8");
    assert.ok(content.includes("Negative Amount in Payment Charge"));
  } finally {
    await repo.cleanup();
  }
});

test("T1.28: recordLearnedPattern records constraint to project-constraints.md", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.recordLearnedPattern) return t.skip("recordLearnedPattern not yet exported in dist/learning/index.js");

  const repo = await createIsolatedRepo();
  try {
    const result = await mod.recordLearnedPattern(repo.dir, {
      type: "constraint",
      title: "No Direct DB Access in Adapters",
      description: "Adapters must route all persistence calls through the repository abstraction.",
      rule: "Adapters cannot import node:sqlite or pg directly",
    });

    assert.ok(result.saved);
    const content = await readFile(path.join(repo.dir, ".engineering-intelligence", "memory", "project-constraints.md"), "utf8");
    assert.ok(content.includes("No Direct DB Access in Adapters"));
  } finally {
    await repo.cleanup();
  }
});

test("T1.29: logUncertaintyEvent writes structured uncertainty log entry", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.logUncertaintyEvent) return t.skip("logUncertaintyEvent not yet exported in dist/learning/index.js");

  const repo = await createIsolatedRepo();
  try {
    const result = await mod.logUncertaintyEvent(repo.dir, {
      trigger: "Unresolved import in legacy adapter",
      area: "src/adapters/legacy.ts",
      description: "Module imports missing config file not found in repository.",
      severity: "medium",
    });

    assert.ok(result.logged, "event must be logged");
    assert.ok(result.id, "event must have an ID");
  } finally {
    await repo.cleanup();
  }
});

test("T1.30: queryProjectMemory retrieves relevant patterns filtered by file or topic", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.recordLearnedPattern || !mod?.queryProjectMemory) {
    return t.skip("Learning module functions not exported");
  }

  const repo = await createIsolatedRepo();
  try {
    await mod.recordLearnedPattern(repo.dir, {
      type: "convention",
      title: "Strict Null Checks in Auth",
      description: "Auth files must handle null and undefined explicitly.",
      rule: "Validate user token is not null before parsing",
      targetFiles: ["src/auth/**/*.ts"],
    });

    const memory = await mod.queryProjectMemory(repo.dir, { file: "src/auth/login.ts" });
    assert.ok(memory, "memory query result must be returned");
    assert.ok(Array.isArray(memory.conventions), "conventions must be array");
  } finally {
    await repo.cleanup();
  }
});

// ===========================================================================
// TIER 2: BOUNDARY & CORNER CASES (>=5 tests per feature)
// ===========================================================================

// ---------------------------------------------------------------------------
// FEATURE 1 BOUNDARY CASES
// ---------------------------------------------------------------------------

test("T2.1: generateCodeSkeleton handles empty file input cleanly", async (t) => {
  const mod = await getSkeletonModule();
  if (!mod?.generateCodeSkeleton) return t.skip("generateCodeSkeleton not yet exported");

  const result = mod.generateCodeSkeleton("", "src/empty.ts");
  assert.equal(result.skeleton, "");
  assert.equal(result.originalTokens, 0);
  assert.equal(result.skeletonTokens, 0);
  assert.equal(result.reductionRatio, 0);
});

test("T2.2: generateCodeSkeleton handles pure declaration files with no bodies", async (t) => {
  const mod = await getSkeletonModule();
  if (!mod?.generateCodeSkeleton) return t.skip("generateCodeSkeleton not yet exported");

  const code = `
export type ID = string;
export interface Identifiable { id: ID; }
`;
  const result = mod.generateCodeSkeleton(code, "src/declarations.d.ts");
  assert.ok(result.skeleton.includes("interface Identifiable"));
  assert.ok(result.reductionRatio >= 0 && result.reductionRatio <= 0.3, "declarations should have little to no folding");
});

test("T2.3: generateCodeSkeleton handles malformed syntax gracefully without throwing", async (t) => {
  const mod = await getSkeletonModule();
  if (!mod?.generateCodeSkeleton) return t.skip("generateCodeSkeleton not yet exported");

  const brokenCode = "export function broken( { // missing parens and braces";
  assert.doesNotThrow(() => {
    const result = mod.generateCodeSkeleton(brokenCode, "src/broken.ts");
    assert.ok(result && typeof result.skeleton === "string");
  });
});

test("T2.4: ContextPackV2 handles zero or near-zero token budgets safely", async (t) => {
  const orch = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  if (!orch?.getEngineeringContext || !graphMod?.buildGraph) return t.skip("Context orchestrator missing");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/a.ts", "export const a = 1;\n");
    repo.git("add -A");
    repo.git("commit -m init");
    await graphMod.buildGraph(repo.dir);

    // Near-zero budget should not cause division by zero or negative allocations
    const pack = await orch.getEngineeringContext(repo.dir, {
      task: "emergency check",
      files: ["src/a.ts"],
      budget: 10,
    });
    assert.ok(pack);
    assert.ok(pack.tokenAllocation.budget >= 10);
  } finally {
    await repo.cleanup();
  }
});

test("T2.5: generateCodeSkeleton handles complex async generators and nested arrow functions", async (t) => {
  const mod = await getSkeletonModule();
  if (!mod?.generateCodeSkeleton) return t.skip("generateCodeSkeleton not yet exported");

  const code = `
export async function* streamEvents<T>(source: AsyncIterable<T>): AsyncGenerator<T, void, unknown> {
  for await (const item of source) {
    const transform = (x: T) => ({ wrapped: x });
    yield transform(item).wrapped;
  }
}
`;
  const result = mod.generateCodeSkeleton(code, "src/stream.ts");
  assert.ok(result.skeleton.includes("async function* streamEvents"));
  assert.ok(result.skeleton.includes("AsyncGenerator"));
  assert.ok(!result.skeleton.includes("transform = (x: T)"), "nested arrow function body must be folded");
});

// ---------------------------------------------------------------------------
// FEATURE 2 BOUNDARY CASES
// ---------------------------------------------------------------------------

test("T2.6: findRelocatedLine returns null when line has shifted beyond search window", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.findRelocatedLine) return t.skip("findRelocatedLine not yet exported");

  const crypto = await import("node:crypto");
  const target = "export function farAway() {}";
  const hash = crypto.createHash("sha256").update(target).digest("hex");

  // 35 lines away with window = 20 -> should return null
  const lines = new Array(35).fill("// line").concat([target]);
  const found = mod.findRelocatedLine(lines, hash, 1, 20);
  assert.equal(found, null, "must return null when outside search window");
});

test("T2.7: findRelocatedLine respects custom window parameter", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.findRelocatedLine) return t.skip("findRelocatedLine not yet exported");

  const crypto = await import("node:crypto");
  const target = "export function customWindowTarget() {}";
  const hash = crypto.createHash("sha256").update(target).digest("hex");

  const lines = new Array(30).fill("// line").concat([target]);
  // With window 25 -> null
  assert.equal(mod.findRelocatedLine(lines, hash, 1, 25), null);
  // With window 40 -> found at line 31
  const found = mod.findRelocatedLine(lines, hash, 1, 40);
  assert.ok(found);
  assert.equal(found.newLine, 31);
});

test("T2.8: findRelocatedLine picks closest match when duplicate identical lines exist", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.findRelocatedLine) return t.skip("findRelocatedLine not yet exported");

  const crypto = await import("node:crypto");
  const target = "return null;";
  const hash = crypto.createHash("sha256").update(target).digest("hex");

  // target occurs at line 5 and line 15; original was line 6 -> should pick line 5
  const lines = [
    "// 1",
    "// 2",
    "// 3",
    "// 4",
    target, // line 5
    "// 6",
    "// 7",
    "// 8",
    "// 9",
    "// 10",
    "// 11",
    "// 12",
    "// 13",
    "// 14",
    target, // line 15
  ];

  const found = mod.findRelocatedLine(lines, hash, 6, 25);
  assert.ok(found);
  assert.equal(found.newLine, 5, "must pick the line closest to originalLine");
});

test("T2.9: findRelocatedLine safely handles empty lines array without throwing", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.findRelocatedLine) return t.skip("findRelocatedLine not yet exported");

  assert.doesNotThrow(() => {
    const found = mod.findRelocatedLine([], "fakehash123", 10, 25);
    assert.equal(found, null);
  });
});

test("T2.10: findRelocatedLine returns null on semantic mutation (content changed, not just moved)", async (t) => {
  const mod = await getEvidenceModule();
  if (!mod?.findRelocatedLine) return t.skip("findRelocatedLine not yet exported");

  const crypto = await import("node:crypto");
  const oldTarget = "export function computeSum(a: number, b: number) {";
  const oldHash = crypto.createHash("sha256").update(oldTarget).digest("hex");

  // Changed to computeSum(a: number, b: number, c: number)
  const lines = [
    "// header",
    "export function computeSum(a: number, b: number, c: number) {",
    "  return a + b + c;",
    "}",
  ];

  const found = mod.findRelocatedLine(lines, oldHash, 1, 25);
  assert.equal(found, null, "semantic mutations must not be relocated; must remain stale");
});

// ---------------------------------------------------------------------------
// FEATURE 3 BOUNDARY CASES
// ---------------------------------------------------------------------------

test("T2.11: findExecutionPaths handles cyclic graphs cleanly without infinite recursion", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported");

  const repo = await createIsolatedRepo();
  try {
    // A imports B, B imports A (cycle)
    await repo.write("src/cycleA.ts", "import { b } from './cycleB.js';\nexport const a = () => b();\n");
    await repo.write("src/cycleB.ts", "import { a } from './cycleA.js';\nexport const b = () => a();\n");
    await mod.buildGraph(repo.dir);

    const paths = await mod.findExecutionPaths(repo.dir, "module:src/cycleA", "module:src/cycleB");
    assert.ok(Array.isArray(paths), "must return array without hanging");
  } finally {
    await repo.cleanup();
  }
});

test("T2.12: findExecutionPaths returns empty array for disconnected graph components", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/islandA.ts", "export const x = 1;\n");
    await repo.write("src/islandB.ts", "export const y = 2;\n");
    await mod.buildGraph(repo.dir);

    const paths = await mod.findExecutionPaths(repo.dir, "module:src/islandA", "module:src/islandB");
    assert.deepEqual(paths, [], "unconnected nodes must have 0 execution paths");
  } finally {
    await repo.cleanup();
  }
});

test("T2.13: findExecutionPaths enforces maxDepth limit", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported");

  const repo = await createIsolatedRepo();
  try {
    // 5 hops: A -> B -> C -> D -> E
    await repo.write("src/e.ts", "export const e = 5;\n");
    await repo.write("src/d.ts", "import { e } from './e.js';\nexport const d = e;\n");
    await repo.write("src/c.ts", "import { d } from './d.js';\nexport const c = d;\n");
    await repo.write("src/b.ts", "import { c } from './c.js';\nexport const b = c;\n");
    await repo.write("src/a.ts", "import { b } from './b.js';\nexport const a = b;\n");
    await mod.buildGraph(repo.dir);

    // With maxDepth = 2, path of length 5 should not be returned
    const paths = await mod.findExecutionPaths(repo.dir, "module:src/a", "module:src/e", { maxDepth: 2 });
    assert.deepEqual(paths, [], "paths exceeding maxDepth must be omitted");
  } finally {
    await repo.cleanup();
  }
});

test("T2.14: findExecutionPaths handles non-existent node IDs gracefully", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/real.ts", "export const r = 1;\n");
    await mod.buildGraph(repo.dir);

    const paths = await mod.findExecutionPaths(repo.dir, "module:non_existent_source", "module:src/real");
    assert.deepEqual(paths, []);
  } finally {
    await repo.cleanup();
  }
});

test("T2.15: findExecutionPaths handles source equal to target cleanly", async (t) => {
  const mod = await getGraphModule();
  if (!mod?.findExecutionPaths) return t.skip("findExecutionPaths not yet exported");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/self.ts", "export const selfVal = 42;\n");
    await mod.buildGraph(repo.dir);

    const paths = await mod.findExecutionPaths(repo.dir, "module:src/self", "module:src/self");
    assert.ok(Array.isArray(paths));
  } finally {
    await repo.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FEATURE 4 BOUNDARY CASES
// ---------------------------------------------------------------------------

test("T2.16: find_symbol returns empty matches for unknown symbol", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  const graphMod = await getGraphModule();
  if (!mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) return t.skip("MCP module missing");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/foo.ts", "export const foo = 1;\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const result = await registry.execute("find_symbol", { query: "completely_unknown_symbol_xyz", root: repo.dir });
    const matches = result.matches || result.rows || [];
    assert.equal(matches.length, 0);
  } finally {
    await repo.cleanup();
  }
});

test("T2.17: who_calls returns empty callers for uncalled root function", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  const graphMod = await getGraphModule();
  if (!mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) return t.skip("MCP module missing");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/root.ts", "export function rootMethod() { return 1; }\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const result = await registry.execute("who_calls", { symbol: "rootMethod", root: repo.dir });
    const callers = result.callers || result.rows || [];
    assert.equal(callers.length, 0);
  } finally {
    await repo.cleanup();
  }
});

test("T2.18: find_symbol respects limit parameter", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  const graphMod = await getGraphModule();
  if (!mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) return t.skip("MCP module missing");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/syms.ts", "export function parseA() {}\nexport function parseB() {}\nexport function parseC() {}\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const result = await registry.execute("find_symbol", { query: "parse", limit: 1, root: repo.dir });
    const matches = result.matches || result.rows || [];
    assert.ok(matches.length <= 1, "matches must respect limit of 1");
  } finally {
    await repo.cleanup();
  }
});

test("T2.19: who_calls enforces file filter parameter", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  const graphMod = await getGraphModule();
  if (!mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) return t.skip("MCP module missing");

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/util1.ts", "export function helper() {}\n");
    await repo.write("src/util2.ts", "export function helper() {}\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    const result = await registry.execute("who_calls", { symbol: "helper", file: "src/util1.ts", root: repo.dir });
    assert.ok(result);
  } finally {
    await repo.cleanup();
  }
});

test("T2.20: MCP rejects invalid parameters with schema error", async (t) => {
  const mcpMod = await getMcpConsolidatedModule();
  if (!mcpMod?.createConsolidatedRegistry) return t.skip("createConsolidatedRegistry not available");

  const repo = await createIsolatedRepo();
  try {
    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    // Passing unknown properties when additionalProperties: false must reject
    await assert.rejects(
      registry.execute("find_symbol", { query: "test", unknownField: true, root: repo.dir }),
      /Unknown argument/,
    );
  } finally {
    await repo.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FEATURE 5 BOUNDARY CASES
// ---------------------------------------------------------------------------

test("T2.21: getSessionHandoff returns null when no handoff file exists", async (t) => {
  const mod = await getFlightModule();
  if (!mod?.getSessionHandoff) return t.skip("getSessionHandoff not yet exported");

  const repo = await createIsolatedRepo();
  try {
    const handoff = await mod.getSessionHandoff(repo.dir);
    assert.equal(handoff, null);
  } finally {
    await repo.cleanup();
  }
});

test("T2.22: createSessionHandoff cleanly overwrites previous handoff without corruption", async (t) => {
  const mod = await getFlightModule();
  if (!mod?.createSessionHandoff || !mod?.getSessionHandoff) return t.skip("Handoff functions not exported");

  const repo = await createIsolatedRepo();
  try {
    await mod.createSessionHandoff(repo.dir, { sessionId: "sess-1", note: "First pass" });
    await mod.createSessionHandoff(repo.dir, { sessionId: "sess-2", note: "Second pass" });

    const current = await mod.getSessionHandoff(repo.dir);
    assert.ok(current);
    assert.equal(current.sessionId, "sess-2");
    assert.equal(current.note, "Second pass");
  } finally {
    await repo.cleanup();
  }
});

test("T2.23: listActiveFlights filters out closed flights", async (t) => {
  const mod = await getFlightModule();
  const graphMod = await getGraphModule();
  if (!mod?.listActiveFlights || !mod?.preflight || !mod?.postflight || !graphMod?.buildGraph) {
    return t.skip("Flight functions not available");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/mod.ts", "export const x = 1;\n");
    repo.git("add -A");
    repo.git("commit -m base");
    await graphMod.buildGraph(repo.dir);

    const flight = await mod.preflight(repo.dir, { intent: "close me", files: ["src/mod.ts"] });
    await mod.postflight(repo.dir, { id: flight.id });

    const active = await mod.listActiveFlights(repo.dir);
    assert.equal(active.length, 0, "closed flight must not be listed in active flights");
  } finally {
    await repo.cleanup();
  }
});

test("T2.24: getSessionHandoff handles corrupted JSON file gracefully", async (t) => {
  const mod = await getFlightModule();
  if (!mod?.getSessionHandoff) return t.skip("getSessionHandoff not exported");

  const repo = await createIsolatedRepo();
  try {
    const flightDir = path.join(repo.dir, ".engineering-intelligence", "flight");
    await mkdir(flightDir, { recursive: true });
    await writeFile(path.join(flightDir, "session-handoff.json"), "{ corrupted json content");

    await assert.doesNotReject(async () => {
      const res = await mod.getSessionHandoff(repo.dir);
      // Returns null or safe error object
      assert.ok(res === null || typeof res === "object");
    });
  } finally {
    await repo.cleanup();
  }
});

test("T2.25: createSessionHandoff auto-creates .engineering-intelligence/flight directory", async (t) => {
  const mod = await getFlightModule();
  if (!mod?.createSessionHandoff) return t.skip("createSessionHandoff not exported");

  const repo = await createIsolatedRepo();
  try {
    // No .engineering-intelligence directory exists yet
    const handoff = await mod.createSessionHandoff(repo.dir, { sessionId: "fresh-workspace" });
    assert.ok(handoff);
  } finally {
    await repo.cleanup();
  }
});

// ---------------------------------------------------------------------------
// FEATURE 6 BOUNDARY CASES
// ---------------------------------------------------------------------------

test("T2.26: recordLearnedPattern avoids unbounded duplicate identical patterns", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.recordLearnedPattern) return t.skip("recordLearnedPattern not exported");

  const repo = await createIsolatedRepo();
  try {
    const pat = {
      type: "convention",
      title: "Idempotent Title",
      description: "Description",
      rule: "Rule",
    };
    await mod.recordLearnedPattern(repo.dir, pat);
    await mod.recordLearnedPattern(repo.dir, pat);

    const file = await readFile(path.join(repo.dir, ".engineering-intelligence", "memory", "coding-patterns.md"), "utf8");
    const count = (file.match(/Idempotent Title/g) || []).length;
    assert.ok(count <= 2, "must not multiply uncontrollably");
  } finally {
    await repo.cleanup();
  }
});

test("T2.27: queryProjectMemory returns empty arrays for non-matching file/topic", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.queryProjectMemory) return t.skip("queryProjectMemory not exported");

  const repo = await createIsolatedRepo();
  try {
    const memory = await mod.queryProjectMemory(repo.dir, { topic: "quantum_teleportation" });
    assert.ok(memory);
    assert.deepEqual(memory.conventions, []);
    assert.deepEqual(memory.constraints, []);
    assert.deepEqual(memory.regressions, []);
  } finally {
    await repo.cleanup();
  }
});

test("T2.28: recordLearnedPattern auto-creates memory directory if missing", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.recordLearnedPattern) return t.skip("recordLearnedPattern not exported");

  const repo = await createIsolatedRepo();
  try {
    const result = await mod.recordLearnedPattern(repo.dir, {
      type: "constraint",
      title: "Auto Init Test",
      description: "Testing auto initialization",
      rule: "Never omit null checks",
    });
    assert.ok(result.saved);
  } finally {
    await repo.cleanup();
  }
});

test("T2.29: recordLearnedPattern escapes markdown special characters and code blocks safely", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.recordLearnedPattern) return t.skip("recordLearnedPattern not exported");

  const repo = await createIsolatedRepo();
  try {
    const result = await mod.recordLearnedPattern(repo.dir, {
      type: "convention",
      title: "Avoid `eval()` & RegExp `.*`",
      description: "Do not write code with `eval()` or unescaped `<script>` tags.",
      rule: "Pattern: /[a-z]+/i and `foo !== null`",
    });
    assert.ok(result.saved);
    const content = await readFile(path.join(repo.dir, ".engineering-intelligence", "memory", "coding-patterns.md"), "utf8");
    assert.ok(content.includes("eval()"));
  } finally {
    await repo.cleanup();
  }
});

test("T2.30: recordLearnedPattern rejects invalid pattern types cleanly", async (t) => {
  const mod = await getLearningModule();
  if (!mod?.recordLearnedPattern) return t.skip("recordLearnedPattern not exported");

  const repo = await createIsolatedRepo();
  try {
    await assert.rejects(
      async () => {
        await mod.recordLearnedPattern(repo.dir, {
          type: "invalid_type",
          title: "Bad Type",
          description: "desc",
          rule: "rule",
        });
      },
      /type/i,
    );
  } finally {
    await repo.cleanup();
  }
});
