/**
 * Live token telemetry.
 *
 * The old "28-37% fewer tokens" figure was synthetic (length/4 over rendered
 * files). This records REAL usage: at session end the Stop hook hands us the
 * host's transcript, we sum the actual billed input/output tokens for the
 * session, note whether the session used the `get_context` tool, and append one
 * row to a local log. `telemetry` then reports observed averages — and, once
 * enough sessions accumulate, an honest with-vs-without-context comparison drawn
 * from measured data instead of a model.
 *
 * Best-effort and fail-safe: if the transcript is absent or in an unexpected
 * shape, we record nothing and never throw.
 */

import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

export interface SessionSample {
  sessionId: string;
  recordedAt: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  contextUsed: boolean;   // did the agent call get_context this session?
}

const DIR = ".engineering-intelligence/telemetry";
const LOG = `${DIR}/sessions.jsonl`;

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Parse a Claude Code JSONL transcript into one aggregated session sample. */
export function summarizeTranscript(transcript: string, sessionId: string): SessionSample {
  let turns = 0, inputTokens = 0, outputTokens = 0, cacheReadTokens = 0;
  let contextUsed = false;

  for (const line of transcript.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(trimmed) as Record<string, unknown>; } catch { continue; }

    const message = (obj.message ?? obj) as Record<string, unknown>;
    const usage = message.usage as Record<string, unknown> | undefined;
    if (usage) {
      turns++;
      inputTokens += num(usage.input_tokens);
      outputTokens += num(usage.output_tokens);
      cacheReadTokens += num(usage.cache_read_input_tokens);
    }
    // Detect get_context tool use anywhere in the message content.
    const content = message.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        const it = item as Record<string, unknown>;
        if (it.type === "tool_use" && typeof it.name === "string" && it.name.includes("get_context")) contextUsed = true;
      }
    }
  }

  return { sessionId, recordedAt: new Date().toISOString(), turns, inputTokens, outputTokens, cacheReadTokens, contextUsed };
}

/** Read the transcript referenced by a hook payload and append a telemetry row. */
export async function recordFromTranscript(root: string, transcriptPath: string, sessionId: string): Promise<SessionSample | null> {
  let transcript: string;
  try { transcript = await readFile(transcriptPath, "utf8"); } catch { return null; }
  const sample = summarizeTranscript(transcript, sessionId);
  if (sample.turns === 0) return null; // nothing measured
  await mkdir(path.join(root, DIR), { recursive: true });
  await ensureGitignored(root);
  await appendFile(path.join(root, LOG), `${JSON.stringify(sample)}\n`, "utf8");
  return sample;
}

async function ensureGitignored(root: string): Promise<void> {
  const p = path.join(root, ".engineering-intelligence", ".gitignore");
  let existing = "";
  try { existing = await readFile(p, "utf8"); } catch { /* new */ }
  if (!existing.includes("telemetry/")) {
    await writeFile(p, existing + (existing && !existing.endsWith("\n") ? "\n" : "") + "telemetry/\n", "utf8");
  }
}

export interface Cohort {
  sessions: number;
  avgInputPerTurn: number;
  avgOutputPerSession: number;
  avgTurns: number;
}

export interface TelemetryReport {
  totalSessions: number;
  withContext: Cohort;
  withoutContext: Cohort;
  note: string;
}

function cohort(samples: SessionSample[]): Cohort {
  if (samples.length === 0) return { sessions: 0, avgInputPerTurn: 0, avgOutputPerSession: 0, avgTurns: 0 };
  const turns = samples.reduce((s, x) => s + x.turns, 0);
  const input = samples.reduce((s, x) => s + x.inputTokens, 0);
  const output = samples.reduce((s, x) => s + x.outputTokens, 0);
  return {
    sessions: samples.length,
    avgInputPerTurn: turns > 0 ? Math.round(input / turns) : 0,
    avgOutputPerSession: Math.round(output / samples.length),
    avgTurns: Math.round((turns / samples.length) * 10) / 10,
  };
}

export async function aggregate(root: string): Promise<TelemetryReport> {
  let raw = "";
  try { raw = await readFile(path.join(root, LOG), "utf8"); } catch { /* none yet */ }
  const samples: SessionSample[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { samples.push(JSON.parse(t) as SessionSample); } catch { /* skip */ }
  }
  const withContext = cohort(samples.filter((s) => s.contextUsed));
  const withoutContext = cohort(samples.filter((s) => !s.contextUsed));
  return {
    totalSessions: samples.length,
    withContext,
    withoutContext,
    note:
      samples.length === 0
        ? "No sessions recorded yet. Telemetry accumulates as the Stop hook observes real sessions."
        : "Observed token usage from real sessions (billed input/output). Compare the two cohorts once both have several sessions.",
  };
}

export function renderReport(report: TelemetryReport): string {
  const lines = [`Token telemetry — ${report.totalSessions} session(s) observed.`, ""];
  const row = (label: string, c: Cohort) =>
    `  ${label.padEnd(22)} sessions=${c.sessions}  avgInput/turn=${c.avgInputPerTurn}  avgOutput/session=${c.avgOutputPerSession}  avgTurns=${c.avgTurns}`;
  lines.push(row("with get_context", report.withContext));
  lines.push(row("without get_context", report.withoutContext));
  lines.push("", report.note);
  return lines.join("\n") + "\n";
}
