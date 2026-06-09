import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readTemplate, SKILL_NAMES, AGENT_NAMES, WORKFLOW_NAMES } from "../templates.js";

interface SkillInfo {
  name: string;
  category: "initialization" | "implementation" | "analysis" | "sync" | "review" | "planning" | "discovery" | "security" | "operations";
  description: string;
  usedBy: string[];
  dependsOn: string[];
}

const SKILL_CATALOG: Record<string, SkillInfo> = {
  "initialize-intelligence-skill": {
    name: "Initialize Intelligence",
    category: "initialization",
    description: "Creates evidence-backed project intelligence baseline",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: ["deep-project-knowledge-extractor", "knowledge-base-validator", "graph-engine", "change-history-engine"],
  },
  "engineering-intelligence-skill": {
    name: "Engineering Intelligence",
    category: "implementation",
    description: "Executes engineering changes with full lifecycle",
    usedBy: [],
    dependsOn: ["initialize-intelligence-skill", "change-detection-engine", "impact-analysis-engine", "testing-intelligence-engine", "incremental-sync-engine", "change-history-engine"],
  },
  "deep-project-knowledge-extractor": {
    name: "Knowledge Extractor",
    category: "initialization",
    description: "Produces evidence-based project documentation",
    usedBy: ["initialize-intelligence-skill"],
    dependsOn: [],
  },
  "knowledge-base-validator": {
    name: "Knowledge Validator",
    category: "review",
    description: "Validates docs against source evidence",
    usedBy: ["initialize-intelligence-skill", "incremental-sync-engine"],
    dependsOn: ["deep-project-knowledge-extractor"],
  },
  "graph-engine": {
    name: "Graph Engine",
    category: "analysis",
    description: "Builds evidence-backed architecture graphs",
    usedBy: ["initialize-intelligence-skill", "impact-analysis-engine", "incremental-sync-engine"],
    dependsOn: [],
  },
  "impact-analysis-engine": {
    name: "Impact Analysis",
    category: "analysis",
    description: "Determines direct and indirect change impact",
    usedBy: ["engineering-intelligence-skill", "incremental-sync-engine"],
    dependsOn: ["change-detection-engine", "graph-engine"],
  },
  "change-detection-engine": {
    name: "Change Detection",
    category: "analysis",
    description: "Resolves change scope from diffs or proposals",
    usedBy: ["impact-analysis-engine", "incremental-sync-engine", "engineering-change-review"],
    dependsOn: [],
  },
  "incremental-sync-engine": {
    name: "Incremental Sync",
    category: "sync",
    description: "Synchronizes only affected intelligence artifacts",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: ["change-detection-engine", "impact-analysis-engine", "graph-engine", "knowledge-sync-engine", "memory-sync-engine", "context-sync-engine"],
  },
  "testing-intelligence-engine": {
    name: "Testing Intelligence",
    category: "implementation",
    description: "Determines risk-based testing needs",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: ["impact-analysis-engine"],
  },
  "knowledge-sync-engine": {
    name: "Knowledge Sync",
    category: "sync",
    description: "Updates knowledge-base documents",
    usedBy: ["incremental-sync-engine"],
    dependsOn: ["impact-analysis-engine"],
  },
  "memory-sync-engine": {
    name: "Memory Sync",
    category: "sync",
    description: "Maintains durable engineering memory",
    usedBy: ["incremental-sync-engine"],
    dependsOn: ["impact-analysis-engine"],
  },
  "context-sync-engine": {
    name: "Context Sync",
    category: "sync",
    description: "Maintains AI navigation context maps",
    usedBy: ["incremental-sync-engine"],
    dependsOn: ["impact-analysis-engine", "graph-engine"],
  },
  "change-history-engine": {
    name: "Change History",
    category: "implementation",
    description: "Records validated engineering work",
    usedBy: ["initialize-intelligence-skill", "engineering-intelligence-skill"],
    dependsOn: ["impact-analysis-engine"],
  },
  "architecture-review-engine": {
    name: "Architecture Review",
    category: "review",
    description: "Reviews architecture quality and health",
    usedBy: ["refactoring-planner"],
    dependsOn: ["graph-engine"],
  },
  "refactoring-planner": {
    name: "Refactoring Planner",
    category: "planning",
    description: "Plans safe, incremental refactoring",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: ["graph-engine", "architecture-review-engine"],
  },
  "engineering-change-review": {
    name: "Change Review",
    category: "review",
    description: "Reviews changes for quality before completion",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: ["change-detection-engine"],
  },
  "requirement-scoper": {
    name: "Requirement Scoper",
    category: "planning",
    description: "Scopes requirements and configurations interactively",
    usedBy: [],
    dependsOn: ["graph-engine", "deep-project-knowledge-extractor"],
  },
  "codebase-discovery-engine": {
    name: "Codebase Discovery",
    category: "discovery",
    description: "Autonomously explores and understands any codebase",
    usedBy: ["initialize-intelligence-skill", "ongoing-learning-engine"],
    dependsOn: [],
  },
  "convention-detector": {
    name: "Convention Detector",
    category: "discovery",
    description: "Detects and codifies project coding conventions",
    usedBy: ["engineering-intelligence-skill", "incremental-sync-engine"],
    dependsOn: ["codebase-discovery-engine"],
  },
  "ongoing-learning-engine": {
    name: "Ongoing Learning",
    category: "sync",
    description: "Continuous post-initialization learning and uncertainty tracking",
    usedBy: ["incremental-sync-engine"],
    dependsOn: ["codebase-discovery-engine", "staleness-detector"],
  },
  "greenfield-architect": {
    name: "Greenfield Architect",
    category: "planning",
    description: "Interview-based architecture design for new projects",
    usedBy: [],
    dependsOn: [],
  },
  "git-intelligence-engine": {
    name: "Git Intelligence",
    category: "analysis",
    description: "Extracts hotspots, ownership, and change coupling from git history",
    usedBy: ["impact-analysis-engine", "graph-engine", "pr-intelligence-engine"],
    dependsOn: [],
  },
  "pr-intelligence-engine": {
    name: "PR Intelligence",
    category: "review",
    description: "Auto-generates PR descriptions, reviewer suggestions, and impact summaries",
    usedBy: [],
    dependsOn: ["git-intelligence-engine", "change-history-engine", "impact-analysis-engine"],
  },
  "staleness-detector": {
    name: "Staleness Detector",
    category: "sync",
    description: "Tracks knowledge freshness and triggers re-verification",
    usedBy: ["ongoing-learning-engine", "incremental-sync-engine"],
    dependsOn: [],
  },
  "security-audit-engine": {
    name: "Security Audit",
    category: "security",
    description: "Scans for vulnerabilities, secrets, and OWASP compliance",
    usedBy: [],
    dependsOn: ["graph-engine", "deep-project-knowledge-extractor"],
  },
  "performance-analysis-engine": {
    name: "Performance Analysis",
    category: "analysis",
    description: "Identifies N+1 queries, bundle bloat, and caching opportunities",
    usedBy: [],
    dependsOn: ["graph-engine"],
  },
  "debugging-engine": {
    name: "Debugging Engine",
    category: "analysis",
    description: "Root cause analysis, log correlation, and fix suggestions",
    usedBy: [],
    dependsOn: ["graph-engine", "change-detection-engine", "impact-analysis-engine"],
  },
  "aidlc-lifecycle-engine": {
    name: "AI-DLC Lifecycle",
    category: "planning",
    description: "Embeds Agile + AI-DLC state, checkpoints, units, and gates",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: [],
  },
  "environmental-backpressure-engine": {
    name: "Environmental Backpressure",
    category: "implementation",
    description: "Uses local tools to self-correct validation failures",
    usedBy: ["engineering-intelligence-skill", "testing-intelligence-engine"],
    dependsOn: [],
  },
  "nfr-adr-governor": {
    name: "NFR & ADR Governor",
    category: "planning",
    description: "Captures measurable NFRs and ADR lifecycle decisions",
    usedBy: ["aidlc-lifecycle-engine"],
    dependsOn: [],
  },
  "mcp-security-governor": {
    name: "MCP Security Governor",
    category: "security",
    description: "Reviews MCP tools, permissions, schemas, and sandboxing",
    usedBy: ["security-audit-engine"],
    dependsOn: [],
  },
  "operations-readiness-engine": {
    name: "Operations Readiness",
    category: "operations",
    description: "Builds rollback, observability, deployment, and runbook readiness",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: [],
  },
  "type-safety-engine": {
    name: "Type Safety",
    category: "implementation",
    description: "Runs type checks and traces type-only dependencies",
    usedBy: ["engineering-intelligence-skill", "impact-analysis-engine"],
    dependsOn: [],
  },
  "database-migration-safety-engine": {
    name: "Migration Safety",
    category: "implementation",
    description: "Checks migrations for rollback, locks, and destructive operations",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: [],
  },
  "api-backward-compatibility-engine": {
    name: "API Compatibility",
    category: "implementation",
    description: "Classifies API changes and blocks unversioned breaking changes",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: [],
  },
  "api-snapshot-testing-engine": {
    name: "API Snapshot Testing",
    category: "implementation",
    description: "Captures and replays API response snapshots",
    usedBy: ["engineering-intelligence-skill", "testing-intelligence-engine"],
    dependsOn: ["api-backward-compatibility-engine"],
  },
  "adr-compliance-checker": {
    name: "ADR Compliance",
    category: "review",
    description: "Checks diffs against accepted ADRs and architecture decisions",
    usedBy: ["engineering-change-review"],
    dependsOn: ["nfr-adr-governor"],
  },
  "dead-code-detector": {
    name: "Dead Code Detector",
    category: "analysis",
    description: "Finds unused exports, zombie dependencies, and stale modules",
    usedBy: ["architecture-review-engine"],
    dependsOn: ["git-intelligence-engine"],
  },
  "environment-variable-auditor": {
    name: "Environment Variable Auditor",
    category: "operations",
    description: "Checks env var usage against examples, validation, CI, and deploy config",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: [],
  },
  "contract-test-generator": {
    name: "Contract Test Generator",
    category: "implementation",
    description: "Generates service-boundary contract test plans and stubs",
    usedBy: ["testing-intelligence-engine"],
    dependsOn: ["graph-engine", "api-backward-compatibility-engine"],
  },
  "llm-prompt-injection-guard": {
    name: "LLM Prompt Injection Guard",
    category: "security",
    description: "Finds unsafe user-input-to-LLM and durable-memory paths",
    usedBy: ["security-audit-engine"],
    dependsOn: [],
  },
  "context-budget-optimizer": {
    name: "Context Budget Optimizer",
    category: "planning",
    description: "Ranks and slices context to reduce AI IDE token usage",
    usedBy: ["engineering-intelligence-skill", "context-sync-engine"],
    dependsOn: ["graph-engine"],
  },
  "backlog-decomposition-engine": {
    name: "Backlog Decomposition Engine",
    category: "planning",
    description: "Decomposes initiatives into an Epic → Feature → Ticket backlog with per-feature approval gates",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: ["graph-engine", "impact-analysis-engine", "issue-tracker-sync-engine"],
  },
  "issue-tracker-sync-engine": {
    name: "Issue Tracker Sync Engine",
    category: "operations",
    description: "Mirrors the local backlog to GitHub Issues while keeping markdown as the source of truth",
    usedBy: ["backlog-decomposition-engine"],
    dependsOn: [],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  initialization: "#6366f1",
  implementation: "#22c55e",
  analysis: "#f59e0b",
  sync: "#06b6d4",
  review: "#ef4444",
  planning: "#a855f7",
  discovery: "#14b8a6",
  security: "#f43f5e",
  operations: "#0ea5e9",
};

const CATEGORY_LABELS: Record<string, string> = {
  initialization: "Initialization",
  implementation: "Implementation",
  analysis: "Analysis",
  sync: "Synchronization",
  review: "Review & Validation",
  planning: "Planning",
  discovery: "Discovery",
  security: "Security",
  operations: "Operations",
};

interface WorkflowStep {
  name: string;
  skill: string;
}

interface WorkflowInfo {
  name: string;
  type: "read-write" | "read-only";
  description: string;
  steps: WorkflowStep[];
}

const WORKFLOW_CATALOG: WorkflowInfo[] = [
  {
    name: "initialize-engineering-intelligence",
    type: "read-write",
    description: "Initialize project intelligence baseline",
    steps: [
      { name: "Discover", skill: "deep-project-knowledge-extractor" },
      { name: "Extract", skill: "deep-project-knowledge-extractor" },
      { name: "Validate", skill: "knowledge-base-validator" },
      { name: "Build Graphs", skill: "graph-engine" },
      { name: "Record", skill: "change-history-engine" },
    ],
  },
  {
    name: "engineering-intelligence",
    type: "read-write",
    description: "Full implementation lifecycle",
    steps: [
      { name: "Detect Change", skill: "change-detection-engine" },
      { name: "Analyze Impact", skill: "impact-analysis-engine" },
      { name: "Implement", skill: "engineering-intelligence-skill" },
      { name: "Test", skill: "testing-intelligence-engine" },
      { name: "Sync", skill: "incremental-sync-engine" },
      { name: "Record", skill: "change-history-engine" },
    ],
  },
  {
    name: "map-architecture",
    type: "read-only",
    description: "Build architecture graphs",
    steps: [{ name: "Build Graphs", skill: "graph-engine" }],
  },
  {
    name: "analyze-impact",
    type: "read-only",
    description: "Write impact report",
    steps: [
      { name: "Detect Change", skill: "change-detection-engine" },
      { name: "Analyze Impact", skill: "impact-analysis-engine" },
    ],
  },
  {
    name: "sync-engineering-intelligence",
    type: "read-only",
    description: "Sync affected intelligence",
    steps: [
      { name: "Detect Change", skill: "change-detection-engine" },
      { name: "Analyze Impact", skill: "impact-analysis-engine" },
      { name: "Sync", skill: "incremental-sync-engine" },
    ],
  },
  {
    name: "review-engineering-change",
    type: "read-only",
    description: "Review changes and write findings",
    steps: [
      { name: "Detect Change", skill: "change-detection-engine" },
      { name: "Review", skill: "engineering-change-review" },
    ],
  },
  {
    name: "scope-requirement",
    type: "read-only",
    description: "Scope feature requirements interactively",
    steps: [
      { name: "Context", skill: "deep-project-knowledge-extractor" },
      { name: "Scoping Q&A", skill: "requirement-scoper" },
      { name: "Document", skill: "requirement-scoper" },
    ],
  },
  {
    name: "discover-codebase",
    type: "read-only",
    description: "Autonomously understand a codebase",
    steps: [
      { name: "Discover", skill: "codebase-discovery-engine" },
      { name: "Detect Conventions", skill: "convention-detector" },
      { name: "Verify", skill: "codebase-discovery-engine" },
    ],
  },
  {
    name: "create-project",
    type: "read-write",
    description: "Scaffold new project with full AIDLC",
    steps: [
      { name: "Interview", skill: "greenfield-architect" },
      { name: "Scaffold", skill: "greenfield-architect" },
      { name: "Initialize", skill: "initialize-intelligence-skill" },
      { name: "Conventions", skill: "convention-detector" },
    ],
  },
];

async function scanWorkspaceFiles(dir: string, baseDir: string): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      if (entry.isDirectory()) {
        const subResults = await scanWorkspaceFiles(fullPath, baseDir);
        Object.assign(results, subResults);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if ([".md", ".json", ".txt", ".yaml", ".yml"].includes(ext)) {
          try {
            const content = await readFile(fullPath, "utf8");
            results[relPath] = content;
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return results;
}

async function readWorkspaceIntelligence(projectRoot: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const sub of ["knowledge-base", ".changes", ".engineering-intelligence"]) {
    const dir = path.join(projectRoot, sub);
    const scanned = await scanWorkspaceFiles(dir, projectRoot);
    Object.assign(files, scanned);
  }
  return files;
}

export async function generateDashboardHTML(projectRoot: string): Promise<string> {
  const vaultName = path.basename(projectRoot);
  
  // Read all canonical template contents
  const templates: Record<string, string> = {};
  for (const name of SKILL_NAMES) {
    try {
      templates[`skills/${name}`] = await readTemplate("skills", name);
    } catch {
      templates[`skills/${name}`] = "";
    }
  }
  for (const name of WORKFLOW_NAMES) {
    try {
      templates[`workflows/${name}`] = await readTemplate("workflows", name);
    } catch {
      templates[`workflows/${name}`] = "";
    }
  }
  for (const name of AGENT_NAMES) {
    try {
      templates[`agents/${name}`] = await readTemplate("agents", name);
    } catch {
      templates[`agents/${name}`] = "";
    }
  }
  try {
    templates["rules/engineering-intelligence"] = await readTemplate("rules", "engineering-intelligence");
  } catch {
    templates["rules/engineering-intelligence"] = "";
  }

  // Read workspace intelligence files
  const workspaceFiles = await readWorkspaceIntelligence(projectRoot);

  const skillCards = Object.entries(SKILL_CATALOG)
    .map(([id, info]) => {
      const color = CATEGORY_COLORS[info.category] ?? "#888";
      const deps = info.dependsOn.length > 0
        ? info.dependsOn.map((d) => `<span class="dep-tag">${SKILL_CATALOG[d]?.name ?? d}</span>`).join("")
        : '<span class="dep-none">None</span>';
      const consumers = info.usedBy.length > 0
        ? info.usedBy.map((u) => `<span class="dep-tag">${SKILL_CATALOG[u]?.name ?? u}</span>`).join("")
        : '<span class="dep-none">Standalone</span>';
      return `<div class="skill-card" data-category="${info.category}">
        <div class="skill-header">
          <span class="skill-badge" style="background:${color}">${CATEGORY_LABELS[info.category]}</span>
          <h3>${info.name}</h3>
        </div>
        <p class="skill-desc">${info.description}</p>
        <div class="skill-id"><code>${id}</code></div>
        <div class="skill-deps">
          <div class="dep-row"><span class="dep-label">Depends on:</span>${deps}</div>
          <div class="dep-row"><span class="dep-label">Used by:</span>${consumers}</div>
        </div>
        <div class="skill-actions">
          <button class="btn btn-sm btn-view" onclick="viewTemplate('skills/${id}', '${info.name}')">View Template</button>
          <button class="btn btn-sm btn-view-workspace" id="ws-btn-${id}" style="display:none;" onclick="viewSkillInWorkspace('${id}')">View Workspace</button>
          <a class="btn btn-sm btn-obsidian" id="obsidian-btn-${id}" style="display:none;" target="_blank">Obsidian</a>
        </div>
      </div>`;
    })
    .join("\n");

  const workflowCards = WORKFLOW_CATALOG.map((wf) => {
    const steps = wf.steps
      .map((step, i) => {
        const color = CATEGORY_COLORS[SKILL_CATALOG[step.skill]?.category ?? "analysis"] ?? "#888";
        return `<div class="wf-step">
          <div class="step-num">${i + 1}</div>
          <div class="step-body">
            <div class="step-name">${step.name}</div>
            <div class="step-skill" style="color:${color}">${SKILL_CATALOG[step.skill]?.name ?? step.skill}</div>
          </div>
        </div>`;
      })
      .join('<div class="step-arrow">→</div>');
    const typeBadge = wf.type === "read-only"
      ? '<span class="wf-badge wf-readonly">Read-Only</span>'
      : '<span class="wf-badge wf-readwrite">Read-Write</span>';
    return `<div class="wf-card">
      <div class="wf-header">
        <div class="wf-header-top">
          ${typeBadge}
          <div class="wf-actions">
            <button class="btn btn-sm btn-view" onclick="viewTemplate('workflows/${wf.name}', '${wf.name}')">View Template</button>
            <button class="btn btn-sm btn-view-workspace" id="ws-btn-${wf.name}" style="display:none;" onclick="viewWorkflowInWorkspace('${wf.name}')">View Workspace</button>
            <a class="btn btn-sm btn-obsidian" id="obsidian-btn-${wf.name}" style="display:none;" target="_blank">Obsidian</a>
          </div>
        </div>
        <h3>${wf.name}</h3>
        <p>${wf.description}</p>
      </div>
      <div class="wf-pipeline">${steps}</div>
    </div>`;
  }).join("\n");

  const agentCards = [
    { name: "Engineering Orchestrator", role: "Classifies requests, routes work, coordinates agents", id: "engineering-orchestrator", skills: "All skills", color: "#6366f1" },
    { name: "Change Agent", role: "Implements code changes, adds tests, collects evidence", id: "change-agent", skills: "engineering-intelligence-skill, testing-intelligence-engine", color: "#22c55e" },
    { name: "Quality Agent", role: "Validates correctness, runs tests, reviews architecture", id: "quality-agent", skills: "engineering-change-review, testing-intelligence-engine", color: "#ef4444" },
    { name: "Knowledge Agent", role: "Maintains all intelligence artifacts", id: "knowledge-agent", skills: "All sync engines, graph-engine, change-history-engine", color: "#06b6d4" },
    { name: "Product Analyst", role: "Scopes requirements, asks clarifying questions, generates prompts", id: "product-analyst", skills: "requirement-scoper, deep-project-knowledge-extractor", color: "#a855f7" },
  ].map((agent) => `<div class="agent-card">
    <div class="agent-icon" style="background:${agent.color}">${agent.name.charAt(0)}</div>
    <div class="agent-body">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
        <h3>${agent.name}</h3>
        <button class="btn btn-sm btn-view" onclick="viewTemplate('agents/${agent.id}', '${agent.name}')">View Instruction</button>
      </div>
      <p>${agent.role}</p>
      <div class="agent-skills"><strong>Skills:</strong> ${agent.skills}</div>
    </div>
  </div>`).join("\n");

  const categoryFilters = Object.entries(CATEGORY_LABELS)
    .map(([id, label]) => `<button class="filter-btn active" data-filter="${id}" style="--btn-color:${CATEGORY_COLORS[id]}">${label}</button>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Engineering Intelligence — Dashboard</title>
<!-- Prism.js for code highlight -->
<link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
<style>
:root {
  --bg: #0a0a0f;
  --surface: #12121a;
  --surface-hover: #1a1a26;
  --border: #2a2a3a;
  --text: #e4e4ef;
  --text-dim: #8888a0;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --radius: 12px;
  --glass: rgba(18, 18, 26, 0.8);
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}
.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }

/* Header */
.header {
  text-align: center;
  padding: 3rem 0 2rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 2rem;
}
.header h1 {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #6366f1, #a855f7, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.5rem;
}
.header p { color: var(--text-dim); font-size: 1.1rem; }
.header .header-controls {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.header .stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1.5rem;
}
.stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.5rem;
  text-align: center;
}
.stat-num { font-size: 2rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.85rem; color: var(--text-dim); }

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.btn:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
}
.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
.btn-sm {
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  border-radius: 4px;
}
.btn-obsidian {
  border-color: #a855f7;
  color: #d8b4fe;
}
.btn-obsidian:hover {
  background: rgba(168, 85, 247, 0.1);
  border-color: #c084fc;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}
.tab {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 1rem;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab-content { display: none; }
.tab-content.active { display: block; }

/* Filter buttons */
.filters { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.filter-btn {
  padding: 0.4rem 1rem;
  border-radius: 20px;
  border: 1px solid var(--btn-color);
  background: transparent;
  color: var(--btn-color);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.filter-btn.active { background: var(--btn-color); color: white; }
.filter-btn:hover { opacity: 0.8; }

/* Skill cards */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}
.skill-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.2s;
}
.skill-card:hover { background: var(--surface-hover); border-color: var(--accent); transform: translateY(-2px); }
.skill-card.hidden { display: none; }
.skill-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.skill-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.skill-header h3 { font-size: 1.1rem; }
.skill-desc { color: var(--text-dim); font-size: 0.9rem; margin-bottom: 0.75rem; }
.skill-id { margin-bottom: 0.75rem; }
.skill-id code { background: var(--bg); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; color: var(--accent); }
.skill-deps { font-size: 0.85rem; margin-bottom: 1rem; }
.dep-row { margin-bottom: 0.4rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.dep-label { color: var(--text-dim); font-weight: 500; margin-right: 0.3rem; }
.dep-tag { background: var(--bg); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
.dep-none { color: var(--text-dim); font-size: 0.75rem; font-style: italic; }
.skill-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }

/* Workflow cards */
.wf-grid { display: flex; flex-direction: column; gap: 1.5rem; }
.wf-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  transition: border-color 0.2s;
}
.wf-card:hover { border-color: var(--accent); }
.wf-header { margin-bottom: 1rem; }
.wf-header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.wf-header h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }
.wf-header p { color: var(--text-dim); font-size: 0.9rem; }
.wf-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}
.wf-readonly { background: #1e3a5f; color: #60a5fa; }
.wf-readwrite { background: #1a3d2a; color: #4ade80; }
.wf-pipeline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 0;
}
.wf-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  min-width: fit-content;
}
.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}
.step-name { font-size: 0.85rem; font-weight: 600; }
.step-skill { font-size: 0.75rem; }
.step-arrow { color: var(--text-dim); font-size: 1.2rem; flex-shrink: 0; }
.wf-actions { display: flex; gap: 0.4rem; }

/* Agent cards */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}
.agent-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  display: flex;
  gap: 1rem;
  transition: all 0.2s;
}
.agent-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.agent-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}
.agent-body { flex: 1; }
.agent-body h3 { font-size: 1rem; }
.agent-body p { color: var(--text-dim); font-size: 0.85rem; margin-bottom: 0.5rem; }
.agent-skills { font-size: 0.8rem; color: var(--text-dim); }

/* Explorer Layout */
.explorer-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-height: 600px;
  overflow: hidden;
}
.explorer-sidebar {
  border-right: 1px solid var(--border);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: rgba(10, 10, 15, 0.3);
}
.explorer-sidebar h3 {
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  max-height: 550px;
}
.file-group-header {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.4rem;
  text-transform: capitalize;
}
.file-group-items {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-left: 0.5rem;
}
.file-item {
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--text-dim);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.file-item::before {
  content: '📄';
  font-size: 0.75rem;
}
.file-item:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text);
}
.file-item.active {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  font-weight: 600;
}
.explorer-content {
  display: flex;
  flex-direction: column;
  height: 650px;
}
.explorer-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(10, 10, 15, 0.2);
}
.explorer-path {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  color: var(--accent);
}
.explorer-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  background: rgba(10,10,15,0.1);
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-dim);
  text-align: center;
  padding: 2rem;
}
.empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
.empty-state p { max-width: 400px; font-size: 0.9rem; }

/* Modal */
.modal {
  display: none;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  align-items: center;
  justify-content: center;
}
.modal.active { display: flex; }
.modal-content {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 90%;
  max-width: 900px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
  animation: modalEnter 0.2s ease-out;
}
@keyframes modalEnter {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 { font-size: 1.2rem; font-weight: 700; color: var(--accent); }
.modal-actions { display: flex; align-items: center; gap: 1rem; }
.modal-close {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 1.8rem;
  cursor: pointer;
  transition: color 0.15s;
  line-height: 1;
}
.modal-close:hover { color: var(--text); }
.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* Markdown Rendering Custom Styles */
.markdown-body {
  font-size: 0.95rem;
  color: var(--text);
}
.markdown-body h1, .markdown-body h2, .markdown-body h3 {
  margin-top: 1.5rem;
  margin-bottom: 0.8rem;
  font-weight: 700;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3rem;
  color: #fff;
}
.markdown-body h1 { font-size: 1.6rem; }
.markdown-body h2 { font-size: 1.3rem; }
.markdown-body h3 { font-size: 1.1rem; }
.markdown-body p, .markdown-body ul, .markdown-body ol {
  margin-bottom: 1rem;
  color: #c9c9d6;
}
.markdown-body ul, .markdown-body ol {
  padding-left: 1.5rem;
}
.markdown-body li { margin-bottom: 0.25rem; }
.markdown-body pre {
  background: #1e1e2f !important;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}
.markdown-body code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  background: rgba(255,255,255,0.06);
  padding: 0.15rem 0.3rem;
  border-radius: 4px;
  color: #f472b6;
}
.markdown-body pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}
.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  font-size: 0.85rem;
}
.markdown-body th, .markdown-body td {
  border: 1px solid var(--border);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.markdown-body th {
  background: rgba(255,255,255,0.03);
  font-weight: 600;
}
.markdown-body blockquote {
  border-left: 4px solid var(--accent);
  padding-left: 1rem;
  margin-bottom: 1rem;
  color: var(--text-dim);
  font-style: italic;
}
.markdown-body a {
  color: #38bdf8;
  text-decoration: none;
}
.markdown-body a:hover {
  text-decoration: underline;
}

/* Mermaid Graph Rendering styling */
.mermaid {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
}

/* Responsive */
@media (max-width: 900px) {
  .explorer-layout { grid-template-columns: 1fr; }
  .explorer-sidebar { border-right: none; border-bottom: 1px solid var(--border); height: 250px; }
  .explorer-content { height: 450px; }
  .header h1 { font-size: 1.8rem; }
  .header .stats { flex-wrap: wrap; }
  .skill-grid { grid-template-columns: 1fr; }
  .agent-grid { grid-template-columns: 1fr; }
  .wf-pipeline { flex-wrap: wrap; }
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Engineering Intelligence OS</h1>
    <p>Graph-backed engineering intelligence toolkit</p>
    <div class="header-controls">
      <button class="btn btn-primary" onclick="viewTemplate('rules/engineering-intelligence', 'Engineering Intelligence Rules')">View Rules Template</button>
      <button class="btn btn-view-workspace" id="ws-rules-btn" style="display:none;" onclick="viewRulesInWorkspace()">View Workspace Rules</button>
      <a class="btn btn-obsidian" id="obsidian-rules-btn" style="display:none;" target="_blank">Open Rules in Obsidian</a>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-num">${SKILL_NAMES.length}</div><div class="stat-label">Skills</div></div>
      <div class="stat"><div class="stat-num">${AGENT_NAMES.length}</div><div class="stat-label">Agents</div></div>
      <div class="stat"><div class="stat-num">${WORKFLOW_NAMES.length}</div><div class="stat-label">Workflows</div></div>
      <div class="stat"><div class="stat-num" id="workspace-files-count">0</div><div class="stat-label">Workspace Files</div></div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="skills">Skills</button>
    <button class="tab" data-tab="workflows">Workflows</button>
    <button class="tab" data-tab="agents">Agents</button>
    <button class="tab" data-tab="artifacts">Workspace Explorer</button>
  </div>

  <div class="tab-content active" id="skills">
    <div class="filters">${categoryFilters}</div>
    <div class="skill-grid">${skillCards}</div>
  </div>

  <div class="tab-content" id="workflows">
    <div class="wf-grid">${workflowCards}</div>
  </div>

  <div class="tab-content" id="agents">
    <div class="agent-grid">${agentCards}</div>
  </div>

  <div class="tab-content" id="artifacts">
    <div class="explorer-layout">
      <div class="explorer-sidebar">
        <h3>Intelligence Artifacts</h3>
        <div id="fileList" class="file-list"></div>
      </div>
      <div class="explorer-content">
        <div class="explorer-header">
          <span id="explorerFilePath" class="explorer-path">Select an artifact to view</span>
          <a id="explorerObsidianLink" href="#" class="btn btn-obsidian hidden" target="_blank">Open in Obsidian</a>
        </div>
        <div id="explorerFileContent" class="explorer-body">
          <div class="empty-state">
            <div class="empty-icon">📁</div>
            <p>Choose an intelligence or lifecycle artifact from the list to view its contents, Mermaid architecture map, or open it in Obsidian.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal File Viewer -->
<div id="fileModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="modalTitle">File Viewer</h3>
      <div class="modal-actions">
        <a id="modalObsidianLink" href="#" class="btn btn-obsidian hidden" target="_blank">Open in Obsidian</a>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
    </div>
    <div id="modalBody" class="modal-body markdown-body"></div>
  </div>
</div>

<!-- Scripts -->
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-markdown.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-json.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

<script>
// Data payloads injected from server-side
const TEMPLATES = ${JSON.stringify(templates)};
const WORKSPACE_FILES = ${JSON.stringify(workspaceFiles)};
const VAULT_NAME = ${JSON.stringify(vaultName)};
const SKILL_CATALOG = ${JSON.stringify(SKILL_CATALOG)};
const WORKFLOW_CATALOG = ${JSON.stringify(WORKFLOW_CATALOG)};

// Initialize Mermaid
mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

// Marked custom renderer to intercept Mermaid blocks
const renderer = new marked.Renderer();
renderer.code = function(code, lang) {
  if (lang === 'mermaid') {
    return \`<div class="mermaid">\${code}</div>\`;
  }
  return \`<pre><code class="language-\${lang}">\${code}</code></pre>\`;
};
marked.setOptions({ renderer });

// Tab Switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    
    // Auto-select first workspace file if explorer is opened and empty
    if (tab.dataset.tab === 'artifacts') {
      const activeFile = document.querySelector('.file-item.active');
      if (!activeFile) {
        const firstFile = document.querySelector('.file-item');
        if (firstFile) firstFile.click();
      }
    }
  });
});

// Category filtering on skills
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const active = [...document.querySelectorAll('.filter-btn.active')].map(b => b.dataset.filter);
    document.querySelectorAll('.skill-card').forEach(card => {
      card.classList.toggle('hidden', !active.includes(card.dataset.category));
    });
  });
});

// Modal Actions
function closeModal() {
  document.getElementById('fileModal').classList.remove('active');
  document.getElementById('modalBody').innerHTML = '';
}

function openModal(title, renderedContent, obsidianLink = null) {
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalBody').innerHTML = renderedContent;
  
  const obsLink = document.getElementById('modalObsidianLink');
  if (obsLink) {
    if (obsidianLink) {
      obsLink.href = obsidianLink;
      obsLink.classList.remove('hidden');
    } else {
      obsLink.classList.add('hidden');
    }
  }
  
  document.getElementById('fileModal').classList.add('active');
  
  // Highlight code blocks
  Prism.highlightAllUnder(document.getElementById('modalBody'));
  
  // Render mermaid graphs
  if (window.mermaid) {
    try {
      mermaid.run({ nodes: document.getElementById('modalBody').querySelectorAll('.mermaid') });
    } catch (e) {
      console.error(e);
    }
  }
}

// Find files in workspace
function findWorkspaceSkillPath(skillId) {
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    if (filePath.includes(\`/skills/\${skillId}/\`) || filePath.endsWith(\`/\${skillId}/SKILL.md\`)) {
      return filePath;
    }
  }
  return null;
}

function findWorkspaceWorkflowPath(wfName) {
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    if (filePath.includes(\`/workflows/\${wfName}.md\`) || filePath.endsWith(\`/\${wfName}.md\`)) {
      return filePath;
    }
  }
  return null;
}

function findWorkspaceRulesPath() {
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    if (filePath.includes("engineering-intelligence.md") && (filePath.includes("/rules/") || filePath.includes("/rules"))) {
      return filePath;
    }
  }
  return null;
}

function getObsidianUrl(filePath) {
  return \`obsidian://open?vault=\${encodeURIComponent(VAULT_NAME)}&file=\${encodeURIComponent(filePath)}\`;
}

// View Content Functions
function viewTemplate(key, title) {
  const content = TEMPLATES[key] || "Template content empty or missing.";
  const rendered = marked.parse(content);
  openModal(title, rendered);
}

function viewSkillInWorkspace(skillId) {
  const filePath = findWorkspaceSkillPath(skillId);
  if (filePath) viewWorkspaceFileInModal(filePath);
}

function viewWorkflowInWorkspace(wfName) {
  const filePath = findWorkspaceWorkflowPath(wfName);
  if (filePath) viewWorkspaceFileInModal(filePath);
}

function viewRulesInWorkspace() {
  const filePath = findWorkspaceRulesPath();
  if (filePath) viewWorkspaceFileInModal(filePath);
}

function viewWorkspaceFileInModal(filePath) {
  const content = WORKSPACE_FILES[filePath] || "";
  const obsidianUrl = getObsidianUrl(filePath);
  let rendered = "";
  if (filePath.toLowerCase().endsWith(".json")) {
    rendered = \`<pre><code class="language-json">\${content}</code></pre>\`;
  } else {
    rendered = marked.parse(content);
  }
  openModal(filePath, rendered, obsidianUrl);
}

// Sidebar Explorer Functions
function viewWorkspaceFile(filePath) {
  const content = WORKSPACE_FILES[filePath] || "";
  const obsidianUrl = getObsidianUrl(filePath);
  const container = document.getElementById('explorerFileContent');
  
  document.getElementById('explorerFilePath').innerText = filePath;
  const obsLink = document.getElementById('explorerObsidianLink');
  obsLink.href = obsidianUrl;
  obsLink.classList.remove('hidden');
  
  let rendered = "";
  if (filePath.toLowerCase().endsWith(".json")) {
    rendered = \`<pre><code class="language-json">\${content}</code></pre>\`;
  } else {
    rendered = marked.parse(content);
  }
  
  container.innerHTML = rendered;
  
  // Highlight code
  Prism.highlightAllUnder(container);
  
  // Render mermaid
  if (window.mermaid) {
    try {
      mermaid.run({ nodes: container.querySelectorAll('.mermaid') });
    } catch (e) {
      console.error(e);
    }
  }
}

function renderFileList() {
  const fileListContainer = document.getElementById('fileList');
  fileListContainer.innerHTML = '';
  
  const filesCount = Object.keys(WORKSPACE_FILES).length;
  document.getElementById('workspace-files-count').innerText = filesCount;
  
  if (filesCount === 0) {
    fileListContainer.innerHTML = '<div style="color:var(--text-dim);font-size:0.8rem;text-align:center;padding:1rem;">No workspace files detected. Run /initialize-engineering-intelligence first.</div>';
    return;
  }
  
  // Group files by top-level directories
  const groups = {};
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    const parts = filePath.split('/');
    const groupName = parts[0];
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(filePath);
  }

  // Sort groups and files, and append
  Object.keys(groups).sort().forEach(groupName => {
    const paths = groups[groupName];
    
    const groupDiv = document.createElement('div');
    groupDiv.className = 'file-group';
    
    const header = document.createElement('div');
    header.className = 'file-group-header';
    header.innerText = groupName === 'knowledge-base' ? 'Knowledge Base' : groupName === '.engineering-intelligence' ? 'Intelligence Graph & Core' : groupName;
    groupDiv.appendChild(header);
    
    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'file-group-items';
    
    paths.sort().forEach(filePath => {
      const item = document.createElement('div');
      item.className = 'file-item';
      const basename = filePath.substring(filePath.lastIndexOf('/') + 1);
      item.innerHTML = \`<span class="file-name">\${basename}</span>\`;
      item.addEventListener('click', () => {
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        viewWorkspaceFile(filePath);
      });
      itemsDiv.appendChild(item);
    });
    
    groupDiv.appendChild(itemsDiv);
    fileListContainer.appendChild(groupDiv);
  });
}

// Initialize workspace components
document.addEventListener("DOMContentLoaded", () => {
  // Populate workspace file tree
  renderFileList();

  // Bind workspace file buttons on skills cards
  for (const skillId of Object.keys(SKILL_CATALOG || {})) {
    const wsPath = findWorkspaceSkillPath(skillId);
    if (wsPath) {
      const wsBtn = document.getElementById(\`ws-btn-\${skillId}\`);
      const obsBtn = document.getElementById(\`obsidian-btn-\${skillId}\`);
      if (wsBtn) wsBtn.style.display = 'inline-block';
      if (obsBtn) {
        obsBtn.style.display = 'inline-block';
        obsBtn.href = getObsidianUrl(wsPath);
      }
    }
  }

  // Bind workspace file buttons on workflows cards
  for (const wf of WORKFLOW_CATALOG || []) {
    const wsPath = findWorkspaceWorkflowPath(wf.name);
    if (wsPath) {
      const wsBtn = document.getElementById(\`ws-btn-\${wf.name}\`);
      const obsBtn = document.getElementById(\`obsidian-btn-\${wf.name}\`);
      if (wsBtn) wsBtn.style.display = 'inline-block';
      if (obsBtn) {
        obsBtn.style.display = 'inline-block';
        obsBtn.href = getObsidianUrl(wsPath);
      }
    }
  }

  // Bind workspace rules controls
  const rulesPath = findWorkspaceRulesPath();
  if (rulesPath) {
    const wsBtn = document.getElementById('ws-rules-btn');
    const obsBtn = document.getElementById('obsidian-rules-btn');
    if (wsBtn) wsBtn.style.display = 'inline-block';
    if (obsBtn) {
      obsBtn.style.display = 'inline-block';
      obsBtn.href = getObsidianUrl(rulesPath);
    }
  }
});
</script>
</body>
</html>`;
}
