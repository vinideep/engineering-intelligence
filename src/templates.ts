import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_NAMES = [
  "initialize-engineering-intelligence",
  "engineering-intelligence",
  "deep-project-knowledge-extractor",
  "knowledge-base-validator",
  "impact-analysis-engine",
  "testing-intelligence-engine",
  "knowledge-sync-engine",
  "memory-sync-engine",
  "context-sync-engine",
  "change-history-engine",
  "architecture-review-engine",
  "refactoring-planner",
  "graph-engine",
  "change-detection-engine",
  "incremental-sync-engine",
  "engineering-change-review",
] as const;

export const AGENT_NAMES = [
  "engineering-orchestrator",
  "change-agent",
  "quality-agent",
  "knowledge-agent",
] as const;

export const WORKFLOW_NAMES = [
  "initialize-engineering-intelligence",
  "engineering-intelligence",
  "map-architecture",
  "analyze-impact",
  "sync-engineering-intelligence",
  "review-engineering-change",
] as const;

function templateRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../templates/canonical");
}

export async function readTemplate(
  category: "skills" | "agents" | "workflows" | "rules",
  name: string,
): Promise<string> {
  const suffix = category === "skills" ? "SKILL.md" : `${name}.md`;
  const location =
    category === "skills"
      ? path.join(templateRoot(), category, name, suffix)
      : path.join(templateRoot(), category, suffix);
  return readFile(location, "utf8");
}

export async function validateCanonicalTemplates(): Promise<string[]> {
  const errors: string[] = [];
  const required = [
    ...SKILL_NAMES.map((name) => ["skills", name] as const),
    ...AGENT_NAMES.map((name) => ["agents", name] as const),
    ...WORKFLOW_NAMES.map((name) => ["workflows", name] as const),
    ["rules", "engineering-intelligence"] as const,
  ];
  for (const [category, name] of required) {
    try {
      const content = await readTemplate(category, name);
      if (content.includes(".agent/") || content.includes(".agents/memory") || content.includes(".agents/context")) {
        errors.push(`${category}/${name} contains an obsolete runtime path`);
      }
    } catch {
      errors.push(`Missing canonical template: ${category}/${name}`);
    }
  }
  const skillDirectory = path.join(templateRoot(), "skills");
  const foundSkills: string[] = await readdir(skillDirectory).catch((): string[] => []);
  for (const name of SKILL_NAMES) {
    if (!foundSkills.includes(name)) {
      errors.push(`Missing canonical skill directory: ${name}`);
    }
  }
  const graph = await readTemplate("skills", "graph-engine").catch(() => "");
  for (const artifact of [
    "dependency-graph.json",
    "service-graph.json",
    "runtime-graph.json",
    "business-flow-graph.json",
    "architecture-map.md",
  ]) {
    if (!graph.includes(artifact)) {
      errors.push(`graph-engine does not define required graph artifact: ${artifact}`);
    }
  }
  for (const requiredContract of ["schemaVersion", "evidence", "unknowns", "verified | inferred | unknown"]) {
    if (!graph.includes(requiredContract)) {
      errors.push(`graph-engine does not define required graph contract field: ${requiredContract}`);
    }
  }
  for (const workflow of [
    "map-architecture",
    "analyze-impact",
    "sync-engineering-intelligence",
    "review-engineering-change",
  ]) {
    const content = await readTemplate("workflows", workflow).catch(() => "");
    if (!content.toLowerCase().includes("not modify product code")) {
      errors.push(`${workflow} must state that it does not modify product code`);
    }
  }
  return errors;
}
