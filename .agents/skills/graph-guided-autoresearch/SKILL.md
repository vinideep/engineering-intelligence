---
name: graph-guided-autoresearch
description: Autonomous, metric-driven code optimization and regression prevention loop guided by dependency and call graph intelligence.
---

# Graph-Guided Autoresearch

Execute hypothesis-driven, metric-focused optimization loops using graph intelligence and the `evaluate_experiment_step` MCP tool for automated 3-tier verification.

## Core Principle: Causal Isolation

1. **Topological Candidate Discovery**: Call `generate_experiment_candidates` to rank bottlenecks, high fan-in nodes, and churn hotspots from the code graph.
2. **Baseline Measurement**: Run the metric command (`metricConfig.command`) prior to editing to establish a hard `baselineValue`. Parse the numeric result from stdout.
3. **Strict Single-Change Mutation**: Mutate exactly one file or symbol per iteration. Never bundle speculative changes.
4. **Automated 3-Tier Verification**: Call `evaluate_experiment_step` to execute the full verification ladder automatically:
   - **Tier 1 (Safety Gates)**: Deterministic gates (`env-vars`, `dead-exports`, `api-diff`). If any fail, the tool reverts immediately.
   - **Tier 2 (Scoped Tests)**: Runs only tests impacted by the mutated node. If tests fail, reverts immediately.
   - **Tier 3 (Empirical Metric)**: Measures the objective metric and compares against baseline. If degraded beyond tolerance, reverts immediately.
5. **Verdict Handling**:
   - `KEEP`: Improvement confirmed. Optionally auto-commits (`commitOnKeep: true`).
   - `REVERT`: Regression or gate failure. Target file is safely restored to baseline commit without touching other files (`autoRollback: true` by default).
   - The tool automatically logs the trial to `.engineering-intelligence/experiments/ledger.jsonl`.

## Tool Parameter Schema

### `evaluate_experiment_step` (required fields)

```
{
  goal: string,           // Target optimization goal (e.g. "Reduce bundle size")
  hypothesis: string,     // Specific hypothesis for this single change
  targetFile: string,     // The single file modified during this iteration
  baselineValue: number,  // Baseline metric value measured BEFORE the edit
  metricConfig: {
    name: string,         // Metric name (e.g. "bundle_size_kb")
    command: string,      // Shell command that outputs the metric (e.g. "du -sk dist/ | cut -f1")
    goal: "minimize" | "maximize" | "target",
    parsePattern?: string,    // Optional regex to extract numeric value from command output
    targetValue?: number,     // Required when goal is "target"
    sampleRuns?: number,      // Number of measurement samples (default 1)
    tolerancePercent?: number // Minimum improvement % to KEEP (default 0)
  }
}
```

### Optional fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `targetSymbol` | string | — | Symbol name within the target file |
| `testCommand` | string | — | Custom test command for Tier 2 verification |
| `skipGates` | boolean | `false` | Skip Tier 1 deterministic safety gates |
| `autoRollback` | boolean | `true` | Automatically rollback on REVERT verdict |
| `commitOnKeep` | boolean | `false` | Auto-commit on KEEP verdict |
| `useWorktree` | boolean | `false` | Run experiment in an isolated git worktree instead of the main workspace — eliminates risk to uncommitted work |
| `flightId` | string | — | Flight ID tracking the active modification cycle |

## Procedure

1. Call `generate_experiment_candidates` to get ranked targets.
2. For each candidate (iterate until goal is met or candidates exhausted):
   a. Read the target file. Form a hypothesis for a single-change mutation.
   b. Run the metric command to capture `baselineValue`.
   c. Apply the mutation to the target file.
   d. Call `evaluate_experiment_step` with all required fields. Use `useWorktree: true` when uncommitted work exists in the workspace.
   e. Read the verdict from the response. If `KEEP`, move to the next candidate or stop. If `REVERT`, try the next hypothesis or next candidate.
3. Call `get_experiment_history` to review cumulative results and confirm the optimization trajectory.

## Tools

- `generate_experiment_candidates`: Ranked optimization targets from call and dependency graphs.
- `evaluate_experiment_step`: Automated 3-tier verification, metric comparison, keep/revert decision, and rollback.
- `get_experiment_history`: Query past experiments and outcomes for a target file or symbol.
- CLI equivalent: `npx engineering-intelligence experiment candidates|history [path]`.

## Cross-References

- Depends on: `graph-engine` (dependency/call graph for candidate ranking), `environmental-backpressure-engine` (metric command execution)
- Used by: `engineering-orchestrator` (optimization route), `engineering-intelligence` (optional autoresearch trigger)
- Related: `impact-analysis-engine` (blast radius of kept mutations)
