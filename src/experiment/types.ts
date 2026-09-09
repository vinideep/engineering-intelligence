export type MetricGoal = "minimize" | "maximize" | "target";

export interface MetricConfig {
  name: string;
  command: string;
  parsePattern?: string; // regex with a capturing group or first match for numeric value
  goal: MetricGoal;
  targetValue?: number;
  sampleRuns?: number; // default 1, run multiple times and take median for noise reduction
  tolerancePercent?: number; // minimum % delta required to qualify as improvement (default 0)
  timeoutMs?: number; // default 30000
}

export type CandidateCategory = "hotspot" | "fan_in" | "coupling" | "caller_chain";

export interface CandidateOpportunity {
  id: string;
  targetNodeId: string;
  targetFile: string;
  symbol?: string;
  category: CandidateCategory;
  score: number; // 0-100
  rationale: string;
  suggestedHypothesis: string;
  testsToRun: string[];
  directDependents: number;
}

export type ExperimentVerdict = "KEEP" | "REVERT" | "ERROR";

export type RevertReason =
  | "gate_failed"
  | "test_failed"
  | "metric_regressed"
  | "out_of_bounds"
  | "command_error";

export interface TierGateResult {
  status: "pass" | "warn" | "fail";
  failedGate?: string;
  summary: string;
}

export interface TierTestResult {
  status: "pass" | "fail";
  command: string;
  exitCode: number;
  outputSummary?: string;
}

export interface TierMetricResult {
  baseline: number;
  measured: number;
  deltaPercent: number;
  improved: boolean;
  sampleRuns?: number;
}

export interface ExperimentRecord {
  schemaVersion: 1;
  id: string;
  goal: string;
  hypothesis: string;
  targetFile: string;
  targetSymbol?: string;
  baselineValue: number;
  measuredValue?: number;
  deltaPercent?: number;
  verdict: ExperimentVerdict;
  revertReason?: RevertReason;
  tierResults: {
    gates?: TierGateResult;
    tests?: TierTestResult;
    metric?: TierMetricResult;
  };
  flightId: string;
  createdAt: string;
  closedAt: string;
  gitCommit?: string;
}

export interface EvaluateStepOptions {
  flightId?: string;
  goal: string;
  hypothesis: string;
  targetFile: string;
  targetSymbol?: string;
  baselineValue: number;
  metricConfig: MetricConfig;
  testCommand?: string;
  skipGates?: boolean;
  autoRollback?: boolean; // default true: restores file from git baseline if verdict is REVERT
  commitOnKeep?: boolean; // default false: auto-commit if KEEP
  useWorktree?: boolean; // default false: run experiment in an isolated git worktree instead of main workspace
}
