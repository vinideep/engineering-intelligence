import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadEiConfig, migrateEiConfig } from "../dist/config/index.js";
import { collectProjectFiles, ProjectFilePolicy } from "../dist/project-files/index.js";
import { buildGraph } from "../dist/graph/index.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-policy-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  await mkdir(path.join(root, "benchmark"), { recursive: true });
  await mkdir(path.join(root, ".agent", "skills"), { recursive: true });
  await writeFile(path.join(root, "src", "kept.ts"), "export const kept = 1;\n");
  await writeFile(path.join(root, "src", "forced.ts"), "export const forced = 1;\n");
  await writeFile(path.join(root, "dist", "generated.js"), "export const generated = 1;\n");
  await writeFile(path.join(root, "benchmark", "noise.ts"), "export const noise = 1;\n");
  await writeFile(path.join(root, ".agent", "skills", "generated.ts"), "export const generatedAdapter = 1;\n");
  await writeFile(path.join(root, ".env.production"), "SECRET=nope\n");
  return root;
}

test("project policy applies safety > explicit > .eiignore > .gitignore > default precedence", async () => {
  const root = await fixture();
  await writeFile(path.join(root, ".gitignore"), "src/kept.ts\ndist/\n");
  await writeFile(path.join(root, ".eiignore"), "benchmark/\n!src/kept.ts\n");
  await mkdir(path.join(root, ".engineering-intelligence"), { recursive: true });
  await writeFile(path.join(root, ".engineering-intelligence", "ei.config.json"), JSON.stringify({
    schemaVersion: 2,
    projectFiles: { include: ["src/forced.ts"], exclude: ["src/kept.ts"] },
  }));

  const policy = await ProjectFilePolicy.load(root);
  assert.equal(policy.explain("src/forced.ts").source, "explicit-include");
  assert.equal(policy.explain("src/kept.ts").source, "explicit-exclude");
  assert.equal(policy.explain("benchmark/noise.ts").source, "eiignore");
  assert.equal(policy.explain("dist/generated.js").included, false);
  assert.equal(policy.explain(".agent/skills/generated.ts").source, "safety");
  assert.equal(policy.explain(".env.production").source, "safety");

  const files = (await collectProjectFiles(policy, { accept: (p) => p.endsWith(".ts") }))
    .map((file) => path.relative(root, file).replace(/\\/g, "/"));
  assert.deepEqual(files, ["src/forced.ts"]);
});

test("always-on safety exclusions cannot be overridden by project includes or ignore negation", async () => {
  const root = await fixture();
  await writeFile(path.join(root, ".gitignore"), "!dist/generated.js\n!.agent/skills/generated.ts\n");
  await mkdir(path.join(root, ".engineering-intelligence"), { recursive: true });
  await writeFile(path.join(root, ".engineering-intelligence", "ei.config.json"), JSON.stringify({
    schemaVersion: 2,
    projectFiles: { include: ["dist/**", ".agent/**"] },
  }));
  const policy = await ProjectFilePolicy.load(root);
  assert.equal(policy.explain("dist/generated.js").source, "safety");
  assert.equal(policy.explain(".agent/skills/generated.ts").source, "safety");
});

test("project policy rejects symlinks whose target escapes the repository", async (t) => {
  const root = await fixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "ei-policy-outside-"));
  await writeFile(path.join(outside, "secret.ts"), "export const secret = 1;\n");
  try {
    await symlink(path.join(outside, "secret.ts"), path.join(root, "src", "escape.ts"));
  } catch (error) {
    if (error?.code === "EPERM") return t.skip("symlink creation unavailable");
    throw error;
  }
  const policy = await ProjectFilePolicy.load(root);
  assert.equal((await policy.explainExisting("src/escape.ts")).source, "safety");
  const files = await collectProjectFiles(policy, { accept: (p) => p.endsWith(".ts") });
  assert.ok(!files.some((file) => file.endsWith("escape.ts")));
});

test("graph excludes ignored source and represents imports to generated output as external", async () => {
  const root = await fixture();
  await writeFile(path.join(root, ".eiignore"), "benchmark/\n");
  await writeFile(path.join(root, "src", "consumer.ts"), "import { generated } from '../dist/generated.js';\nvoid generated;\n");
  await buildGraph(root);
  const graph = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"), "utf8"));
  assert.ok(!graph.nodes.some((node) => node.path?.startsWith("dist/")));
  assert.ok(!graph.nodes.some((node) => node.path?.startsWith("benchmark/")));
  const external = graph.nodes.find((node) => node.id === "external:dist/generated.js");
  assert.ok(external, `expected external generated reference: ${JSON.stringify(graph.nodes)}`);
  assert.equal(external.metadata.excludedPath, "dist/generated.js");
});

test("legacy token budgets are read and migrated atomically into ei.config.json", async () => {
  const root = await fixture();
  await mkdir(path.join(root, ".engineering-intelligence"), { recursive: true });
  await writeFile(path.join(root, ".engineering-intelligence", "config.json"), JSON.stringify({ tokenBudgets: { get_graph: 3210 } }));
  const before = await loadEiConfig(root);
  assert.equal(before.tokenBudgets.get_graph, 3210);
  const migration = await migrateEiConfig(root);
  assert.equal(migration.changed, true);
  const persisted = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "ei.config.json"), "utf8"));
  assert.equal(persisted.schemaVersion, 2);
  assert.equal(persisted.tokenBudgets.get_graph, 3210);
  assert.equal((await migrateEiConfig(root)).changed, false);
});
