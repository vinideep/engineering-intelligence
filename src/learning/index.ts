import { mkdir, readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface LearnedPatternInput {
  type: "convention" | "regression" | "constraint";
  title: string;
  description: string;
  rule: string;
  targetFiles?: string[];
}

export interface UncertaintyEventInput {
  trigger: string;
  area: string;
  description: string;
  severity?: "low" | "medium" | "high";
  observedReality?: string;
  resolution?: string;
}

export interface MemoryQueryResult {
  constraints: string[];
  conventions: string[];
  regressions: string[];
}

function memoryDir(root: string): string {
  return path.join(root, ".engineering-intelligence", "memory");
}

function eventsDir(root: string): string {
  return path.join(root, ".engineering-intelligence", "events");
}

/**
 * Record a learned pattern, convention, or negative constraint to durable project memory.
 */
export async function recordLearnedPattern(
  root: string,
  pattern: LearnedPatternInput,
): Promise<{ saved: boolean; path: string }> {
  const validTypes = ["convention", "regression", "constraint"] as const;
  if (!pattern || !validTypes.includes(pattern.type as any)) {
    throw new Error(`Invalid pattern type "${pattern?.type}". Allowed types: ${validTypes.join(", ")}.`);
  }

  const dir = memoryDir(root);
  await mkdir(dir, { recursive: true });

  const fileNameMap: Record<LearnedPatternInput["type"], { file: string; heading: string }> = {
    convention: { file: "coding-patterns.md", heading: "# Coding Patterns" },
    regression: { file: "regression-patterns.md", heading: "# Regression Patterns" },
    constraint: { file: "project-constraints.md", heading: "# Project Constraints" },
  };

  const info = fileNameMap[pattern.type];
  const filePath = path.join(dir, info.file);

  const evidenceStr = pattern.targetFiles && pattern.targetFiles.length > 0
    ? ` (evidence: ${pattern.targetFiles.join(", ")})`
    : "";

  const entry = `- **${pattern.title}:** ${pattern.rule} (${pattern.description})${evidenceStr}\n`;

  if (!existsSync(filePath)) {
    const today = new Date().toISOString().split("T")[0];
    const initialContent = `${info.heading}\n<!-- freshness: last_checked=${today} -->\n\n${entry}`;
    await appendFile(filePath, initialContent, "utf8");
  } else {
    await appendFile(filePath, entry, "utf8");
  }

  return {
    saved: true,
    path: path.relative(root, filePath).replace(/\\/g, "/"),
  };
}

/**
 * Log an uncertainty event or specification ambiguity to the durable events log.
 */
export async function logUncertaintyEvent(
  root: string,
  event: UncertaintyEventInput,
): Promise<{ logged: boolean; id: string }> {
  const dir = eventsDir(root);
  await mkdir(dir, { recursive: true });

  const id = `unc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    id,
    timestamp: new Date().toISOString(),
    trigger: event.trigger,
    area: event.area,
    description: event.description,
    severity: event.severity ?? "medium",
    observedReality: event.observedReality,
    resolution: event.resolution,
  };

  const jsonlPath = path.join(dir, "uncertainty-log.jsonl");
  await appendFile(jsonlPath, `${JSON.stringify(record)}\n`, "utf8");

  const mdPath = path.join(dir, "uncertainty-log.md");
  const mdEntry = `\n### [${record.severity.toUpperCase()}] ${record.trigger} (${id})\n- **Area:** ${record.area}\n- **Description:** ${record.description}\n${record.observedReality ? `- **Observed reality:** ${record.observedReality}\n` : ""}${record.resolution ? `- **Resolution:** ${record.resolution}\n` : ""}`;

  if (!existsSync(mdPath)) {
    const initialMd = `# Uncertainty & Ambiguity Event Log\n${mdEntry}`;
    await appendFile(mdPath, initialMd, "utf8");
  } else {
    await appendFile(mdPath, mdEntry, "utf8");
  }

  return { logged: true, id };
}

function parseBullets(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || line.startsWith("* "))
    .map((line) => line.replace(/^[-*]\s+/, ""));
}

function matchesQuery(item: string, queryWords: string[]): boolean {
  if (queryWords.length === 0) return true;
  const lower = item.toLowerCase();
  return queryWords.some((w) => lower.includes(w));
}

/**
 * Query project memory files for conventions, constraints, and regression patterns.
 */
export async function queryProjectMemory(
  root: string,
  query: { file?: string; topic?: string } = {},
): Promise<MemoryQueryResult> {
  const dir = memoryDir(root);
  const queryWords: string[] = [];
  if (query.file) {
    queryWords.push(...query.file.toLowerCase().split(/[\\/._-]+/).filter((w) => w.length > 2));
  }
  if (query.topic) {
    queryWords.push(...query.topic.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  }

  const readLines = async (fileName: string): Promise<string[]> => {
    const full = path.join(dir, fileName);
    try {
      if (!existsSync(full)) return [];
      const text = await readFile(full, "utf8");
      const bullets = parseBullets(text);
      if (queryWords.length === 0) return bullets;
      const matched = bullets.filter((b) => matchesQuery(b, queryWords));
      return matched;
    } catch {
      return [];
    }
  };

  const [conventions, regressions, constraints] = await Promise.all([
    readLines("coding-patterns.md"),
    readLines("regression-patterns.md"),
    readLines("project-constraints.md"),
  ]);

  return {
    constraints,
    conventions,
    regressions,
  };
}
