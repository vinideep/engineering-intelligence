import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { recordLearnedPattern, logUncertaintyEvent, queryProjectMemory } from "../dist/learning/index.js";
import { createConsolidatedRegistry } from "../dist/mcp/consolidated.js";

function setupLearningRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-learning-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });
  return dir;
}

test("recordLearnedPattern saves conventions, constraints, and regressions", async () => {
  const dir = setupLearningRepo();
  try {
    const r1 = await recordLearnedPattern(dir, {
      type: "convention",
      title: "File Naming",
      rule: "Use kebab-case for all TypeScript source files.",
      description: "Keeps imports consistent across Linux and macOS.",
      targetFiles: ["src/index.ts"],
    });
    assert.equal(r1.saved, true);
    assert.ok(existsSync(path.join(dir, ".engineering-intelligence", "memory", "coding-patterns.md")));

    const r2 = await recordLearnedPattern(dir, {
      type: "regression",
      title: "Memory Leak",
      rule: "Always unsubscribe event listeners in useEffect cleanup.",
      description: "Prevent zombie listeners on re-render.",
    });
    assert.equal(r2.saved, true);
    assert.ok(existsSync(path.join(dir, ".engineering-intelligence", "memory", "regression-patterns.md")));

    const r3 = await recordLearnedPattern(dir, {
      type: "constraint",
      title: "Database Safety",
      rule: "Never run DROP TABLE in production migrations.",
      description: "Requires backward-compatible soft-deprecations.",
    });
    assert.equal(r3.saved, true);
    assert.ok(existsSync(path.join(dir, ".engineering-intelligence", "memory", "project-constraints.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("logUncertaintyEvent creates structured event records", async () => {
  const dir = setupLearningRepo();
  try {
    const res = await logUncertaintyEvent(dir, {
      trigger: "API Contract Ambiguity",
      area: "payment-gateway",
      description: "Response format for 3DS verification is not specified.",
      severity: "high",
      observedReality: "Gateway returns 302 instead of 200 with challenge URL",
      resolution: "Handle 302 redirect explicitly in client",
    });

    assert.equal(res.logged, true);
    assert.ok(res.id.startsWith("unc-"));
    assert.ok(existsSync(path.join(dir, ".engineering-intelligence", "events", "uncertainty-log.jsonl")));
    assert.ok(existsSync(path.join(dir, ".engineering-intelligence", "events", "uncertainty-log.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("queryProjectMemory filters memory items by topic and file", async () => {
  const dir = setupLearningRepo();
  try {
    await recordLearnedPattern(dir, {
      type: "convention",
      title: "Naming Auth Tokens",
      rule: "Prefix all JWT secret variables with AUTH_JWT_",
      description: "Clarity in environment variables",
    });

    await recordLearnedPattern(dir, {
      type: "regression",
      title: "Token Expiry Drift",
      rule: "Do not compare raw timestamps without clock skew leeway",
      description: "Causes spurious 401 on distributed servers",
    });

    const queryRes = await queryProjectMemory(dir, { topic: "auth" });
    assert.ok(queryRes.conventions.length > 0);
    assert.ok(queryRes.conventions.some((c) => c.includes("AUTH_JWT_")));

    const queryRegression = await queryProjectMemory(dir, { topic: "drift" });
    assert.ok(queryRegression.regressions.some((r) => r.includes("Token Expiry Drift")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("MCP tools record_learned_pattern and query_project_memory execute via consolidated registry", async () => {
  const dir = setupLearningRepo();
  try {
    const registry = await createConsolidatedRegistry(dir);

    const recordRes = await registry.execute("record_learned_pattern", {
      root: dir,
      type: "convention",
      title: "Pure Functions",
      rule: "Avoid side effects in calculations",
      description: "Makes testing deterministic",
    });
    assert.equal(recordRes.saved, true);

    const queryRes = await registry.execute("query_project_memory", {
      root: dir,
      topic: "functions",
    });
    assert.ok(queryRes);
    assert.ok(Array.isArray(queryRes.conventions));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
