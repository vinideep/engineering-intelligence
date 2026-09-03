/**
 * The derived/asserted split.
 *
 * The failure this prevents: an anchor proves a symbol still EXISTS; it does not
 * prove the sentence bound to it is TRUE. A claim like "the auth endpoint is
 * rate-limited", anchored to a handler with no rate limiting, resolves fine,
 * hashes cleanly, and under the old model reported `verified` forever — an
 * expensive mtime wearing a green checkmark, and worse than no claim because it
 * is trusted.
 *
 * Derived claims are RENDERED from a machine-extracted descriptor, so verifying
 * them re-computes the sentence. Asserted claims are free text and can never
 * earn the word "verified".
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  addClaim,
  deriveClaims,
  verifyClaims,
  loadClaims,
  claimKind,
} from "../dist/claims/index.js";
import { deriveFacts, factKey, renderFact } from "../dist/claims/derive.js";
import { getContext } from "../dist/context/index.js";
import { buildGraph } from "../dist/graph/index.js";

async function project(files) {
  const root = await mkdtemp(path.join(tmpdir(), "ei-derived-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
  return root;
}

const SAMPLE = {
  "package.json": JSON.stringify({ name: "demo", dependencies: { express: "^4" } }),
  "src/auth.ts": "export function requireUser(req, res, next) { next(); }\n",
  "src/routes.ts": "import { helper } from 'undeclared-helper';\nimport { requireUser } from './auth.js';\nconst app = express();\napp.get('/users', requireUser, h);\n",
};

test("deriveFacts computes imports, dependencies and routes from source", async () => {
  const root = await project(SAMPLE);
  const facts = await deriveFacts(root);
  const keys = facts.map(factKey);

  assert.ok(keys.includes("module-imports|src/routes.ts|src/auth.ts"), `expected the import fact, got: ${keys.join(", ")}`);
  assert.ok(keys.includes("package-dependency|express"));
  assert.ok(!keys.includes("package-dependency|undeclared-helper"), "an imported package is not necessarily a declared dependency");
  assert.ok(keys.includes("http-route|GET|/users|src/routes.ts"));
  await rm(root, { recursive: true, force: true });
});

test("provider-only structural evidence cannot be promoted into a derived EI claim", async () => {
  const root = await project(SAMPLE);
  await buildGraph(root); // writes the canonical graph fixture
  const graphPath = path.join(root, ".engineering-intelligence/graph/dependency-graph.json");
  const graph = JSON.parse(await readFile(graphPath, "utf8"));
  graph.edges.push({
    from: "module:src/auth",
    to: "module:src/routes",
    relation: "imports",
    confidence: "inferred",
    metadata: {
      provider: "graphify",
      providerVersion: "test",
      trustState: "unverifiable",
      corroborated: false,
    },
    evidence: ["src/auth.ts:1"],
  });
  await writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");

  const keys = (await deriveFacts(root)).map(factKey);
  assert.ok(!keys.includes("module-imports|src/auth.ts|src/routes.ts"));
  await deriveClaims(root);
  const store = await loadClaims(root);
  assert.ok(!store.claims.some((claim) => claim.statement === "Module `src/auth.ts` imports `src/routes.ts`."));
  await rm(root, { recursive: true, force: true });
});

test("a derived statement is generated from its descriptor, not authored", () => {
  const fact = { type: "http-route", method: "GET", route: "/users", file: "src/routes.ts", evidence: "src/routes.ts" };
  assert.equal(renderFact(fact), "HTTP route `GET /users` is defined in `src/routes.ts`.");
});

test("derived claims verify by RE-DERIVATION, and are refuted when no longer true", async () => {
  const root = await project(SAMPLE);
  const { total } = await deriveClaims(root);
  assert.ok(total >= 3, `expected several derived facts, got ${total}`);

  let report = await verifyClaims(root);
  assert.equal(report.refuted, 0);
  assert.ok(report.verified >= 3, "derived facts re-derive cleanly against unchanged source");

  // Delete the route. Its ANCHOR (src/routes.ts) still exists and still hashes —
  // only re-derivation can notice the endpoint is gone.
  await writeFile(path.join(root, "src/routes.ts"), "import { requireUser } from './auth.js';\nconst app = express();\n", "utf8");
  report = await verifyClaims(root);

  const route = report.results.find((r) => r.statement.includes("GET /users"));
  assert.equal(route.status, "refuted", "a fact that stopped being true must be refuted, not silently verified");
  assert.equal(route.missingEvidence.length, 0, "the anchor is intact — hashing alone would have missed this");
  await rm(root, { recursive: true, force: true });
});

test("a false asserted claim can never report verified", async () => {
  const root = await project(SAMPLE);
  // The canonical failure: a true-sounding sentence anchored to real code that
  // does not support it.
  await addClaim(root, {
    statement: "The auth endpoint is rate-limited.",
    evidence: [{ path: "src/auth.ts" }],
    author: "alice",
  });

  const report = await verifyClaims(root);
  const claim = report.results.find((r) => r.statement.includes("rate-limited"));
  assert.equal(claim.kind, "asserted");
  assert.equal(claim.status, "unverified", "unchecked prose must never be labelled verified");
  assert.equal(report.verified, 0, "no claim earns 'verified' without re-derivation");
  await rm(root, { recursive: true, force: true });
});

test("asserted claims require an author, so unchecked statements always have an owner", async () => {
  const root = await project(SAMPLE);
  await assert.rejects(
    () => addClaim(root, { statement: "something", evidence: [{ path: "src/auth.ts" }], author: "" }),
    /author/i,
  );
  await rm(root, { recursive: true, force: true });
});

test("legacy claims without a kind are read as asserted, never as fact", async () => {
  const root = await project(SAMPLE);
  await mkdir(path.join(root, ".engineering-intelligence/claims"), { recursive: true });
  // A store written before the split: free text, confidence "verified".
  await writeFile(
    path.join(root, ".engineering-intelligence/claims/claims.json"),
    JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date(0).toISOString(),
      claims: [{
        id: "CLM-0001",
        statement: "Everything is fine.",
        evidence: [{ path: "src/auth.ts", contentHash: "deadbeefdeadbeef" }],
        confidence: "verified",
        lastVerified: new Date(0).toISOString(),
      }],
    }),
    "utf8",
  );

  const store = await loadClaims(root);
  assert.equal(claimKind(store.claims[0]), "asserted", "a legacy claim must not be promoted to fact");
  const report = await verifyClaims(root);
  assert.equal(report.verified, 0);
  await rm(root, { recursive: true, force: true });
});

test("deriveClaims regenerates facts without touching the user's assertions", async () => {
  const root = await project(SAMPLE);
  await addClaim(root, { statement: "A note worth keeping.", evidence: [{ path: "src/auth.ts" }], author: "bob" });
  await deriveClaims(root);
  await deriveClaims(root); // idempotent re-run

  const store = await loadClaims(root);
  const asserted = store.claims.filter((c) => claimKind(c) === "asserted");
  assert.equal(asserted.length, 1, "the user's note survives regeneration exactly once");
  assert.equal(asserted[0].statement, "A note worth keeping.");
  await rm(root, { recursive: true, force: true });
});

test("get_context serves derived facts and quarantines assertions", async () => {
  const root = await project(SAMPLE);
  await deriveClaims(root);
  await addClaim(root, {
    statement: "The auth endpoint is rate-limited.",
    evidence: [{ path: "src/auth.ts" }],
    author: "alice",
  });

  const pack = await getContext(root, { task: "auth routes users", budget: 4000 });
  const text = pack.markdown;

  assert.match(text, /Verified facts \(re-derived from current source\)/);
  assert.match(text, /Unverified assertions/, "assertions must be served under their own, explicit heading");
  // The unproven sentence must never appear beneath the verified heading.
  const verifiedSection = text.split("## Unverified assertions")[0];
  assert.ok(!verifiedSection.includes("rate-limited"), "an unchecked claim must not be presented as a verified fact");
  await rm(root, { recursive: true, force: true });
});
