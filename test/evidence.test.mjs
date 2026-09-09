/**
 * Evidence hashing tests (v2.3 self-invalidating knowledge).
 *
 * Proves that when a cited line of code changes, the knowledge-base citation
 * that pointed at it is mechanically flagged as stale.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { recordEvidenceHashes, checkEvidenceHashes } from "../dist/evidence/index.js";

function setup() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-evidence-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });
  mkdirSync(path.join(dir, ".engineering-intelligence", "knowledge-base"), { recursive: true });
  writeFileSync(path.join(dir, "src", "auth.ts"), "export function login() {\n  return checkPassword();\n}\n");
  writeFileSync(
    path.join(dir, ".engineering-intelligence", "knowledge-base", "auth.md"),
    "Login is handled at `src/auth.ts:2` which calls checkPassword.\n",
  );
  return dir;
}

test("evidence citation is ok immediately after recording", async () => {
  const dir = setup();
  try {
    await recordEvidenceHashes(dir);
    const report = await checkEvidenceHashes(dir);
    assert.equal(report.checked, 1);
    assert.equal(report.stale, 0);
    assert.equal(report.results[0].status, "ok");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("citation becomes stale when the cited line changes", async () => {
  const dir = setup();
  try {
    await recordEvidenceHashes(dir);
    // Change line 2 — the exact line the knowledge base cited.
    writeFileSync(path.join(dir, "src", "auth.ts"), "export function login() {\n  return verifyToken();\n}\n");
    const report = await checkEvidenceHashes(dir);
    assert.equal(report.stale, 1, `expected 1 stale, got: ${JSON.stringify(report)}`);
    assert.equal(report.results[0].status, "stale");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("citation is flagged when the cited file is removed", async () => {
  const dir = setup();
  try {
    await recordEvidenceHashes(dir);
    rmSync(path.join(dir, "src", "auth.ts"));
    const report = await checkEvidenceHashes(dir);
    assert.equal(report.results[0].status, "missing-file");
    assert.ok(report.stale >= 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
