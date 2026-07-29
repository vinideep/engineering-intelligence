/**
 * Safety-gate unit tests — each gate is driven against a temp fixture with known
 * violations, asserting both the findings and the pass/warn/fail status that CI
 * keys off. api-diff is exercised against a real git base ref.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runGate,
  statusFromFindings,
  isGateName,
  GATE_NAMES,
} from "../dist/gates/index.js";
import { extractApiSurface } from "../dist/gates/api-diff.js";

async function tmp() {
  return mkdtemp(path.join(tmpdir(), "ei-gates-"));
}
async function write(root, rel, content) {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
}
function git(root, ...args) {
  execFileSync("git", args, { cwd: root, stdio: "pipe" });
}

test("GATE_NAMES / isGateName / statusFromFindings basics", () => {
  assert.deepEqual([...GATE_NAMES].sort(), ["api-diff", "dead-exports", "env-vars", "migration-lint"]);
  assert.equal(isGateName("env-vars"), true);
  assert.equal(isGateName("nope"), false);
  assert.equal(statusFromFindings([]), "pass");
  assert.equal(statusFromFindings([{ severity: "warning", message: "" }]), "warn");
  assert.equal(statusFromFindings([{ severity: "error", message: "" }]), "fail");
  // A configurable threshold is what lets an advisory gate become a blocking one.
  assert.equal(statusFromFindings([{ severity: "warning", message: "" }], "warning"), "fail");
  assert.equal(statusFromFindings([{ severity: "info", message: "" }], "warning"), "pass");
});

test("failOn promotes warning-only gates from advisory to blocking", async () => {
  // env-vars and dead-exports emit no `error` findings, so with the default
  // threshold they could never fail anything — advisory checks named as gates.
  const root = await tmp();
  await write(root, "package.json", JSON.stringify({ main: "src/index.ts" }));
  await write(root, "src/index.ts", "console.log(1);\n");
  await write(root, "src/util.ts", "export function orphan() { return 1; }\n");

  const advisory = await runGate("dead-exports", root);
  assert.equal(advisory.status, "warn", "default threshold keeps it advisory");

  const blocking = await runGate("dead-exports", root, { failOn: "warning" });
  assert.equal(blocking.status, "fail", "failOn:warning makes the same findings blocking");
  assert.deepEqual(blocking.findings, advisory.findings, "findings are unchanged — only the threshold moved");
});

test("env-vars: flags a variable used in code but missing from .env.example", async () => {
  const root = await tmp();
  await write(root, "src/app.ts", "const a = process.env.API_KEY;\nconst b = process.env.PORT;\n");
  await write(root, ".env.example", "PORT=3000\nUNUSED_VAR=1\n");
  const result = await runGate("env-vars", root);

  assert.equal(result.status, "warn");
  const warn = result.findings.filter((f) => f.severity === "warning");
  assert.equal(warn.length, 1, "only API_KEY is undocumented");
  assert.match(warn[0].message, /API_KEY/);
  assert.match(warn[0].evidence, /src\/app\.ts:1/);
  // Declared-but-unused surfaces as info, not a failure.
  assert.ok(result.findings.some((f) => f.severity === "info" && /UNUSED_VAR/.test(f.message)));
});

test("env-vars: passes cleanly when every referenced var is declared", async () => {
  const root = await tmp();
  await write(root, "src/app.py", "import os\nx = os.environ['DB_URL']\ny = os.getenv('DB_POOL')\n");
  await write(root, ".env.example", "DB_URL=postgres://\nDB_POOL=5\n");
  const result = await runGate("env-vars", root);
  assert.equal(result.status, "pass");
  assert.equal(result.findings.filter((f) => f.severity === "warning").length, 0);
});

test("dead-exports: flags an unused export but not one imported elsewhere", async () => {
  const root = await tmp();
  await write(root, "package.json", JSON.stringify({ main: "src/index.ts" }));
  await write(root, "src/index.ts", "import { used } from './util.js';\nconsole.log(used());\n");
  await write(root, "src/util.ts", "export function used() { return 1; }\nexport function orphan() { return 2; }\n");
  const result = await runGate("dead-exports", root);

  assert.equal(result.status, "warn");
  const names = result.findings.map((f) => f.message);
  assert.ok(names.some((m) => /orphan/.test(m)), "orphan should be flagged");
  assert.ok(!names.some((m) => /'used'/.test(m)), "used must not be flagged");
});

test("dead-exports: namespace and type imports count as usage", async () => {
  const root = await tmp();
  await write(root, "src/consumer.ts", "import * as ns from './ns.js';\nimport type { T } from './types.js';\nns.run(); const x: T = {};\n");
  await write(root, "src/ns.ts", "export function run() {}\nexport function also() {}\n"); // module used wholesale
  await write(root, "src/types.ts", "export type T = {};\n"); // imported by name (type)
  const result = await runGate("dead-exports", root);
  assert.equal(result.findings.length, 0, `no findings expected, got: ${JSON.stringify(result.findings)}`);
  assert.equal(result.status, "pass");
});

test("migration-lint: flags destructive and locking operations", async () => {
  const root = await tmp();
  await write(root, "db/migrations/001_drop.sql", "DROP TABLE users;\n");
  await write(root, "db/migrations/002_index.sql", "CREATE INDEX idx ON orders (customer_id);\n");
  await write(root, "db/migrations/003_ok.sql", "ALTER TABLE orders ADD COLUMN note text;\n");
  const result = await runGate("migration-lint", root);

  assert.equal(result.status, "fail", "a DROP TABLE must fail the gate");
  assert.ok(result.findings.some((f) => f.severity === "error" && /DROP/.test(f.message)));
  assert.ok(result.findings.some((f) => f.severity === "warning" && /CONCURRENTLY/.test(f.message)));
  // The benign ADD COLUMN (nullable) produces no finding.
  assert.ok(!result.findings.some((f) => f.file?.endsWith("003_ok.sql")));
});

test("migration-lint: passes a clean tree", async () => {
  const root = await tmp();
  await write(root, "db/migrations/001_ok.sql", "ALTER TABLE t ADD COLUMN c int;\n");
  const result = await runGate("migration-lint", root);
  assert.equal(result.status, "pass");
});

test("extractApiSurface: parses framework routes, decorators, and OpenAPI JSON", () => {
  // Route-call syntax is only trusted in a file that actually uses a server
  // framework — otherwise an HTTP client wrapper reads as a router.
  const code = extractApiSurface(
    "const app = express();\napp.get('/a', h); router.post(\"/b\", h); @Delete('/c')",
    "src/api.ts",
  );
  assert.ok(code.has("GET /a"));
  assert.ok(code.has("POST /b"));
  assert.ok(code.has("DELETE /c"));

  const oas = extractApiSurface(JSON.stringify({ paths: { "/pets": { get: {}, post: {} } } }), "openapi.json");
  assert.ok(oas.has("GET /pets"));
  assert.ok(oas.has("POST /pets"));
});

test("api-diff: fails when a route is removed vs the git base", async () => {
  const root = await tmp();
  git(root, "init");
  git(root, "config", "user.email", "t@t.co");
  git(root, "config", "user.name", "t");
  await write(root, "src/routes.js", "const app = express();\napp.get('/x', h); app.delete('/x/:id', h);\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "base");

  // Remove the DELETE route in the working tree.
  await write(root, "src/routes.js", "const app = express();\napp.get('/x', h);\n");
  const result = await runGate("api-diff", root, { base: "HEAD" });

  assert.equal(result.status, "fail");
  assert.ok(result.findings.some((f) => f.severity === "error" && /DELETE \/x\/:id/.test(f.message)));
});

test("api-diff: an HTTP client call is not mistaken for a route registration", async () => {
  const root = await tmp();
  git(root, "init");
  git(root, "config", "user.email", "t@t.co");
  git(root, "config", "user.name", "t");
  // No server framework anywhere — this is an axios-style wrapper.
  await write(root, "src/client.js", "const api = makeClient();\napi.get('/users');\napi.delete('/users/1');\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "base");

  await write(root, "src/client.js", "const api = makeClient();\napi.get('/users');\n");
  const result = await runGate("api-diff", root, { base: "HEAD" });
  assert.equal(result.status, "pass", `client calls must not register as endpoints: ${JSON.stringify(result.findings)}`);
});

test("api-diff: a route moved between files is not a breaking change", async () => {
  const root = await tmp();
  git(root, "init");
  git(root, "config", "user.email", "t@t.co");
  git(root, "config", "user.name", "t");
  await write(root, "src/routes.js", "const app = express();\napp.get('/a', h);\napp.post('/b', h);\n");
  await write(root, "src/more.js", "const app = express();\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "base");

  // Move POST /b into the other file — the surface is unchanged repo-wide.
  await write(root, "src/routes.js", "const app = express();\napp.get('/a', h);\n");
  await write(root, "src/more.js", "const app = express();\napp.post('/b', h);\n");

  const result = await runGate("api-diff", root, { base: "HEAD" });
  assert.equal(result.status, "pass", `per-file comparison would falsely flag this: ${JSON.stringify(result.findings)}`);
});

test("api-diff: passes when only additive changes exist", async () => {
  const root = await tmp();
  git(root, "init");
  git(root, "config", "user.email", "t@t.co");
  git(root, "config", "user.name", "t");
  await write(root, "src/routes.js", "const app = express();\napp.get('/x', h);\n");
  git(root, "add", "-A");
  git(root, "commit", "-m", "base");

  await write(root, "src/routes.js", "const app = express();\napp.get('/x', h); app.post('/y', h);\n");
  const result = await runGate("api-diff", root, { base: "HEAD" });
  assert.equal(result.status, "pass");
  assert.ok(result.findings.some((f) => f.severity === "info" && /POST \/y/.test(f.message)));
});
