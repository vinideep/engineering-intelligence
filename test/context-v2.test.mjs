import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { deriveClaims } from "../dist/claims/index.js";
import { getEngineeringContext } from "../dist/context/orchestrator.js";
import { recordEvidenceHashes } from "../dist/evidence/index.js";
import { buildGraph } from "../dist/graph/index.js";

const missingProvider = async (request) => ({ command: request.command, args: request.args ?? [], exitCode: 1, stdout: "", stderr: "missing", timedOut: false });

async function write(root, relative, content) {
  const absolute = path.join(root, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content);
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ei-context-v2-"));
  await write(root, "src/pay.ts", "export function charge(amount: number) {\n  return amount > 0;\n}\n");
  await write(root, "src/checkout.ts", "import { charge } from './pay.js';\nexport const checkout = () => charge(10);\n");
  await write(root, "test/pay.test.ts", "import { charge } from '../src/pay.js';\nexport const passes = charge(10);\n");
  await write(root, "dist/generated.js", "export const charge = 'generated';\n");
  await buildGraph(root);
  await deriveClaims(root);
  await write(root, ".engineering-intelligence/knowledge-base/system-overview.md", "# Billing system\n\nThe charge implementation is in `src/pay.ts:1`.\n");
  await recordEvidenceHashes(root);
  return root;
}

test("ContextPackV2 is knowledge-first, graph-scoped, hash-pinned, and fallback-safe", async () => {
  const root = await fixture();
  const pack = await getEngineeringContext(root, { task: "change billing charge", files: ["src/pay.ts"], budget: 3000 }, { runner: missingProvider, providerHome: path.join(root, "missing-providers") });
  assert.equal(pack.schemaVersion, 2);
  assert.equal(pack.knowledge.trust, "healthy");
  assert.ok(pack.knowledge.documents.some((document) => document.path.endsWith("system-overview.md")));
  assert.ok(pack.architecture.nodes.some((node) => node.path === "src/pay.ts"));
  assert.ok(pack.architecture.nodes.some((node) => node.path === "src/checkout.ts"));
  assert.ok(!pack.architecture.approvedScope.some((scope) => scope.startsWith("dist/")));
  assert.equal(pack.providers.cce.fallback, true);
  assert.ok([...pack.code.primary, ...pack.code.secondary, ...pack.code.tests].length > 0);
  assert.ok(pack.evidence.every((item) => item.current && /^[a-f0-9]{64}$/.test(item.hash)));
  assert.ok(pack.risk.testsToRun.includes("test/pay.test.ts"));
  assert.ok(pack.claims.length > 0, "derived current claims should be available");
  assert.ok(pack.tokenAllocation.used <= pack.tokenAllocation.budget);
});

test("ContextPackV2 does not promote drifted EI prose as verified knowledge", async () => {
  const root = await fixture();
  await write(root, "src/pay.ts", "export function chargePayment(amount: number) {\n  return amount >= 0;\n}\n");
  const pack = await getEngineeringContext(root, { task: "fix charge", files: ["src/pay.ts"], budget: 2500 }, { runner: missingProvider, providerHome: path.join(root, "missing-providers") });
  assert.equal(pack.knowledge.trust, "degraded");
  assert.equal(pack.knowledge.documents.length, 0);
  assert.ok(pack.unknowns.some((item) => item.includes("stale citation")));
  const conflictedIds = new Set(pack.conflicts.map((item) => item.split(" ")[0]));
  assert.ok(pack.claims.every((claim) => !conflictedIds.has(claim.id)), "stale or refuted claim ids cannot also be served as facts");
});

test("ContextPackV2 task router applies adaptive security budget and gates", async () => {
  const root = await fixture();
  const pack = await getEngineeringContext(root, { task: "add authentication rate limiting", files: ["src/pay.ts"] }, { runner: missingProvider, providerHome: path.join(root, "missing-providers") });
  assert.equal(pack.classification.kind, "security-change");
  assert.equal(pack.classification.risk, "critical");
  assert.equal(pack.tokenAllocation.budget, 15_000);
  assert.ok(pack.classification.route.includes("security-gates"));
  assert.ok(pack.risk.requiredGates.includes("security review"));
});

test("unverifiable provider-only edges cannot expand the approved retrieval neighborhood", async () => {
  const root = await fixture();
  await write(root, "src/untrusted.ts", "export const untrusted = true;\n");
  await buildGraph(root);
  const graphPath = path.join(root, ".engineering-intelligence", "graph", "dependency-graph.json");
  const graph = JSON.parse(await readFile(graphPath, "utf8"));
  graph.edges.push({
    from: "module:src/pay",
    to: "module:src/untrusted",
    relation: "uses",
    confidence: "inferred",
    metadata: { provider: "graphify", trustState: "unverifiable", corroborated: false },
    evidence: ["src/pay.ts:1"],
  });
  await writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
  const pack = await getEngineeringContext(root, { task: "change billing charge", files: ["src/pay.ts"], budget: 3000 }, { runner: missingProvider, providerHome: path.join(root, "missing-providers") });
  assert.ok(!pack.architecture.nodes.some((node) => node.path === "src/untrusted.ts"));
  assert.ok(!pack.architecture.edges.some((edge) => edge.trustState === "unverifiable"));
  assert.ok(!pack.architecture.approvedScope.includes("src/untrusted.ts"));
});
