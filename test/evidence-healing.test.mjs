import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { recordEvidenceHashes, checkEvidenceHashes, findRelocatedLine } from "../dist/evidence/index.js";

test("findRelocatedLine finds line shifted downwards", () => {
  const target = "export function pay() { return true; }";
  const hash = createHash("sha1").update(target).digest("hex").slice(0, 16);

  const lines = [
    "// line 1",
    "// line 2",
    "// inserted comment A",
    "// inserted comment B",
    target, // was line 3, now line 5
  ];

  const found = findRelocatedLine(lines, hash, 3, 25);
  assert.ok(found);
  assert.equal(found.newLine, 5);
  assert.ok(found.confidence >= 0.8);
});

test("findRelocatedLine finds line shifted upwards", () => {
  const target = "export function refund() { return 0; }";
  const hash = createHash("sha1").update(target).digest("hex").slice(0, 16);

  const lines = [
    "// line 1",
    target, // was line 5, now line 2
  ];

  const found = findRelocatedLine(lines, hash, 5, 25);
  assert.ok(found);
  assert.equal(found.newLine, 2);
  assert.ok(found.confidence >= 0.8);
});

test("findRelocatedLine returns null on content mutation", () => {
  const target = "export function pay() { return true; }";
  const hash = createHash("sha1").update(target).digest("hex").slice(0, 16);

  const lines = [
    "// line 1",
    "export function pay(amount: number) { return true; }", // mutated
  ];

  const found = findRelocatedLine(lines, hash, 2, 25);
  assert.equal(found, null);
});

test("checkEvidenceHashes marks shifted citation as relocated", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-healing-"));
  try {
    mkdirSync(path.join(dir, "src"), { recursive: true });
    mkdirSync(path.join(dir, ".engineering-intelligence", "knowledge-base"), { recursive: true });
    writeFileSync(path.join(dir, "src", "auth.ts"), "export function login() {\n  return checkPassword();\n}\n");
    writeFileSync(
      path.join(dir, ".engineering-intelligence", "knowledge-base", "auth.md"),
      "Login is handled at `src/auth.ts:2` which calls checkPassword.\n",
    );

    await recordEvidenceHashes(dir);

    // Prepend 3 comment lines to src/auth.ts so line 2 shifts to line 5
    writeFileSync(
      path.join(dir, "src", "auth.ts"),
      "// new line 1\n// new line 2\n// new line 3\nexport function login() {\n  return checkPassword();\n}\n",
    );

    const report = await checkEvidenceHashes(dir);
    assert.equal(report.checked, 1);
    assert.equal(report.stale, 0, "relocated citation should not be counted as broken stale");
    assert.equal(report.relocated, 1);
    assert.equal(report.results[0].status, "relocated");
    assert.equal(report.results[0].relocatedLine, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
