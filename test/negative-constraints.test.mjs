import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getEngineeringContext } from "../dist/context/index.js";
import { recordExperiment } from "../dist/experiment/index.js";
import { buildGraph } from "../dist/graph/index.js";

function initRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-neg-context-"));
  const git = (a) => execSync(`git ${a}`, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
  git("init -q");
  git("config user.email test@example.com");
  git("config user.name Test");
  mkdirSync(path.join(dir, "src"));
  writeFileSync(
    path.join(dir, "src", "compute.js"),
    "export function compute() {\n  return 100;\n}\n",
  );
  git("add -A");
  git('commit -q -m "initial repo setup"');
  return { dir, git };
}

test("getEngineeringContext injects negative constraints from past REVERT experiments", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir, { write: true });

    // Record a failed experiment (REVERT) on src/compute.js
    await recordExperiment(dir, {
      schemaVersion: 1,
      id: "exp-failed-algo",
      goal: "optimize compute latency",
      hypothesis: "use recursive memoization on compute()",
      targetFile: "src/compute.js",
      baselineValue: 100,
      measuredValue: 250,
      deltaPercent: 150,
      verdict: "REVERT",
      revertReason: "metric_regressed",
      tierResults: {
        gates: { status: "pass", summary: "ok" },
      },
      flightId: "flt-1",
      createdAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
    });

    // Also record a successful experiment (KEEP) — should NOT be a negative constraint
    await recordExperiment(dir, {
      schemaVersion: 1,
      id: "exp-success",
      goal: "optimize compute latency",
      hypothesis: "lookup table",
      targetFile: "src/compute.js",
      baselineValue: 100,
      measuredValue: 50,
      deltaPercent: -50,
      verdict: "KEEP",
      tierResults: {
        gates: { status: "pass", summary: "ok" },
      },
      flightId: "flt-2",
      createdAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
    });

    // Request engineering context touching src/compute.js
    const context = await getEngineeringContext(dir, {
      task: "optimize compute function in src/compute.js",
      files: ["src/compute.js"],
    });

    // Verify negative constraints are present in pack
    assert.ok(context.negativeConstraints, "negativeConstraints must be defined");
    assert.equal(context.negativeConstraints.length, 1);
    assert.equal(context.negativeConstraints[0].experimentId, "exp-failed-algo");
    assert.equal(context.negativeConstraints[0].revertReason, "metric_regressed");

    // Verify knowledge.constraints contains the warning
    const avoidItem = context.knowledge.constraints.find((c) => c.includes("AVOID:"));
    assert.ok(avoidItem, "knowledge.constraints must include AVOID constraint");
    assert.ok(avoidItem.includes("use recursive memoization"));

    // Verify markdown rendering contains the section
    assert.ok(context.markdown.includes("## Negative constraints (past failed experiments)"));
    assert.ok(context.markdown.includes("use recursive memoization"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
