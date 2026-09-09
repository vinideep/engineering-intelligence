import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  extractNumericMetric,
  compareMetric,
  generateExperimentCandidates,
  startExperiment,
  evaluateExperimentStep,
  loadExperiments,
  renderExperimentHistory,
} from "../dist/experiment/index.js";
import { buildGraph } from "../dist/graph/index.js";

function initRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-experiment-"));
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
    "import { compute } from './compute.js';\nexport function run() {\n  return compute() * 2;\n}\n",
  );
  writeFileSync(
    path.join(dir, "src", "api.js"),
    "import { run } from './service.js';\nexport function handler() {\n  return run();\n}\n",
  );
  git("add -A");
  git("commit -q -m 'initial repo setup'");
  return { dir, git };
}

test("extractNumericMetric correctly extracts values from regex and stdout formats", () => {
  assert.equal(extractNumericMetric("p95 latency: 142.5ms", "latency:\\s*([0-9.]+)"), 142.5);
  assert.equal(extractNumericMetric("Completed in 85 ms"), 85);
  assert.equal(extractNumericMetric("Total score: 98.6"), 98.6);
  assert.equal(extractNumericMetric("memory_mb: 256"), 256);
});

test("compareMetric computes improvement and delta percentages across goals", () => {
  // Minimize goal (e.g. latency)
  const minImproved = compareMetric(200, 150, { name: "latency", command: "echo 1", goal: "minimize" });
  assert.equal(minImproved.improved, true);
  assert.equal(minImproved.deltaPercent, -25);

  const minRegressed = compareMetric(200, 250, { name: "latency", command: "echo 1", goal: "minimize" });
  assert.equal(minRegressed.improved, false);
  assert.equal(minRegressed.deltaPercent, 25);

  // Maximize goal (e.g. throughput)
  const maxImproved = compareMetric(1000, 1200, { name: "rps", command: "echo 1", goal: "maximize" });
  assert.equal(maxImproved.improved, true);
  assert.equal(maxImproved.deltaPercent, 20);

  // Target goal
  const targetImproved = compareMetric(80, 95, { name: "coverage", command: "echo 1", goal: "target", targetValue: 100 });
  assert.equal(targetImproved.improved, true);
});

test("generateExperimentCandidates ranks graph bottlenecks and fan-in nodes", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir, { write: true });
    const candidates = await generateExperimentCandidates(dir, { topN: 5 });

    assert.ok(candidates.length > 0, "should produce candidate opportunities");
    const top = candidates[0];
    assert.ok(top.score > 0);
    assert.ok(top.targetFile);
    assert.ok(top.rationale);
    assert.ok(top.suggestedHypothesis);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evaluateExperimentStep keeps improvements and records KEEP in ledger", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir, { write: true });

    // Establish flight
    const flight = await startExperiment(dir, {
      goal: "reduce compute value",
      hypothesis: "optimize compute() logic",
      targetFile: "src/compute.js",
    });

    // Make the change in declared file
    writeFileSync(
      path.join(dir, "src", "compute.js"),
      "export function compute() {\n  return 50;\n}\n",
    );

    // Evaluate step with a mock metric command that returns 50
    const result = await evaluateExperimentStep(dir, {
      flightId: flight.id,
      goal: "reduce compute value",
      hypothesis: "optimize compute() logic",
      targetFile: "src/compute.js",
      baselineValue: 100,
      metricConfig: {
        name: "compute_val",
        command: "node -e console.log(50)",
        goal: "minimize",
      },
      skipGates: true,
      autoRollback: true,
    });

    assert.equal(result.verdict, "KEEP");
    assert.equal(result.measuredValue, 50);
    assert.equal(result.deltaPercent, -50);

    // Verify ledger contains the record
    const records = await loadExperiments(dir);
    assert.equal(records.length, 1);
    assert.equal(records[0].verdict, "KEEP");

    const historyRender = renderExperimentHistory(records);
    assert.ok(historyRender.includes("KEEP"));
    assert.ok(historyRender.includes("src/compute.js"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evaluateExperimentStep safely rolls back on regression (REVERT)", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir, { write: true });

    const originalContent = readFileSync(path.join(dir, "src", "compute.js"), "utf8");

    const flight = await startExperiment(dir, {
      goal: "reduce compute value",
      hypothesis: "bad change that increases compute",
      targetFile: "src/compute.js",
    });

    // Make the change that regresses metric
    writeFileSync(
      path.join(dir, "src", "compute.js"),
      "export function compute() {\n  return 200;\n}\n",
    );

    // Evaluate step with a mock metric returning 200 (> baseline of 100)
    const result = await evaluateExperimentStep(dir, {
      flightId: flight.id,
      goal: "reduce compute value",
      hypothesis: "bad change that increases compute",
      targetFile: "src/compute.js",
      baselineValue: 100,
      metricConfig: {
        name: "compute_val",
        command: "node -e console.log(200)",
        goal: "minimize",
      },
      skipGates: true,
      autoRollback: true,
    });

    assert.equal(result.verdict, "REVERT");
    assert.equal(result.revertReason, "metric_regressed");

    // Check that autoRollback restored the file to its original content
    const restoredContent = readFileSync(path.join(dir, "src", "compute.js"), "utf8");
    assert.equal(restoredContent, originalContent, "file should be restored on regression");

    // Verify ledger records the rejection
    const records = await loadExperiments(dir);
    assert.equal(records.length, 1);
    assert.equal(records[0].verdict, "REVERT");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evaluateExperimentStep reverts when out-of-bounds changes occur", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir, { write: true });

    const flight = await startExperiment(dir, {
      goal: "tweak compute",
      hypothesis: "declared compute.js only",
      targetFile: "src/compute.js",
    });

    // Make an undeclared change in an unrelated file outside predicted blast radius
    mkdirSync(path.join(dir, "other"));
    writeFileSync(path.join(dir, "other", "rogue.js"), "console.log('out of bounds');\n");

    const result = await evaluateExperimentStep(dir, {
      flightId: flight.id,
      goal: "tweak compute",
      hypothesis: "declared compute.js only",
      targetFile: "src/compute.js",
      baselineValue: 100,
      metricConfig: {
        name: "compute_val",
        command: "node -e console.log(40)",
        goal: "minimize",
      },
      skipGates: true,
      autoRollback: true,
    });

    assert.equal(result.verdict, "REVERT");
    assert.equal(result.revertReason, "out_of_bounds");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
