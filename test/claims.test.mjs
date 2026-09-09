/**
 * Claim verification tests — a claim is bound to evidence spans pinned by content
 * hash. Editing the cited lines must flip it stale; deleting the file, missing.
 * Cosmetic (trailing-whitespace) edits must NOT flip it.
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  addClaim,
  verifyClaims,
  loadClaims,
  refreshClaims,
  parseEvidenceSpec,
  hashSpan,
} from "../dist/claims/index.js";

async function tmp() { return mkdtemp(path.join(tmpdir(), "ei-claims-")); }
async function write(root, rel, content) {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
}

test("parseEvidenceSpec parses path and path:start-end", () => {
  assert.deepEqual(parseEvidenceSpec("src/a.ts:10-20,src/b.ts"), [
    { path: "src/a.ts", lines: [10, 20] },
    { path: "src/b.ts" },
  ]);
});

test("addClaim records an ASSERTED claim; an intact anchor never makes it verified", async () => {
  const root = await tmp();
  try {
    await write(root, "src/pay.ts", "export function pay() {\n  return charge();\n}\n");
    const claim = await addClaim(root, { statement: "pay delegates to charge", evidence: [{ path: "src/pay.ts", lines: [1, 3] }], author: "tester" });
    assert.match(claim.id, /^CLM-0001$/);
    assert.equal(claim.evidence[0].contentHash.length, 16);

    const store = await loadClaims(root);
    assert.equal(store.claims.length, 1);

    const report = await verifyClaims(root);
    // An intact anchor is NOT proof the sentence is true, so an asserted claim
    // reports `unverified` — never `verified`.
    assert.equal(report.unverified, 1);
    assert.equal(report.verified, 0);
    assert.equal(report.stale, 0);
    assert.equal(report.missing, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("editing a cited line flips the claim stale", async () => {
  const root = await tmp();
  try {
    await write(root, "src/pay.ts", "export function pay() {\n  return charge();\n}\n");
    await addClaim(root, { statement: "pay delegates to charge", evidence: [{ path: "src/pay.ts", lines: [1, 3] }], author: "tester" });
    await write(root, "src/pay.ts", "export function pay() {\n  return refund();\n}\n");
    const report = await verifyClaims(root);
    assert.equal(report.stale, 1);
    assert.equal(report.results[0].status, "stale");
    assert.deepEqual(report.results[0].staleEvidence, ["src/pay.ts:1-3"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("deleting the cited file flips the claim missing", async () => {
  const root = await tmp();
  try {
    await write(root, "src/pay.ts", "export function pay() {}\n");
    await addClaim(root, { statement: "pay exists", evidence: [{ path: "src/pay.ts" }], author: "tester" });
    await rm(path.join(root, "src/pay.ts"));
    const report = await verifyClaims(root);
    assert.equal(report.missing, 1);
    assert.equal(report.results[0].status, "missing");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("changes OUTSIDE the cited line range do not flip the claim stale", async () => {
  const root = await tmp();
  try {
    await write(root, "src/pay.ts", "export function pay() {\n  return charge();\n}\nexport function other() {}\n");
    await addClaim(root, { statement: "pay delegates to charge", evidence: [{ path: "src/pay.ts", lines: [1, 3] }], author: "tester" });
    // Edit line 4 only — outside the [1,3] evidence range.
    await write(root, "src/pay.ts", "export function pay() {\n  return charge();\n}\nexport function CHANGED() {}\n");
    const report = await verifyClaims(root);
    assert.equal(report.unverified, 1, "line-scoped evidence ignores unrelated edits");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("trailing-whitespace-only edits do not flip the claim stale", async () => {
  const root = await tmp();
  try {
    await write(root, "src/a.ts", "const x = 1;\nconst y = 2;\n");
    await addClaim(root, { statement: "x and y", evidence: [{ path: "src/a.ts", lines: [1, 2] }], author: "tester" });
    await write(root, "src/a.ts", "const x = 1;   \nconst y = 2;\t\n");
    const report = await verifyClaims(root);
    assert.equal(report.unverified, 1, "normalization ignores trailing whitespace");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("refreshClaims re-pins hashes so a previously stale claim verifies again", async () => {
  const root = await tmp();
  try {
    await write(root, "src/a.ts", "line1\nline2\n");
    await addClaim(root, { statement: "two lines", evidence: [{ path: "src/a.ts", lines: [1, 2] }], author: "tester" });
    await write(root, "src/a.ts", "changed1\nchanged2\n");
    assert.equal((await verifyClaims(root)).stale, 1);
    const updated = await refreshClaims(root);
    assert.equal(updated, 1);
    assert.equal((await verifyClaims(root)).unverified, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("hashSpan returns null for out-of-range lines and missing files", async () => {
  const root = await tmp();
  try {
    await write(root, "src/a.ts", "one\ntwo\n");
    assert.equal(await hashSpan(root, { path: "src/a.ts", lines: [5, 9] }), null);
    assert.equal(await hashSpan(root, { path: "nope.ts" }), null);
    assert.ok(await hashSpan(root, { path: "src/a.ts", lines: [1, 2] }));
  } finally { await rm(root, { recursive: true, force: true }); }
});
