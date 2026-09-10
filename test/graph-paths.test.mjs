import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildGraph, findExecutionPaths } from "../dist/graph/index.js";

function setupGraphRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ei-paths-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });

  // 3-layer architecture: controller -> service -> repository
  writeFileSync(dir + "/src/repo.js", "export function queryDb() { return []; }\n");
  writeFileSync(
    dir + "/src/service.js",
    "import { queryDb } from './repo.js';\nexport function fetchData() { return queryDb(); }\n",
  );
  writeFileSync(
    dir + "/src/controller.js",
    "import { fetchData } from './service.js';\nexport function handleRequest() { return fetchData(); }\n",
  );
  writeFileSync(dir + "/src/isolated.js", "export function isolated() { return 1; }\n");

  return dir;
}

test("findExecutionPaths discovers multi-hop chain from controller to repo", async () => {
  const dir = setupGraphRepo();
  try {
    await buildGraph(dir);
    const paths = await findExecutionPaths(dir, "src/controller.js", "src/repo.js");
    assert.ok(paths.length > 0, "should find at least one execution path");
    const p = paths[0];
    assert.ok(p.nodes.length >= 3, `path should have at least 3 nodes, got: ${p.nodes.join(" -> ")}`);
    assert.ok(p.nodes[0].includes("controller"));
    assert.ok(p.nodes[p.nodes.length - 1].includes("repo"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findExecutionPaths returns empty array when no path exists", async () => {
  const dir = setupGraphRepo();
  try {
    await buildGraph(dir);
    const paths = await findExecutionPaths(dir, "src/isolated.js", "src/repo.js");
    assert.equal(paths.length, 0, "isolated node should have no path to repo");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findExecutionPaths respects maxDepth limit", async () => {
  const dir = setupGraphRepo();
  try {
    await buildGraph(dir);
    // controller -> service -> repo is depth 2. With maxDepth 1, no path should be found
    const paths = await findExecutionPaths(dir, "src/controller.js", "src/repo.js", { maxDepth: 1 });
    assert.equal(paths.length, 0, "path of length 2 should be pruned when maxDepth is 1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
