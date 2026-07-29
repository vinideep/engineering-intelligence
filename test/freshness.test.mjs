/**
 * Freshness honesty tests.
 *
 * The scorer previously awarded a full 100/"fresh" to any document lacking
 * evidence citations, so an empty placeholder outscored a conscientious doc that
 * cited real sources and had one drift — inverting the incentive the product
 * depends on. It also meant this repo's own report said "Proceed" permanently.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { computeFreshness } from "../dist/freshness/index.js";

async function repoWithDocs(docs, sources = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "ei-fresh-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init");
  git("config", "user.email", "t@t.co");
  git("config", "user.name", "t");
  for (const [rel, content] of Object.entries(sources)) {
    const abs = path.join(root, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
  const kb = path.join(root, ".engineering-intelligence", "knowledge-base");
  await mkdir(kb, { recursive: true });
  for (const [name, content] of Object.entries(docs)) {
    await writeFile(path.join(kb, name), content, "utf8");
  }
  git("add", "-A");
  git("commit", "-m", "base");
  return root;
}

const score = (report, name) => report.scores.find((s) => s.docPath.endsWith(name));

test("a document with no evidence citations is unverifiable, not fresh", async () => {
  const root = await repoWithDocs({
    "00-placeholder.md": "# Architecture\n\nTODO: describe the system.\n",
  });
  const report = await computeFreshness(root);
  const doc = score(report, "00-placeholder.md");

  assert.equal(doc.status, "unverifiable", "an uncited doc cannot be called fresh");
  assert.notEqual(doc.score, 100, "a placeholder must not score a perfect 100");
  assert.equal(doc.action, "manual-review");
});

test("a cited document is scored, and beats an uncited one", async () => {
  const root = await repoWithDocs(
    {
      "01-cited.md": "Last updated: 2099-01-01\n\nThe entry point is here (evidence: src/app.ts).\n",
      "02-uncited.md": "# Notes\n\nNo citations at all.\n",
    },
    { "src/app.ts": "export const app = 1;\n" },
  );
  const report = await computeFreshness(root);
  const cited = score(report, "01-cited.md");
  const uncited = score(report, "02-uncited.md");

  assert.equal(cited.status, "fresh", "a doc citing a real, unchanged source is fresh");
  assert.ok(cited.score > uncited.score, "citing evidence must never score worse than citing nothing");
});

test("a citation to a deleted source is penalized", async () => {
  const root = await repoWithDocs({
    "03-ghost.md": "Last updated: 2099-01-01\n\nSee (evidence: src/deleted.ts).\n",
  });
  const report = await computeFreshness(root);
  const doc = score(report, "03-ghost.md");
  assert.deepEqual(doc.deletedSources, ["src/deleted.ts"]);
  assert.ok(doc.score < 100, "a dangling citation must cost something");
});

test("unverifiable documents do not, by themselves, block implementation", async () => {
  // Absence of evidence is missing information, not proof of drift. Counting an
  // uncited doc as score 0 would block every edit in any repo containing one.
  const root = await repoWithDocs({ "04-empty.md": "# Nothing here\n" });
  const report = await computeFreshness(root);
  assert.equal(report.scores.length, 1);
  assert.equal(report.scores[0].status, "unverifiable");
  assert.equal(report.driftDecision, "Proceed", "must stay fail-safe");
});

test("a genuinely stale cited document does drive the drift decision", async () => {
  const root = await repoWithDocs(
    { "05-stale.md": "Last updated: 2020-01-01\n\nSee (evidence: src/a.ts) and (evidence: src/gone.ts).\n" },
    { "src/a.ts": "export const a = 1;\n" },
  );
  const report = await computeFreshness(root);
  const doc = score(report, "05-stale.md");
  assert.ok(doc.score < 60, `an old doc with a dangling citation should score low, got ${doc.score}`);
  assert.notEqual(report.driftDecision, "Proceed", "real staleness must still surface");
});
