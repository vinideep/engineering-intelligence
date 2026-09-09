import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createIsolatedWorktree,
  withIsolatedWorktree,
  startExperiment,
  evaluateExperimentStep,
} from "../dist/experiment/index.js";
import { buildGraph } from "../dist/graph/index.js";

function initRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-workspace-"));
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
  git("commit -q -m 'initial repo setup'");
  return { dir, git };
}

test("createIsolatedWorktree creates detached worktree and cleans up cleanly", async () => {
  const { dir } = initRepo();
  try {
    const session = await createIsolatedWorktree(dir, { id: "test1" });
    assert.ok(session.worktreeDir);
    // Worktree should have src/compute.js
    const computeContent = readFileSync(path.join(session.worktreeDir, "src", "compute.js"), "utf8");
    assert.ok(computeContent.includes("return 100"));

    // Modify worktree
    writeFileSync(
      path.join(session.worktreeDir, "src", "compute.js"),
      "export function compute() {\n  return 150;\n}\n",
    );

    const patch = await session.createPatch();
    assert.ok(patch.includes("+  return 150;"));

    // Main workspace remains untouched
    const mainContent = readFileSync(path.join(dir, "src", "compute.js"), "utf8");
    assert.ok(mainContent.includes("return 100"));

    // Cleanup worktree
    await session.cleanup();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("withIsolatedWorktree runs callback in isolated tree and cleans up", async () => {
  const { dir } = initRepo();
  try {
    const result = await withIsolatedWorktree(dir, async (session) => {
      writeFileSync(
        path.join(session.worktreeDir, "src", "compute.js"),
        "export function compute() {\n  return 999;\n}\n",
      );
      return "done";
    });
    assert.equal(result, "done");
    // Main file still untouched
    const mainContent = readFileSync(path.join(dir, "src", "compute.js"), "utf8");
    assert.ok(mainContent.includes("return 100"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CRITICAL: developer uncommitted work survives failed experiment rollback", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir, { write: true });

    // Step 1: Developer makes uncommitted edits in src/compute.js BEFORE experiment starts
    const developerUncommittedCode = "export function compute() {\n  // Developer wip\n  return 120;\n}\n";
    writeFileSync(path.join(dir, "src", "compute.js"), developerUncommittedCode);

    // Step 2: Autoresearch starts an experiment on compute.js
    const flight = await startExperiment(dir, {
      goal: "optimize compute",
      hypothesis: "try bad algorithmic change",
      targetFile: "src/compute.js",
    });

    // Step 3: Experiment makes a change that regresses
    writeFileSync(
      path.join(dir, "src", "compute.js"),
      "export function compute() {\n  // Broken experiment\n  return 9999;\n}\n",
    );

    // Step 4: Step is evaluated and fails (metric regressed -> REVERT)
    const result = await evaluateExperimentStep(dir, {
      flightId: flight.id,
      goal: "optimize compute",
      hypothesis: "try bad algorithmic change",
      targetFile: "src/compute.js",
      baselineValue: 100,
      metricConfig: {
        name: "compute_val",
        command: "node -e console.log(9999)",
        goal: "minimize",
      },
      skipGates: true,
      autoRollback: true,
    });

    assert.equal(result.verdict, "REVERT");

    // Step 5: VERIFY developer uncommitted code is RESTORED, NOT wiped by git checkout HEAD!
    const restoredContent = readFileSync(path.join(dir, "src", "compute.js"), "utf8");
    assert.equal(
      restoredContent,
      developerUncommittedCode,
      "Developer uncommitted work MUST survive experiment rollback",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
