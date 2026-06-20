import path from "node:path";
import { renderAdapters } from "../adapters/index.js";
import { readManifest } from "../manifest/index.js";
import {
  estimateTokens,
  SKILLS_INDEX_FILENAME,
  WORKFLOW_ROUTING_FILENAME,
} from "../token-optimizer.js";
import type { IdeId, RenderedFile } from "../types.js";

export type FileCategory =
  | "routing"
  | "index"
  | "brief"
  | "skill"
  | "workflow"
  | "agent"
  | "command"
  | "other";

export interface FileTokenEntry {
  path: string;
  category: FileCategory;
  tokens: number;
  owners: IdeId[];
}

export interface AdapterInvocationModel {
  adapter: IdeId;
  naiveTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savedPercent: number;
  hasSkills: boolean;
  hasBriefs: boolean;
}

export interface TokenReport {
  generatedAt: string;
  adapters: IdeId[];
  files: FileTokenEntry[];
  perAdapter: AdapterInvocationModel[];
}

// Per-invocation constants (matches test harness)
const N_NAIVE = 4;  // avg raw skills loaded per invocation without EI
const N_BRIEF = 3;  // briefs loaded per optimized invocation
const N_EXEC = 1;   // full skills executed per invocation

function categorize(filePath: string): FileCategory {
  const base = path.basename(filePath);
  if (base === WORKFLOW_ROUTING_FILENAME) return "routing";
  if (base === SKILLS_INDEX_FILENAME) return "index";
  if (base === "SKILL-BRIEF.md") return "brief";
  if (base === "SKILL.md") return "skill";
  const norm = filePath.replace(/\\/g, "/");
  if (norm.includes("/workflows/")) return "workflow";
  if (norm.endsWith(".json") || norm.includes("/agents/")) return "agent";
  return "command";
}

function avg(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildAdapterModel(
  adapter: IdeId,
  files: FileTokenEntry[],
): AdapterInvocationModel | null {
  const owned = files.filter((f) => f.owners.includes(adapter));
  const skillTokens = owned.filter((f) => f.category === "skill").map((f) => f.tokens);
  const briefTokens = owned.filter((f) => f.category === "brief").map((f) => f.tokens);
  const routingEntry = owned.find((f) => f.category === "routing");
  const indexEntry = owned.find((f) => f.category === "index");

  if (skillTokens.length === 0) return null;

  const avgSkill = avg(skillTokens);
  const avgBrief = avg(briefTokens);
  const routingT = routingEntry?.tokens ?? 0;
  const indexT = indexEntry?.tokens ?? 0;
  const hasBriefs = briefTokens.length > 0;

  const naiveTokens = Math.round(N_NAIVE * avgSkill);
  const optimizedTokens = hasBriefs
    ? Math.round(routingT + indexT + N_BRIEF * avgBrief + N_EXEC * avgSkill)
    : Math.round(routingT + indexT + N_EXEC * avgSkill);
  const savedTokens = naiveTokens - optimizedTokens;
  const savedPercent =
    naiveTokens > 0 ? Math.round((savedTokens / naiveTokens) * 1000) / 10 : 0;

  return {
    adapter,
    naiveTokens,
    optimizedTokens,
    savedTokens,
    savedPercent,
    hasSkills: true,
    hasBriefs,
  };
}

export async function generateTokenReport(
  root: string,
): Promise<TokenReport> {
  const manifest = await readManifest(root);
  const adapters: IdeId[] = manifest?.adapters ?? [];

  // Use manifest adapters if available; fall back to rendering all adapters
  const rendered: RenderedFile[] =
    adapters.length > 0
      ? await renderAdapters(adapters)
      : await renderAdapters(["claude-code"]);

  const files: FileTokenEntry[] = rendered.map((r) => ({
    path: r.path,
    category: categorize(r.path),
    tokens: estimateTokens(r.content),
    owners: r.owners,
  }));

  const perAdapter: AdapterInvocationModel[] = adapters
    .map((id) => buildAdapterModel(id, files))
    .filter((m): m is AdapterInvocationModel => m !== null);

  return {
    generatedAt: new Date().toISOString(),
    adapters,
    files,
    perAdapter,
  };
}

// --- Formatters -----------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function projectionRows(savedTokens: number): string {
  const rates = [10, 50, 100];
  const header = "| Calls/day |      Daily |       Weekly |       Monthly |\n|----------:|-----------:|-------------:|--------------:|";
  const rows = rates
    .map((r) => {
      const d = r * savedTokens;
      return `| ${String(r).padStart(9)} | ${fmt(d).padStart(10)} | ${fmt(d * 7).padStart(12)} | ${fmt(d * 30).padStart(13)} |`;
    })
    .join("\n");
  return `${header}\n${rows}`;
}

function categoryLabel(c: FileCategory): string {
  const MAP: Record<FileCategory, string> = {
    routing: "routing",
    index: "index",
    brief: "brief",
    skill: "skill",
    workflow: "workflow",
    agent: "agent",
    command: "command",
    other: "other",
  };
  return MAP[c];
}

export function formatMarkdown(report: TokenReport): string {
  const date = report.generatedAt.slice(0, 10);
  const adapterList = report.adapters.join(", ") || "none";
  const totalTokens = report.files.reduce((s, f) => s + f.tokens, 0);

  const lines: string[] = [
    "# Engineering Intelligence — Token Report",
    "",
    `Generated: ${date}  |  Adapters: ${adapterList}`,
    "",
  ];

  // Per-invocation table
  if (report.perAdapter.length > 0) {
    lines.push("## Per-Invocation Token Savings");
    lines.push("");
    lines.push(
      "How many tokens are saved per AI invocation compared to loading raw skills naively.",
    );
    lines.push("");
    lines.push(
      "| Adapter | Without EI | With EI | Saved | % Saved |",
    );
    lines.push(
      "|---------|----------:|--------:|------:|--------:|",
    );
    for (const m of report.perAdapter) {
      lines.push(
        `| ${m.adapter} | ${fmt(m.naiveTokens)} | ${fmt(m.optimizedTokens)} | ${fmt(m.savedTokens)} | ${fmtPct(m.savedPercent)} |`,
      );
    }
    lines.push("");
    lines.push(
      "_Baseline: " +
        `${N_NAIVE} raw full skills per invocation.  \n` +
        "Optimized: WORKFLOW-ROUTING + SKILLS-INDEX + " +
        `${N_BRIEF} briefs + ${N_EXEC} full skill (adapters with briefs); ` +
        `WORKFLOW-ROUTING + SKILLS-INDEX + ${N_EXEC} full skill (adapters without briefs)._`,
    );
    lines.push("");

    // Cumulative projections for first adapter with savings
    const best = report.perAdapter.find((m) => m.savedTokens > 0);
    if (best) {
      lines.push(`## Estimated Cumulative Savings (${best.adapter})`);
      lines.push("");
      lines.push(projectionRows(best.savedTokens));
      lines.push("");
    }
  }

  // File breakdown
  lines.push("## Installed Files — Token Breakdown");
  lines.push("");
  lines.push("| File | Category | Tokens |");
  lines.push("|------|----------:|-------:|");

  const sorted = [...report.files].sort((a, b) => b.tokens - a.tokens);
  for (const f of sorted) {
    lines.push(`| \`${f.path}\` | ${categoryLabel(f.category)} | ${fmt(f.tokens)} |`);
  }
  lines.push("");
  lines.push(`_Total installed: **${fmt(totalTokens)} tokens** across ${report.files.length} files._`);
  lines.push("");

  return lines.join("\n");
}

export function formatCsv(report: TokenReport): string {
  const rows: string[] = [
    "section,adapter,path,category,tokens",
  ];

  for (const f of report.files) {
    for (const owner of f.owners) {
      rows.push(
        `files,${owner},${f.path},${f.category},${f.tokens}`,
      );
    }
  }

  rows.push("");
  rows.push("section,adapter,naive_tokens,optimized_tokens,saved_tokens,saved_pct");
  for (const m of report.perAdapter) {
    rows.push(
      `invocation,${m.adapter},${m.naiveTokens},${m.optimizedTokens},${m.savedTokens},${m.savedPercent}`,
    );
  }

  return rows.join("\n") + "\n";
}
