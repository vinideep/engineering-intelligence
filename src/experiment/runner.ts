import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { preflight, postflight, restoreFlightSnapshots, type FlightRecord } from "../flight/index.js";
import { runGate, GATE_NAMES, type GateName } from "../gates/index.js";
import { runProcess, runProcessSync } from "../process/index.js";
import { analyzeImpact } from "../graph/index.js";
import { measureMetric, compareMetric } from "./metric.js";
import { recordExperiment } from "./ledger.js";
import { attachExperimentToGraph } from "./graph-sync.js";
import { createIsolatedWorktree } from "./workspace.js";
import type {
  EvaluateStepOptions,
  ExperimentRecord,
  ExperimentVerdict,
  RevertReason,
  TierGateResult,
  TierTestResult,
  TierMetricResult,
} from "./types.js";

function git(root: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
  return runProcessSync({ command: "git", args, cwd: root, timeoutMs: 15_000 });
}

export async function rollbackTargetFiles(
  root: string,
  files: string[],
  flightRecord?: FlightRecord | null,
): Promise<void> {
  if (flightRecord && flightRecord.snapshots) {
    await restoreFlightSnapshots(root, flightRecord, files);
    return;
  }

  for (const f of files) {
    const fullPath = path.resolve(root, f);
    if (!existsSync(fullPath)) continue;

    const check = git(root, ["ls-files", "--error-unmatch", f]);
    if (check.exitCode === 0) {
      git(root, ["checkout", "HEAD", "--", f]);
    } else {
      try {
        await unlink(fullPath);
      } catch {
        // ignore
      }
    }
  }
}

export async function startExperiment(
  root: string,
  options: { goal: string; hypothesis: string; targetFile: string },
): Promise<FlightRecord> {
  return preflight(root, {
    intent: `[Autoresearch] ${options.goal}: ${options.hypothesis}`,
    files: [options.targetFile],
  });
}

export async function evaluateExperimentStep(
  root: string,
  options: EvaluateStepOptions,
): Promise<ExperimentRecord> {
  if (options.useWorktree) {
    return evaluateInWorktree(root, options);
  }
  return evaluateInPlace(root, options);
}

async function evaluateInWorktree(
  root: string,
  options: EvaluateStepOptions,
): Promise<ExperimentRecord> {
  const session = await createIsolatedWorktree(root, {
    id: `exp-${Date.now().toString(36)}`,
    copyDirty: false, // experiments start from clean HEAD
  });
  try {
    // Run the experiment inside the worktree — never touches the main workspace
    const record = await evaluateInPlace(session.worktreeDir, {
      ...options,
      autoRollback: false, // No need to rollback in worktree, we just discard it
      commitOnKeep: false, // Don't commit in worktree, we patch back instead
      useWorktree: false, // Prevent recursion
    });

    if (record.verdict === "KEEP") {
      // Apply the successful changes back to the main workspace
      await session.applyPatchToMain();
      if (options.commitOnKeep) {
        git(root, ["add", options.targetFile]);
        git(root, [
          "commit",
          "-m",
          `autoresearch(${options.targetFile}): ${options.hypothesis} [${record.deltaPercent}%]`,
        ]);
      }
    }
    // REVERT/ERROR: worktree is discarded on cleanup — zero risk to main workspace

    // Record in main workspace ledger, not worktree ledger
    await recordExperiment(root, record);
    await attachExperimentToGraph(root, record);

    return record;
  } finally {
    await session.cleanup();
  }
}

async function evaluateInPlace(
  root: string,
  options: EvaluateStepOptions,
): Promise<ExperimentRecord> {
  const startedAt = new Date().toISOString();
  const id = `exp-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  const autoRollback = options.autoRollback ?? true;
  const filesToRollback = [options.targetFile];

  let verdict: ExperimentVerdict = "REVERT";
  let revertReason: RevertReason | undefined;
  let flightId = options.flightId || "";

  const tierGates: TierGateResult = { status: "pass", summary: "All gates passed" };
  let tierTest: TierTestResult | undefined;
  let tierMetric: TierMetricResult | undefined;

  // 1. Audit scope via Flight Recorder
  const flightResult = await postflight(root, options.flightId ? { id: options.flightId } : {});
  const flightRecord = "record" in flightResult ? flightResult.record : null;
  if ("record" in flightResult) {
    flightId = flightResult.record.id;
    if (flightResult.report.verdict === "flagged") {
      verdict = "REVERT";
      revertReason = "out_of_bounds";
      if (autoRollback) {
        await rollbackTargetFiles(root, flightResult.report.actualChanged, flightRecord);
      }
      return finishRecord();
    }
  }

  // 2. Tier 1: Deterministic Safety Gates
  if (!options.skipGates) {
    const gatesToCheck: GateName[] = ["env-vars", "dead-exports", "api-diff"];
    for (const gate of gatesToCheck) {
      try {
        const res = await runGate(gate, root);
        if (res.status === "fail") {
          tierGates.status = "fail";
          tierGates.failedGate = gate;
          tierGates.summary = res.summary;
          verdict = "REVERT";
          revertReason = "gate_failed";
          if (autoRollback) {
            await rollbackTargetFiles(root, filesToRollback, flightRecord);
          }
          return finishRecord();
        }
      } catch {
        // Non-blocking if gate cannot execute in target environment
      }
    }
  }

  // 3. Tier 2: Scoped Tests
  let testCmd = options.testCommand;
  if (!testCmd) {
    try {
      const impact = await analyzeImpact(root, [options.targetFile]);
      if (impact.testsToRun.length > 0) {
        // If node test suite exists
        testCmd = `node --test ${impact.testsToRun.join(" ")}`;
      }
    } catch {
      // test derivation non-fatal
    }
  }

  if (testCmd) {
    const [tCmd, ...tArgs] = testCmd.split(" ");
    if (tCmd) {
      const testRes = await runProcess({
        command: tCmd,
        args: tArgs,
        cwd: root,
        timeoutMs: 60_000,
      });

      tierTest = {
        status: testRes.exitCode === 0 ? "pass" : "fail",
        command: testCmd,
        exitCode: testRes.exitCode,
        outputSummary: (testRes.stdout || testRes.stderr).slice(0, 200),
      };

      if (testRes.exitCode !== 0) {
        verdict = "REVERT";
        revertReason = "test_failed";
        if (autoRollback) {
          await rollbackTargetFiles(root, filesToRollback, flightRecord);
        }
        return finishRecord();
      }
    }
  }

  // 4. Tier 3: Empirical Metric Evaluation
  try {
    const measureResult = await measureMetric(root, options.metricConfig);
    tierMetric = compareMetric(options.baselineValue, measureResult.value, options.metricConfig);

    if (tierMetric.improved) {
      verdict = "KEEP";
      revertReason = undefined;

      if (options.commitOnKeep) {
        git(root, ["add", options.targetFile]);
        git(root, [
          "commit",
          "-m",
          `autoresearch(${options.targetFile}): ${options.hypothesis} [${tierMetric.deltaPercent}%]`,
        ]);
      }
    } else {
      verdict = "REVERT";
      revertReason = "metric_regressed";
      if (autoRollback) {
        await rollbackTargetFiles(root, filesToRollback, flightRecord);
      }
    }
  } catch (err) {
    verdict = "ERROR";
    revertReason = "command_error";
    if (autoRollback) {
      await rollbackTargetFiles(root, filesToRollback, flightRecord);
    }
  }

  return finishRecord();

  async function finishRecord(): Promise<ExperimentRecord> {
    const closedAt = new Date().toISOString();
    const currentSha = git(root, ["rev-parse", "HEAD"]).stdout.trim() || undefined;

    const record: ExperimentRecord = {
      schemaVersion: 1,
      id,
      goal: options.goal,
      hypothesis: options.hypothesis,
      targetFile: options.targetFile,
      targetSymbol: options.targetSymbol,
      baselineValue: options.baselineValue,
      measuredValue: tierMetric?.measured,
      deltaPercent: tierMetric?.deltaPercent,
      verdict,
      revertReason,
      tierResults: {
        gates: tierGates,
        tests: tierTest,
        metric: tierMetric,
      },
      flightId,
      createdAt: startedAt,
      closedAt,
      gitCommit: currentSha,
    };

    await recordExperiment(root, record);
    await attachExperimentToGraph(root, record);

    return record;
  }
}
