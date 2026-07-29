#!/usr/bin/env node
/**
 * Derived-fact replay benchmark.
 *
 * The question this answers — and the reason it is not an agent benchmark:
 *
 *   ETH Zurich measured LLM-generated repository context files at −3% task
 *   success across 5,694 PRs. A solo harness cannot resolve an effect that small,
 *   so any "our toolkit makes agents N% better" number would be noise dressed as
 *   evidence. This measures something a skeptic can audit in ten minutes instead:
 *   when real commits land, does the derived-fact layer NOTICE, and how much does
 *   it cry wolf?
 *
 * Method: for each commit in a window, materialise the tree before and after in a
 * throwaway git worktree, derive the fact set at both points, and diff them. No
 * model is invoked at any stage, so re-running on the same repo and range gives
 * byte-identical output.
 *
 * Reported per commit:
 *   added / removed   — facts that started or stopped being true
 *   sourceTouched     — did the commit change files the derivation can even see
 *   blind             — source changed but the fact set did not move at all
 *
 * And in aggregate:
 *   detectionRate     — of commits that touched derivable source, the share where
 *                       the fact set moved. Low means the layer is blind to real work.
 *   medianChurn       — facts changed per detected commit. High means noisy: a
 *                       reviewer drowning in deltas ignores all of them.
 *
 * Usage:
 *   node bench/replay.mjs [repoPath] [--commits 30] [--json]
 *
 * Publish the numbers WITH this script and the commit range. A benchmark that is
 * only published when it flatters the tool is worth less than no benchmark.
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { deriveFacts, factKey } = await import(path.resolve(__dirname, "../dist/claims/derive.js"));

function git(repo, args, opts = {}) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts }).trim();
}

const DERIVABLE = /\.(tsx?|jsx?|mjs|cjs)$|(^|\/)package\.json$/;

function parseArgs(argv) {
  const out = { repo: process.cwd(), commits: 30, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--commits") out.commits = parseInt(argv[++i], 10);
    else if (a.startsWith("--commits=")) out.commits = parseInt(a.slice(10), 10);
    else if (a === "--json") out.json = true;
    else if (!a.startsWith("-")) out.repo = path.resolve(a);
  }
  return out;
}

/** Derive the fact set for a commit by materialising it in a throwaway worktree. */
async function factsAt(repo, sha) {
  const dir = await mkdtemp(path.join(tmpdir(), "ei-bench-"));
  const wt = path.join(dir, "tree");
  try {
    git(repo, ["worktree", "add", "--detach", "--quiet", wt, sha], { stdio: "pipe" });
    const facts = await deriveFacts(wt);
    return new Set(facts.map(factKey));
  } catch {
    return null; // unbuildable checkout — reported, never silently counted as "no change"
  } finally {
    try { git(repo, ["worktree", "remove", "--force", wt], { stdio: "pipe" }); } catch { /* best effort */ }
    await rm(dir, { recursive: true, force: true });
  }
}

function median(values) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

async function main() {
  const { repo, commits, json } = parseArgs(process.argv.slice(2));

  let shas;
  try {
    shas = git(repo, ["log", `-n${commits}`, "--format=%H", "--no-merges"]).split("\n").filter(Boolean);
  } catch {
    process.stderr.write(`Not a git repository: ${repo}\n`);
    process.exit(2);
  }
  if (shas.length < 2) {
    process.stderr.write("Need at least 2 commits of history.\n");
    process.exit(2);
  }

  const rows = [];
  let skipped = 0;

  for (const sha of shas) {
    let parent;
    try { parent = git(repo, ["rev-parse", `${sha}^`]); } catch { continue; } // initial commit
    const changed = git(repo, ["diff", "--name-only", parent, sha]).split("\n").filter(Boolean);
    const sourceTouched = changed.some((f) => DERIVABLE.test(f));

    const before = await factsAt(repo, parent);
    const after = await factsAt(repo, sha);
    if (!before || !after) { skipped++; continue; }

    const added = [...after].filter((k) => !before.has(k)).length;
    const removed = [...before].filter((k) => !after.has(k)).length;

    rows.push({
      sha: sha.slice(0, 8),
      subject: git(repo, ["log", "-1", "--format=%s", sha]).slice(0, 60),
      filesChanged: changed.length,
      sourceTouched,
      added,
      removed,
      blind: sourceTouched && added === 0 && removed === 0,
    });
  }

  const touched = rows.filter((r) => r.sourceTouched);
  const detected = touched.filter((r) => !r.blind);
  const churn = detected.map((r) => r.added + r.removed);

  const summary = {
    repo,
    commitsAnalyzed: rows.length,
    skipped,
    touchedDerivableSource: touched.length,
    detected: detected.length,
    blind: touched.length - detected.length,
    detectionRate: touched.length ? Number((detected.length / touched.length).toFixed(3)) : null,
    medianChurn: median(churn),
    maxChurn: churn.length ? Math.max(...churn) : 0,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify({ summary, rows }, null, 2)}\n`);
    return;
  }

  process.stdout.write(`Derived-fact replay — ${summary.repo}\n`);
  process.stdout.write(`${summary.commitsAnalyzed} commits analyzed${skipped ? ` (${skipped} skipped: unbuildable checkout)` : ""}\n\n`);
  process.stdout.write("  commit    +facts  -facts  files  note\n");
  for (const r of rows.slice(0, 25)) {
    const note = !r.sourceTouched ? "no derivable source" : r.blind ? "BLIND — source changed, no fact moved" : "";
    process.stdout.write(
      `  ${r.sha}  ${String(r.added).padStart(6)}  ${String(r.removed).padStart(6)}  ${String(r.filesChanged).padStart(5)}  ${note}\n`,
    );
  }
  if (rows.length > 25) process.stdout.write(`  … ${rows.length - 25} more\n`);

  process.stdout.write(`\nCommits touching derivable source: ${summary.touchedDerivableSource}\n`);
  process.stdout.write(`  detected (fact set moved):       ${summary.detected}\n`);
  process.stdout.write(`  blind    (nothing noticed):      ${summary.blind}\n`);
  process.stdout.write(`  detection rate:                  ${summary.detectionRate ?? "n/a"}\n`);
  process.stdout.write(`  median churn per detected commit:${String(summary.medianChurn).padStart(4)}  (max ${summary.maxChurn})\n`);
  process.stdout.write(
    `\nRead honestly: a low detection rate means the derived layer is blind to the work this\n` +
    `repo actually does. A high median churn means it is noisy enough to be ignored. Both\n` +
    `are properties of the tool, not of the repo — publish whichever you measure.\n`,
  );
}

await main();
