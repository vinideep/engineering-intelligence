---
name: graph-guided-autoresearch
description: Autonomous, metric-driven code optimization and regression prevention loop guided by dependency and call graph intelligence.
---

# Graph-Guided Autoresearch

Execute hypothesis-driven, metric-focused optimization loops using graph intelligence and mechanical 3-tier verification.

## Core Principle: Causal Isolation

1. **Topological Candidate Discovery**: Query `generate_experiment_candidates` to rank bottlenecks, high fan-in nodes, and churn hotspots from the code graph.
2. **Baseline Measurement**: Run the metric command prior to editing to establish a hard baseline.
3. **Strict Single-Change Mutation**: Mutate exactly one file or symbol per iteration. Never bundle speculative changes.
4. **Three-Tier Verification Ladder**:
   - **Tier 1 (Safety Gates)**: Run deterministic safety gates (`env-vars`, `dead-exports`, `api-diff`, `migration-lint`). If any fail, revert immediately.
   - **Tier 2 (Scoped Tests)**: Run only the tests impacted by the mutated node (`testsToRun`). If tests fail, revert immediately.
   - **Tier 3 (Empirical Metric)**: Measure the objective metric (latency, memory, bundle size, pass rate). If degraded, revert immediately.
5. **Git Transaction & Ledger**:
   - On improvement ($\ge$ tolerance threshold): **KEEP** and optionally commit.
   - On regression or gate failure: **REVERT** (safely restores target file to baseline commit without touching other files).
   - Log trial to `.engineering-intelligence/experiments/ledger.jsonl` and append an `experiment` node to `.engineering-intelligence/graph/dependency-graph.json`.

## Tools

- `generate_experiment_candidates`: Output ranked optimization targets from call and dependency graphs.
- `evaluate_experiment_step`: Automated 3-tier verification, metric comparison, keep/revert decision, and rollback.
- `get_experiment_history`: Query past experiments and outcomes for a target file or symbol.
- CLI equivalent: `npx engineering-intelligence experiment candidates|history [path]`.
