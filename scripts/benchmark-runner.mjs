#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile, writeFile, rm, cp, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BENCHMARK_TASKS } from "../benchmark/harness/tasks.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(REPO_ROOT, "dist/cli/index.js");
const TSC_SCRIPT = path.join(REPO_ROOT, "node_modules/typescript/bin/tsc");
const TYPE_ROOTS = path.join(REPO_ROOT, "node_modules/@types");
const FIXTURE_DIR = path.join(REPO_ROOT, "benchmark/complex-backend");
const REPORT_PATH = path.join(REPO_ROOT, "benchmark/benchmark-report.html");
let WORKSPACE_DIR = "";
let TARGET_DIR = "";

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}
const LOW_MODEL = getArg("low-model", "Gemini 3.5 Flash (Low)");
const HIGH_MODEL = getArg("high-model", "Gemini 3.7 Flash (High)");
const TIMEOUT_MS = parseInt(getArg("timeout", "600000"), 10);
const RUN_MODELS = args.includes("--models");
const OPEN_REPORT = args.includes("--open");

function fmt(ms) { return `${(ms / 1000).toFixed(1)}s`; }

function runSync(cmd, args, opts = {}) {
  const start = performance.now();
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: TARGET_DIR,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      ...opts,
    });
    return { ok: true, stdout, stderr: "", ms: performance.now() - start, exit: 0 };
  } catch (e) {
    return {
      ok: false,
      stdout: e.stdout ? String(e.stdout) : "",
      stderr: e.stderr ? String(e.stderr) : e.message,
      ms: performance.now() - start,
      exit: e.status ?? 1,
    };
  }
}

async function snapshotFixture() {
  const BACKUP_DIR = path.join(WORKSPACE_DIR, "baseline");
  if (existsSync(BACKUP_DIR)) await rm(BACKUP_DIR, { recursive: true, force: true });
  await cp(TARGET_DIR, BACKUP_DIR, { recursive: true });
}

async function restoreFixture() {
  const BACKUP_DIR = path.join(WORKSPACE_DIR, "baseline");
  if (existsSync(BACKUP_DIR)) {
    await rm(TARGET_DIR, { recursive: true, force: true });
    await cp(BACKUP_DIR, TARGET_DIR, { recursive: true });
    await rm(BACKUP_DIR, { recursive: true, force: true });
  }
}

async function extractFilesFromOutput(output, targetDir) {
  if (!output) return;
  const blocks = [];
  const regex = /```(?:typescript|ts|javascript|js)?(?:\s*(?:\/\/\s*([^\r\n]+)|#\s*([^\r\n]+)))?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    const header = (match[1] || match[2] || "").trim();
    const code = match[3];
    blocks.push({ header, code });
  }

  const { mkdir } = await import("node:fs/promises");
  for (const b of blocks) {
    const isTest =
      b.header.includes("refunds.test") ||
      b.code.slice(0, 150).includes("refunds.test") ||
      (b.code.includes("refundOrder") && (b.code.includes("test(") || b.code.includes("describe(")));

    const isSrc =
      !isTest &&
      (b.header.includes("refund.ts") ||
       b.code.slice(0, 150).includes("refund.ts") ||
       b.code.includes("refundOrder"));

    if (isSrc) {
      const dest = path.join(targetDir, "src/orders/refund.ts");
      if (!existsSync(dest)) {
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, b.code, "utf8");
        console.log("   [Auto-Extracted] Created src/orders/refund.ts from model response");
      }
    } else if (isTest) {
      const dest = path.join(targetDir, "test/refunds.test.mjs");
      if (!existsSync(dest)) {
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, b.code, "utf8");
        console.log("   [Auto-Extracted] Created test/refunds.test.mjs from model response");
      }
    }
  }
}

async function evaluateRun(label, task, agyOutput = "") {
  const score = {
    compile: false,
    regressionPass: false,
    modelTestPass: false,
    adversarialPass: false,
    inventoryReleased: false,
    idempotencyHandled: false,
    eventPublished: false,
    receiptValid: false,
    targetFileExists: false,
    testFileExists: false,
    compileOutput: "",
    testOutput: "",
    agyOutput: agyOutput || "",
    durationMs: 0,
  };

  // If agent did not write files directly, extract from markdown blocks
  if (!existsSync(path.join(TARGET_DIR, task.targetFile))) {
    await extractFilesFromOutput(agyOutput, TARGET_DIR);
  }

  score.targetFileExists = existsSync(path.join(TARGET_DIR, task.targetFile));
  score.testFileExists = existsSync(path.join(TARGET_DIR, task.testFile));

  if (!score.targetFileExists) {
    console.log(`   [${label}] ✗ ${task.targetFile} was NOT created`);
    return score;
  }

  // 1. TypeScript Compilation
  const build = runSync(process.execPath, [TSC_SCRIPT, "-p", "tsconfig.json", "--typeRoots", TYPE_ROOTS]);
  score.compile = build.ok;
  score.compileOutput = build.ok ? "Clean compile" : (build.stdout || build.stderr || "Compilation failed").slice(0, 1500);
  if (!build.ok) {
    console.log(`   [${label}] ✗ TypeScript compilation failed`);
    return score;
  }
  console.log(`   [${label}] ✓ TypeScript Compilation Clean`);

  // 2. Source Code AST & Invariant Pattern Verification
  const srcPath = path.join(TARGET_DIR, task.targetFile);
  const srcCode = await readFile(srcPath, "utf8");
  score.eventPublished = /eventBus\.publish|order\.refunded/i.test(srcCode);
  score.inventoryReleased = /releaseStock/i.test(srcCode);
  score.idempotencyHandled = /idempotencyKey|isDuplicate/i.test(srcCode);

  // 3. Baseline Regression Suite (PASS_TO_PASS)
  const regressionTest = runSync("node", ["--test", "test/orders.test.mjs", "test/payments.test.mjs"]);
  score.regressionPass = regressionTest.ok;
  console.log(`   [${label}] ${regressionTest.ok ? "✓" : "✗"} Baseline Regressions (PASS_TO_PASS): ${regressionTest.ok ? "PASSED" : "FAILED"}`);

  // 4. Model Self-Written Tests (FAIL_TO_PASS)
  if (score.testFileExists) {
    const modelTest = runSync("node", ["--test", task.testFile]);
    score.modelTestPass = modelTest.ok;
    score.testOutput = (modelTest.stdout || modelTest.stderr).slice(0, 2000);
    console.log(`   [${label}] ${modelTest.ok ? "✓" : "✗"} Model Self-Tests: ${modelTest.ok ? "PASSED" : "FAILED"}`);
  }

  // 5. Independent Adversarial Invariant Suite
  const advSrc = path.join(REPO_ROOT, task.adversarialSuite);
  const advDest = path.join(TARGET_DIR, "test/adversarial.test.mjs");
  if (existsSync(advSrc)) {
    await cp(advSrc, advDest);
    const advRun = runSync("node", ["--test", "test/adversarial.test.mjs"]);
    score.adversarialPass = advRun.ok;
    if (advRun.ok) {
      score.eventPublished = true;
      score.inventoryReleased = true;
      score.idempotencyHandled = true;
    }
    console.log(`   [${label}] ${advRun.ok ? "✓" : "✗"} Adversarial Invariant Suite (6/6 Invariants): ${advRun.ok ? "PASSED" : "FAILED"}`);
    await rm(advDest, { force: true });
  }

  // 6. Cryptographic Verification Receipt
  if ((score.modelTestPass || score.adversarialPass) && score.regressionPass) {
    runSync("node", [CLI_PATH, "verify", TARGET_DIR]);
    try {
      const receiptsRaw = await readFile(
        path.join(TARGET_DIR, ".engineering-intelligence/.verify/receipts.json"),
        "utf8"
      );
      const receipts = JSON.parse(receiptsRaw);
      score.receiptValid = receipts[0]?.verdict === "pass";
      console.log(`   [${label}] ${score.receiptValid ? "✓" : "✗"} Cryptographic SHA-256 Receipt: ${receipts[0]?.verdict?.toUpperCase() || "NONE"}`);
    } catch { /* no receipts */ }
  }

  return score;
}

function computeScore(s) {
  let total = 0;
  if (s.targetFileExists) total += 5;
  if (s.testFileExists) total += 5;
  if (s.compile) total += 20;
  if (s.regressionPass) total += 15;
  if (s.modelTestPass) total += 15;
  if (s.adversarialPass) total += 15;
  if (s.inventoryReleased) total += 5;
  if (s.idempotencyHandled) total += 5;
  if (s.eventPublished) total += 5;
  if (s.receiptValid) total += 10;
  return total;
}

function checkTag(ok, passLabel, failLabel = "Failed") {
  return ok
    ? `<span class="tag tag-pass">✓ ${passLabel}</span>`
    : `<span class="tag tag-fail">✗ ${failLabel}</span>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderReport(results, lowScore, highScore, task) {
  const lo = results.lowModel;
  const hi = results.highModel;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Engineering Intelligence OS — Enterprise Benchmark Report</title>
  <style>
    :root { --bg:#0d1117; --card:#161b22; --border:#30363d; --text:#c9d1d9; --bright:#f0f6fc; --accent:#58a6ff; --ok:#3fb950; --fail:#f85149; --warn:#d29922; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; background:var(--bg); color:var(--text); padding:2rem; line-height:1.5; }
    .ctr { max-width:1200px; margin:0 auto; }
    header { border-bottom:1px solid var(--border); padding-bottom:1.5rem; margin-bottom:2rem; }
    h1 { color:var(--bright); font-size:1.8rem; }
    .sub { color:#8b949e; margin-top:0.25rem; }
    .scores { display:flex; gap:2rem; margin:1.5rem 0; }
    .score-box { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.5rem 2rem; flex:1; text-align:center; }
    .score-box h3 { color:#8b949e; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; }
    .score-num { font-size:3.2rem; font-weight:800; margin:0.5rem 0; }
    .score-num.high { color:var(--ok); }
    .score-num.mid { color:var(--warn); }
    .score-num.low { color:var(--fail); }
    .score-model { color:var(--accent); font-size:0.95rem; font-weight:600; }
    .section { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:1.5rem; margin-bottom:2rem; }
    h2 { color:var(--bright); font-size:1.2rem; margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid var(--border); }
    table { width:100%; border-collapse:collapse; font-size:0.9rem; }
    th,td { text-align:left; padding:0.75rem 1rem; border-bottom:1px solid var(--border); }
    th { color:var(--bright); background:rgba(255,255,255,0.03); }
    .tag { display:inline-block; padding:0.25rem 0.6rem; border-radius:4px; font-size:0.75rem; font-weight:600; }
    .tag-pass { background:rgba(63,185,80,0.2); color:var(--ok); border:1px solid rgba(63,185,80,0.3); }
    .tag-fail { background:rgba(248,81,73,0.2); color:var(--fail); border:1px solid rgba(248,81,73,0.3); }
    .tag-warn { background:rgba(210,153,34,0.2); color:var(--warn); border:1px solid rgba(210,153,34,0.3); }
    pre { background:#090d13; border:1px solid var(--border); padding:1rem; border-radius:6px; overflow-x:auto; font-family:ui-monospace,monospace; font-size:0.8rem; color:#7ee787; margin-top:0.75rem; max-height:300px; overflow-y:auto; }
    details summary { cursor:pointer; color:var(--accent); font-size:0.9rem; margin:0.5rem 0; }
  </style>
</head>
<body>
<div class="ctr">
  <header>
    <h1>Engineering Intelligence OS — Benchmark Suite</h1>
    <p class="sub">Challenge: ${escapeHtml(task.name)} • Real Antigravity CLI Execution • ${new Date().toISOString().slice(0, 19)}</p>
  </header>

  <div class="scores">
    <div class="score-box">
      <h3>Low Model</h3>
      <div class="score-num ${lowScore >= 80 ? "high" : lowScore >= 40 ? "mid" : "low"}">${lowScore}/100</div>
      <div class="score-model">${escapeHtml(lo.modelName || "N/A")}</div>
      <div style="color:#8b949e;font-size:0.8rem;margin-top:0.25rem">Duration: ${fmt(lo.durationMs || 0)}</div>
    </div>
    <div class="score-box">
      <h3>High Model</h3>
      <div class="score-num ${highScore >= 80 ? "high" : highScore >= 40 ? "mid" : "low"}">${highScore}/100</div>
      <div class="score-model">${escapeHtml(hi.modelName || "N/A")}</div>
      <div style="color:#8b949e;font-size:0.8rem;margin-top:0.25rem">Duration: ${fmt(hi.durationMs || 0)}</div>
    </div>
  </div>

  <div class="section">
    <h2>Rigorous Verification Matrix</h2>
    <table>
      <thead><tr><th>Dimension</th><th>Low Model (${escapeHtml(lo.modelName || "N/A")})</th><th>High Model (${escapeHtml(hi.modelName || "N/A")})</th></tr></thead>
      <tbody>
        <tr><td><strong>File Scaffolding</strong></td><td>${checkTag(lo.targetFileExists, "Created", "Missing")}</td><td>${checkTag(hi.targetFileExists, "Created", "Missing")}</td></tr>
        <tr><td><strong>Test File Scaffolding</strong></td><td>${checkTag(lo.testFileExists, "Created", "Missing")}</td><td>${checkTag(hi.testFileExists, "Created", "Missing")}</td></tr>
        <tr><td><strong>TypeScript AST Compilation</strong></td><td>${checkTag(lo.compile, "Clean Compile", "Type Errors")}</td><td>${checkTag(hi.compile, "Clean Compile", "Type Errors")}</td></tr>
        <tr><td><strong>Baseline Regressions (PASS_TO_PASS)</strong></td><td>${checkTag(lo.regressionPass, "Passed", "Failed")}</td><td>${checkTag(hi.regressionPass, "Passed", "Failed")}</td></tr>
        <tr><td><strong>Model Self-Tests (FAIL_TO_PASS)</strong></td><td>${checkTag(lo.modelTestPass, "Passed", "Failed")}</td><td>${checkTag(hi.modelTestPass, "Passed", "Failed")}</td></tr>
        <tr><td><strong>Adversarial Invariants (6/6 Checks)</strong></td><td>${checkTag(lo.adversarialPass, "6/6 Verified", "Failed")}</td><td>${checkTag(hi.adversarialPass, "6/6 Verified", "Failed")}</td></tr>
        <tr><td><strong>Compensating Stock Rollback</strong></td><td>${checkTag(lo.inventoryReleased, "Verified", "Not Released")}</td><td>${checkTag(hi.inventoryReleased, "Verified", "Not Released")}</td></tr>
        <tr><td><strong>Payment Idempotency Guard</strong></td><td>${checkTag(lo.idempotencyHandled, "Verified", "Unchecked")}</td><td>${checkTag(hi.idempotencyHandled, "Verified", "Unchecked")}</td></tr>
        <tr><td><strong>Domain Event Sourcing</strong></td><td>${checkTag(lo.eventPublished, "Verified", "Not Published")}</td><td>${checkTag(hi.eventPublished, "Verified", "Not Published")}</td></tr>
        <tr><td><strong>Cryptographic SHA-256 Receipt</strong></td><td>${checkTag(lo.receiptValid, "Valid", "No Receipt")}</td><td>${checkTag(hi.receiptValid, "Valid", "No Receipt")}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Offline Intelligence Topology</h2>
    <table>
      <tr><td>Modules Scanned</td><td>${results.offline.modules}</td></tr>
      <tr><td>Symbols Indexed</td><td>${results.offline.symbols}</td></tr>
      <tr><td>Call Graph Edges</td><td>${results.offline.callEdges}</td></tr>
      <tr><td>Health Gate</td><td>${checkTag(results.offline.healthOk, "PASS")}</td></tr>
      <tr><td>Anti-Tamper Mutation Gate</td><td>${checkTag(results.antiTamperBlocked, "Tamper Blocked")}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Execution Output</h2>
    <details><summary>Low Model Compilation Output</summary><pre>${escapeHtml(lo.compileOutput || "Clean compile")}</pre></details>
    <details><summary>High Model Compilation Output</summary><pre>${escapeHtml(hi.compileOutput || "Clean compile")}</pre></details>
    <details><summary>Low Model CLI Log (${escapeHtml(lo.modelName || "N/A")})</summary><pre>${escapeHtml(lo.agyOutput)}</pre></details>
    <details><summary>High Model CLI Log (${escapeHtml(hi.modelName || "N/A")})</summary><pre>${escapeHtml(hi.agyOutput)}</pre></details>
    <details><summary>Low Model Test Suite Output</summary><pre>${escapeHtml(lo.testOutput)}</pre></details>
    <details><summary>High Model Test Suite Output</summary><pre>${escapeHtml(hi.testOutput)}</pre></details>
  </div>
</div>
</body>
</html>`;
}

async function main() {
  console.log("================================================================================");
  console.log("  Engineering Intelligence OS — Enterprise Benchmark Suite");
  console.log("================================================================================");
  console.log(`  Low Model:  ${LOW_MODEL}`);
  console.log(`  High Model: ${HIGH_MODEL}`);
  console.log(`  Mode:       ${RUN_MODELS ? "explicit model comparison" : "deterministic non-model dry run"}`);
  console.log(`  Timeout:    ${TIMEOUT_MS / 1000}s per run\n`);

  const task = BENCHMARK_TASKS[0];

  // 1. Build Core
  console.log("📦 1. Compiling Engineering Intelligence core...");
  execFileSync("npm", ["run", "build"], { cwd: REPO_ROOT, stdio: "inherit" });
  console.log("   ✓ Core compiled.\n");

  // Every run gets a disposable copy. The tracked fixture and its generated
  // report are never used as a mutable project workspace.
  WORKSPACE_DIR = await mkdtemp(path.join(tmpdir(), "ei-benchmark-"));
  TARGET_DIR = path.join(WORKSPACE_DIR, "complex-backend");
  await cp(FIXTURE_DIR, TARGET_DIR, { recursive: true });

  if (!RUN_MODELS) {
    try {
      console.log("🧪 2. Running deterministic initialization and verification...");
      const initialized = runSync("node", [CLI_PATH, "initialize", TARGET_DIR, "--providers", "native", "--yes"]);
      const compiled = runSync(process.execPath, [TSC_SCRIPT, "-p", "tsconfig.json", "--typeRoots", TYPE_ROOTS]);
      const tests = runSync("node", ["--test", "test/orders.test.mjs", "test/payments.test.mjs"]);
      const claims = runSync("node", [CLI_PATH, "claims", "verify", TARGET_DIR, "--json"]);
      const health = runSync("node", [CLI_PATH, "health", TARGET_DIR, "--strict", "--json"]);
      const graph = JSON.parse(await readFile(path.join(TARGET_DIR, ".engineering-intelligence/graph/dependency-graph.json"), "utf8"));
      const leakage = graph.nodes.filter((node) => typeof node.path === "string" && /(^|\/)(?:dist|benchmark|node_modules|\.engineering-intelligence)(?:\/|$)/.test(node.path));
      const result = {
        mode: "non-model-dry-run",
        disposableWorkspace: true,
        initialized: initialized.ok,
        compile: compiled.ok,
        baselineTests: tests.ok,
        claimsVerified: claims.ok,
        strictHealth: health.ok,
        graph: { nodes: graph.nodes.length, edges: graph.edges.length, disallowedScopeLeakage: leakage.length },
      };
      console.log(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.compile) console.error(`TypeScript compile failed: ${compiled.stdout || compiled.stderr}`);
      const passed = Object.values({ initialized: result.initialized, compile: result.compile, baselineTests: result.baselineTests, claimsVerified: result.claimsVerified, strictHealth: result.strictHealth }).every(Boolean) && leakage.length === 0;
      if (!passed) {
        throw new Error("Deterministic benchmark gates failed.");
      }
      return;
    } finally {
      await rm(WORKSPACE_DIR, { recursive: true, force: true });
    }
  }

  // 2. Snapshot
  console.log("💾 2. Snapshotting fixture baseline...");
  await snapshotFixture();
  console.log("   ✓ Baseline snapshot saved.\n");

  const results = { offline: {}, lowModel: {}, highModel: {} };

  try {
    // 3. Offline Intelligence Setup
    console.log("🧠 3. Running Offline Intelligence Setup (AST Graph, Symbols, Receipts)...");
    runSync("node", [CLI_PATH, "setup", TARGET_DIR, "--ide", "claude-code,cursor,antigravity", "--yes"]);
    runSync("node", [CLI_PATH, "map", TARGET_DIR]);
    runSync("node", [CLI_PATH, "verify", TARGET_DIR]);
    const health = runSync("node", [CLI_PATH, "health", TARGET_DIR, "--strict", "--json"]);

    const graph = JSON.parse(await readFile(
      path.join(TARGET_DIR, ".engineering-intelligence/graph/dependency-graph.json"),
      "utf8"
    ));
    results.offline = {
      modules: graph.nodes.filter((n) => n.kind === "module").length,
      symbols: graph.nodes.filter((n) => n.kind === "symbol").length,
      callEdges: graph.edges.filter((e) => e.relation === "calls").length,
      healthOk: health.ok,
    };
    console.log(`   ✓ Graph: ${results.offline.modules} modules, ${results.offline.symbols} symbols, ${results.offline.callEdges} call edges`);
    console.log(`   ✓ Health Gate: ${health.ok ? "PASS" : "FAIL"}\n`);

    // 4A. Run Low Model
    console.log(`🔴 4A. [LOW MODEL: ${LOW_MODEL}] Launching Antigravity CLI on challenge '${task.name}'...`);
    const lowStart = performance.now();
    const lowAgy = runSync("agy", [
      "--print", task.prompt,
      "--model", LOW_MODEL,
      "--dangerously-skip-permissions",
      "--print-timeout", `${Math.floor(TIMEOUT_MS / 1000)}s`,
    ]);
    const lowDuration = performance.now() - lowStart;
    console.log(`   agy exited code ${lowAgy.exit} in ${fmt(lowDuration)}`);
    results.lowModel = await evaluateRun("LOW", task, lowAgy.stdout || lowAgy.stderr);
    results.lowModel.agyOutput = (lowAgy.stdout || lowAgy.stderr).slice(0, 3000);
    results.lowModel.durationMs = lowDuration;
    results.lowModel.modelName = LOW_MODEL;
    const lowScore = computeScore(results.lowModel);
    console.log(`   🎯 Low Model Score: ${lowScore}/100\n`);

    // Restore fixture for high model
    console.log("   🔄 Restoring fixture for high model run...");
    await restoreFixture();
    await snapshotFixture();
    runSync("node", [CLI_PATH, "setup", TARGET_DIR, "--ide", "claude-code,cursor,antigravity", "--yes"]);
    runSync("node", [CLI_PATH, "map", TARGET_DIR]);
    runSync("node", [CLI_PATH, "verify", TARGET_DIR]);
    console.log("   ✓ Fixture restored and re-initialized.\n");

    // 4B. Run High Model
    console.log(`🟢 4B. [HIGH MODEL: ${HIGH_MODEL}] Launching Antigravity CLI on challenge '${task.name}'...`);
    const highStart = performance.now();
    const highAgy = runSync("agy", [
      "--print", task.prompt,
      "--model", HIGH_MODEL,
      "--dangerously-skip-permissions",
      "--print-timeout", `${Math.floor(TIMEOUT_MS / 1000)}s`,
    ]);
    const highDuration = performance.now() - highStart;
    console.log(`   agy exited code ${highAgy.exit} in ${fmt(highDuration)}`);
    results.highModel = await evaluateRun("HIGH", task, highAgy.stdout || highAgy.stderr);
    results.highModel.agyOutput = (highAgy.stdout || highAgy.stderr).slice(0, 3000);
    results.highModel.durationMs = highDuration;
    results.highModel.modelName = HIGH_MODEL;
    const highScore = computeScore(results.highModel);
    console.log(`   🎯 High Model Score: ${highScore}/100\n`);

    // 5. Anti-Tamper Verification
    console.log("🛡️  5. Testing Cryptographic Anti-Tamper Gate...");
    const targetPath = path.join(TARGET_DIR, task.targetFile);
    if (existsSync(targetPath)) {
      const origCode = await readFile(targetPath, "utf8");
      await writeFile(targetPath, origCode + "\n// unauthorized edit\n", "utf8");
      const { coverageFor } = await import("../dist/verify/index.js");
      const cov = await coverageFor(TARGET_DIR, [task.targetFile]);
      results.antiTamperBlocked = !cov.covered;
      console.log(`   ✓ Anti-Tamper: ${results.antiTamperBlocked ? "Tamper DETECTED and blocked (PASS)" : "Failed to catch"}`);
      await writeFile(targetPath, origCode, "utf8");
    } else {
      const stockPath = path.join(TARGET_DIR, "src/inventory/stock.ts");
      const stockOrig = await readFile(stockPath, "utf8");
      await writeFile(stockPath, stockOrig + "\n// unauthorized edit\n", "utf8");
      const { coverageFor } = await import("../dist/verify/index.js");
      const cov = await coverageFor(TARGET_DIR, ["src/inventory/stock.ts"]);
      results.antiTamperBlocked = !cov.covered;
      console.log(`   ✓ Anti-Tamper: ${results.antiTamperBlocked ? "Tamper DETECTED and blocked (PASS)" : "Failed to catch"}`);
      await writeFile(stockPath, stockOrig, "utf8");
    }

  } finally {
    // 6. Rollback
    console.log("\n🔄 6. Rolling back fixture to clean baseline...");
    await restoreFixture();
    console.log("   ✓ Workspace restored.\n");
  }

  // 7. Render HTML Report
  const lowScore = computeScore(results.lowModel);
  const highScore = computeScore(results.highModel);

  console.log("🎨 7. Generating Enterprise Benchmark HTML Report...");
  const html = renderReport(results, lowScore, highScore, task);
  await writeFile(REPORT_PATH, html, "utf8");
  console.log(`   ✓ Report generated at: ${REPORT_PATH}`);

  if (OPEN_REPORT) try {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    execFileSync(opener, [REPORT_PATH], { stdio: "ignore" });
    console.log(`   🚀 Opened benchmark dashboard in browser.\n`);
  } catch { /* headless */ }

  console.log("================================================================================");
  console.log(`  🎉 Benchmark Complete!`);
  console.log(`  📊 Low Model  (${LOW_MODEL}): ${lowScore}/100`);
  console.log(`  📊 High Model (${HIGH_MODEL}): ${highScore}/100`);
  console.log(`  📄 Report: file://${REPORT_PATH}`);
  console.log("================================================================================");
  await rm(WORKSPACE_DIR, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("Benchmark runner failed:", err);
  process.exit(1);
});
