/**
 * Simple-4 orchestrator tests (v2.4): ask routing, brief determinism, health.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildGraph } from "../dist/graph/index.js";
import { runAsk } from "../dist/orchestrators/ask.js";
import { runHealth } from "../dist/orchestrators/health.js";
import { detectIdes } from "../dist/orchestrators/setup.js";
import { generateBrief } from "../dist/brief/index.js";

function initRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-orch-"));
  const git = (a) => execSync(`git ${a}`, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
  git("init -q");
  git("config user.email t@t.co");
  git("config user.name T");
  mkdirSync(path.join(dir, "src"));
  writeFileSync(path.join(dir, "src", "a.js"), "export function alpha() { return 1; }\n");
  writeFileSync(path.join(dir, "src", "b.js"), "import { alpha } from './a.js';\nexport function beta() { return alpha(); }\n");
  git("add -A");
  git("commit -q -m init");
  return dir;
}

test("ask routes 'who calls X' to caller lookup", async () => {
  const dir = initRepo();
  try {
    await buildGraph(dir);
    const res = await runAsk(dir, "who calls alpha", ["who", "calls", "alpha"]);
    assert.equal(res.kind, "who-calls");
    assert.match(res.text, /beta/, `expected beta among callers: ${res.text}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ask routes a file path to impact analysis", async () => {
  const dir = initRepo();
  try {
    await buildGraph(dir);
    const res = await runAsk(dir, "src/a.js", ["src/a.js"]);
    assert.equal(res.kind, "impact");
    assert.match(res.text, /Impact of changing/, res.text);
    assert.match(res.text, /b/, "b.js depends on a.js so should appear");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ask routes a bare identifier to combined locate + callers", async () => {
  const dir = initRepo();
  try {
    await buildGraph(dir);
    const res = await runAsk(dir, "alpha", ["alpha"]);
    assert.match(res.text, /defined:/, res.text);
    assert.match(res.text, /called by/, res.text);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generateBrief is deterministic for identical graph state", async () => {
  const dir = initRepo();
  try {
    await buildGraph(dir);
    const first = (await generateBrief(dir)).markdown;
    const second = (await generateBrief(dir)).markdown;
    assert.equal(first, second, "brief should be byte-identical across runs on the same graph");
    assert.match(first, /Repo Brief/, "brief should have a heading");
    assert.match(first, /Most depended-on modules/, "brief should list dependencies");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("detectIdes finds adapters from marker directories", () => {
  const dir = initRepo();
  try {
    mkdirSync(path.join(dir, ".claude"));
    mkdirSync(path.join(dir, ".cursor"));
    mkdirSync(path.join(dir, ".agents", "agents"), { recursive: true });
    const ides = detectIdes(dir);
    assert.ok(ides.includes("claude-code"), `expected claude-code, got ${ides}`);
    assert.ok(ides.includes("cursor"), `expected cursor, got ${ides}`);
    assert.ok(ides.includes("antigravity"), `expected modern Antigravity marker, got ${ides}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runHealth reports graph stats and an overall verdict", async () => {
  const dir = initRepo();
  try {
    await buildGraph(dir);
    const res = await runHealth(dir);
    assert.match(res.text, /health check/, res.text);
    assert.match(res.text, /Graph:/, "should report graph stats");
    assert.equal(typeof res.ok, "boolean");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
