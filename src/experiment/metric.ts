import { runProcess } from "../process/index.js";
import type { MetricConfig, TierMetricResult } from "./types.js";

export interface MeasureResult {
  value: number;
  rawOutputs: string[];
  samples: number[];
}

export function extractNumericMetric(output: string, parsePattern?: string): number {
  if (parsePattern) {
    const re = new RegExp(parsePattern, "m");
    const match = re.exec(output);
    if (match) {
      // If regex has capturing group, use first group, else full match
      const valStr = match[1] !== undefined ? match[1] : match[0];
      const parsed = parseFloat(valStr.replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  // Fallback heuristic: look for numbers preceded by common metric labels or just numbers
  const labeledMatch = /(?:latency|p95|p99|time|score|duration|memory|errors?|count|size)[\s:=]+([0-9]+(?:\.[0-9]+)?)/i.exec(output);
  if (labeledMatch && labeledMatch[1]) {
    const val = parseFloat(labeledMatch[1]);
    if (!Number.isNaN(val)) return val;
  }

  // General fallback: grab the last number found in stdout
  const matches = output.match(/-?[0-9]+(?:\.[0-9]+)?/g);
  if (matches && matches.length > 0) {
    const lastNum = parseFloat(matches[matches.length - 1]!);
    if (!Number.isNaN(lastNum)) return lastNum;
  }

  throw new Error(`Could not parse numeric metric from command output: "${output.slice(0, 150)}..."`);
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export async function measureMetric(root: string, config: MetricConfig): Promise<MeasureResult> {
  const runs = Math.max(1, config.sampleRuns ?? 1);
  const samples: number[] = [];
  const rawOutputs: string[] = [];

  const [cmd, ...args] = config.command.split(" ");
  if (!cmd) {
    throw new Error("Metric command cannot be empty");
  }

  for (let i = 0; i < runs; i++) {
    const result = await runProcess({
      command: cmd,
      args,
      cwd: root,
      timeoutMs: config.timeoutMs ?? 30_000,
    });

    const combinedOutput = `${result.stdout}\n${result.stderr}`.trim();
    rawOutputs.push(combinedOutput);

    if (result.exitCode !== 0) {
      throw new Error(`Metric command failed with exit code ${result.exitCode}: ${combinedOutput.slice(0, 200)}`);
    }

    const val = extractNumericMetric(combinedOutput, config.parsePattern);
    samples.push(val);
  }

  return {
    value: calculateMedian(samples),
    rawOutputs,
    samples,
  };
}

export function compareMetric(
  baseline: number,
  measured: number,
  config: MetricConfig,
): TierMetricResult {
  const tolerance = config.tolerancePercent ?? 0;
  const denom = Math.abs(baseline) === 0 ? 1 : Math.abs(baseline);
  const deltaPercent = ((measured - baseline) / denom) * 100;

  let improved = false;

  switch (config.goal) {
    case "minimize": {
      // Must be lower than baseline by at least tolerance %
      const threshold = baseline * (1 - tolerance / 100);
      improved = measured <= threshold && measured < baseline;
      break;
    }
    case "maximize": {
      // Must be higher than baseline by at least tolerance %
      const threshold = baseline * (1 + tolerance / 100);
      improved = measured >= threshold && measured > baseline;
      break;
    }
    case "target": {
      const target = config.targetValue ?? 0;
      const baselineDist = Math.abs(baseline - target);
      const measuredDist = Math.abs(measured - target);
      const threshold = baselineDist * (1 - tolerance / 100);
      improved = measuredDist <= threshold && measuredDist < baselineDist;
      break;
    }
  }

  return {
    baseline,
    measured,
    deltaPercent: Math.round(deltaPercent * 100) / 100,
    improved,
    sampleRuns: config.sampleRuns ?? 1,
  };
}
