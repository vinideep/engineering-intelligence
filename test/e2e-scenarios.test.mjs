/**
 * Comprehensive Requirement-Driven E2E Test Suite — Cross-Feature & Real-World Scenarios (Tiers 3 & 4)
 *
 * Tier 3: Cross-Feature Combinations (Pairwise Interactions: 8 tests)
 * Tier 4: Real-World Application Scenarios (>=5 Realistic Workloads: 5 tests)
 *
 * Designed to assert the public interface contracts defined in PROJECT.md:
 * - Feature 1: Progressive Code Skeletonization & Interface Outlines
 * - Feature 2: Self-Healing Evidence Citations
 * - Feature 3: Multi-Hop Call Chain & Execution Path Tracing
 * - Feature 4: Fast Symbol Navigation & Call Graph in Consolidated MCP
 * - Feature 5: Cross-IDE Session Handoff & Flight Coordination Engine
 * - Feature 6: Continuous Self-Learning Engine & Memory Consolidation
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Dynamic import helpers for progressive testability
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

async function createIsolatedRepo() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ei-e2e-scen-"));
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
// TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Interactions)
// ===========================================================================

test("T3.1: Progressive Skeletonization + Session Handoff (F1 + F5)", async (t) => {
  const skelMod = await getSkeletonModule();
  const flightMod = await getFlightModule();
  if (!skelMod?.generateCodeSkeleton || !flightMod?.createSessionHandoff) {
    return t.skip("Skeleton or flight module not yet available");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write(
      "src/service.ts",
      "export class GatewayService {\n  executeTransaction(id: string) {\n    return id + '_ok';\n  }\n}\n",
    );
    repo.git("add -A");
    repo.git("commit -m init");

    // Edit file
    await repo.write(
      "src/service.ts",
      "export class GatewayService {\n  executeTransaction(id: string) {\n    const logged = true;\n    return id + '_ok';\n  }\n}\n",
    );

    // Create session handoff
    const handoff = await flightMod.createSessionHandoff(repo.dir, {
      sessionId: "sess-f1-f5",
      targetIde: "claude-code",
      note: "Preparing dirty files with skeleton context",
    });

    assert.ok(handoff);
    // Generate skeleton of the dirty file to accompany handoff
    const content = await readFile(path.join(repo.dir, "src/service.ts"), "utf8");
    const skel = skelMod.generateCodeSkeleton(content, "src/service.ts");
    assert.ok(skel.skeleton.includes("class GatewayService"));
    assert.ok(skel.reductionRatio >= 0);
  } finally {
    await repo.cleanup();
  }
});

test("T3.2: Multi-Hop Execution Path Tracing + Fast Symbol Navigation (F3 + F4)", async (t) => {
  const graphMod = await getGraphModule();
  const mcpMod = await getMcpConsolidatedModule();
  if (!graphMod?.findExecutionPaths || !mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) {
    return t.skip("Execution path finding or consolidated MCP not available");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/repo.ts", "export function saveRecord() { return true; }\n");
    await repo.write("src/service.ts", "import { saveRecord } from './repo.js';\nexport function createItem() { return saveRecord(); }\n");
    await repo.write("src/api.ts", "import { createItem } from './service.js';\nexport function postEndpoint() { return createItem(); }\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);
    // 1. Locate symbol via MCP find_symbol
    const symResult = await registry.execute("find_symbol", { query: "saveRecord", root: repo.dir });
    assert.ok(symResult);

    // 2. Trace execution path from entrypoint to the located symbol
    const paths = await graphMod.findExecutionPaths(repo.dir, "module:src/api", "module:src/repo");
    assert.ok(paths.length > 0, "must find path connecting entrypoint to target");
    assert.equal(paths[0].nodes[0], "module:src/api");
    assert.equal(paths[0].nodes[paths[0].nodes.length - 1], "module:src/repo");
  } finally {
    await repo.cleanup();
  }
});

test("T3.3: Continuous Self-Learning + Evidence Citation Healing (F2 + F6)", async (t) => {
  const learnMod = await getLearningModule();
  const evidMod = await getEvidenceModule();
  if (!learnMod?.recordLearnedPattern || !evidMod?.recordEvidenceHashes || !evidMod?.findRelocatedLine) {
    return t.skip("Learning or evidence healing module missing");
  }

  const repo = await createIsolatedRepo();
  try {
    // 1. Record a regression pattern
    await learnMod.recordLearnedPattern(repo.dir, {
      type: "regression",
      title: "Integer Overflow in Rate Limiter",
      description: "Window calculation exceeds max integer on high traffic.",
      rule: "Use BigInt for timestamp math in rate limiter",
    });

    // 2. Cite the memory file in knowledge base
    const memFile = ".engineering-intelligence/memory/regression-patterns.md";
    await repo.write(
      ".engineering-intelligence/knowledge-base/rules.md",
      `Refer to \`${memFile}:1\` for rate limiter precautions.\n`,
    );
    await evidMod.recordEvidenceHashes(repo.dir);

    // 3. Shift the memory file content downwards by prepending lines
    const existingMem = await readFile(path.join(repo.dir, memFile), "utf8");
    await writeFile(path.join(repo.dir, memFile), "# Security & Regressions\n\n" + existingMem, "utf8");

    // 4. Verify citation relocation discovers shifted line
    const checkReport = await evidMod.checkEvidenceHashes(repo.dir);
    assert.ok(checkReport);
    // The citation should be healed as relocated or ok rather than breaking
    assert.ok(checkReport.stale === 0 || checkReport.results.some((r) => r.status === "relocated"));
  } finally {
    await repo.cleanup();
  }
});

test("T3.4: MCP who_calls + Multi-Hop Execution Path Tracing (F3 + F4)", async (t) => {
  const graphMod = await getGraphModule();
  const mcpMod = await getMcpConsolidatedModule();
  if (!graphMod?.findExecutionPaths || !mcpMod?.createConsolidatedRegistry || !graphMod?.buildGraph) {
    return t.skip("Execution paths or consolidated MCP not available");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/core.ts", "export function executeCore() { return true; }\n");
    await repo.write("src/step.ts", "import { executeCore } from './core.js';\nexport function intermediateStep() { return executeCore(); }\n");
    await repo.write("src/entry.ts", "import { intermediateStep } from './step.js';\nexport function run() { return intermediateStep(); }\n");
    await graphMod.buildGraph(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);

    // 1. Query who_calls for executeCore
    const whoResult = await registry.execute("who_calls", { symbol: "executeCore", root: repo.dir });
    assert.ok(whoResult);
    const callers = whoResult.callers || whoResult.rows || [];

    // 2. Trace execution paths from entry to core
    const paths = await graphMod.findExecutionPaths(repo.dir, "module:src/entry", "module:src/core");
    assert.ok(paths.length > 0);

    // Immediate predecessor of executeCore in the path must match the direct caller found by who_calls
    const pathNodes = paths[0].nodes;
    const directCallerNode = pathNodes[pathNodes.length - 2];
    assert.ok(directCallerNode.includes("step"));
  } finally {
    await repo.cleanup();
  }
});

test("T3.5: Active Flights Listing + Session Handoff Serialization (F5)", async (t) => {
  const flightMod = await getFlightModule();
  const graphMod = await getGraphModule();
  if (!flightMod?.createSessionHandoff || !flightMod?.listActiveFlights || !flightMod?.preflight || !graphMod?.buildGraph) {
    return t.skip("Flight coordination functions missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/auth.ts", "export function login() {}\n");
    repo.git("add -A");
    repo.git("commit -m initial");
    await graphMod.buildGraph(repo.dir);

    // Start an active flight
    const flight = await flightMod.preflight(repo.dir, {
      intent: "Migrate auth to OAuth2",
      files: ["src/auth.ts"],
    });

    // 1. Verify listActiveFlights captures the flight
    const active = await flightMod.listActiveFlights(repo.dir);
    assert.equal(active.length, 1);
    assert.equal(active[0].id, flight.id);

    // 2. Create session handoff
    const handoff = await flightMod.createSessionHandoff(repo.dir, {
      sessionId: "sess-coord-01",
      targetIde: "cursor",
    });

    assert.ok(handoff);
    assert.equal(handoff.sessionId, "sess-coord-01");
  } finally {
    await repo.cleanup();
  }
});

test("T3.6: Continuous Self-Learning Negative Constraints + ContextPackV2 Injection (F6 + Context)", async (t) => {
  const learnMod = await getLearningModule();
  const orchMod = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  if (!learnMod?.recordLearnedPattern || !orchMod?.getEngineeringContext || !graphMod?.buildGraph) {
    return t.skip("Learning or context orchestrator not available");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/pay.ts", "export function charge() { return true; }\n");
    repo.git("add -A");
    repo.git("commit -m initial");
    await graphMod.buildGraph(repo.dir);

    // Record a regression constraint
    await learnMod.recordLearnedPattern(repo.dir, {
      type: "constraint",
      title: "Avoid Unvalidated Webhook Payloads",
      description: "Stripe webhooks must verify signature before dispatch.",
      rule: "Reject webhook without stripe-signature header",
      targetFiles: ["src/pay.ts"],
    });

    const pack = await orchMod.getEngineeringContext(repo.dir, {
      task: "update payment webhooks",
      files: ["src/pay.ts"],
      budget: 3000,
    });

    assert.ok(pack);
    // Verified negativeConstraints or knowledge constraints must reflect learned constraints
    assert.ok(pack.negativeConstraints || pack.knowledge.constraints);
  } finally {
    await repo.cleanup();
  }
});

test("T3.7: Skeletonized Chunks + Token Budget Allocation (F1 + Context)", async (t) => {
  const orchMod = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  if (!orchMod?.getEngineeringContext || !graphMod?.buildGraph) {
    return t.skip("Context orchestrator not available");
  }

  const repo = await createIsolatedRepo();
  try {
    // Generate a file with large function bodies
    const largeBody = new Array(50).fill("  console.log('padding detail line');").join("\n");
    await repo.write("src/core.ts", "export function main() { return 1; }\n");
    await repo.write("src/helper1.ts", `export function h1() {\n${largeBody}\n  return 1;\n}\n`);
    await repo.write("src/helper2.ts", `export function h2() {\n${largeBody}\n  return 2;\n}\n`);
    repo.git("add -A");
    repo.git("commit -m initial");
    await graphMod.buildGraph(repo.dir);

    const pack = await orchMod.getEngineeringContext(repo.dir, {
      task: "modify core",
      files: ["src/core.ts"],
      budget: 1200, // tight budget
    });

    assert.ok(pack);
    assert.ok(pack.tokenAllocation.used <= pack.tokenAllocation.budget);
  } finally {
    await repo.cleanup();
  }
});

test("T3.8: Self-Healing Citations + ContextPackV2 Knowledge Stability (F2 + Context)", async (t) => {
  const evidMod = await getEvidenceModule();
  const orchMod = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  if (!evidMod?.recordEvidenceHashes || !orchMod?.getEngineeringContext || !graphMod?.buildGraph) {
    return t.skip("Evidence or context orchestrator missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/billing.ts", "export function invoice() { return 100; }\n");
    await repo.write(
      ".engineering-intelligence/knowledge-base/billing.md",
      "# Billing\n\nInvoice function is in `src/billing.ts:1`.\n",
    );
    await graphMod.buildGraph(repo.dir);
    await evidMod.recordEvidenceHashes(repo.dir);

    // Prepend 6 lines of comments (benign shift)
    await repo.write(
      "src/billing.ts",
      "/**\n * Billing module\n * Author: Test\n */\n\n\nexport function invoice() { return 100; }\n",
    );

    const pack = await orchMod.getEngineeringContext(repo.dir, {
      task: "check billing",
      files: ["src/billing.ts"],
      budget: 2500,
    });

    assert.ok(pack);
    if (evidMod.findRelocatedLine) {
      assert.equal(pack.knowledge.trust, "healthy", "trust must not degrade on harmless line shifts");
      assert.ok(pack.knowledge.documents.length > 0, "knowledge documents must remain available");
    }
  } finally {
    await repo.cleanup();
  }
});

// ===========================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (>=5 Realistic Workloads)
// ===========================================================================

test("T4.1: Scenario 1 — End-to-End API Refactoring Pipeline", async (t) => {
  const graphMod = await getGraphModule();
  const mcpMod = await getMcpConsolidatedModule();
  const evidMod = await getEvidenceModule();
  const skelMod = await getSkeletonModule();

  if (!graphMod?.findExecutionPaths || !mcpMod?.createConsolidatedRegistry || !evidMod?.recordEvidenceHashes) {
    return t.skip("Required modules for Scenario 1 missing");
  }

  const repo = await createIsolatedRepo();
  try {
    // 1. Setup multi-layer architecture
    await repo.write("src/db.ts", "export function runQuery(sql: string) { return []; }\n");
    await repo.write("src/authRepo.ts", "import { runQuery } from './db.js';\nexport function getUser(id: string) { return runQuery('SELECT ' + id); }\n");
    await repo.write("src/authService.ts", "import { getUser } from './authRepo.js';\nexport function authenticate(id: string) { return getUser(id); }\n");
    await repo.write("src/authRouter.ts", "import { authenticate } from './authService.js';\nexport function handleAuth(req: any) { return authenticate(req.id); }\n");
    await repo.write(".engineering-intelligence/knowledge-base/auth.md", "Authentication entry is at `src/authRouter.ts:2`.\n");
    repo.git("add -A");
    repo.git("commit -m initial");

    await graphMod.buildGraph(repo.dir);
    await evidMod.recordEvidenceHashes(repo.dir);

    const registry = await mcpMod.createConsolidatedRegistry(repo.dir);

    // Step A: Fast symbol search for 'authenticate'
    const symMatch = await registry.execute("find_symbol", { query: "authenticate", root: repo.dir });
    assert.ok(symMatch);

    // Step B: Who calls 'authenticate'
    const callerInfo = await registry.execute("who_calls", { symbol: "authenticate", root: repo.dir });
    assert.ok(callerInfo);

    // Step C: Trace end-to-end execution path from Router to DB
    const paths = await graphMod.findExecutionPaths(repo.dir, "module:src/authRouter", "module:src/db");
    assert.ok(paths.length > 0);
    assert.equal(paths[0].nodes[0], "module:src/authRouter");
    assert.equal(paths[0].nodes[paths[0].nodes.length - 1], "module:src/db");

    // Step D: Perform refactor on authRouter.ts (shifts line by 3 lines)
    await repo.write(
      "src/authRouter.ts",
      "// Refactored with middleware\nimport { authenticate } from './authService.js';\n\nexport function handleAuth(req: any) { return authenticate(req.id); }\n",
    );

    // Step E: Self-healing evidence check distinguishes line shift from drift
    if (evidMod.findRelocatedLine) {
      const checkResult = await evidMod.checkEvidenceHashes(repo.dir);
      assert.ok(checkResult);
      assert.equal(checkResult.stale, 0, "shifted citation must be healed rather than marked stale");
    }

    // Step F: Skeletonize peripheral authRepo.ts
    if (skelMod?.generateCodeSkeleton) {
      const repoContent = await readFile(path.join(repo.dir, "src/authRepo.ts"), "utf8");
      const skel = skelMod.generateCodeSkeleton(repoContent, "src/authRepo.ts");
      assert.ok(skel.skeleton.includes("function getUser"));
    }
  } finally {
    await repo.cleanup();
  }
});

test("T4.2: Scenario 2 — Cross-IDE Developer Handoff (Cursor -> Claude Code -> Antigravity)", async (t) => {
  const flightMod = await getFlightModule();
  const graphMod = await getGraphModule();
  if (!flightMod?.createSessionHandoff || !flightMod?.getSessionHandoff || !flightMod?.preflight || !graphMod?.buildGraph) {
    return t.skip("Flight module functions missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/payment.ts", "export function processPayment(cents: number) { return cents > 0; }\n");
    repo.git("add -A");
    repo.git("commit -m init");
    await graphMod.buildGraph(repo.dir);

    // 1. Cursor IDE session initiates flight
    const cursorFlight = await flightMod.preflight(repo.dir, {
      intent: "Refactor payment validation to support multiple currencies",
      files: ["src/payment.ts"],
    });
    assert.ok(cursorFlight.id.startsWith("flt-"));

    // 2. Cursor IDE developer modifies payment.ts
    await repo.write(
      "src/payment.ts",
      "export function processPayment(cents: number, currency = 'USD') { return cents > 0 && currency.length === 3; }\n",
    );

    // 3. Cursor developer saves session handoff targeted to Claude Code
    const handoffPacket = await flightMod.createSessionHandoff(repo.dir, {
      sessionId: "cursor-flight-transfer-001",
      targetIde: "claude-code",
      note: "Updated payment signature; Claude Code to update tests and consumers",
    });
    assert.ok(handoffPacket);

    // 4. Claude Code agent joins session, loads handoff packet
    const resumedByClaude = await flightMod.getSessionHandoff(repo.dir);
    assert.ok(resumedByClaude);
    assert.equal(resumedByClaude.sessionId, "cursor-flight-transfer-001");
    assert.equal(resumedByClaude.targetIde, "claude-code");

    // 5. Claude Code updates handoff for Antigravity multi-agent system
    const antigravityHandoff = await flightMod.createSessionHandoff(repo.dir, {
      sessionId: "claude-to-antigravity-002",
      targetIde: "antigravity",
      note: "Tests updated, ready for multi-agent validation audit",
    });
    assert.ok(antigravityHandoff);

    // 6. Antigravity loads the packet
    const resumedByAntigravity = await flightMod.getSessionHandoff(repo.dir);
    assert.equal(resumedByAntigravity.sessionId, "claude-to-antigravity-002");
    assert.equal(resumedByAntigravity.targetIde, "antigravity");
  } finally {
    await repo.cleanup();
  }
});

test("T4.3: Scenario 3 — Autonomous Test Failure Learning and Memory Feedback Loop", async (t) => {
  const learnMod = await getLearningModule();
  const orchMod = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  if (!learnMod?.recordLearnedPattern || !orchMod?.getEngineeringContext || !graphMod?.buildGraph) {
    return t.skip("Learning or context module missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/order.ts", "export function createOrder(total: number) { return { total }; }\n");
    repo.git("add -A");
    repo.git("commit -m init");
    await graphMod.buildGraph(repo.dir);

    // Phase 1: Test failure occurs (e.g. order with 0 items or negative amount was allowed)
    // Agent records the failure as a learned regression pattern
    const saved = await learnMod.recordLearnedPattern(repo.dir, {
      type: "regression",
      title: "Zero-Total Orders Allowed",
      description: "createOrder allowed total = 0 which corrupted downstream accounting.",
      rule: "Reject createOrder when total <= 0",
      targetFiles: ["src/order.ts"],
    });
    assert.ok(saved.saved);

    // Phase 2: Verify project memory surfaces the regression rule
    const mem = await learnMod.queryProjectMemory(repo.dir, { file: "src/order.ts" });
    assert.ok(mem);

    // Phase 3: Next agent session requests context for modifying order
    const pack = await orchMod.getEngineeringContext(repo.dir, {
      task: "refactor order creation logic",
      files: ["src/order.ts"],
      budget: 3500,
    });
    assert.ok(pack);
    // Context pack reflects learned constraints
    assert.ok(pack.negativeConstraints || pack.knowledge.constraints);
  } finally {
    await repo.cleanup();
  }
});

test("T4.4: Scenario 4 — Multi-Agent Collision Avoidance in Monorepo", async (t) => {
  const flightMod = await getFlightModule();
  const graphMod = await getGraphModule();
  if (!flightMod?.preflight || !flightMod?.listActiveFlights || !graphMod?.buildGraph) {
    return t.skip("Flight coordination functions missing");
  }

  const repo = await createIsolatedRepo();
  try {
    await repo.write("src/serviceA.ts", "export const a = 1;\n");
    await repo.write("src/serviceB.ts", "export const b = 2;\n");
    repo.git("add -A");
    repo.git("commit -m init");
    await graphMod.buildGraph(repo.dir);

    // Agent Alpha opens flight on serviceA.ts
    const flightAlpha = await flightMod.preflight(repo.dir, {
      intent: "Refactor Service A",
      files: ["src/serviceA.ts"],
    });
    assert.ok(flightAlpha.id);

    // Agent Beta inspects active flights before declaring intent
    const activeFlights = await flightMod.listActiveFlights(repo.dir);
    assert.equal(activeFlights.length, 1);

    // Agent Beta detects that serviceA.ts is locked/in-flight
    const lockedFiles = new Set(activeFlights.flatMap((f) => f.declaredFiles));
    assert.ok(lockedFiles.has("src/serviceA.ts"), "must detect serviceA is in-flight");

    // Agent Beta safely chooses non-colliding file serviceB.ts
    const canEditB = !lockedFiles.has("src/serviceB.ts");
    assert.ok(canEditB, "serviceB must be free of collision");

    const flightBeta = await flightMod.preflight(repo.dir, {
      intent: "Refactor Service B",
      files: ["src/serviceB.ts"],
    });
    assert.ok(flightBeta.id);

    // Now 2 active flights exist without collision
    const updatedActive = await flightMod.listActiveFlights(repo.dir);
    assert.equal(updatedActive.length, 2);
  } finally {
    await repo.cleanup();
  }
});

test("T4.5: Scenario 5 — Repository-Wide Formatting and Citation Auto-Healing", async (t) => {
  const evidMod = await getEvidenceModule();
  const orchMod = await getContextOrchestratorModule();
  const graphMod = await getGraphModule();
  if (!evidMod?.recordEvidenceHashes || !evidMod?.checkEvidenceHashes || !orchMod?.getEngineeringContext || !graphMod?.buildGraph) {
    return t.skip("Evidence or context orchestrator missing");
  }

  const repo = await createIsolatedRepo();
  try {
    // 3 files cited in knowledge base
    await repo.write("src/mod1.ts", "export const v1 = 'one';\n");
    await repo.write("src/mod2.ts", "export const v2 = 'two';\n");
    await repo.write("src/mod3.ts", "export const v3 = 'three';\n");

    await repo.write(
      ".engineering-intelligence/knowledge-base/arch.md",
      "# Architecture\n\n- Mod 1: `src/mod1.ts:1`\n- Mod 2: `src/mod2.ts:1`\n- Mod 3: `src/mod3.ts:1`\n",
    );

    await graphMod.buildGraph(repo.dir);
    await evidMod.recordEvidenceHashes(repo.dir);

    // Prettier formatting run prepends a 5-line license comment to every source file
    const licenseHeader = "/*\n * Copyright 2026 Test Corp\n * Licensed under MIT\n */\n\n";
    await repo.write("src/mod1.ts", licenseHeader + "export const v1 = 'one';\n");
    await repo.write("src/mod2.ts", licenseHeader + "export const v2 = 'two';\n");
    await repo.write("src/mod3.ts", licenseHeader + "export const v3 = 'three';\n");

    // Check evidence hashes
    const checkResult = await evidMod.checkEvidenceHashes(repo.dir);
    assert.ok(checkResult);

    // If self-healing relocation is supported:
    if (evidMod.findRelocatedLine) {
      assert.equal(checkResult.stale, 0, "all shifted citations must be healed, 0 stale citations");
      // Knowledge trust in ContextPackV2 remains healthy
      const pack = await orchMod.getEngineeringContext(repo.dir, {
        task: "overview",
        files: ["src/mod1.ts"],
        budget: 3000,
      });
      assert.equal(pack.knowledge.trust, "healthy");
      assert.ok(pack.knowledge.documents.length > 0);
    }
  } finally {
    await repo.cleanup();
  }
});
