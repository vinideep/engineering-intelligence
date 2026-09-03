import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseCceSearchOutput, runCceIndex, searchCodeContext } from "../dist/providers/cce.js";

const digest = (value) => createHash("sha256").update(value).digest("hex");

test("CCE parser accepts human and JSON result formats", () => {
  assert.deepEqual(parseCceSearchOutput("1. src/auth.ts:12-24 function login\n2) test/auth.test.ts:4"), [
    { path: "src/auth.ts", startLine: 12, endLine: 24 },
    { path: "test/auth.test.ts", startLine: 4, endLine: 4 },
  ]);
  assert.deepEqual(parseCceSearchOutput(JSON.stringify({ results: [{ file: "src/api.ts", start_line: 3, end_line: 8, score: 0.9 }] })), [
    { path: "src/api.ts", startLine: 3, endLine: 8, score: 0.9 },
  ]);
});

async function indexedFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-cce-"));
  const provider = path.join(root, ".engineering-intelligence", "providers");
  const content = "export function authenticate(token: string) {\n  return token.length > 0;\n}\n";
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(provider, "cce", "project"), { recursive: true });
  await mkdir(path.join(provider, "cce", "project", "workspace", "src"), { recursive: true });
  await mkdir(path.join(provider, "cce", "project", "storage"), { recursive: true });
  await writeFile(path.join(root, "src", "auth.ts"), content);
  await writeFile(path.join(provider, "cce", "project", "workspace", "src", "auth.ts"), content);
  await writeFile(path.join(provider, "cce", "run.json"), JSON.stringify({
    schemaVersion: 1,
    provider: "cce",
    providerVersion: "0.4.25",
    generatedAt: new Date().toISOString(),
    workspaceHash: digest(`src/auth.ts:${digest(content)}`),
    sourceHashes: { "src/auth.ts": digest(content) },
    indexedPath: path.join(provider, "cce", "project", "workspace"),
    storagePath: path.join(provider, "cce", "project", "storage"),
  }));
  return { root, provider, content };
}

test("CCE retrieval overfetches but returns only current EI-approved source spans", async () => {
  const fx = await indexedFixture();
  const calls = [];
  const runner = async (request) => {
    calls.push(request);
    if (request.args?.[0] === "--version") return { command: request.command, args: request.args, exitCode: 0, stdout: "cce 0.4.25", stderr: "", timedOut: false };
    if (request.args?.[0] === "search") {
      return { command: request.command, args: request.args, exitCode: 0, stdout: "1. src/auth.ts:1-3\n2. ../../../../outside.ts:1-5\n", stderr: "", timedOut: false };
    }
    return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "unexpected", timedOut: false };
  };
  const result = await searchCodeContext(fx.root, "authenticate token", ["src"], { topK: 5, runner, providerHome: path.join(fx.root, "provider-home") });
  assert.equal(result.provider, "cce");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0].path, "src/auth.ts");
  assert.equal(result.chunks[0].content, fx.content.trimEnd());
  assert.ok(result.scopeRejected > 0);
  assert.ok(calls.find((call) => call.args?.[0] === "search").args.includes("20"), "small requests should overfetch for scope filtering");
});

test("stale CCE hits are rejected and native scoped retrieval takes over", async () => {
  const fx = await indexedFixture();
  await writeFile(path.join(fx.root, "src", "auth.ts"), "export const authenticate = () => true;\n");
  const runner = async (request) => request.args?.[0] === "--version"
    ? { command: request.command, args: request.args, exitCode: 0, stdout: "cce 0.4.25", stderr: "", timedOut: false }
    : { command: request.command, args: request.args ?? [], exitCode: 0, stdout: "1. src/auth.ts:1\n", stderr: "", timedOut: false };
  const result = await searchCodeContext(fx.root, "authenticate", ["src"], { runner, providerHome: path.join(fx.root, "provider-home") });
  assert.equal(result.provider, "native");
  assert.equal(result.fallbackUsed, true);
  assert.match(result.message, /stale/);
  assert.equal(result.chunks[0].path, "src/auth.ts");
  assert.equal(result.chunks[0].provider, "native");
});

test("CCE initialization occurs only in the provider sandbox, never in the source repository", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-cce-init-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "main.ts"), "export const main = true;\n");
  const calls = [];
  const runner = async (request) => {
    calls.push(request);
    if (request.args?.[0] === "--version") return { command: request.command, args: request.args, exitCode: 0, stdout: "cce 0.4.25", stderr: "", timedOut: false };
    return { command: request.command, args: request.args ?? [], exitCode: 0, stdout: "ok", stderr: "", timedOut: false };
  };
  const result = await runCceIndex(root, { runner, providerHome: path.join(root, "provider-home") });
  assert.equal(result.ok, true);
  const index = calls.find((call) => call.args?.[0] === "index");
  assert.equal(calls.some((call) => call.args?.[0] === "init"), false, "EI must not let CCE install competing hooks/MCP instructions");
  assert.notEqual(path.resolve(index.cwd), path.resolve(root));
  assert.match(index.cwd, /\.engineering-intelligence[\\/]providers[\\/]cce[\\/]project$/);
  assert.equal(index.env.CCE_EMBED_BACKEND, "fastembed");
  assert.match(index.env.CCE_FASTEMBED_CACHE_PATH, /provider-home[\\/]cce[\\/]models$/);
  const config = await readFile(path.join(index.cwd, ".context-engine.yaml"), "utf8");
  assert.match(config, /storage:\n  path:/);
  assert.match(config, /watch: false/);
  assert.ok(index.args.includes("--full"));
  assert.ok(index.args.includes("--path"));
  assert.match(index.args[index.args.indexOf("--path") + 1], /\.engineering-intelligence[\\/]providers[\\/]cce[\\/]project[\\/]workspace$/);
  const manifest = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "providers", "cce", "run.json"), "utf8"));
  assert.equal(manifest.sourceHashes["src/main.ts"], digest("export const main = true;\n"));
  assert.match(manifest.storagePath, /\.engineering-intelligence[\\/]providers[\\/]cce[\\/]project[\\/]storage$/);
});
