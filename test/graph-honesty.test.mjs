/**
 * Graph honesty tests.
 *
 * The graph's job is not to be complete — it is to never state something false.
 * Every test here pins a defect found in the committed graph of this very repo:
 * fabricated edges parsed out of comments and string literals, module nodes whose
 * `path` did not exist on disk, silent false negatives from line-by-line matching,
 * a structurally-always-empty `unknowns`, and type-only imports double-counted as
 * runtime dependencies.
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildGraph, analyzeImpact } from "../dist/graph/index.js";
import { extractImports } from "../dist/graph/parsers/imports.js";
import { maskSource } from "../dist/graph/parsers/scan.js";

async function project(files) {
  const root = await mkdtemp(path.join(tmpdir(), "ei-graph-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
  return root;
}

test("maskSource blanks comments and captures string bodies while preserving lines", () => {
  const { masked, literals } = maskSource([
    "// import { x } from './fake'",
    "/* multi",
    "   line */",
    "import { real } from './real.js';",
  ].join("\n"));
  assert.equal(masked.split("\n").length, 4, "line structure must be preserved for evidence");
  assert.ok(!masked.includes("fake"), "comment contents must be blanked");
  assert.ok(literals.includes("./real.js"), "string bodies are captured for lookup");
});

test("imports inside comments and string literals produce no edges", async () => {
  const root = await project({
    "src/a.ts": [
      "// export { a } from './ghost';",
      "/* import { b } from './phantom'; */",
      "const sample = `import { c } from './fixture';`;",
      "const s = \"require('./stringy')\";",
      "export const a = 1;",
      "void sample; void s;",
    ].join("\n"),
  });
  const { edges, nodes } = await extractImports(path.join(root, "src/a.ts"), root);
  assert.deepEqual(edges, [], `no edge may come from prose: ${JSON.stringify(edges.map((e) => e.to))}`);
  assert.equal(nodes.length, 1, "only the source module node");
});

test("multi-line imports are seen (the silent false-negative case)", async () => {
  const root = await project({
    "src/target.ts": "export const t = 1;\n",
    "src/consumer.ts": [
      "import {",
      "  t,",
      "} from './target.js';",
      "console.log(t);",
    ].join("\n"),
  });
  const { edges } = await extractImports(path.join(root, "src/consumer.ts"), root);
  assert.deepEqual(edges.map((e) => e.to), ["module:src/target"]);
  assert.equal(edges[0].evidence[0], "src/consumer.ts:1", "evidence points at the import statement");
});

test("a .js specifier resolves to the .ts file that actually exists", async () => {
  const root = await project({
    "src/dep.ts": "export const d = 1;\n",
    "src/main.ts": "import { d } from './dep.js';\nvoid d;\n",
  });
  const { nodes } = await extractImports(path.join(root, "src/main.ts"), root);
  const target = nodes.find((n) => n.id === "module:src/dep");
  assert.equal(target.path, "src/dep.ts", "path must name a file on disk, not the literal specifier");
  assert.equal(target.confidence, "verified");
});

test("an unresolvable import is reported as unknown, never as a confident edge", async () => {
  const root = await project({ "src/main.ts": "import { g } from './does-not-exist.js';\nvoid g;\n" });
  const { nodes, unknowns } = await extractImports(path.join(root, "src/main.ts"), root);
  const target = nodes.find((n) => n.id.includes("does-not-exist"));
  assert.equal(target.confidence, "unknown", "must not claim verified for a file it never found");
  assert.equal(target.path, undefined, "must not invent a path");
  assert.ok(unknowns.some((u) => /does-not-exist/.test(u)), `unknowns must record it: ${JSON.stringify(unknowns)}`);
});

test("unknowns reaches the built graph instead of being structurally empty", async () => {
  const root = await project({
    "src/a.ts": "import { x } from './missing.js';\nvoid x;\n",
  });
  await buildGraph(root);
  const graph = JSON.parse(await readFile(
    path.join(root, ".engineering-intelligence/graph/dependency-graph.json"), "utf8"));
  assert.ok(
    graph.unknowns.some((u) => /missing/.test(u)),
    `a graph that cannot resolve an import must say so, got: ${JSON.stringify(graph.unknowns)}`,
  );
});

test("a type-only import is never also counted as a runtime dependency", async () => {
  const root = await project({
    "src/types.ts": "export type T = { a: number };\n",
    "src/use.ts": "import type { T } from './types.js';\nexport const v: T = { a: 1 };\n",
  });
  const { edges } = await extractImports(path.join(root, "src/use.ts"), root);
  assert.equal(edges.length, 1, `exactly one edge expected, got ${JSON.stringify(edges.map((e) => e.relation))}`);
  assert.equal(edges[0].relation, "imports-type");
});

test("every module node path in a built graph exists on disk", async () => {
  const root = await project({
    "src/a.ts": "import { b } from './b.js';\nvoid b;\n",
    "src/b.ts": "export const b = 1;\n",
    "src/c.py": "from .d import thing\n",
  });
  await buildGraph(root);
  const graph = JSON.parse(await readFile(
    path.join(root, ".engineering-intelligence/graph/dependency-graph.json"), "utf8"));
  const lying = graph.nodes.filter((n) => n.path && !existsSync(path.join(root, n.path)));
  assert.deepEqual(lying.map((n) => `${n.id} -> ${n.path}`), [], "a node must never carry a path that isn't there");
});

test("concurrent parsing yields the same edges as serial parsing", async () => {
  // Regression guard: `g`-flagged regexes carry a mutable lastIndex. Sharing them
  // across the builder's 50-way parallel parse silently dropped imports — the
  // graph looked plausible and was wrong.
  const files = {};
  for (let i = 0; i < 40; i++) {
    files[`src/m${i}.ts`] = [
      "import {",
      "  shared,",
      "} from './shared.js';",
      `import type { T } from './types.js';`,
      `export const v${i} = shared;`,
    ].join("\n");
  }
  files["src/shared.ts"] = "export const shared = 1;\n";
  files["src/types.ts"] = "export type T = number;\n";
  const root = await project(files);

  const paths = Object.keys(files).map((f) => path.join(root, f));
  const serial = [];
  for (const p of paths) serial.push(await extractImports(p, root));
  const parallel = await Promise.all(paths.map((p) => extractImports(p, root)));

  const flat = (rs) => rs.flatMap((r) => r.edges.map((e) => `${e.from}|${e.to}|${e.relation}`)).sort();
  assert.deepEqual(flat(parallel), flat(serial), "parallel parsing must not lose edges");
  assert.equal(flat(serial).length, 80, "40 modules x (shared + types)");
});

test("analyzeImpact resolves changed files for every supported language", async () => {
  const root = await project({
    "src/lib.go": "package lib\n",
    "src/app.go": 'package main\nimport "example.com/x/y"\n',
    "src/lib.rs": "pub fn f() {}\n",
    "src/a.ts": "export const a = 1;\n",
    "src/b.ts": "import { a } from './a.js';\nvoid a;\n",
  });
  await buildGraph(root);

  // A .ts change finds its importer.
  const ts = await analyzeImpact(root, ["src/a.ts"]);
  assert.deepEqual(ts.direct, ["module:src/b"]);

  // Non-JS extensions must map onto real node ids rather than silently missing.
  const go = await analyzeImpact(root, ["src/app.go"]);
  assert.ok(!go.unknowns.some((u) => u.includes("module:src/app.go")),
    `.go must normalize to module:src/app, got: ${JSON.stringify(go.unknowns)}`);
  const rs = await analyzeImpact(root, ["src/lib.rs"]);
  assert.ok(!rs.unknowns.some((u) => u.includes("module:src/lib.rs")),
    `.rs must normalize to module:src/lib, got: ${JSON.stringify(rs.unknowns)}`);
});
