/**
 * Knowledge-base drift verification tests.
 *
 * Proves the `verify` command mechanically detects when generated documentation
 * references code that no longer exists (or line numbers that drifted).
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { verifyKnowledge, renderVerifyReport } from "../dist/verify/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "verify-fixture");

test("verifyKnowledge classifies ok / missing / line-out-of-range references", async () => {
  const report = await verifyKnowledge(FIXTURE);
  const byStatus = (s) => report.results.filter((r) => r.status === s);

  // `src/real.ts` (exists) and `src/real.ts:1` (in range) → ok.
  assert.ok(byStatus("ok").length >= 2, `expected >=2 ok refs, got ${JSON.stringify(report.results)}`);

  // `src/ghost.ts` → missing.
  const missing = byStatus("missing");
  assert.ok(missing.some((r) => r.target === "src/ghost.ts"), "expected src/ghost.ts to be missing");

  // `src/real.ts:999` → line-out-of-range.
  const oor = byStatus("line-out-of-range");
  assert.ok(oor.some((r) => r.target === "src/real.ts" && r.line === 999), "expected src/real.ts:999 out of range");

  // drift = missing + out-of-range.
  assert.equal(report.drift, missing.length + oor.length);
  assert.ok(report.drift >= 2, "expected drift >= 2");
});

test("bare prose filenames (README.md) are not flagged as missing", async () => {
  const report = await verifyKnowledge(FIXTURE);
  // README.md has no slash and does not exist at the fixture root → skipped, not missing.
  assert.ok(!report.results.some((r) => r.target === "README.md"), "README.md prose mention should be skipped");
});

test("renderVerifyReport produces human-readable output", async () => {
  const report = await verifyKnowledge(FIXTURE);
  const text = renderVerifyReport(report);
  assert.ok(text.includes("Knowledge-base drift verification"));
  assert.ok(text.includes("Drift"));
});
