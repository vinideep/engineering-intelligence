/**
 * Agent Flight Recorder tests (v2.3 accountability layer).
 *
 * Proves preflight records declared intent + predicted radius, and postflight
 * flags changes that landed outside the declared scope — deterministically.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { preflight, postflight, loadFlight } from "../dist/flight/index.js";
import { buildGraph } from "../dist/graph/index.js";

function initRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-flight-"));
  const git = (a) => execSync(`git ${a}`, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
  git("init -q");
  git("config user.email test@example.com");
  git("config user.name Test");
  mkdirSync(path.join(dir, "src"));
  writeFileSync(path.join(dir, "src", "a.js"), "export function a() { return 1; }\n");
  writeFileSync(path.join(dir, "src", "b.js"), "import { a } from './a.js';\nexport function b() { return a() + 1; }\n");
  writeFileSync(path.join(dir, "src", "c.js"), "export function c() { return 3; }\n");
  git("add -A");
  git("commit -q -m initial");
  return { dir, git };
}

test("preflight records intent, declared files, and a predicted radius", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir);
    const record = await preflight(dir, { intent: "tweak a()", files: ["src/a.js"] });
    assert.ok(record.id.startsWith("flt-"), `bad id: ${record.id}`);
    assert.equal(record.status, "open");
    assert.deepEqual(record.declaredFiles, ["src/a.js"]);
    assert.ok(record.baselineCommit, "should capture a baseline commit");
    // src/b.js imports src/a.js, so it should be in the predicted radius.
    assert.ok(
      record.predictedRadius.files.includes("src/b.js"),
      `expected src/b.js in predicted radius, got: ${JSON.stringify(record.predictedRadius.files)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("postflight verdict is clean when changes stay within the declared scope", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir);
    const record = await preflight(dir, { intent: "tweak a()", files: ["src/a.js"] });
    // Edit only the declared file.
    writeFileSync(path.join(dir, "src", "a.js"), "export function a() { return 42; }\n");
    const result = await postflight(dir, { id: record.id });
    assert.ok(!("error" in result), "postflight should succeed");
    assert.equal(result.report.verdict, "clean", `expected clean, got: ${JSON.stringify(result.report)}`);
    assert.ok(result.report.actualChanged.includes("src/a.js"));
    assert.equal(result.report.outOfBounds.length, 0);
    // Record is closed on disk.
    const reloaded = await loadFlight(dir, record.id);
    assert.equal(reloaded.status, "closed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("postflight flags an out-of-bounds change outside the declared scope + radius", async () => {
  const { dir } = initRepo();
  try {
    await buildGraph(dir);
    const record = await preflight(dir, { intent: "tweak a()", files: ["src/a.js"] });
    // Edit the declared file AND an unrelated file (c.js is not a dependent of a).
    writeFileSync(path.join(dir, "src", "a.js"), "export function a() { return 42; }\n");
    writeFileSync(path.join(dir, "src", "c.js"), "export function c() { return 99; }\n");
    const result = await postflight(dir, { id: record.id });
    assert.ok(!("error" in result), "postflight should succeed");
    assert.equal(result.report.verdict, "flagged", `expected flagged, got: ${JSON.stringify(result.report)}`);
    assert.ok(
      result.report.outOfBounds.includes("src/c.js"),
      `expected src/c.js flagged out-of-bounds, got: ${JSON.stringify(result.report.outOfBounds)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("postflight with no open flight returns an error", async () => {
  const { dir } = initRepo();
  try {
    const result = await postflight(dir, {});
    assert.ok("error" in result, "expected an error when no flight exists");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
