import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getEngineeringContext } from "../dist/context/orchestrator.js";
import { runHealth } from "../dist/orchestrators/health.js";
import { searchCodeContext } from "../dist/providers/cce.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const quick = process.argv.includes("--quick");
const fixtureRoot = path.join(repoRoot, "benchmark", "complex-backend");
const generatedRoots = new Set([".agent", ".agents", ".claude", ".cursor", ".codex", ".gemini", ".commandcode", ".engineering-intelligence"]);
const generatedFiles = new Set(["AGENTS.md", "CLAUDE.md", ".mcp.json"]);

function copyFixtureSource(source) {
  const relative = path.relative(fixtureRoot, source).replace(/\\/g, "/");
  if (!relative) return true;
  const first = relative.split("/")[0];
  return !generatedRoots.has(first) && !generatedFiles.has(relative);
}

function copyRepositorySource(source) {
  const relative = path.relative(repoRoot, source).replace(/\\/g, "/");
  if (!relative) return true;
  const first = relative.split("/")[0];
  return !generatedRoots.has(first) && ![".git", "dist", "node_modules", "benchmark"].includes(first);
}

function runCli(args) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "dist", "cli", "index.js"), ...args], {
    cwd: repoRoot,
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30 * 60_000,
  });
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().slice(-4000);
    throw new Error(`CLI failed (${result.status}): ${args.join(" ")}\n${detail}`);
  }
  return JSON.parse(result.stdout);
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "ei-provider-smoke-"));
const projectRoot = path.join(temporaryRoot, "complex-backend");
const accuracyRoot = path.join(temporaryRoot, "accuracy-project");

try {
  await cp(fixtureRoot, projectRoot, { recursive: true, filter: copyFixtureSource });
  const initialized = runCli([
    "initialize", projectRoot,
    "--ide", "generic",
    "--providers", "full",
    "--require-providers",
    "--yes",
    "--json",
  ]);

  assert.equal(initialized.ok, true, "required provider initialization must succeed");
  assert.equal(initialized.degraded, false, "provider initialization must not be degraded");
  assert.equal(initialized.graphify.ok, true, "Graphify extraction must succeed");
  assert.equal(initialized.cce.ok, true, "CCE indexing must succeed");
  assert.equal(initialized.evidence.knowledge.status, "ready", "EI-owned knowledge must pass publication trust");
  assert.ok(initialized.evidence.claims.total > 0, "non-empty source must derive claims");

  const context = await getEngineeringContext(projectRoot, {
    task: "refund order payment inventory",
    budget: 6000,
  });
  const chunks = [...context.code.primary, ...context.code.secondary, ...context.code.tests];
  assert.equal(context.providers.graphify.fallback, false, "Graphify evidence must be available");
  assert.equal(context.providers.cce.fallback, false, "CCE retrieval must not fall back");
  assert.ok(chunks.length > 0, "ContextPackV2 must contain code evidence");
  assert.ok(chunks.every((chunk) => chunk.provider === "cce" && chunk.current === true), "all provider smoke spans must be current CCE evidence");
  assert.ok(context.evidence.every((item) => !/(^|\/)(?:dist|benchmark|node_modules|\.engineering-intelligence|\.agent|\.agents|\.claude|\.cursor)(?:\/|$)/.test(item.path)), "context must not leak disallowed paths");
  assert.ok(context.tokenAllocation.used <= context.tokenAllocation.budget, "context must obey its token budget");

  const health = await runHealth(projectRoot);
  assert.equal(health.ok, true, health.text);

  // Exercise the same versioned 30-query corpus through real CCE, not merely
  // through native fallback. The repository copy is disposable and excludes
  // all generated/project-local provider state.
  let accuracy;
  if (!quick) {
    await cp(repoRoot, accuracyRoot, { recursive: true, filter: copyRepositorySource });
    const accuracyInitialization = runCli([
      "initialize", accuracyRoot,
      "--ide", "generic",
      "--providers", "full",
      "--require-providers",
      "--yes",
      "--json",
    ]);
    assert.equal(accuracyInitialization.ok, true, "accuracy project provider initialization must succeed");
    const corpus = JSON.parse(await readFile(path.join(repoRoot, "bench", "context-golden.json"), "utf8"));
    let expected = 0;
    let recalled = 0;
    let spans = 0;
    for (const item of corpus.queries) {
      const result = await searchCodeContext(accuracyRoot, item.query, item.scope, { topK: 10 });
      assert.equal(result.provider, "cce", `CCE must serve corpus query: ${item.query}`);
      assert.equal(result.fallbackUsed, false, `CCE fallback is not allowed for corpus query: ${item.query}`);
      const paths = new Set(result.chunks.map((chunk) => chunk.path));
      for (const expectedPath of item.expected) {
        expected += 1;
        if (paths.has(expectedPath)) recalled += 1;
      }
      assert.ok(result.chunks.every((chunk) => chunk.current && item.scope.some((scope) => chunk.path === scope || chunk.path.startsWith(`${scope}/`))), `invalid scope/span for query: ${item.query}`);
      spans += result.chunks.length;
    }
    const recallAt10 = expected === 0 ? 0 : recalled / expected;
    assert.ok(recallAt10 >= corpus.thresholds.recallAt10, `provider Recall@10 ${recallAt10.toFixed(3)} must be >= ${corpus.thresholds.recallAt10}`);
    assert.ok(spans > 0, "provider corpus must return source spans");
    accuracy = { queries: corpus.queries.length, recallAt10, currentScopedSpans: spans };
  }

  console.log(JSON.stringify({
    ok: true,
    disposableWorkspace: true,
    providers: { graphify: initialized.graphify.ok, cce: initialized.cce.ok },
    graph: initialized.evidence.graph,
    claims: initialized.evidence.claims,
    context: {
      chunks: chunks.length,
      cceFallback: context.providers.cce.fallback,
      confidence: context.overallConfidence,
      usedTokens: context.tokenAllocation.used,
      budget: context.tokenAllocation.budget,
    },
    ...(accuracy ? { accuracy } : {}),
    strictHealth: health.ok,
  }, null, 2));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
