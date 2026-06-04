import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function exists(location: string): Promise<boolean> {
  try {
    await access(location);
    return true;
  } catch {
    return false;
  }
}

export const SKILL_NAMES = [
  "initialize-intelligence-skill",
  "engineering-intelligence-skill",
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
  "requirement-scoper",
  "codebase-discovery-engine",
  "convention-detector",
  "ongoing-learning-engine",
  "greenfield-architect",
  "git-intelligence-engine",
  "pr-intelligence-engine",
  "staleness-detector",
  "security-audit-engine",
  "performance-analysis-engine",
  "debugging-engine",
  "aidlc-lifecycle-engine",
  "environmental-backpressure-engine",
  "nfr-adr-governor",
  "mcp-security-governor",
  "operations-readiness-engine",
  "type-safety-engine",
  "database-migration-safety-engine",
  "api-backward-compatibility-engine",
] as const;

export const AGENT_NAMES = [
  "engineering-orchestrator",
  "change-agent",
  "quality-agent",
  "knowledge-agent",
  "product-analyst",
  "system-architect",
  "security-officer",
  "database-administrator",
  "test-engineer",
  "adversary",
  "performance-analyst",
  "compliance-auditor",
  "release-engineer",
  "site-reliability-engineer",
  "documentation-writer",
] as const;

export const WORKFLOW_NAMES = [
  "initialize-engineering-intelligence",
  "engineering-intelligence",
  "map-architecture",
  "analyze-impact",
  "sync-engineering-intelligence",
  "review-engineering-change",
  "scope-requirement",
  "discover-codebase",
  "create-project",
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
    "data-flow-graph.json",
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
    "scope-requirement",
    "discover-codebase",
  ]) {
    const content = await readTemplate("workflows", workflow).catch(() => "");
    if (!content.toLowerCase().includes("not modify product code")) {
      errors.push(`${workflow} must state that it does not modify product code`);
    }
  }
  const lifecycle = await readTemplate("skills", "aidlc-lifecycle-engine").catch(() => "");
  for (const requiredContract of [
    "Discovery",
    "Inception",
    "Construction",
    "Operations",
    "environmental backpressure",
    "aidlc-state.md",
    "cross-unit-discoveries.md",
  ]) {
    if (!lifecycle.includes(requiredContract)) {
      errors.push(`aidlc-lifecycle-engine does not define required AI-DLC contract: ${requiredContract}`);
    }
  }
  const nfrAdr = await readTemplate("skills", "nfr-adr-governor").catch(() => "");
  for (const requiredContract of ["ADR", "Proposed", "Accepted", "Superseded", "NFR"]) {
    if (!nfrAdr.includes(requiredContract)) {
      errors.push(`nfr-adr-governor does not define required governance contract: ${requiredContract}`);
    }
  }
  const implementation = await readTemplate("skills", "engineering-intelligence-skill").catch(() => "");
  for (const requiredContract of [
    "Pre-Flight Freshness Gate",
    "Acceptance Criteria Verification Matrix",
    "type-safety-engine",
    "database-migration-safety-engine",
    "api-backward-compatibility-engine",
  ]) {
    if (!implementation.includes(requiredContract)) {
      errors.push(`engineering-intelligence-skill does not define required accuracy gate: ${requiredContract}`);
    }
  }
  const typeSafety = await readTemplate("skills", "type-safety-engine").catch(() => "");
  for (const requiredContract of ["tsc --listFilesOnly", "mypy --show-column-numbers", "Type Error Map"]) {
    if (!typeSafety.includes(requiredContract)) {
      errors.push(`type-safety-engine does not define required type safety contract: ${requiredContract}`);
    }
  }
  const migrationSafety = await readTemplate("skills", "database-migration-safety-engine").catch(() => "");
  for (const requiredContract of ["down migration", "CONCURRENTLY", "explicit approval"]) {
    if (!migrationSafety.includes(requiredContract)) {
      errors.push(`database-migration-safety-engine does not define required migration safety contract: ${requiredContract}`);
    }
  }
  const apiCompatibility = await readTemplate("skills", "api-backward-compatibility-engine").catch(() => "");
  for (const requiredContract of ["additive", "deprecated", "breaking", "version bump"]) {
    if (!apiCompatibility.includes(requiredContract)) {
      errors.push(`api-backward-compatibility-engine does not define required API compatibility contract: ${requiredContract}`);
    }
  }
  return errors;
}
