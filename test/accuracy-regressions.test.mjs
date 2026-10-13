/**
 * Regression tests for analysis bugs that produced confidently WRONG answers —
 * the failure mode that most misleads coding agents. Each test reproduces the
 * original wrong output and pins the corrected behaviour.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { maskSource } from "../dist/graph/parsers/scan.js";
import { extractImports } from "../dist/graph/parsers/imports.js";
import { extractSymbols, resolvePendingCalls, buildGlobalSymbolTable } from "../dist/graph/parsers/symbols.js";
import { buildGraph, analyzeImpact, whoCalls } from "../dist/graph/index.js";
import { runGate } from "../dist/gates/index.js";
import { extractApiSurface } from "../dist/gates/api-diff.js";
import { changedFiles } from "../dist/verify/index.js";
import { parsePorcelainPaths } from "../dist/process/git-paths.js";
import { classifyTask } from "../dist/context/orchestrator.js";
import { smartCrush, generateWorkflowRouting, generateSkillsIndex } from "../dist/token-optimizer.js";

async function tmp(prefix = "gw-acc-") {
  return mkdtemp(path.join(tmpdir(), prefix));
}
async function write(root, rel, content) {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
}
function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, stdio: "pipe", encoding: "utf8" });
}
async function gitRepo() {
  const root = await tmp();
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@t.co");
  git(root, "config", "user.name", "t");
  git(root, "config", "commit.gpgsign", "false");
  return root;
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

test("maskSource: a regex literal containing /* does not swallow later imports", () => {
  const { masked } = maskSource('const re = /\\/*$/;\nimport x from "./x.js";\n');
  assert.match(masked, /import x from/);
  assert.equal(masked.split("\n").length, 3, "line structure preserved");
});

test("maskSource: division is not mistaken for a regex", () => {
  const { masked } = maskSource("const a = b / c; // note\nconst d = (e) / 2;\n");
  assert.match(masked, /b \/ c;/);
  assert.match(masked, /\(e\) \/ 2;/);
  assert.doesNotMatch(masked, /note/);
});

test("maskSource: template interpolations stay code; nested templates don't unbalance", () => {
  const { masked } = maskSource("const t = `a ${fn(`x`)} }`;\nimport y from \"./y.js\";\n");
  assert.match(masked, /fn\(/, "interpolated code is visible");
  assert.match(masked, /import y from/);
});

test("extractImports: a regex literal no longer hides the following import edge", async () => {
  const root = await tmp();
  await write(root, "src/a.ts", 'const re = /\\/*$/;\nimport { b } from "./b.js";\nexport const a = re;\n');
  await write(root, "src/b.ts", "export const b = 1;\n");
  const { edges } = await extractImports(path.join(root, "src/a.ts"), root);
  assert.ok(edges.some((e) => e.to === "module:src/b" && e.relation === "imports"));
});

test("extractImports: a runtime re-export after a type alias is not labelled type-only", async () => {
  const root = await tmp();
  await write(root, "src/a.ts", 'export type Foo = string;\nexport { b } from "./b.js";\n');
  await write(root, "src/b.ts", "export const b = 1;\n");
  const { edges } = await extractImports(path.join(root, "src/a.ts"), root);
  const edge = edges.find((e) => e.to === "module:src/b");
  assert.equal(edge?.relation, "imports");
});

test("extractImports: .jsx, .mts and .cts files are parsed", async () => {
  const root = await tmp();
  await write(root, "src/App.jsx", 'import Header from "./Header.jsx";\nexport default () => Header;\n');
  await write(root, "src/Header.jsx", "export default 1;\n");
  await write(root, "src/m.mts", 'import { c } from "./c.cjs";\n');
  await write(root, "src/c.cts", "export const c = 1;\n");
  const jsx = await extractImports(path.join(root, "src/App.jsx"), root);
  assert.ok(jsx.edges.some((e) => e.to === "module:src/Header"));
  const mts = await extractImports(path.join(root, "src/m.mts"), root);
  assert.ok(mts.edges.length > 0);
});

test("extractImports (Python): `import x as y` and `from . import z` resolve to real ids", async () => {
  const root = await tmp();
  await write(root, "pkg/__init__.py", "");
  await write(root, "pkg/mod.py", "import numpy as np\nfrom . import helpers\n");
  const { edges } = await extractImports(path.join(root, "pkg/mod.py"), root);
  assert.ok(edges.some((e) => e.to === "pkg:numpy"), "alias stripped");
  assert.ok(edges.some((e) => e.to === "module:pkg/__init__"), "package import targets __init__");
});

test("extractImports (Rust): use crate:: resolves from the crate root", async () => {
  const root = await tmp();
  await write(root, "src/lib.rs", "pub mod util;\npub mod graph;\n");
  await write(root, "src/util.rs", "pub fn u() {}\n");
  await write(root, "src/graph/mod.rs", "use crate::util::u;\n");
  const { edges } = await extractImports(path.join(root, "src/graph/mod.rs"), root);
  assert.ok(edges.some((e) => e.to === "module:src/util"), JSON.stringify(edges.map((e) => e.to)));
});

// ---------------------------------------------------------------------------
// Symbols / call resolution
// ---------------------------------------------------------------------------

test("symbols: Set#has / Map#get calls are not resolved to a same-named user method", async () => {
  const root = await tmp();
  await write(root, "src/registry.ts", "export class Registry {\n  has(name: string) { return name.length > 0; }\n}\n");
  await write(root, "src/user.ts", "export function check(s: Set<string>) {\n  return s.has('x');\n}\n");
  const reg = await extractSymbols(path.join(root, "src/registry.ts"), root);
  const user = await extractSymbols(path.join(root, "src/user.ts"), root);
  const table = buildGlobalSymbolTable([...reg.nodes, ...user.nodes]);
  const edges = resolvePendingCalls([...reg.pendingCalls, ...user.pendingCalls], table, new Map());
  assert.equal(edges.length, 0, JSON.stringify(edges));
});

test("symbols: a JS caller never resolves a call into a module it does not import", () => {
  const table = new Map([["helper", ["symbol:src/other#helper"]]]);
  const pending = [{ from: "symbol:src/a#run", calleeName: "helper", evidence: "src/a.ts:3" }];
  assert.equal(resolvePendingCalls(pending, table, new Map()).length, 0);
  const imports = new Map([["module:src/a", new Set(["module:src/other"])]]);
  assert.equal(resolvePendingCalls(pending, table, imports).length, 1);
});

test("symbols: calls inside strings and comments are not edges; symbol path keeps its extension", async () => {
  const root = await tmp();
  await write(root, "src/a.ts", [
    "export function target() { return 1; }",
    "export function caller() {",
    '  const msg = "target( is mentioned";',
    "  // target() in a comment",
    "  return msg;",
    "}",
    "",
  ].join("\n"));
  const { nodes, edges } = await extractSymbols(path.join(root, "src/a.ts"), root);
  assert.equal(edges.filter((e) => e.relation === "calls").length, 0);
  assert.ok(nodes.every((n) => n.path === "src/a.ts"));
});

test("impact: testsToRun lists real test file paths", async () => {
  const root = await tmp();
  await write(root, "package.json", JSON.stringify({ name: "x", version: "1.0.0" }));
  await write(root, "src/math.ts", "export function add(a: number, b: number) { return a + b; }\n");
  await write(root, "tests/math_spec.ts", 'import { add } from "../src/math.js";\nexport function testAdd() { return add(1, 2); }\n');
  await buildGraph(root, { write: true });
  const impact = await analyzeImpact(root, ["src/math.ts"]);
  assert.ok(impact.testsToRun.length > 0, JSON.stringify(impact));
  const { existsSync } = await import("node:fs");
  for (const file of impact.testsToRun) assert.ok(existsSync(path.join(root, file)), `${file} exists`);
});

test("who-calls: built-in method calls do not appear as callers", async () => {
  const root = await tmp();
  await write(root, "package.json", JSON.stringify({ name: "x", version: "1.0.0" }));
  await write(root, "src/registry.ts", "export class Registry {\n  has(n: string) { return !!n; }\n}\n");
  await write(root, "src/a.ts", "export function a(s: Set<string>) { return s.has('q'); }\n");
  await write(root, "src/b.ts", "export function b(m: Map<string, number>) { return m.has('q'); }\n");
  await buildGraph(root, { write: true });
  const result = await whoCalls(root, "has");
  const callers = JSON.stringify(result);
  assert.doesNotMatch(callers, /src\/a\.ts|src\/b\.ts/);
});

// ---------------------------------------------------------------------------
// Git paths
// ---------------------------------------------------------------------------

test("parsePorcelainPaths: first line keeps its first character; renames yield both sides", () => {
  const out = " M src/a.ts\nR  old/x.ts -> new/x.ts\n?? \"with space.ts\"\n";
  assert.deepEqual(parsePorcelainPaths(out), ["src/a.ts", "old/x.ts", "new/x.ts", "with space.ts"]);
});

test("parsePorcelainPaths: paths are mapped to a subdirectory root", () => {
  const out = " M packages/api/src/routes.ts\n M packages/web/x.ts\n";
  assert.deepEqual(parsePorcelainPaths(out, "packages/api/"), ["src/routes.ts"]);
});

test("verify.changedFiles: the first modified file is reported intact", async () => {
  const root = await gitRepo();
  await write(root, "src/a.ts", "export const a = 1;\n");
  await write(root, "src/b.ts", "export const b = 1;\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  await write(root, "src/a.ts", "export const a = 2;\n");
  await write(root, "src/b.ts", "export const b = 2;\n");
  assert.deepEqual((await changedFiles(root)).sort(), ["src/a.ts", "src/b.ts"]);
});

test("verify.changedFiles: works when the analysed root is a monorepo package", async () => {
  const repo = await gitRepo();
  await write(repo, "packages/api/src/a.ts", "export const a = 1;\n");
  await write(repo, "packages/web/w.ts", "export const w = 1;\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "init");
  await write(repo, "packages/api/src/a.ts", "export const a = 2;\n");
  await write(repo, "packages/web/w.ts", "export const w = 2;\n");
  assert.deepEqual(await changedFiles(path.join(repo, "packages/api")), ["src/a.ts"]);
});

test("graph: a renamed file does not linger as a ghost module after incremental refresh", async () => {
  const root = await gitRepo();
  await write(root, "package.json", JSON.stringify({ name: "x", version: "1.0.0" }));
  await write(root, ".gitignore", ".graphward/\n.graphward/\n");
  await write(root, "src/a.ts", "export const a = 1;\n");
  await write(root, "src/main.ts", 'import { a } from "./a.js";\nexport const m = a;\n');
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  await buildGraph(root, { write: true });
  git(root, "mv", "src/a.ts", "src/b.ts");
  await write(root, "src/main.ts", 'import { a } from "./b.js";\nexport const m = a;\n');
  git(root, "add", "-A");
  git(root, "commit", "-qm", "rename");
  const { ensureFreshGraph } = await import("../dist/graph/index.js");
  await ensureFreshGraph(root);
  const impact = await analyzeImpact(root, ["src/b.ts"]);
  assert.ok(impact.direct.includes("module:src/main"), JSON.stringify(impact.direct));
  const stale = await analyzeImpact(root, ["src/a.ts"]);
  assert.ok(!stale.direct.includes("module:src/main"), "old path no longer has dependents");
});

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

test("dead-exports: modules consumed via destructured dynamic import of an index file are live", async () => {
  const root = await tmp();
  await write(root, "src/feature/index.ts", "export async function runFeature() { return 1; }\n");
  await write(root, "src/cli.ts", 'export async function main() {\n  const { runFeature } = await import("./feature/index.js");\n  return runFeature();\n}\n');
  await write(root, "src/other/index.ts", "export const unused = 1;\n");
  await write(root, "src/use-other.ts", 'import * as o from "./other";\nexport const x = o;\n');
  const result = await runGate("dead-exports", root);
  const flagged = result.findings.map((f) => f.message).join("\n");
  assert.doesNotMatch(flagged, /runFeature/);
  assert.doesNotMatch(flagged, /'unused'/, "namespace import of ./other resolves to other/index.ts");
});

test("dead-exports: an export used only by tests importing dist/ is live", async () => {
  const root = await tmp();
  await write(root, "src/lib.ts", "export function helper() { return 1; }\n");
  await write(root, "test/lib.test.mjs", 'const { helper } = await import("../dist/lib.js");\nhelper();\n');
  const result = await runGate("dead-exports", root);
  assert.equal(result.findings.length, 0, JSON.stringify(result.findings));
});

test("api-diff: a wildcard route does not swallow the routes after it", () => {
  const src = 'import express from "express";\nconst app = express();\napp.get("/*", h);\napp.get("/users", u);\n/** doc */\nexport default app;\n';
  const surface = extractApiSurface(src, "src/server.ts");
  assert.ok(surface.has("GET /users"), [...surface].join(","));
  assert.ok(surface.has("GET /*"));
});

test("migration-lint: multi-line destructive statements are caught", async () => {
  const root = await tmp();
  await write(root, "db/migrations/001.sql", "-- drop column email\nALTER TABLE users\n  DROP COLUMN email;\nUPDATE users\nSET active = false;\n");
  const result = await runGate("migration-lint", root);
  const messages = result.findings.map((f) => `${f.line}:${f.message}`);
  assert.ok(messages.some((m) => m.startsWith("2:") && /dropping a column/.test(m)), messages.join("\n"));
  assert.ok(messages.some((m) => m.startsWith("4:") && /UPDATE without WHERE/.test(m)), messages.join("\n"));
  assert.ok(!messages.some((m) => m.startsWith("1:")), "comment line is not linted");
});

test("env-vars: mixed-case names and destructured process.env are detected", async () => {
  const root = await tmp();
  await write(root, ".env.example", "NEXT_PUBLIC_apiUrl=\nDB_URL=\n");
  await write(root, "src/a.ts", "const u = process.env.NEXT_PUBLIC_apiUrl;\nconst {\n  DB_URL,\n  PORT: port = 3000,\n} = process.env;\n");
  const result = await runGate("env-vars", root);
  const text = result.findings.map((f) => f.message).join("\n");
  assert.doesNotMatch(text, /NEXT_PUBLIC_[^a]/, "name not truncated");
  assert.match(text, /PORT/, "destructured PORT is undeclared");
  assert.doesNotMatch(text, /'DB_URL'.*not declared|DB_URL.*missing/);
});

// ---------------------------------------------------------------------------
// Context classification
// ---------------------------------------------------------------------------

test("classifyTask: file names and substrings no longer force security/database routing", () => {
  assert.equal(classifyTask("add a CLI flag", ["src/index.ts"]).kind, "feature");
  assert.equal(classifyTask("improve the author list", ["src/token-optimizer.ts"]).kind, "feature");
  assert.equal(classifyTask("make the build stable", []).kind, "feature");
  assert.equal(classifyTask("fix login redirect", []).kind, "security-change");
  assert.equal(classifyTask("add a column", ["db/migrations/002.sql"]).kind, "database-change");
  assert.equal(classifyTask("tweak handler", ["src/routes/users.ts"]).kind, "api-change");
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test("smartCrush: keeps HTML comments inside inline code and fences, strips prose comments", () => {
  const out = smartCrush("Keep `<!-- freshness: x -->` here.\n<!-- remove me -->\n```md\n<!-- generated: y -->\n```\ntext <!-- gone --> end\n");
  assert.match(out, /`<!-- freshness: x -->`/);
  assert.match(out, /<!-- generated: y -->/);
  assert.doesNotMatch(out, /remove me|gone/);
  assert.match(out, /text  end/);
});

test("routing/index never mention SKILL-BRIEF.md when briefs are not emitted", async () => {
  assert.doesNotMatch(generateWorkflowRouting(".agents/skills", false), /SKILL-BRIEF/);
  assert.match(generateWorkflowRouting(".claude/skills", true), /SKILL-BRIEF/);
  assert.doesNotMatch(await generateSkillsIndex(["graph-engine"], ".agents/skills", false), /SKILL-BRIEF/);
});

test("rendered staleness-detector skill keeps its freshness marker format", async () => {
  const { readTemplate } = await import("../dist/templates.js");
  const rendered = smartCrush(await readTemplate("skills", "staleness-detector"));
  assert.doesNotMatch(rendered, /If a `` comment/);
  assert.match(rendered, /<!-- freshness:/);
});

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

test("claims: CRLF vs LF content hashes identically", async () => {
  const { hashSpan } = await import("../dist/claims/index.js");
  const a = await tmp();
  const b = await tmp();
  await write(a, "f.ts", "line1\nline2\n");
  await write(b, "f.ts", "line1\r\nline2\r\n");
  assert.equal(await hashSpan(a, { path: "f.ts", lines: [1, 2] }), await hashSpan(b, { path: "f.ts", lines: [1, 2] }));
  assert.ok((await readFile(path.join(b, "f.ts"), "utf8")).includes("\r\n"));
});
