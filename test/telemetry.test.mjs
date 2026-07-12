/**
 * Telemetry tests — real transcript parsing (not a synthetic length/4 model):
 * sum billed input/output tokens, detect get_context usage, split cohorts.
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  summarizeTranscript,
  recordFromTranscript,
  aggregate,
} from "../dist/telemetry/index.js";

async function tmp() { return mkdtemp(path.join(tmpdir(), "ei-tel-")); }

const TRANSCRIPT_WITH_CONTEXT = [
  JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
  JSON.stringify({ type: "assistant", message: { role: "assistant", usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 8000 }, content: [{ type: "tool_use", name: "get_context" }] } }),
  JSON.stringify({ type: "assistant", message: { role: "assistant", usage: { input_tokens: 1500, output_tokens: 420 }, content: [{ type: "text", text: "done" }] } }),
  "",
].join("\n");

const TRANSCRIPT_NO_CONTEXT = [
  JSON.stringify({ type: "assistant", message: { role: "assistant", usage: { input_tokens: 5000, output_tokens: 600 }, content: [{ type: "text", text: "read a lot of files" }] } }),
].join("\n");

test("summarizeTranscript sums usage and detects get_context", () => {
  const s = summarizeTranscript(TRANSCRIPT_WITH_CONTEXT, "s1");
  assert.equal(s.turns, 2);
  assert.equal(s.inputTokens, 2700);
  assert.equal(s.outputTokens, 720);
  assert.equal(s.cacheReadTokens, 8000);
  assert.equal(s.contextUsed, true);
});

test("summarizeTranscript flags contextUsed false when the tool is absent", () => {
  const s = summarizeTranscript(TRANSCRIPT_NO_CONTEXT, "s2");
  assert.equal(s.contextUsed, false);
  assert.equal(s.inputTokens, 5000);
});

test("summarizeTranscript tolerates malformed lines", () => {
  const s = summarizeTranscript("not json\n{bad\n" + TRANSCRIPT_NO_CONTEXT, "s3");
  assert.equal(s.turns, 1);
});

test("recordFromTranscript appends a row; aggregate splits cohorts", async () => {
  const root = await tmp();
  try {
    await mkdir(path.join(root, ".engineering-intelligence"), { recursive: true });
    const p1 = path.join(root, "t1.jsonl");
    const p2 = path.join(root, "t2.jsonl");
    await writeFile(p1, TRANSCRIPT_WITH_CONTEXT, "utf8");
    await writeFile(p2, TRANSCRIPT_NO_CONTEXT, "utf8");

    await recordFromTranscript(root, p1, "with");
    await recordFromTranscript(root, p2, "without");

    const report = await aggregate(root);
    assert.equal(report.totalSessions, 2);
    assert.equal(report.withContext.sessions, 1);
    assert.equal(report.withoutContext.sessions, 1);
    // with-context averaged input/turn = 2700/2 = 1350; without = 5000/1 = 5000.
    assert.equal(report.withContext.avgInputPerTurn, 1350);
    assert.equal(report.withoutContext.avgInputPerTurn, 5000);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("recordFromTranscript is fail-safe on a missing transcript and empty sessions", async () => {
  const root = await tmp();
  try {
    const res = await recordFromTranscript(root, path.join(root, "nope.jsonl"), "x");
    assert.equal(res, null);
    const report = await aggregate(root);
    assert.equal(report.totalSessions, 0);
    assert.match(report.note, /No sessions recorded/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
