import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runInitialization } from "../dist/orchestrators/initialize.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-initialize-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "a.ts"), "import { b } from './b.js';\nexport const a = b;\n");
  await writeFile(path.join(root, "src", "b.ts"), "export const b = true;\n");
  return root;
}

test("one initialization pipeline produces EI-owned graph, claims, CCE index metadata, and synthesis brief", async () => {
  const root = await fixture();
  const calls = [];
  const runner = async (request) => {
    calls.push(request);
    if (request.command === "git") return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "not a git repo", timedOut: false };
    if (request.command.includes(path.sep)) return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "managed missing", timedOut: false };
    if (request.command === "graphify" && request.args?.[0] === "--version") return { command: request.command, args: request.args, exitCode: 0, stdout: "graphify 0.9.29", stderr: "", timedOut: false };
    if (request.command === "cce" && request.args?.[0] === "--version") return { command: request.command, args: request.args, exitCode: 0, stdout: "cce 0.4.25", stderr: "", timedOut: false };
    if (request.command === "graphify" && request.args?.[0] === "extract") {
      const workspace = request.args[1];
      const output = request.args[request.args.indexOf("--out") + 1];
      const actualOutput = path.join(output, "graphify-out");
      await mkdir(actualOutput, { recursive: true });
      await writeFile(path.join(actualOutput, "graph.json"), JSON.stringify({
        nodes: [
          { id: "a", label: "a", source_file: path.join(workspace, "src", "a.ts"), confidence: "EXTRACTED" },
          { id: "b", label: "b", source_file: path.join(workspace, "src", "b.ts"), confidence: "EXTRACTED" },
        ],
        edges: [{ source: "a", target: "b", relation: "IMPORTS_FROM", confidence: "EXTRACTED", source_file: "src/a.ts", source_location: "L1" }],
      }));
      await writeFile(path.join(actualOutput, "GRAPH_REPORT.md"), "# Raw Graphify report\n");
      return { command: request.command, args: request.args, exitCode: 0, stdout: "extracted", stderr: "", timedOut: false };
    }
    if (request.command === "cce" && request.args?.[0] === "index") return { command: request.command, args: request.args, exitCode: 0, stdout: "ok", stderr: "", timedOut: false };
    return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "unexpected", timedOut: false };
  };

  const result = await runInitialization(root, { ides: ["generic"], packageVersion: "3.5.0", policy: "full", runner, providerHome: path.join(root, "shared-provider-home") });
  assert.equal(result.ok, true);
  assert.equal(result.providers.degraded, false);
  assert.equal(result.graphify.ok, true);
  assert.equal(result.cce.ok, true);
  assert.ok(result.evidence.claims.total > 0);
  assert.equal(result.evidence.knowledge.status, "ready");
  assert.ok(result.evidence.graph.graphifyCorroboratedEdges > 0);
  assert.ok(result.evidence.source.approvedFiles > 0);
  assert.ok(!Object.keys(result.evidence.source.languages).includes("generated"));
  const graph = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json"), "utf8"));
  assert.ok(graph.edges.some((edge) => edge.metadata.corroborated === true));
  assert.match(await readFile(path.join(root, ".engineering-intelligence", "providers", "graphify", "GRAPH_REPORT.md"), "utf8"), /Raw Graphify report/);
  const claims = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "claims", "claims.json"), "utf8"));
  assert.ok(claims.claims.length > 0);
  assert.match(await readFile(path.join(root, ".engineering-intelligence", "context", "KNOWLEDGE-GENERATION-BRIEF.md"), "utf8"), /EI owns the canonical knowledge base/);
  assert.match(await readFile(path.join(root, ".engineering-intelligence", "knowledge-base", "00-project-overview.md"), "utf8"), /EI owns canonical knowledge/);
  const evidenceHashes = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "knowledge-base", ".evidence-hashes.json"), "utf8"));
  assert.ok(evidenceHashes.hashes.length > 0);
  assert.match(await readFile(path.join(root, ".engineering-intelligence", ".gitignore"), "utf8"), /^providers\/$/m);
  const config = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "ei.config.json"), "utf8"));
  assert.equal(config.providers.policy, "full");
  const cceIndex = calls.find((call) => call.command === "cce" && call.args?.[0] === "index");
  assert.ok(cceIndex);
  assert.notEqual(path.resolve(cceIndex.cwd), path.resolve(root));
  assert.equal(calls.some((call) => call.command === "cce" && call.args?.[0] === "init"), false);
});

test("native-only initialization is explicit and does not pretend provider evidence exists", async () => {
  const root = await fixture();
  const result = await runInitialization(root, { ides: ["generic"], packageVersion: "3.5.0", policy: "native", runner: async (request) => ({ command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "unavailable", timedOut: false }), providerHome: path.join(root, "shared-provider-home") });
  assert.equal(result.ok, true);
  assert.equal(result.degraded, false);
  assert.ok(result.providers.statuses.every((status) => status.health === "disabled"));
  assert.equal(result.graphify.ok, false);
  assert.equal(result.cce.ok, false);
  assert.ok(result.evidence.graph.nodes > 0);
  assert.ok(result.evidence.claims.total > 0);
  const config = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "ei.config.json"), "utf8"));
  assert.equal(config.providers.policy, "native");
});

test("omitting provider policy keeps providers optional and preserves native fallback", async () => {
  const root = await fixture();
  const unavailable = async (request) => ({ command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "provider unavailable", timedOut: false });
  const result = await runInitialization(root, {
    ides: ["generic"],
    packageVersion: "4.2.0",
    runner: unavailable,
    providerHome: path.join(root, "shared-provider-home"),
  });

  assert.equal(result.ok, true, "optional providers must not block initialization");
  assert.equal(result.degraded, true, "the provider fallback must remain visible");
  assert.equal(result.providers.policy, "auto");
  assert.equal(result.providers.statuses.every((status) => status.health === "unsupported"), true);
  const config = JSON.parse(await readFile(path.join(root, ".engineering-intelligence", "ei.config.json"), "utf8"));
  assert.equal(config.providers.policy, "auto");
  assert.equal(config.providers.requireProviders, false);
});

test("required-provider initialization fails when a healthy binary cannot extract or index", async () => {
  const root = await fixture();
  const runner = async (request) => {
    if (request.command === "git") return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "not a git repo", timedOut: false };
    if (request.command.includes(path.sep)) return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "managed missing", timedOut: false };
    if (request.command === "graphify" && request.args?.[0] === "--version") return { command: request.command, args: request.args, exitCode: 0, stdout: "graphify 0.9.29", stderr: "", timedOut: false };
    if (request.command === "cce" && request.args?.[0] === "--version") return { command: request.command, args: request.args, exitCode: 0, stdout: "cce 0.4.25", stderr: "", timedOut: false };
    return { command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "provider execution failed", timedOut: false };
  };
  const result = await runInitialization(root, {
    ides: ["generic"],
    packageVersion: "3.5.0",
    policy: "full",
    requireProviders: true,
    runner,
    providerHome: path.join(root, "shared-provider-home"),
  });
  assert.equal(result.providers.ok, true, "binary handshakes should pass");
  assert.equal(result.graphify.ok, false);
  assert.equal(result.cce.ok, false);
  assert.equal(result.degraded, true);
  assert.equal(result.ok, false, "required mode must cover provider execution, not only installation");
});
