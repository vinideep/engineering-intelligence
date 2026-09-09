/**
 * get_context tests — the pack must (1) surface the graph neighborhood of touched
 * files, (2) include only VERIFIED claims (stale facts excluded), (3) respect the
 * token budget, trimming lowest-priority sections first, and (4) degrade gracefully
 * when no intelligence exists.
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { getContext } from "../dist/context/index.js";
import { buildGraph } from "../dist/graph/index.js";
import { addClaim } from "../dist/claims/index.js";
import { estimateTokens } from "../dist/token-optimizer.js";

async function tmp() { return mkdtemp(path.join(tmpdir(), "ei-ctx-")); }
async function write(root, rel, content) {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
}

async function fixture() {
  const root = await tmp();
  await write(root, "src/pay.ts", "export function charge() {\n  return 1;\n}\n");
  await write(root, "src/checkout.ts", "import { charge } from './pay.js';\nexport function checkout() { return charge(); }\n");
  await buildGraph(root);
  return root;
}

test("pack includes the graph neighborhood: dependents of the touched file", async () => {
  const root = await fixture();
  try {
    const pack = await getContext(root, { task: "change charge", files: ["src/pay.ts"] });
    assert.match(pack.markdown, /Graph neighborhood/);
    assert.match(pack.markdown, /src\/checkout/, "checkout depends on pay and should appear");
    assert.ok(pack.included.includes("graph-neighborhood"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("pack serves asserted claims as unverified, and drops them when stale", async () => {
  const root = await fixture();
  try {
    await addClaim(root, { statement: "charge returns cents", evidence: [{ path: "src/pay.ts", lines: [1, 3] }], author: "tester" });
    let pack = await getContext(root, { task: "refunds", files: ["src/pay.ts"] });
    assert.match(pack.markdown, /charge returns cents/, "an anchored assertion is still served...");
    assert.match(pack.markdown, /Unverified assertions/, "...but only under the unverified heading");

    // Mutate the cited lines → claim goes stale → must be excluded.
    await write(root, "src/pay.ts", "export function charge() {\n  return refund();\n}\n");
    pack = await getContext(root, { task: "refunds", files: ["src/pay.ts"] });
    assert.doesNotMatch(pack.markdown, /charge returns cents/, "stale claim must not be served");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("token budget is respected and lower-priority sections are trimmed first", async () => {
  const root = await fixture();
  try {
    await addClaim(root, { statement: "charge is the core billing entry point used across checkout", evidence: [{ path: "src/pay.ts", lines: [1, 3] }], author: "tester" });
    await write(root, ".engineering-intelligence/memory/coding-patterns.md", Array.from({ length: 50 }, (_, i) => `- convention line ${i} with some descriptive text`).join("\n"));

    const pack = await getContext(root, { task: "refund support in charge", files: ["src/pay.ts"], budget: 80 });
    assert.ok(pack.tokensEstimated <= pack.budget, `pack ${pack.tokensEstimated} must fit budget ${pack.budget}`);
    // Under pressure the highest-priority sections survive and conventions are trimmed.
    assert.ok(pack.included.length > 0, `something must survive: ${JSON.stringify(pack)}`);
    assert.ok(pack.omitted.includes("conventions"), `conventions should be trimmed under a tight budget: ${JSON.stringify(pack)}`);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("no intelligence → graceful, non-empty guidance", async () => {
  const root = await tmp();
  try {
    const pack = await getContext(root, { task: "anything" });
    assert.match(pack.markdown, /Context for: anything/);
    assert.match(pack.markdown, /initialize-engineering-intelligence/);
    assert.equal(pack.included.length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("estimated tokens never exceed the requested budget", async () => {
  const root = await fixture();
  try {
    for (let i = 0; i < 10; i++) {
      await addClaim(root, { statement: `fact number ${i} about the payment subsystem and its many collaborators`, evidence: [{ path: "src/pay.ts", lines: [1, 3] }], author: "tester" });
    }
    for (const budget of [50, 120, 500]) {
      const pack = await getContext(root, { task: "billing", files: ["src/pay.ts"], budget });
      assert.ok(pack.tokensEstimated <= budget, `budget ${budget}: got ${pack.tokensEstimated}`);
      assert.equal(pack.tokensEstimated, estimateTokens(pack.markdown));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
