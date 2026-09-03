import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createHash } from "node:crypto";
import { managedProviderPaths, prepareProviders, providerStatus, installProvider, inspectProjectProviderRuns, readProviderManifest } from "../dist/providers/index.js";

const fail = async (request) => ({ command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "missing", timedOut: false });
const digest = (value) => createHash("sha256").update(value).digest("hex");

test("provider status is honest when neither managed nor system executable exists", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "ei-provider-home-"));
  const status = await providerStatus("graphify", { providerHome: home, runner: fail });
  assert.equal(status.health, "missing");
  assert.match(status.message, /not installed/);
  assert.ok(status.remediation.some((line) => line.includes("providers install graphify")));
});

test("offline auto policy degrades to native evidence without pretending providers are healthy", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-provider-project-"));
  const home = await mkdtemp(path.join(os.tmpdir(), "ei-provider-home-"));
  const result = await prepareProviders(root, { offline: true, installMissing: true, providerHome: home, runner: fail });
  assert.equal(result.ok, true);
  assert.equal(result.degraded, true);
  assert.ok(result.statuses.every((status) => status.health === "degraded"));
  const manifest = await readProviderManifest(root);
  assert.equal(manifest.offline, true);
  assert.equal(manifest.providers.length, 2);
});

test("strict provider policy fails deterministically when providers are unavailable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-provider-project-"));
  const result = await prepareProviders(root, { requireProviders: true, providerHome: path.join(root, "home"), runner: fail });
  assert.equal(result.ok, false);
  assert.equal(result.degraded, true);
});

test("native policy disables both providers and remains healthy", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-provider-project-"));
  const result = await prepareProviders(root, { policy: "native", requireProviders: true, runner: fail });
  assert.equal(result.ok, true);
  assert.equal(result.degraded, false);
  assert.ok(result.statuses.every((status) => status.health === "disabled"));
});

test("managed install uses pinned uv spec and activates only after a healthy handshake", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "ei-provider-home-"));
  const paths = managedProviderPaths("graphify", home);
  let installed = false;
  const calls = [];
  const runner = async (request) => {
    calls.push([request.command, ...(request.args ?? [])]);
    if (request.command === "uv" && request.args?.[0] === "--version") {
      return { command: request.command, args: request.args, exitCode: 0, stdout: "uv 0.8.0", stderr: "", timedOut: false };
    }
    if (request.command === "uv" && request.args?.[0] === "tool") {
      installed = true;
      const executable = path.join(request.env.UV_TOOL_BIN_DIR, path.basename(paths.executable));
      await mkdir(path.dirname(executable), { recursive: true });
      await writeFile(executable, "managed graphify executable\n");
      return { command: request.command, args: request.args, exitCode: 0, stdout: "installed", stderr: "", timedOut: false };
    }
    if (request.command.endsWith(path.basename(paths.executable)) && installed) {
      return { command: request.command, args: request.args ?? [], exitCode: 0, stdout: "graphify 0.9.29", stderr: "", timedOut: false };
    }
    return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "missing", timedOut: false };
  };
  const status = await installProvider("graphify", { providerHome: home, runner });
  assert.equal(status.health, "healthy");
  assert.ok(calls.some((call) => call.join(" ").includes("graphifyy==0.9.29")));
  const current = JSON.parse(await readFile(path.join(home, "graphify", "current.json"), "utf8"));
  assert.equal(current.version, "0.9.29");
  assert.equal(current.executable, status.executable);
  assert.match(current.executable, /releases/);
  assert.ok(current.fingerprint);
});

test("provider install never attempts an administrator prerequisite when uv is missing", async () => {
  const calls = [];
  const runner = async (request) => {
    calls.push(request.command);
    return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "missing", timedOut: false };
  };
  const status = await installProvider("cce", { providerHome: await mkdtemp(path.join(os.tmpdir(), "ei-provider-home-")), runner });
  assert.equal(status.health, "unsupported");
  assert.deepEqual(calls, ["uv"]);
  assert.ok(!calls.some((command) => ["sudo", "apt", "dnf", "brew", "xcode-select"].includes(command)));
});

test("failed staged upgrade preserves the last healthy provider executable", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "ei-provider-home-"));
  const paths = managedProviderPaths("graphify", home);
  await mkdir(path.dirname(paths.executable), { recursive: true });
  await writeFile(paths.executable, "last healthy bytes\n");
  const runner = async (request) => {
    if (request.command === "uv" && request.args?.[0] === "--version") {
      return { command: request.command, args: request.args, exitCode: 0, stdout: "uv 0.8.0", stderr: "", timedOut: false };
    }
    if (request.command === "uv" && request.args?.[0] === "tool") {
      const staged = path.join(request.env.UV_TOOL_BIN_DIR, path.basename(paths.executable));
      await mkdir(path.dirname(staged), { recursive: true });
      await writeFile(staged, "broken staged bytes\n");
      return { command: request.command, args: request.args, exitCode: 0, stdout: "installed", stderr: "", timedOut: false };
    }
    if (request.command.includes(`${path.sep}releases${path.sep}`)) {
      return { command: request.command, args: request.args ?? [], exitCode: 0, stdout: "graphify 9.9.9", stderr: "", timedOut: false };
    }
    return { command: request.command, args: request.args ?? [], exitCode: 0, stdout: "graphify 0.9.29", stderr: "", timedOut: false };
  };
  const status = await installProvider("graphify", { providerHome: home, runner });
  assert.notEqual(status.health, "healthy");
  assert.equal(await readFile(paths.executable, "utf8"), "last healthy bytes\n");
});

test("managed provider activation rejects path escape and executable fingerprint tampering", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "ei-provider-home-"));
  const currentPath = path.join(home, "graphify", "current.json");
  await mkdir(path.dirname(currentPath), { recursive: true });
  await writeFile(currentPath, JSON.stringify({ executable: "/tmp/not-owned-by-ei", fingerprint: "bad" }));
  let status = await providerStatus("graphify", { providerHome: home, runner: fail });
  assert.equal(status.health, "error");
  assert.match(status.message, /outside EI/);

  const executable = path.join(home, "graphify", "0.9.29", "darwin-arm64", "releases", "abc", "bin", "graphify");
  await mkdir(path.dirname(executable), { recursive: true });
  await writeFile(executable, "tampered\n");
  await writeFile(currentPath, JSON.stringify({ executable, fingerprint: "0000" }));
  status = await providerStatus("graphify", { providerHome: home, runner: fail });
  assert.equal(status.health, "error");
  assert.match(status.message, /fingerprint changed/);
});

test("project provider run status detects current and stale source snapshots", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-provider-project-state-"));
  const provider = path.join(root, ".engineering-intelligence", "providers");
  const source = "export const ready = true;\n";
  const sourceHash = digest(source);
  const workspaceHash = digest(`src/main.ts:${sourceHash}`);
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(provider, "graphify"), { recursive: true });
  await mkdir(path.join(provider, "cce", "project", "workspace"), { recursive: true });
  await mkdir(path.join(provider, "cce", "project", "storage"), { recursive: true });
  await writeFile(path.join(root, "src", "main.ts"), source);
  await writeFile(path.join(provider, "graphify", "graph.json"), JSON.stringify({ nodes: [], edges: [] }));
  await writeFile(path.join(provider, "graphify", "run.json"), JSON.stringify({
    schemaVersion: 1, provider: "graphify", providerVersion: "0.9.29", generatedAt: new Date().toISOString(),
    workspaceHash, sourceHashes: { "src/main.ts": sourceHash }, command: [], graphPath: ".engineering-intelligence/providers/graphify/graph.json",
  }));
  await writeFile(path.join(provider, "cce", "run.json"), JSON.stringify({
    schemaVersion: 1, provider: "cce", providerVersion: "0.4.25", generatedAt: new Date().toISOString(),
    workspaceHash, sourceHashes: { "src/main.ts": sourceHash },
    indexedPath: path.join(provider, "cce", "project", "workspace"), storagePath: path.join(provider, "cce", "project", "storage"),
  }));
  let statuses = await inspectProjectProviderRuns(root);
  assert.ok(statuses.every((status) => status.health === "current" && status.fallback === false));
  await writeFile(path.join(root, "src", "main.ts"), "export const ready = false;\n");
  statuses = await inspectProjectProviderRuns(root);
  assert.ok(statuses.every((status) => status.health === "stale" && status.fallback === true));
});
