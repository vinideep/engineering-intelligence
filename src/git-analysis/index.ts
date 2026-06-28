import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Hotspot {
  file: string;
  changeFreq: number;
  score: number;
}

export interface OwnershipEntry {
  module: string;
  primaryOwner: string;
  busFactor: number;
  isOrphaned: boolean;
  lastActiveAt: string;
}

export interface CouplingPair {
  fileA: string;
  fileB: string;
  coChanges: number;
  strength: number;    // 0–1
  crossModule: boolean;
}

export interface VelocityEntry {
  module: string;
  commitsPerWeek: number;
  trend: "accelerating" | "stable" | "declining" | "stale";
  lastCommitAt: string;
}

export interface GitAnalysis {
  generatedAt: string;
  windowDays: number;
  commitsAnalyzed: number;
  hotspots: Hotspot[];
  ownership: OwnershipEntry[];
  coupling: CouplingPair[];
  velocity: VelocityEntry[];
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function tryGit(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf8",
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 20_000,
    }).trim();
  } catch {
    return "";
  }
}

function parseSince(windowDays: number): string {
  return `${windowDays} days ago`;
}

// ---------------------------------------------------------------------------
// Hotspot analysis
// ---------------------------------------------------------------------------

function analyzeHotspots(commits: Array<{ files: string[] }>, topN = 20): Hotspot[] {
  const freq = new Map<string, number>();
  for (const c of commits) {
    for (const f of c.files) freq.set(f, (freq.get(f) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([file, changeFreq], i) => ({
      file,
      changeFreq,
      score: Math.round(100 * (1 - i / topN)),
    }));
}

// ---------------------------------------------------------------------------
// Ownership mapping
// ---------------------------------------------------------------------------

function analyzeOwnership(
  commits: Array<{ author: string; files: string[]; date: Date }>,
  staleDays = 90,
): OwnershipEntry[] {
  // Group files by top-level module (first path segment)
  const moduleAuthor = new Map<string, Map<string, number>>();
  const moduleLastActive = new Map<string, Map<string, Date>>();

  for (const c of commits) {
    for (const f of c.files) {
      const mod = f.split("/")[0] ?? f;
      if (!moduleAuthor.has(mod)) moduleAuthor.set(mod, new Map());
      if (!moduleLastActive.has(mod)) moduleLastActive.set(mod, new Map());

      const am = moduleAuthor.get(mod)!;
      am.set(c.author, (am.get(c.author) ?? 0) + 1);

      const lm = moduleLastActive.get(mod)!;
      const prev = lm.get(c.author);
      if (!prev || c.date > prev) lm.set(c.author, c.date);
    }
  }

  const now = new Date();
  const staleThresholdMs = staleDays * 24 * 60 * 60 * 1000;
  const results: OwnershipEntry[] = [];

  for (const [mod, authorMap] of moduleAuthor) {
    const sorted = [...authorMap.entries()].sort((a, b) => b[1] - a[1]);
    const primaryOwner = sorted[0]?.[0] ?? "unknown";
    const total = sorted.reduce((s, [, n]) => s + n, 0);
    const busFactor = sorted.filter(([, n]) => n / total > 0.1).length;

    const lastActiveDates = [...(moduleLastActive.get(mod)?.values() ?? [])];
    const maxDate = lastActiveDates.reduce((m, d) => (d > m ? d : m), new Date(0));
    const isOrphaned = now.getTime() - maxDate.getTime() > staleThresholdMs;

    results.push({
      module: mod,
      primaryOwner,
      busFactor,
      isOrphaned,
      lastActiveAt: maxDate.toISOString(),
    });
  }

  return results.sort((a, b) => a.module.localeCompare(b.module));
}

// ---------------------------------------------------------------------------
// Change coupling
// ---------------------------------------------------------------------------

function analyzeChangeCoupling(
  commits: Array<{ files: string[] }>,
  minCoChanges = 3,
): CouplingPair[] {
  const pairCount = new Map<string, number>();
  const fileTotal = new Map<string, number>();

  for (const c of commits) {
    const files = [...new Set(c.files)];
    for (const f of files) fileTotal.set(f, (fileTotal.get(f) ?? 0) + 1);
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = [files[i], files[j]].sort().join("\0");
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: CouplingPair[] = [];
  for (const [key, coChanges] of pairCount) {
    if (coChanges < minCoChanges) continue;
    const [fileA, fileB] = key.split("\0") as [string, string];
    const totalA = fileTotal.get(fileA) ?? coChanges;
    const totalB = fileTotal.get(fileB) ?? coChanges;
    const strength = coChanges / Math.max(totalA, totalB);
    if (strength < 0.3) continue; // noise filter
    const modA = fileA.split("/")[0];
    const modB = fileB.split("/")[0];
    pairs.push({ fileA, fileB, coChanges, strength: Math.round(strength * 100) / 100, crossModule: modA !== modB });
  }

  return pairs.sort((a, b) => b.strength - a.strength).slice(0, 30);
}

// ---------------------------------------------------------------------------
// Velocity
// ---------------------------------------------------------------------------

function analyzeVelocity(
  commits: Array<{ files: string[]; date: Date }>,
  windowDays: number,
): VelocityEntry[] {
  const moduleWeeks = new Map<string, number[]>(); // module → commits per week buckets
  const moduleLastCommit = new Map<string, Date>();

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const now = new Date();
  const weeks = Math.ceil(windowDays / 7);

  for (const c of commits) {
    const weekIndex = Math.floor((now.getTime() - c.date.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weekIndex >= weeks) continue;
    for (const f of c.files) {
      const mod = f.split("/")[0] ?? f;
      if (!moduleWeeks.has(mod)) moduleWeeks.set(mod, new Array(weeks).fill(0) as number[]);
      moduleWeeks.get(mod)![weekIndex]++;
      const prev = moduleLastCommit.get(mod);
      if (!prev || c.date > prev) moduleLastCommit.set(mod, c.date);
    }
  }

  const results: VelocityEntry[] = [];
  for (const [mod, buckets] of moduleWeeks) {
    const recent = buckets.slice(0, Math.min(4, weeks));
    const older = buckets.slice(Math.min(4, weeks));
    const recentAvg = recent.reduce((s, n) => s + n, 0) / Math.max(1, recent.length);
    const olderAvg = older.length > 0 ? older.reduce((s, n) => s + n, 0) / older.length : recentAvg;

    const trend: VelocityEntry["trend"] =
      recentAvg === 0 ? "stale" :
      recentAvg > olderAvg * 1.3 ? "accelerating" :
      recentAvg < olderAvg * 0.7 ? "declining" : "stable";

    const lastCommit = moduleLastCommit.get(mod) ?? new Date(0);
    results.push({
      module: mod,
      commitsPerWeek: Math.round(recentAvg * 10) / 10,
      trend,
      lastCommitAt: lastCommit.toISOString(),
    });
  }

  return results.sort((a, b) => b.commitsPerWeek - a.commitsPerWeek);
}

// ---------------------------------------------------------------------------
// Commit log parser
// ---------------------------------------------------------------------------

function parseCommitLog(raw: string): Array<{ sha: string; author: string; date: Date; subject: string; files: string[] }> {
  const commits: ReturnType<typeof parseCommitLog> = [];
  let current: (typeof commits)[0] | null = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("COMMIT:")) {
      if (current) commits.push(current);
      const parts = line.slice("COMMIT:".length).split("|");
      const sha = parts[0]?.trim() ?? "";
      const author = parts[1]?.trim() ?? "unknown";
      const dateStr = parts[2]?.trim() ?? "";
      const subject = parts[3]?.trim() ?? "";
      const date = new Date(dateStr);
      current = { sha, author, date: isNaN(date.getTime()) ? new Date(0) : date, subject, files: [] };
    } else if (current && line.trim()) {
      current.files.push(line.trim());
    }
  }
  if (current) commits.push(current);
  return commits;
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function renderReport(analysis: GitAnalysis): string {
  const hotspotRows = analysis.hotspots
    .map((h) => `| \`${h.file}\` | ${h.changeFreq} | ${h.score} |`)
    .join("\n");

  const ownershipRows = analysis.ownership
    .map((o) => `| \`${o.module}/\` | ${o.primaryOwner} | ${o.busFactor} | ${o.isOrphaned ? "⚠️ Yes" : "No"} |`)
    .join("\n");

  const couplingRows = analysis.coupling
    .map((c) => `| \`${c.fileA}\` | \`${c.fileB}\` | ${c.coChanges} | ${c.strength} | ${c.crossModule ? "⚠️ Yes" : "No"} |`)
    .join("\n");

  const velocityRows = analysis.velocity
    .map((v) => `| \`${v.module}/\` | ${v.commitsPerWeek}/wk | ${v.trend} |`)
    .join("\n");

  return `# Git Intelligence Report
<!-- generated by \`ei git-analysis\` — do not edit manually -->

Generated: ${analysis.generatedAt}
Window: last ${analysis.windowDays} days
Commits analyzed: ${analysis.commitsAnalyzed}

## Hotspots (Top ${analysis.hotspots.length} most-changed files)

| File | Change Freq | Score |
|---|---|---|
${hotspotRows || "| — | — | — |"}

## Module Ownership

| Module | Primary Owner | Bus Factor | Orphaned |
|---|---|---|---|
${ownershipRows || "| — | — | — | — |"}

## Change Coupling (files that always change together)

| File A | File B | Co-changes | Strength | Cross-module |
|---|---|---|---|---|
${couplingRows || "| — | — | — | — | — |"}

## Velocity

| Module | Commits/Week | Trend |
|---|---|---|
${velocityRows || "| — | — | — |"}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runGitAnalysis(root: string, windowDays = 90): Promise<{ reportPath: string; analysis: GitAnalysis }> {
  const since = parseSince(windowDays);
  const raw = tryGit(
    `log --since=${JSON.stringify(since)} --name-only --format="COMMIT:%H|%ae|%cI|%s"`,
    root,
  );

  const commits = parseCommitLog(raw);
  const analysis: GitAnalysis = {
    generatedAt: new Date().toISOString(),
    windowDays,
    commitsAnalyzed: commits.length,
    hotspots: analyzeHotspots(commits),
    ownership: analyzeOwnership(commits),
    coupling: analyzeChangeCoupling(commits),
    velocity: analyzeVelocity(commits, windowDays),
  };

  const reportsDir = path.join(root, ".engineering-intelligence", "reports");
  await mkdir(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, "GIT-intelligence.md");
  await writeFile(reportPath, renderReport(analysis), "utf8");

  return { reportPath: path.relative(root, reportPath), analysis };
}
