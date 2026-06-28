import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FreshnessStatus = "fresh" | "aging" | "stale" | "very-stale" | "obsolete";
export type FreshnessAction = "none" | "incremental-sync" | "full-regeneration" | "manual-review";

export interface StaleSource {
  file: string;
  modifiedAt: string;
  daysAfterDoc: number;
}

export interface DocumentScore {
  docPath: string;        // relative to root
  score: number;          // 0–100
  status: FreshnessStatus;
  docLastUpdated: string | null;
  staleSources: StaleSource[];
  deletedSources: string[];
  action: FreshnessAction;
}

export interface FreshnessReport {
  generatedAt: string;
  root: string;
  threshold: number;
  scores: DocumentScore[];
  driftDecision: "Proceed" | "Sync before implementation" | "Block implementation";
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
      timeout: 10_000,
    }).trim();
  } catch {
    return "";
  }
}

function gitLastModified(filePath: string, root: string): Date | null {
  const iso = tryGit(`log -1 --format=%cI -- ${JSON.stringify(filePath)}`, root);
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function fileExists(filePath: string): boolean {
  try {
    execSync(`test -e ${JSON.stringify(filePath)}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Document parsing
// ---------------------------------------------------------------------------

const EVIDENCE_PATTERN = /\(evidence:\s*([^):]+?)(?::L\d+)?\)/g;
const FRESHNESS_COMMENT = /<!--\s*freshness:[^>]*last_checked=([^\s,>]+)/;
const LAST_UPDATED = /^Last updated:\s*(.+)$/m;
const FRONTMATTER_DATE = /^updated_at:\s*(.+)$/m;

function extractDocTimestamp(content: string): Date | null {
  for (const pattern of [FRESHNESS_COMMENT, LAST_UPDATED, FRONTMATTER_DATE]) {
    const m = content.match(pattern);
    if (m?.[1]) {
      const d = new Date(m[1].trim());
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function extractEvidencePaths(content: string): string[] {
  const paths = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(EVIDENCE_PATTERN.source, "g");
  while ((match = re.exec(content)) !== null) {
    const p = match[1]?.trim();
    if (p) paths.add(p);
  }
  return [...paths];
}

// ---------------------------------------------------------------------------
// Freshness formula (from staleness-detector skill)
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function statusFromScore(score: number): FreshnessStatus {
  if (score >= 80) return "fresh";
  if (score >= 60) return "aging";
  if (score >= 40) return "stale";
  if (score >= 20) return "very-stale";
  return "obsolete";
}

function actionFromStatus(status: FreshnessStatus): FreshnessAction {
  if (status === "fresh" || status === "aging") return "none";
  if (status === "stale") return "incremental-sync";
  if (status === "very-stale") return "full-regeneration";
  return "manual-review";
}

async function scoreDocument(docPath: string, root: string): Promise<DocumentScore> {
  const absPath = path.join(root, docPath);
  let content = "";
  try { content = await readFile(absPath, "utf8"); } catch {
    return { docPath, score: 0, status: "obsolete", docLastUpdated: null, staleSources: [], deletedSources: [], action: "manual-review" };
  }

  const docLastUpdated = extractDocTimestamp(content);
  const evidencePaths = extractEvidencePaths(content);

  let score = 100;
  const staleSources: StaleSource[] = [];
  const deletedSources: string[] = [];
  const now = new Date();

  for (const evPath of evidencePaths) {
    const absEv = path.isAbsolute(evPath) ? evPath : path.join(root, evPath);
    if (!fileExists(absEv)) {
      score -= 25;
      deletedSources.push(evPath);
      continue;
    }
    const fileModified = gitLastModified(evPath, root);
    if (fileModified && docLastUpdated && fileModified > docLastUpdated) {
      const days = daysBetween(docLastUpdated, fileModified);
      const penalty = Math.min(30, Math.round(days * 3));
      score -= penalty;
      staleSources.push({ file: evPath, modifiedAt: fileModified.toISOString(), daysAfterDoc: Math.round(days) });
    }
  }

  // Age penalty
  if (docLastUpdated) {
    const ageDays = daysBetween(docLastUpdated, now);
    score -= Math.min(20, ageDays * 0.5);
  }

  score = Math.max(0, Math.round(score));
  const status = statusFromScore(score);

  return {
    docPath,
    score,
    status,
    docLastUpdated: docLastUpdated?.toISOString() ?? null,
    staleSources,
    deletedSources,
    action: actionFromStatus(status),
  };
}

// ---------------------------------------------------------------------------
// Discovery — find all knowledge documents
// ---------------------------------------------------------------------------

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      if (e.isFile() && (e.name.endsWith(".md") || e.name.endsWith(".json"))) {
        files.push(path.join(dir, e.name));
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function discoverDocuments(root: string): Promise<string[]> {
  const eiDir = path.join(root, ".engineering-intelligence");
  const dirs = [
    path.join(eiDir, "knowledge-base"),
    path.join(eiDir, "memory"),
    path.join(eiDir, "context"),
    path.join(eiDir, "graph"),
  ];
  const all: string[] = [];
  for (const d of dirs) {
    const files = await listMarkdownFiles(d);
    for (const f of files) all.push(path.relative(root, f));
  }
  return all;
}

// ---------------------------------------------------------------------------
// Drift decision
// ---------------------------------------------------------------------------

function computeDriftDecision(
  scores: DocumentScore[],
  threshold: number,
): FreshnessReport["driftDecision"] {
  const minScore = scores.reduce((min, s) => Math.min(min, s.score), 100);
  if (minScore < 50) return "Block implementation";
  if (minScore < threshold) return "Sync before implementation";
  return "Proceed";
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<FreshnessStatus, string> = {
  fresh: "🟢", aging: "🟡", stale: "🟠", "very-stale": "🔴", obsolete: "⛔",
};

function renderReport(report: FreshnessReport): string {
  const { generatedAt, threshold, scores, driftDecision } = report;

  const counts = { fresh: 0, aging: 0, stale: 0, "very-stale": 0, obsolete: 0 };
  for (const s of scores) counts[s.status]++;

  const summaryRows = Object.entries(counts)
    .map(([status, count]) => `| ${STATUS_ICON[status as FreshnessStatus]} ${status} | ${count} |`)
    .join("\n");

  const docRows = scores
    .sort((a, b) => a.score - b.score)
    .map((s) => {
      const staleList = s.staleSources.map((ss) => `${ss.file} (+${ss.daysAfterDoc}d)`).join(", ");
      const deletedList = s.deletedSources.join(", ");
      const issues = [staleList, deletedList].filter(Boolean).join("; ");
      return `| \`${s.docPath}\` | ${s.score} | ${STATUS_ICON[s.status]} ${s.status} | ${issues || "—"} | ${s.action} |`;
    })
    .join("\n");

  const needsSync = scores.filter((s) => s.action !== "none");
  const actionItems = needsSync.length > 0
    ? needsSync.map((s) => `- **${s.action}**: \`${s.docPath}\` (score ${s.score})`).join("\n")
    : "- None — all documents are fresh.";

  return `# Freshness Report
<!-- generated by \`ei freshness\` — do not edit manually -->

Generated: ${generatedAt}
Threshold: ${threshold}
Documents scanned: ${scores.length}

## Pre-Implementation Drift Decision

**${driftDecision}**

| Condition | Threshold |
|---|---|
| All scoped artifacts >= ${threshold} | Proceed |
| Any artifact 50-${threshold - 1} | Sync before implementation |
| Any artifact < 50 | Block implementation |

## Summary

| Status | Count |
|---|---|
${summaryRows}

## Document Scores

| Document | Score | Status | Stale / Deleted Sources | Action |
|---|---|---|---|---|
${docRows}

## Recommended Actions

${actionItems}
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function computeFreshness(root: string, threshold = 60): Promise<FreshnessReport> {
  const docs = await discoverDocuments(root);
  const scores = await Promise.all(docs.map((d) => scoreDocument(d, root)));

  return {
    generatedAt: new Date().toISOString(),
    root,
    threshold,
    scores,
    driftDecision: computeDriftDecision(scores, threshold),
  };
}

export async function writeFreshnessReport(root: string, threshold = 60): Promise<{ reportPath: string; report: FreshnessReport }> {
  const report = await computeFreshness(root, threshold);
  const reportsDir = path.join(root, ".engineering-intelligence", "reports");
  await mkdir(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, "FRESHNESS-report.md");
  await writeFile(reportPath, renderReport(report), "utf8");
  return { reportPath: path.relative(root, reportPath), report };
}
