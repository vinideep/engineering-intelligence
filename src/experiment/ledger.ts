import { mkdir, writeFile, readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ExperimentRecord } from "./types.js";

function experimentsDir(root: string): string {
  return path.join(root, ".engineering-intelligence", "experiments");
}

function jsonlPath(root: string): string {
  return path.join(experimentsDir(root), "ledger.jsonl");
}

function tsvPath(root: string): string {
  return path.join(experimentsDir(root), "ledger.tsv");
}

export async function recordExperiment(root: string, record: ExperimentRecord): Promise<void> {
  const dir = experimentsDir(root);
  await mkdir(dir, { recursive: true });

  // 1. Append to JSONL
  await appendFile(jsonlPath(root), `${JSON.stringify(record)}\n`, "utf8");

  // 2. Append to TSV (create header if not exists)
  const tsvFile = tsvPath(root);
  if (!existsSync(tsvFile)) {
    const header = ["id", "timestamp", "target", "verdict", "baseline", "measured", "delta%", "revert_reason", "hypothesis"].join("\t");
    await writeFile(tsvFile, `${header}\n`, "utf8");
  }

  const row = [
    record.id,
    record.closedAt,
    record.targetSymbol ? `${record.targetFile}:${record.targetSymbol}` : record.targetFile,
    record.verdict,
    record.baselineValue.toString(),
    record.measuredValue !== undefined ? record.measuredValue.toString() : "-",
    record.deltaPercent !== undefined ? `${record.deltaPercent > 0 ? "+" : ""}${record.deltaPercent}%` : "-",
    record.revertReason || "-",
    `"${record.hypothesis.replace(/"/g, '""')}"`,
  ].join("\t");

  await appendFile(tsvFile, `${row}\n`, "utf8");
}

export async function loadExperiments(
  root: string,
  filter?: { targetFile?: string },
): Promise<ExperimentRecord[]> {
  const file = jsonlPath(root);
  if (!existsSync(file)) return [];

  const raw = await readFile(file, "utf8");
  const records: ExperimentRecord[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed) as ExperimentRecord;
      if (filter?.targetFile && record.targetFile !== filter.targetFile) {
        continue;
      }
      records.push(record);
    } catch {
      // ignore corrupted lines
    }
  }

  return records;
}

export function renderExperimentHistory(records: ExperimentRecord[]): string {
  if (records.length === 0) {
    return "No experiments recorded yet.";
  }

  const lines: string[] = [];
  lines.push("# Graph-Guided Autoresearch Experiment History");
  lines.push("");
  lines.push("| ID | Target | Verdict | Baseline | Measured | Delta | Reason | Hypothesis |");
  lines.push("|---|---|---|---|---|---|---|---|");

  for (const r of records) {
    const target = r.targetSymbol ? `${r.targetFile}:${r.targetSymbol}` : r.targetFile;
    const delta = r.deltaPercent !== undefined ? `${r.deltaPercent > 0 ? "+" : ""}${r.deltaPercent}%` : "—";
    const measured = r.measuredValue !== undefined ? r.measuredValue.toString() : "—";
    const reason = r.revertReason || "—";
    const verdictIcon = r.verdict === "KEEP" ? "✓ KEEP" : r.verdict === "REVERT" ? "✗ REVERT" : "⚠ ERROR";

    lines.push(`| \`${r.id}\` | \`${target}\` | ${verdictIcon} | ${r.baselineValue} | ${measured} | ${delta} | ${reason} | ${r.hypothesis} |`);
  }

  const keepCount = records.filter((r) => r.verdict === "KEEP").length;
  const revertCount = records.filter((r) => r.verdict === "REVERT").length;
  lines.push("");
  lines.push(`**Summary:** Total: ${records.length} | Keep: ${keepCount} (${Math.round((keepCount / records.length) * 100)}%) | Revert: ${revertCount}`);

  return lines.join("\n");
}
