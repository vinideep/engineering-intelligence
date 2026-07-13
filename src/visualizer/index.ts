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
    name: "Sync Engine",
    category: "sync",
    description: "Synchronizes only affected knowledge, memory, context, graph, and claims",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: ["change-detection-engine", "impact-analysis-engine", "graph-engine"],
  },
  "testing-intelligence-engine": {
    name: "Testing Intelligence",
    category: "implementation",
    description: "Determines risk-based testing needs",
    usedBy: ["engineering-intelligence-skill"],
    dependsOn: ["impact-analysis-engine"],
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
    description: "Classifies API changes, blocks unversioned breaking changes, and replays response snapshots",
    usedBy: ["engineering-intelligence-skill", "testing-intelligence-engine"],
    dependsOn: [],
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
    usedBy: ["engineering-intelligence-skill", "incremental-sync-engine"],
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
  "question-file-engine": {
    name: "Question File Engine",
    category: "planning",
    description: "Creates structured MCQ clarification files instead of asking inline. Enables context reset and durable decision artifacts.",
    usedBy: ["requirement-scoper", "backlog-decomposition-engine"],
    dependsOn: [],
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  initialization: "#818cf8",
  implementation: "#34d399",
  analysis: "#fbbf24",
  sync: "#22d3ee",
  review: "#f87171",
  planning: "#c084fc",
  discovery: "#2dd4bf",
  security: "#fb7185",
  operations: "#38bdf8",
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
  for (const sub of [".engineering-intelligence"]) {
    const dir = path.join(projectRoot, sub);
    const scanned = await scanWorkspaceFiles(dir, projectRoot);
    Object.assign(files, scanned);
  }
  return files;
}

// Prevents `</script>` sequences inside embedded file contents from
// terminating the inline <script> block that carries the data payload.
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
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
        ? info.dependsOn.map((d) => `<span class="dep-tag" onclick="focusGraphNode('skills','${d}')">${SKILL_CATALOG[d]?.name ?? d}</span>`).join("")
        : '<span class="dep-none">None</span>';
      const consumers = info.usedBy.length > 0
        ? info.usedBy.map((u) => `<span class="dep-tag" onclick="focusGraphNode('skills','${u}')">${SKILL_CATALOG[u]?.name ?? u}</span>`).join("")
        : '<span class="dep-none">Standalone</span>';
      return `<div class="skill-card" data-category="${info.category}" data-search="${id} ${info.name.toLowerCase()}">
        <div class="skill-header">
          <span class="skill-badge" style="--badge-color:${color}">${CATEGORY_LABELS[info.category]}</span>
          <h3>${info.name}</h3>
        </div>
        <p class="skill-desc">${info.description}</p>
        <div class="skill-id"><code>${id}</code></div>
        <div class="skill-deps">
          <div class="dep-row"><span class="dep-label">Depends on</span>${deps}</div>
          <div class="dep-row"><span class="dep-label">Used by</span>${consumers}</div>
        </div>
        <div class="skill-actions">
          <button class="btn btn-sm" onclick="viewTemplate('skills/${id}', '${info.name}')">Template</button>
          <button class="btn btn-sm btn-graph" onclick="focusGraphNode('skills','${id}')"><span class="dot"></span>Graph</button>
          <button class="btn btn-sm" id="ws-btn-${id}" style="display:none;" onclick="viewSkillInWorkspace('${id}')">Workspace</button>
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
            <button class="btn btn-sm" onclick="viewTemplate('workflows/${wf.name}', '${wf.name}')">Template</button>
            <button class="btn btn-sm btn-graph" onclick="focusGraphNode('skills','wf:${wf.name}')"><span class="dot"></span>Graph</button>
            <button class="btn btn-sm" id="ws-btn-${wf.name}" style="display:none;" onclick="viewWorkflowInWorkspace('${wf.name}')">Workspace</button>
          </div>
        </div>
        <h3>${wf.name}</h3>
        <p>${wf.description}</p>
      </div>
      <div class="wf-pipeline">${steps}</div>
    </div>`;
  }).join("\n");

  const agentCards = [
    { name: "Engineering Orchestrator", role: "Classifies requests, routes work, coordinates agents", id: "engineering-orchestrator", skills: "All skills", color: "#818cf8" },
    { name: "Change Agent", role: "Implements code changes, adds tests, collects evidence", id: "change-agent", skills: "engineering-intelligence-skill, testing-intelligence-engine", color: "#34d399" },
    { name: "Quality Agent", role: "Validates correctness, runs tests, reviews architecture", id: "quality-agent", skills: "engineering-change-review, testing-intelligence-engine", color: "#f87171" },
    { name: "Knowledge Agent", role: "Maintains all intelligence artifacts", id: "knowledge-agent", skills: "All sync engines, graph-engine, change-history-engine", color: "#22d3ee" },
    { name: "Product Analyst", role: "Scopes requirements, asks clarifying questions, generates prompts", id: "product-analyst", skills: "requirement-scoper, deep-project-knowledge-extractor", color: "#c084fc" },
  ].map((agent) => `<div class="agent-card">
    <div class="agent-icon" style="--agent-color:${agent.color}">${agent.name.charAt(0)}</div>
    <div class="agent-body">
      <div class="agent-title-row">
        <h3>${agent.name}</h3>
        <button class="btn btn-sm" onclick="viewTemplate('agents/${agent.id}', '${agent.name}')">Instruction</button>
      </div>
      <p>${agent.role}</p>
      <div class="agent-skills"><strong>Skills</strong> ${agent.skills}</div>
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
<style>
:root {
  --bg: #060609;
  --surface: rgba(255, 255, 255, 0.025);
  --surface-solid: #0e0e16;
  --surface-hover: rgba(255, 255, 255, 0.05);
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);
  --text: #ecedf4;
  --text-dim: #8b8ca3;
  --text-faint: #5c5d75;
  --accent: #7c7ff2;
  --accent-strong: #6366f1;
  --accent-glow: rgba(124, 127, 242, 0.35);
  --radius: 14px;
  --radius-sm: 8px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
}
* { margin:0; padding:0; box-sizing:border-box; }
html { scrollbar-color: #33344d var(--bg); }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 40% at 15% -10%, rgba(99, 102, 241, 0.14), transparent),
    radial-gradient(ellipse 50% 35% at 85% -5%, rgba(168, 85, 247, 0.10), transparent),
    radial-gradient(ellipse 45% 30% at 50% 110%, rgba(6, 182, 212, 0.06), transparent);
  pointer-events: none;
  z-index: 0;
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: #2b2c40; border-radius: 5px; border: 2px solid var(--bg); }
::-webkit-scrollbar-track { background: transparent; }
.container { max-width: 1440px; margin: 0 auto; padding: 0 2rem 3rem; position: relative; z-index: 1; }

/* ── Topbar ─────────────────────────────────────────── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(18px) saturate(1.4);
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  background: rgba(6, 6, 10, 0.72);
  border-bottom: 1px solid var(--border);
}
.topbar-inner {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0.85rem 2rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}
.brand { display: flex; align-items: center; gap: 0.7rem; font-weight: 800; font-size: 1.02rem; letter-spacing: -0.01em; white-space: nowrap; }
.brand-mark {
  width: 30px; height: 30px; border-radius: 9px;
  background: conic-gradient(from 210deg, #6366f1, #a855f7, #06b6d4, #6366f1);
  position: relative;
  box-shadow: 0 0 18px var(--accent-glow);
}
.brand-mark::after {
  content: ''; position: absolute; inset: 3px; border-radius: 6px; background: var(--bg);
}
.brand-mark::before {
  content: ''; position: absolute; inset: 10px; border-radius: 50%;
  background: linear-gradient(135deg, #818cf8, #22d3ee); z-index: 1;
}
.brand small { color: var(--text-faint); font-weight: 500; font-size: 0.72rem; display: block; margin-top: -4px; }
.topbar-stats { display: flex; gap: 0.4rem; margin-left: auto; }
.stat-pill {
  display: flex; align-items: baseline; gap: 0.35rem;
  padding: 0.32rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.78rem;
  color: var(--text-dim);
  white-space: nowrap;
}
.stat-pill b { color: var(--text); font-weight: 700; font-size: 0.88rem; }
.search-trigger {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.42rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-dim);
  font-size: 0.82rem;
  font-family: var(--font);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  min-width: 200px;
}
.search-trigger:hover { border-color: var(--border-strong); background: var(--surface-hover); }
.search-trigger kbd {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 0.66rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: rgba(255,255,255,0.04);
  color: var(--text-faint);
}

/* ── Hero + tabs ────────────────────────────────────── */
.hero { padding: 2.6rem 0 1.6rem; }
.hero h1 {
  font-size: 2.1rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(120deg, #e0e1ff 10%, #a5b4fc 45%, #67e8f9 90%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero p { color: var(--text-dim); font-size: 0.98rem; margin-top: 0.3rem; max-width: 640px; }
.hero-actions { margin-top: 1.1rem; display: flex; gap: 0.6rem; flex-wrap: wrap; }

.tabs {
  display: inline-flex;
  gap: 0.25rem;
  margin: 0.5rem 0 1.75rem;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.02);
  padding: 0.3rem;
  border-radius: 12px;
}
.tab {
  padding: 0.5rem 1.15rem;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  font-family: var(--font);
  border-radius: 9px;
  transition: color 0.18s, background 0.18s;
  display: flex; align-items: center; gap: 0.45rem;
}
.tab:hover { color: var(--text); }
.tab.active {
  color: #fff;
  background: linear-gradient(135deg, rgba(99,102,241,0.9), rgba(124,58,237,0.75));
  box-shadow: 0 2px 14px rgba(99, 102, 241, 0.35);
}
.tab .tab-icon { font-size: 0.85rem; opacity: 0.9; }
.tab-content { display: none; animation: fadeUp 0.25s ease-out; }
.tab-content.active { display: block; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* ── Buttons ────────────────────────────────────────── */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.84rem;
  font-family: var(--font);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.btn:hover { background: var(--surface-hover); border-color: var(--border-strong); }
.btn-primary {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 2px 14px rgba(99, 102, 241, 0.3);
}
.btn-primary:hover { filter: brightness(1.12); box-shadow: 0 2px 20px rgba(99, 102, 241, 0.45); }
.btn-sm { padding: 0.28rem 0.65rem; font-size: 0.74rem; border-radius: 7px; }
.btn-graph { border-color: rgba(124, 127, 242, 0.4); color: #b3b5ff; }
.btn-graph:hover { background: rgba(99, 102, 241, 0.12); border-color: var(--accent); }
.btn-graph .dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
}

/* ── Filters ────────────────────────────────────────── */
.filters { display: flex; gap: 0.45rem; margin-bottom: 1.4rem; flex-wrap: wrap; }
.filter-btn {
  padding: 0.34rem 0.9rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--btn-color) 45%, transparent);
  background: transparent;
  color: var(--btn-color);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: var(--font);
  transition: all 0.18s;
}
.filter-btn.active { background: color-mix(in srgb, var(--btn-color) 18%, transparent); border-color: var(--btn-color); }
.filter-btn:hover { opacity: 0.85; }

/* ── Skill cards ────────────────────────────────────── */
.skill-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; }
.skill-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.2rem 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.skill-card:hover {
  border-color: rgba(124, 127, 242, 0.45);
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(124,127,242,0.1);
}
.skill-card.hidden { display: none; }
.skill-header { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.skill-badge {
  padding: 0.16rem 0.6rem;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 700;
  color: var(--badge-color);
  background: color-mix(in srgb, var(--badge-color) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--badge-color) 35%, transparent);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  white-space: nowrap;
}
.skill-header h3 { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; }
.skill-desc { color: var(--text-dim); font-size: 0.87rem; margin-bottom: 0.7rem; }
.skill-id { margin-bottom: 0.7rem; }
.skill-id code { background: rgba(0,0,0,0.35); padding: 0.18rem 0.5rem; border-radius: 6px; font-size: 0.76rem; color: #a5b4fc; font-family: var(--mono); }
.skill-deps { font-size: 0.82rem; margin-bottom: 0.9rem; }
.dep-row { margin-bottom: 0.35rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.dep-label { color: var(--text-faint); font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 0.2rem; }
.dep-tag { background: rgba(255,255,255,0.04); border: 1px solid var(--border); padding: 0.12rem 0.5rem; border-radius: 6px; font-size: 0.73rem; cursor: pointer; transition: all 0.15s; }
.dep-tag:hover { border-color: var(--accent); color: #b3b5ff; }
.dep-none { color: var(--text-faint); font-size: 0.73rem; font-style: italic; }
.skill-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }

/* ── Workflow cards ─────────────────────────────────── */
.wf-grid { display: flex; flex-direction: column; gap: 1.2rem; }
.wf-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.4rem 1.5rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.wf-card:hover { border-color: rgba(124, 127, 242, 0.4); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
.wf-header { margin-bottom: 1rem; }
.wf-header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.wf-header h3 { font-size: 1.08rem; font-family: var(--mono); font-weight: 600; margin-bottom: 0.2rem; color: #c7d2fe; }
.wf-header p { color: var(--text-dim); font-size: 0.88rem; }
.wf-badge {
  display: inline-block;
  padding: 0.18rem 0.65rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.wf-readonly { background: rgba(96, 165, 250, 0.12); color: #93c5fd; border: 1px solid rgba(96, 165, 250, 0.3); }
.wf-readwrite { background: rgba(74, 222, 128, 0.1); color: #86efac; border: 1px solid rgba(74, 222, 128, 0.28); }
.wf-pipeline { display: flex; align-items: center; gap: 0.5rem; overflow-x: auto; padding: 0.5rem 0; }
.wf-step {
  display: flex; align-items: center; gap: 0.55rem;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  padding: 0.65rem 0.9rem;
  border-radius: 10px;
  min-width: fit-content;
}
.step-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700; flex-shrink: 0;
}
.step-name { font-size: 0.82rem; font-weight: 600; }
.step-skill { font-size: 0.72rem; }
.step-arrow { color: var(--text-faint); font-size: 1.1rem; flex-shrink: 0; }
.wf-actions { display: flex; gap: 0.4rem; }

/* ── Agent cards ────────────────────────────────────── */
.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem; }
.agent-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.2rem 1.25rem;
  display: flex; gap: 1rem;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.agent-card:hover { border-color: rgba(124, 127, 242, 0.4); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.35); }
.agent-icon {
  width: 46px; height: 46px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem; font-weight: 800;
  color: var(--agent-color);
  background: color-mix(in srgb, var(--agent-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--agent-color) 40%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--agent-color) 20%, transparent);
  flex-shrink: 0;
}
.agent-body { flex: 1; }
.agent-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; gap: 0.5rem; }
.agent-body h3 { font-size: 0.98rem; font-weight: 700; }
.agent-body p { color: var(--text-dim); font-size: 0.84rem; margin-bottom: 0.5rem; }
.agent-skills { font-size: 0.76rem; color: var(--text-faint); }
.agent-skills strong { color: var(--text-dim); text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.05em; margin-right: 0.3rem; }

/* ── Graph view ─────────────────────────────────────── */
.graph-layout {
  display: grid;
  grid-template-columns: 236px 1fr;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: #08080e;
  height: calc(100vh - 220px);
  min-height: 560px;
  position: relative;
}
.graph-rail {
  border-right: 1px solid var(--border);
  padding: 1.1rem;
  overflow-y: auto;
  background: rgba(255,255,255,0.015);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.rail-section h4 {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  font-weight: 700;
  margin-bottom: 0.55rem;
}
.mode-list { display: flex; flex-direction: column; gap: 0.25rem; }
.mode-btn {
  display: flex; align-items: center; gap: 0.55rem;
  padding: 0.5rem 0.7rem;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-dim);
  font-size: 0.84rem;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.mode-btn:hover { background: var(--surface-hover); color: var(--text); }
.mode-btn.active {
  background: rgba(99, 102, 241, 0.14);
  border-color: rgba(99, 102, 241, 0.4);
  color: #c7d2fe;
}
.mode-btn .mode-icon { font-size: 0.95rem; }
.layer-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.layer-chip {
  padding: 0.26rem 0.65rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  font-family: var(--font);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
}
.layer-chip.active { border-color: var(--accent); background: rgba(99,102,241,0.14); color: #c7d2fe; }
.graph-search-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: rgba(0,0,0,0.3);
  color: var(--text);
  font-size: 0.82rem;
  font-family: var(--font);
  outline: none;
  transition: border-color 0.18s;
}
.graph-search-input:focus { border-color: var(--accent); }
.graph-search-input::placeholder { color: var(--text-faint); }
.rail-toggle {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.8rem; color: var(--text-dim);
  padding: 0.3rem 0.1rem;
  cursor: pointer;
  user-select: none;
}
.switch {
  width: 32px; height: 18px; border-radius: 999px;
  background: rgba(255,255,255,0.1);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.switch::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: #9ea0b8;
  transition: all 0.2s;
}
.rail-toggle.on .switch { background: var(--accent-strong); }
.rail-toggle.on .switch::after { left: 16px; background: #fff; }
.rail-slider { margin-bottom: 0.6rem; }
.rail-slider label { display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-dim); margin-bottom: 0.25rem; }
.rail-slider input[type=range] {
  width: 100%; height: 4px; -webkit-appearance: none; appearance: none;
  background: rgba(255,255,255,0.1); border-radius: 2px; outline: none;
}
.rail-slider input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 13px; height: 13px; border-radius: 50%;
  background: var(--accent); cursor: pointer;
  box-shadow: 0 0 8px var(--accent-glow);
}
.legend-list { display: flex; flex-direction: column; gap: 0.15rem; }
.legend-item {
  display: flex; align-items: center; gap: 0.55rem;
  font-size: 0.78rem; color: var(--text-dim);
  padding: 0.28rem 0.45rem;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}
.legend-item:hover { background: var(--surface-hover); }
.legend-item.off { opacity: 0.35; }
.legend-item .swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
.legend-item .count { margin-left: auto; color: var(--text-faint); font-size: 0.7rem; font-family: var(--mono); }
.graph-stage { position: relative; overflow: hidden; }
#graphCanvas { display: block; width: 100%; height: 100%; cursor: grab; }
#graphCanvas.dragging { cursor: grabbing; }
.graph-hud {
  position: absolute; top: 0.9rem; left: 0.9rem;
  display: flex; gap: 0.4rem; align-items: center;
  pointer-events: none;
}
.graph-hud .hud-pill {
  pointer-events: auto;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgba(10, 10, 18, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  font-size: 0.72rem;
  color: var(--text-dim);
  font-family: var(--mono);
}
.graph-hud button.hud-pill { cursor: pointer; color: var(--text); transition: border-color 0.15s; font-family: var(--font); font-weight: 600; }
.graph-hud button.hud-pill:hover { border-color: var(--accent); }
.graph-empty {
  position: absolute; inset: 0;
  display: none;
  align-items: center; justify-content: center;
  flex-direction: column; gap: 0.6rem;
  color: var(--text-faint); font-size: 0.9rem;
  text-align: center; padding: 2rem;
}
.graph-empty.visible { display: flex; }

/* node inspector drawer */
.node-drawer {
  position: absolute;
  top: 0.9rem; right: 0.9rem; bottom: 0.9rem;
  width: 330px;
  background: rgba(12, 12, 20, 0.88);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  transform: translateX(calc(100% + 1.5rem));
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  z-index: 5;
}
.node-drawer.open { transform: translateX(0); }
.drawer-head {
  padding: 1rem 1.1rem 0.8rem;
  border-bottom: 1px solid var(--border);
}
.drawer-head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
.drawer-title { font-size: 1rem; font-weight: 700; word-break: break-word; line-height: 1.35; }
.drawer-close {
  background: transparent; border: none; color: var(--text-dim);
  font-size: 1.3rem; cursor: pointer; line-height: 1; padding: 0.1rem 0.3rem;
  border-radius: 6px;
}
.drawer-close:hover { color: var(--text); background: var(--surface-hover); }
.drawer-sub { margin-top: 0.45rem; display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
.drawer-chip {
  padding: 0.12rem 0.55rem; border-radius: 999px;
  font-size: 0.66rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
}
.drawer-meta { font-size: 0.72rem; color: var(--text-faint); font-family: var(--mono); }
.drawer-body { flex: 1; overflow-y: auto; padding: 0.9rem 1.1rem; }
.drawer-section-title {
  font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--text-faint); font-weight: 700;
  margin: 0.9rem 0 0.45rem;
  display: flex; align-items: center; gap: 0.4rem;
}
.drawer-section-title:first-child { margin-top: 0; }
.drawer-section-title .n { color: var(--accent); font-family: var(--mono); }
.drawer-desc { font-size: 0.84rem; color: var(--text-dim); }
.link-list { display: flex; flex-direction: column; gap: 0.2rem; }
.link-item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.38rem 0.55rem;
  border-radius: 8px;
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--text-dim);
  transition: all 0.13s;
  border: 1px solid transparent;
}
.link-item:hover { background: rgba(99,102,241,0.1); color: #c7d2fe; border-color: rgba(99,102,241,0.25); }
.link-item .swatch { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.link-item .rel { margin-left: auto; font-size: 0.64rem; color: var(--text-faint); font-family: var(--mono); flex-shrink: 0; }
.link-empty { color: var(--text-faint); font-size: 0.78rem; font-style: italic; padding: 0.2rem 0.5rem; }
.drawer-actions { padding: 0.8rem 1.1rem; border-top: 1px solid var(--border); display: flex; gap: 0.5rem; }
.drawer-actions .btn { flex: 1; justify-content: center; }

/* ── Vault explorer ─────────────────────────────────── */
.explorer-layout {
  display: grid;
  grid-template-columns: 290px 1fr;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-height: 620px;
  overflow: hidden;
}
.explorer-sidebar {
  border-right: 1px solid var(--border);
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  background: rgba(0, 0, 0, 0.22);
}
.explorer-sidebar h3 { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-faint); font-weight: 700; }
.file-list { display: flex; flex-direction: column; gap: 0.85rem; overflow-y: auto; max-height: 560px; }
.file-group-header {
  font-size: 0.74rem; font-weight: 700; color: #a5b4fc;
  margin-bottom: 0.3rem;
  display: flex; align-items: center; gap: 0.4rem;
  text-transform: capitalize;
}
.file-group-header .count { color: var(--text-faint); font-weight: 500; font-family: var(--mono); font-size: 0.68rem; }
.file-group-items { display: flex; flex-direction: column; gap: 0.12rem; padding-left: 0.35rem; }
.file-item {
  padding: 0.36rem 0.6rem;
  border-radius: 7px;
  font-family: var(--mono);
  font-size: 0.76rem;
  cursor: pointer;
  color: var(--text-dim);
  transition: all 0.13s;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid transparent;
}
.file-item::before { content: '◆'; font-size: 0.5rem; color: var(--text-faint); }
.file-item:hover { background: var(--surface-hover); color: var(--text); }
.file-item.active {
  background: rgba(99, 102, 241, 0.13);
  border-color: rgba(99, 102, 241, 0.35);
  color: #b3b5ff;
}
.file-item.active::before { color: var(--accent); }
.explorer-content { display: flex; flex-direction: column; height: 680px; }
.explorer-header {
  padding: 0.9rem 1.4rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.18);
}
.explorer-path { font-family: var(--mono); font-size: 0.8rem; color: #a5b4fc; word-break: break-all; }
.explorer-body { padding: 1.5rem 1.75rem; overflow-y: auto; flex: 1; }
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; color: var(--text-faint); text-align: center; padding: 2rem;
}
.empty-icon { font-size: 2.6rem; margin-bottom: 1rem; opacity: 0.5; }
.empty-state p { max-width: 420px; font-size: 0.88rem; }

/* ── Modal ──────────────────────────────────────────── */
.modal {
  display: none;
  position: fixed; z-index: 1000; inset: 0;
  background: rgba(3, 3, 6, 0.7);
  backdrop-filter: blur(6px);
  align-items: center; justify-content: center;
}
.modal.active { display: flex; }
.modal-content {
  background: var(--surface-solid);
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  width: 92%; max-width: 940px; height: 82vh;
  display: flex; flex-direction: column;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  animation: modalEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modalEnter { from { transform: scale(0.96) translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
.modal-header {
  padding: 1.1rem 1.4rem;
  border-bottom: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
}
.modal-header h3 { font-size: 1.05rem; font-weight: 700; color: #c7d2fe; word-break: break-all; }
.modal-actions { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }
.modal-close {
  background: transparent; border: none; color: var(--text-dim);
  font-size: 1.6rem; cursor: pointer; transition: color 0.15s; line-height: 1;
  padding: 0.1rem 0.4rem; border-radius: 8px;
}
.modal-close:hover { color: var(--text); background: var(--surface-hover); }
.modal-body { padding: 1.5rem 1.75rem; overflow-y: auto; flex: 1; }

/* ── Command palette ────────────────────────────────── */
.palette-overlay {
  display: none;
  position: fixed; z-index: 1100; inset: 0;
  background: rgba(3, 3, 6, 0.6);
  backdrop-filter: blur(5px);
  align-items: flex-start; justify-content: center;
  padding-top: 14vh;
}
.palette-overlay.active { display: flex; }
.palette {
  width: 92%; max-width: 580px;
  background: rgba(14, 14, 24, 0.96);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: 0 30px 90px rgba(0,0,0,0.65), 0 0 0 1px rgba(124,127,242,0.08);
  overflow: hidden;
  animation: modalEnter 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.palette input {
  width: 100%;
  padding: 1rem 1.2rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-size: 1rem;
  font-family: var(--font);
  outline: none;
}
.palette input::placeholder { color: var(--text-faint); }
.palette-results { max-height: 46vh; overflow-y: auto; padding: 0.5rem; }
.palette-item {
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.1s;
}
.palette-item:hover, .palette-item.selected { background: rgba(99, 102, 241, 0.14); }
.palette-item .p-icon {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.palette-item .p-label { font-size: 0.88rem; font-weight: 600; }
.palette-item .p-sub { font-size: 0.7rem; color: var(--text-faint); font-family: var(--mono); }
.palette-item .p-kind {
  margin-left: auto; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--text-faint); border: 1px solid var(--border); border-radius: 999px;
  padding: 0.08rem 0.5rem; flex-shrink: 0;
}
.palette-empty { padding: 1.4rem; text-align: center; color: var(--text-faint); font-size: 0.85rem; }

/* ── Markdown ───────────────────────────────────────── */
.markdown-body { font-size: 0.93rem; color: var(--text); }
.markdown-body h1, .markdown-body h2, .markdown-body h3 {
  margin-top: 1.5rem; margin-bottom: 0.8rem; font-weight: 700;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.35rem; color: #f4f4fb;
  letter-spacing: -0.01em;
}
.markdown-body h1 { font-size: 1.5rem; }
.markdown-body h2 { font-size: 1.22rem; }
.markdown-body h3 { font-size: 1.05rem; }
.markdown-body p, .markdown-body ul, .markdown-body ol { margin-bottom: 1rem; color: #c4c5d8; }
.markdown-body ul, .markdown-body ol { padding-left: 1.5rem; }
.markdown-body li { margin-bottom: 0.25rem; }
.markdown-body pre {
  background: #0b0b13 !important;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}
.markdown-body code {
  font-family: var(--mono);
  font-size: 0.82rem;
  background: rgba(255,255,255,0.06);
  padding: 0.14rem 0.35rem;
  border-radius: 5px;
  color: #f0abfc;
}
.markdown-body pre code { background: transparent; padding: 0; color: inherit; }
.markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.84rem; }
.markdown-body th, .markdown-body td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
.markdown-body th { background: rgba(255,255,255,0.03); font-weight: 600; }
.markdown-body blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 1rem; margin-bottom: 1rem;
  color: var(--text-dim); font-style: italic;
}
.markdown-body a { color: #67e8f9; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.mermaid {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
}

/* ── Responsive ─────────────────────────────────────── */
@media (max-width: 1000px) {
  .graph-layout { grid-template-columns: 1fr; height: auto; }
  .graph-rail { border-right: none; border-bottom: 1px solid var(--border); flex-direction: row; flex-wrap: wrap; }
  .graph-stage { height: 60vh; }
  .node-drawer { width: min(330px, 86vw); }
  .explorer-layout { grid-template-columns: 1fr; }
  .explorer-sidebar { border-right: none; border-bottom: 1px solid var(--border); max-height: 260px; }
  .explorer-content { height: 480px; }
  .topbar-stats { display: none; }
  .hero h1 { font-size: 1.6rem; }
  .skill-grid, .agent-grid { grid-template-columns: 1fr; }
  .wf-pipeline { flex-wrap: wrap; }
  .tabs { flex-wrap: wrap; }
}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-inner">
    <div class="brand">
      <div class="brand-mark"></div>
      <div>Engineering Intelligence<small>${vaultName}</small></div>
    </div>
    <button class="search-trigger" onclick="openPalette()">
      <span>Search skills, workflows, files…</span>
      <kbd>⌘K</kbd>
    </button>
    <div class="topbar-stats">
      <div class="stat-pill"><b>${SKILL_NAMES.length}</b> skills</div>
      <div class="stat-pill"><b>${AGENT_NAMES.length}</b> agents</div>
      <div class="stat-pill"><b>${WORKFLOW_NAMES.length}</b> workflows</div>
      <div class="stat-pill"><b id="workspace-files-count">0</b> vault files</div>
      <div class="stat-pill"><b id="vault-links-count">0</b> links</div>
    </div>
  </div>
</div>

<div class="container">
  <div class="hero">
    <h1>Intelligence Dashboard</h1>
    <p>Graph-backed engineering intelligence — explore the skill web, workflow pipelines, and your project's knowledge vault as an interactive graph, right in the browser.</p>
    <div class="hero-actions">
      <button class="btn btn-primary" onclick="viewTemplate('rules/engineering-intelligence', 'Engineering Intelligence Rules')">View Rules Template</button>
      <button class="btn" id="ws-rules-btn" style="display:none;" onclick="viewRulesInWorkspace()">Workspace Rules</button>
      <button class="btn btn-graph" onclick="switchTab('graph')"><span class="dot"></span>Open Graph View</button>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="graph"><span class="tab-icon">◉</span>Graph</button>
    <button class="tab" data-tab="skills"><span class="tab-icon">⬡</span>Skills</button>
    <button class="tab" data-tab="workflows"><span class="tab-icon">⇶</span>Workflows</button>
    <button class="tab" data-tab="agents"><span class="tab-icon">⬢</span>Agents</button>
    <button class="tab" data-tab="artifacts"><span class="tab-icon">▤</span>Vault</button>
  </div>

  <div class="tab-content active" id="graph">
    <div class="graph-layout">
      <div class="graph-rail">
        <div class="rail-section">
          <h4>Graph Mode</h4>
          <div class="mode-list">
            <button class="mode-btn active" data-mode="vault" onclick="setGraphMode('vault')"><span class="mode-icon">◈</span>Knowledge Vault</button>
            <button class="mode-btn" data-mode="skills" onclick="setGraphMode('skills')"><span class="mode-icon">⬡</span>Skill Web</button>
            <button class="mode-btn" data-mode="arch" onclick="setGraphMode('arch')"><span class="mode-icon">⌘</span>Architecture</button>
          </div>
        </div>
        <div class="rail-section" id="archLayersSection" style="display:none;">
          <h4>Layers</h4>
          <div class="layer-chips">
            <button class="layer-chip active" data-layer="dependency">Dependency</button>
            <button class="layer-chip active" data-layer="service">Service</button>
            <button class="layer-chip" data-layer="runtime">Runtime</button>
            <button class="layer-chip" data-layer="business-flow">Business Flow</button>
          </div>
        </div>
        <div class="rail-section">
          <h4>Filter</h4>
          <input id="graphSearch" class="graph-search-input" type="text" placeholder="Highlight nodes…" autocomplete="off">
        </div>
        <div class="rail-section">
          <h4>Display</h4>
          <div class="rail-toggle on" id="toggleLabels" onclick="toggleSetting('labels')"><span>Labels</span><span class="switch"></span></div>
          <div class="rail-toggle" id="toggleOrphans" onclick="toggleSetting('orphans')"><span>Hide orphans</span><span class="switch"></span></div>
          <div class="rail-toggle" id="toggleArrows" onclick="toggleSetting('arrows')"><span>Arrows</span><span class="switch"></span></div>
        </div>
        <div class="rail-section">
          <h4>Forces</h4>
          <div class="rail-slider">
            <label><span>Repel</span></label>
            <input type="range" id="forceRepel" min="20" max="600" value="180">
          </div>
          <div class="rail-slider">
            <label><span>Link distance</span></label>
            <input type="range" id="forceDist" min="20" max="220" value="70">
          </div>
        </div>
        <div class="rail-section">
          <h4>Groups</h4>
          <div class="legend-list" id="graphLegend"></div>
        </div>
      </div>
      <div class="graph-stage" id="graphStage">
        <canvas id="graphCanvas"></canvas>
        <div class="graph-hud">
          <span class="hud-pill" id="graphStats">—</span>
          <button class="hud-pill" onclick="fitGraph()">Fit</button>
          <button class="hud-pill" onclick="reheatGraph()">Re-layout</button>
        </div>
        <div class="graph-empty" id="graphEmpty">
          <div style="font-size:2.2rem;opacity:0.5;">◇</div>
          <div>No graph data for this mode yet.<br>Run <code style="font-family:var(--mono);color:#a5b4fc;">/initialize-engineering-intelligence</code> to generate the knowledge vault and architecture graphs.</div>
        </div>
        <div class="node-drawer" id="nodeDrawer">
          <div class="drawer-head">
            <div class="drawer-head-row">
              <div class="drawer-title" id="drawerTitle">—</div>
              <button class="drawer-close" onclick="closeDrawer()">×</button>
            </div>
            <div class="drawer-sub" id="drawerSub"></div>
          </div>
          <div class="drawer-body" id="drawerBody"></div>
          <div class="drawer-actions" id="drawerActions"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="tab-content" id="skills">
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
          <button id="explorerGraphBtn" class="btn btn-sm btn-graph" style="display:none;"><span class="dot"></span>View in Graph</button>
        </div>
        <div id="explorerFileContent" class="explorer-body">
          <div class="empty-state">
            <div class="empty-icon">▤</div>
            <p>Choose an intelligence or lifecycle artifact from the list to read it, rendered with Mermaid architecture maps — or jump to its position in the knowledge graph.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal File Viewer -->
<div id="fileModal" class="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="modalTitle">File Viewer</h3>
      <div class="modal-actions">
        <button id="modalGraphBtn" class="btn btn-sm btn-graph" style="display:none;"><span class="dot"></span>View in Graph</button>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
    </div>
    <div id="modalBody" class="modal-body markdown-body"></div>
  </div>
</div>

<!-- Command palette -->
<div id="paletteOverlay" class="palette-overlay" onclick="if(event.target===this)closePalette()">
  <div class="palette">
    <input id="paletteInput" type="text" placeholder="Jump to a skill, workflow, agent, or vault file…" autocomplete="off">
    <div class="palette-results" id="paletteResults"></div>
  </div>
</div>

<!-- Scripts -->
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-markdown.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-json.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>

<script>
// ── Data payloads injected from server-side ──────────────────────────
const TEMPLATES = ${safeJson(templates)};
const WORKSPACE_FILES = ${safeJson(workspaceFiles)};
const VAULT_NAME = ${safeJson(vaultName)};
const SKILL_CATALOG = ${safeJson(SKILL_CATALOG)};
const WORKFLOW_CATALOG = ${safeJson(WORKFLOW_CATALOG)};
const CATEGORY_COLORS = ${safeJson(CATEGORY_COLORS)};
const CATEGORY_LABELS = ${safeJson(CATEGORY_LABELS)};

// ── Utilities ────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function basename(p) { return p.substring(p.lastIndexOf('/') + 1); }
function stem(p) { const b = basename(p); const i = b.lastIndexOf('.'); return i > 0 ? b.substring(0, i) : b; }

// ── Markdown / Mermaid setup ─────────────────────────────────────────
mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
const renderer = new marked.Renderer();
// marked >= 12 passes a token object; older versions pass (code, lang).
renderer.code = function(codeOrToken, langArg) {
  const isToken = typeof codeOrToken === 'object' && codeOrToken !== null;
  const code = isToken ? codeOrToken.text : codeOrToken;
  const lang = (isToken ? codeOrToken.lang : langArg) || '';
  if (lang === 'mermaid') {
    return '<div class="mermaid">' + escapeHtml(code) + '</div>';
  }
  return '<pre><code class="language-' + escapeHtml(lang) + '">' + escapeHtml(code) + '</code></pre>';
};
marked.setOptions({ renderer });

function renderContentHtml(filePath, content) {
  if (filePath.toLowerCase().endsWith('.json')) {
    return '<pre><code class="language-json">' + escapeHtml(content) + '</code></pre>';
  }
  return marked.parse(content);
}
function postRender(container) {
  Prism.highlightAllUnder(container);
  if (window.mermaid) {
    try { mermaid.run({ nodes: container.querySelectorAll('.mermaid') }); } catch (e) { console.error(e); }
  }
}

// ── Tabs ─────────────────────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.toggle('active', t.dataset.tab === tabId); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.toggle('active', c.id === tabId); });
  if (tabId === 'graph') { ensureGraph(); resizeGraph(); }
  if (tabId === 'artifacts') {
    const activeFile = document.querySelector('.file-item.active');
    if (!activeFile) {
      const firstFile = document.querySelector('.file-item');
      if (firstFile) firstFile.click();
    }
  }
}
document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() { switchTab(tab.dataset.tab); });
});

// ── Category filtering on skills ─────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    btn.classList.toggle('active');
    const active = Array.from(document.querySelectorAll('.filter-btn.active')).map(function(b) { return b.dataset.filter; });
    document.querySelectorAll('.skill-card').forEach(function(card) {
      card.classList.toggle('hidden', !active.includes(card.dataset.category));
    });
  });
});

// ── Modal ────────────────────────────────────────────────────────────
function closeModal() {
  document.getElementById('fileModal').classList.remove('active');
  document.getElementById('modalBody').innerHTML = '';
}
function openModal(title, renderedContent, graphTarget) {
  document.getElementById('modalTitle').innerText = title;
  const body = document.getElementById('modalBody');
  body.innerHTML = renderedContent;
  const graphBtn = document.getElementById('modalGraphBtn');
  if (graphTarget) {
    graphBtn.style.display = 'inline-flex';
    graphBtn.onclick = function() { closeModal(); focusGraphNode(graphTarget.mode, graphTarget.id); };
  } else {
    graphBtn.style.display = 'none';
  }
  document.getElementById('fileModal').classList.add('active');
  postRender(body);
}

// ── Workspace lookups ────────────────────────────────────────────────
function findWorkspaceSkillPath(skillId) {
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    if (filePath.includes('/skills/' + skillId + '/') || filePath.endsWith('/' + skillId + '/SKILL.md')) return filePath;
  }
  return null;
}
function findWorkspaceWorkflowPath(wfName) {
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    if (filePath.includes('/workflows/' + wfName + '.md') || filePath.endsWith('/' + wfName + '.md')) return filePath;
  }
  return null;
}
function findWorkspaceRulesPath() {
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    if (filePath.includes('engineering-intelligence.md') && filePath.includes('/rules')) return filePath;
  }
  return null;
}

// ── View content ─────────────────────────────────────────────────────
function viewTemplate(key, title) {
  const content = TEMPLATES[key] || 'Template content empty or missing.';
  openModal(title, marked.parse(content), null);
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
  const content = WORKSPACE_FILES[filePath] || '';
  const graphTarget = filePath.endsWith('.md') ? { mode: 'vault', id: filePath } : null;
  openModal(filePath, renderContentHtml(filePath, content), graphTarget);
}

// ── Vault explorer ───────────────────────────────────────────────────
function viewWorkspaceFile(filePath) {
  const content = WORKSPACE_FILES[filePath] || '';
  const container = document.getElementById('explorerFileContent');
  document.getElementById('explorerFilePath').innerText = filePath;
  const graphBtn = document.getElementById('explorerGraphBtn');
  if (filePath.endsWith('.md')) {
    graphBtn.style.display = 'inline-flex';
    graphBtn.onclick = function() { focusGraphNode('vault', filePath); };
  } else {
    graphBtn.style.display = 'none';
  }
  container.innerHTML = renderContentHtml(filePath, content);
  postRender(container);
}

function renderFileList() {
  const fileListContainer = document.getElementById('fileList');
  fileListContainer.innerHTML = '';
  const filesCount = Object.keys(WORKSPACE_FILES).length;
  document.getElementById('workspace-files-count').innerText = filesCount;
  if (filesCount === 0) {
    fileListContainer.innerHTML = '<div style="color:var(--text-faint);font-size:0.8rem;text-align:center;padding:1rem;">No workspace files detected. Run /initialize-engineering-intelligence first.</div>';
    return;
  }
  const groups = {};
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    const parts = filePath.split('/');
    const groupName = parts.length > 2 ? parts[1] : 'core';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(filePath);
  }
  Object.keys(groups).sort().forEach(function(groupName) {
    const paths = groups[groupName];
    const groupDiv = document.createElement('div');
    groupDiv.className = 'file-group';
    const header = document.createElement('div');
    header.className = 'file-group-header';
    header.innerHTML = escapeHtml(groupName.replace(/-/g, ' ')) + ' <span class="count">' + paths.length + '</span>';
    groupDiv.appendChild(header);
    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'file-group-items';
    paths.sort().forEach(function(filePath) {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.textContent = basename(filePath);
      item.addEventListener('click', function() {
        document.querySelectorAll('.file-item').forEach(function(el) { el.classList.remove('active'); });
        item.classList.add('active');
        viewWorkspaceFile(filePath);
      });
      itemsDiv.appendChild(item);
    });
    groupDiv.appendChild(itemsDiv);
    fileListContainer.appendChild(groupDiv);
  });
}

function openFileInExplorer(filePath) {
  switchTab('artifacts');
  const items = document.querySelectorAll('.file-item');
  for (const item of items) {
    if (item.textContent === basename(filePath)) {
      item.click();
      item.scrollIntoView({ block: 'nearest' });
      return;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
//  GRAPH VIEW — Obsidian-style force-directed graph on canvas
// ═════════════════════════════════════════════════════════════════════
const GROUP_PALETTE = ['#8b93ff', '#4ade80', '#fbbf24', '#22d3ee', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171', '#60a5fa', '#e879f9', '#a3e635'];

const graphState = {
  initialized: false,
  mode: 'vault',
  layers: { 'dependency': true, 'service': true, 'runtime': false, 'business-flow': false },
  settings: { labels: true, orphans: false, arrows: false },
  hiddenGroups: new Set(),
  nodes: [],
  links: [],
  adjacency: new Map(),
  groupColors: new Map(),
  groupCounts: new Map(),
  sim: null,
  transform: d3.zoomIdentity,
  hoverNode: null,
  selectedNode: null,
  searchTerm: '',
  canvas: null,
  ctx: null,
  dpr: 1,
  zoomBehavior: null,
  pendingFocus: null,
  userMoved: false,
};

function groupColor(group) {
  if (!graphState.groupColors.has(group)) {
    graphState.groupColors.set(group, GROUP_PALETTE[graphState.groupColors.size % GROUP_PALETTE.length]);
  }
  return graphState.groupColors.get(group);
}

// ── Graph builders ───────────────────────────────────────────────────
// Vault: nodes are workspace markdown files; edges are [[wikilinks]],
// markdown links, and cross-file basename mentions (Obsidian-style).
function buildVaultGraph() {
  const files = Object.keys(WORKSPACE_FILES).filter(function(f) { return f.endsWith('.md'); });
  const nodes = files.map(function(f) {
    const parts = f.split('/');
    return { id: f, label: stem(f), group: parts.length > 2 ? parts[1] : 'core', kind: 'file' };
  });
  const linkSet = new Set();
  const links = [];
  function addLink(a, b, rel) {
    if (a === b) return;
    const key = a + '\\u0000' + b;
    const rkey = b + '\\u0000' + a;
    if (linkSet.has(key) || linkSet.has(rkey)) return;
    linkSet.add(key);
    links.push({ source: a, target: b, relation: rel });
  }
  const byStem = new Map();
  const byBase = new Map();
  for (const f of files) {
    byStem.set(stem(f).toLowerCase(), f);
    byBase.set(basename(f), f);
  }
  for (const f of files) {
    const content = WORKSPACE_FILES[f] || '';
    // explicit wikilinks: [[target]] or [[target|alias]]
    const wikiRe = /\\[\\[([^\\]|#]+)/g;
    let m;
    while ((m = wikiRe.exec(content)) !== null) {
      const target = byStem.get(m[1].trim().toLowerCase());
      if (target) addLink(f, target, 'wikilink');
    }
    // markdown links + raw basename mentions of other vault files
    for (const other of files) {
      if (other === f) continue;
      if (content.includes(basename(other))) addLink(f, other, 'mentions');
    }
  }
  return { nodes: nodes, links: links };
}

// Skills: the installed skill catalog + workflow pipelines.
function buildSkillsGraph() {
  const nodes = [];
  const links = [];
  for (const id of Object.keys(SKILL_CATALOG)) {
    const info = SKILL_CATALOG[id];
    nodes.push({ id: id, label: info.name, group: info.category, kind: 'skill' });
    for (const dep of info.dependsOn) {
      if (SKILL_CATALOG[dep]) links.push({ source: id, target: dep, relation: 'depends on' });
    }
  }
  for (const wf of WORKFLOW_CATALOG) {
    const wfId = 'wf:' + wf.name;
    nodes.push({ id: wfId, label: wf.name, group: 'workflow', kind: 'workflow' });
    const seen = new Set();
    for (const step of wf.steps) {
      if (SKILL_CATALOG[step.skill] && !seen.has(step.skill)) {
        seen.add(step.skill);
        links.push({ source: wfId, target: step.skill, relation: 'runs' });
      }
    }
  }
  return { nodes: nodes, links: links };
}

// Architecture: real nodes/edges from .engineering-intelligence/graph/*.json
function buildArchGraph() {
  const nodes = [];
  const links = [];
  const nodeIds = new Set();
  for (const layer of Object.keys(graphState.layers)) {
    if (!graphState.layers[layer]) continue;
    let parsed = null;
    for (const filePath of Object.keys(WORKSPACE_FILES)) {
      if (filePath.endsWith('/graph/' + layer + '-graph.json')) {
        try { parsed = JSON.parse(WORKSPACE_FILES[filePath]); } catch (e) { parsed = null; }
        break;
      }
    }
    if (!parsed) continue;
    for (const n of (parsed.nodes || [])) {
      if (nodeIds.has(n.id)) continue;
      nodeIds.add(n.id);
      nodes.push({ id: n.id, label: n.label || n.id, group: n.kind || 'node', kind: 'arch', meta: n });
    }
    for (const e of (parsed.edges || [])) {
      if (nodeIds.has(e.from) && nodeIds.has(e.to)) {
        links.push({ source: e.from, target: e.to, relation: e.relation || 'link' });
      }
    }
  }
  return { nodes: nodes, links: links };
}

// ── Graph lifecycle ──────────────────────────────────────────────────
function rebuildGraph() {
  const built = graphState.mode === 'vault' ? buildVaultGraph()
    : graphState.mode === 'skills' ? buildSkillsGraph()
    : buildArchGraph();

  // degree + adjacency computed on the full graph, filters applied after
  const degree = new Map();
  for (const l of built.links) {
    degree.set(l.source, (degree.get(l.source) || 0) + 1);
    degree.set(l.target, (degree.get(l.target) || 0) + 1);
  }
  let nodes = built.nodes.map(function(n) {
    return Object.assign({}, n, { degree: degree.get(n.id) || 0 });
  });

  graphState.groupCounts = new Map();
  for (const n of nodes) {
    graphState.groupCounts.set(n.group, (graphState.groupCounts.get(n.group) || 0) + 1);
    groupColor(n.group);
  }

  if (graphState.settings.orphans) nodes = nodes.filter(function(n) { return n.degree > 0; });
  nodes = nodes.filter(function(n) { return !graphState.hiddenGroups.has(n.group); });
  const nodeIds = new Set(nodes.map(function(n) { return n.id; }));
  const links = built.links
    .filter(function(l) { return nodeIds.has(l.source) && nodeIds.has(l.target); })
    .map(function(l) { return Object.assign({}, l); });

  // preserve positions across rebuilds so the layout doesn't jump
  const prev = new Map();
  for (const n of graphState.nodes) prev.set(n.id, n);
  for (const n of nodes) {
    const p = prev.get(n.id);
    if (p) { n.x = p.x; n.y = p.y; n.vx = p.vx; n.vy = p.vy; }
  }

  graphState.nodes = nodes;
  graphState.links = links;
  graphState.adjacency = new Map();
  for (const l of links) {
    if (!graphState.adjacency.has(l.source)) graphState.adjacency.set(l.source, new Set());
    if (!graphState.adjacency.has(l.target)) graphState.adjacency.set(l.target, new Set());
    graphState.adjacency.get(l.source).add(l.target);
    graphState.adjacency.get(l.target).add(l.source);
  }
  graphState.hoverNode = null;
  if (graphState.selectedNode && !nodeIds.has(graphState.selectedNode.id)) {
    graphState.selectedNode = null;
    closeDrawer();
  }

  document.getElementById('graphStats').textContent = nodes.length + ' nodes · ' + links.length + ' links';
  document.getElementById('graphEmpty').classList.toggle('visible', nodes.length === 0);
  renderLegend();
  restartSimulation();
}

function restartSimulation() {
  if (graphState.sim) graphState.sim.stop();
  const repel = Number(document.getElementById('forceRepel').value);
  const dist = Number(document.getElementById('forceDist').value);
  graphState.sim = d3.forceSimulation(graphState.nodes)
    .force('link', d3.forceLink(graphState.links).id(function(d) { return d.id; }).distance(dist).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-repel))
    .force('center', d3.forceCenter(0, 0))
    .force('collide', d3.forceCollide().radius(function(d) { return nodeRadius(d) + 3; }))
    .force('x', d3.forceX().strength(0.04))
    .force('y', d3.forceY().strength(0.04))
    .on('tick', drawGraph)
    .on('end', function() {
      // settle-time fit — skipped once the user has taken over the viewport
      if (!graphState.userMoved && !graphState.selectedNode) fitGraph();
    });
  graphState.sim.alpha(1).restart();
  if (graphState.pendingFocus) {
    const id = graphState.pendingFocus;
    graphState.pendingFocus = null;
    setTimeout(function() { selectNodeById(id, true); }, 550);
  } else {
    setTimeout(fitGraph, 700);
  }
}

function nodeRadius(d) {
  return Math.min(3 + Math.sqrt(d.degree || 0) * 1.7, 16);
}

// ── Rendering ────────────────────────────────────────────────────────
function drawGraph() {
  const c = graphState.canvas;
  const ctx = graphState.ctx;
  if (!c || !ctx) return;
  const w = c.width / graphState.dpr;
  const h = c.height / graphState.dpr;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  // world origin sits at the canvas center; zoom/fit/hit-testing all assume this
  ctx.translate(w / 2 + graphState.transform.x, h / 2 + graphState.transform.y);
  ctx.scale(graphState.transform.k, graphState.transform.k);

  const t = graphState.transform;
  const focus = graphState.hoverNode || graphState.selectedNode;
  const neighbors = focus ? (graphState.adjacency.get(focus.id) || new Set()) : null;
  const term = graphState.searchTerm;

  function nodeAlpha(n) {
    if (term) {
      return (n.label.toLowerCase().includes(term) || n.id.toLowerCase().includes(term)) ? 1 : 0.08;
    }
    if (!focus) return 1;
    if (n.id === focus.id || neighbors.has(n.id)) return 1;
    return 0.08;
  }

  // edges
  for (const l of graphState.links) {
    const s = l.source, e = l.target;
    if (s.x == null || e.x == null) continue;
    let alpha = 0.16;
    if (focus) {
      alpha = (s.id === focus.id || e.id === focus.id) ? 0.55 : 0.03;
    } else if (term) {
      alpha = 0.05;
    }
    ctx.strokeStyle = 'rgba(148, 163, 184, ' + alpha + ')';
    ctx.lineWidth = (focus && (s.id === focus.id || e.id === focus.id) ? 1.4 : 0.8) / t.k;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    if (graphState.settings.arrows && t.k > 0.5) {
      const dx = e.x - s.x, dy = e.y - s.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len, uy = dy / len;
      const tipX = e.x - ux * (nodeRadius(e) + 2);
      const tipY = e.y - uy * (nodeRadius(e) + 2);
      const size = 4 / t.k;
      ctx.fillStyle = 'rgba(148, 163, 184, ' + alpha + ')';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - ux * size * 2 - uy * size, tipY - uy * size * 2 + ux * size);
      ctx.lineTo(tipX - ux * size * 2 + uy * size, tipY - uy * size * 2 - ux * size);
      ctx.closePath();
      ctx.fill();
    }
  }

  // nodes
  for (const n of graphState.nodes) {
    if (n.x == null) continue;
    const r = nodeRadius(n);
    const alpha = nodeAlpha(n);
    const color = groupColor(n.group);
    ctx.globalAlpha = alpha;
    const isFocus = focus && n.id === focus.id;
    if (isFocus || (term && alpha === 1)) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (isFocus) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.6 / t.k;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 2.5 / t.k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // labels — fade in with zoom (Obsidian-style), always show for focus/neighbors
  const labelBase = graphState.settings.labels ? Math.max(0, Math.min(1, (t.k - 0.7) / 0.7)) : 0;
  if (labelBase > 0.02 || focus || term) {
    ctx.font = (11 / t.k) + 'px ' + 'Inter, sans-serif';
    ctx.textAlign = 'center';
    for (const n of graphState.nodes) {
      if (n.x == null) continue;
      let la = labelBase;
      if (focus) {
        la = (n.id === focus.id || neighbors.has(n.id)) ? 1 : 0;
      } else if (term) {
        la = (n.label.toLowerCase().includes(term) || n.id.toLowerCase().includes(term)) ? 1 : 0;
      }
      if (la <= 0.02) continue;
      const a = la * nodeAlpha(n);
      if (a <= 0.02) continue;
      ctx.fillStyle = 'rgba(226, 232, 240, ' + a * 0.9 + ')';
      ctx.fillText(n.label, n.x, n.y + nodeRadius(n) + 13 / t.k);
    }
  }
  ctx.restore();
}

// ── Canvas setup: zoom, pan, drag, hover, click ─────────────────────
function initGraphCanvas() {
  const canvas = document.getElementById('graphCanvas');
  const stage = document.getElementById('graphStage');
  graphState.canvas = canvas;
  graphState.ctx = canvas.getContext('2d');

  function resize() {
    const rect = stage.getBoundingClientRect();
    graphState.dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * graphState.dpr;
    canvas.height = rect.height * graphState.dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    graphState.ctx.setTransform(graphState.dpr, 0, 0, graphState.dpr, 0, 0);
    // keep origin centered
    drawGraph();
  }
  window.addEventListener('resize', resize);
  window.__resizeGraph = resize;
  resize();

  const sel = d3.select(canvas);

  function worldPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    return [(x - graphState.transform.x) / graphState.transform.k, (y - graphState.transform.y) / graphState.transform.k];
  }
  function findNode(event, radius) {
    const p = worldPoint(event);
    let best = null, bestDist = (radius || 14) / graphState.transform.k;
    for (const n of graphState.nodes) {
      if (n.x == null) continue;
      const d = Math.sqrt((n.x - p[0]) * (n.x - p[0]) + (n.y - p[1]) * (n.y - p[1]));
      if (d < bestDist + nodeRadius(n)) { best = n; bestDist = d; }
    }
    return best;
  }

  graphState.zoomBehavior = d3.zoom()
    .scaleExtent([0.15, 8])
    .filter(function(event) { return !event.button && event.type !== 'dblclick'; })
    .on('zoom', function(event) {
      if (event.sourceEvent) graphState.userMoved = true;
      graphState.transform = event.transform;
      drawGraph();
    });
  sel.call(graphState.zoomBehavior);

  sel.call(d3.drag()
    .container(canvas)
    .subject(function(event) { return findNode(event.sourceEvent || event, 12); })
    .on('start', function(event) {
      if (!event.subject) return;
      canvas.classList.add('dragging');
      if (!event.active) graphState.sim.alphaTarget(0.25).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on('drag', function(event) {
      if (!event.subject) return;
      const p = worldPoint(event.sourceEvent);
      event.subject.fx = p[0];
      event.subject.fy = p[1];
    })
    .on('end', function(event) {
      canvas.classList.remove('dragging');
      if (!event.subject) return;
      if (!event.active) graphState.sim.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }));

  canvas.addEventListener('mousemove', function(event) {
    const n = findNode(event, 10);
    if (n !== graphState.hoverNode) {
      graphState.hoverNode = n;
      canvas.style.cursor = n ? 'pointer' : 'grab';
      drawGraph();
    }
  });
  canvas.addEventListener('mouseleave', function() {
    if (graphState.hoverNode) { graphState.hoverNode = null; drawGraph(); }
  });
  canvas.addEventListener('click', function(event) {
    const n = findNode(event, 10);
    if (n) { selectNode(n, false); } else { graphState.selectedNode = null; closeDrawer(); drawGraph(); }
  });
  canvas.addEventListener('dblclick', function(event) {
    const n = findNode(event, 10);
    if (n) openNodeContent(n);
  });
}

function resizeGraph() { if (window.__resizeGraph) window.__resizeGraph(); }

function ensureGraph() {
  if (graphState.initialized) return;
  graphState.initialized = true;
  initGraphCanvas();
  rebuildGraph();
}

// zoom transform is relative to canvas center
function centerOnNode(n) {
  const canvas = graphState.canvas;
  const rect = canvas.getBoundingClientRect();
  const k = Math.max(graphState.transform.k, 1.4);
  const t = d3.zoomIdentity.translate(-n.x * k, -n.y * k).scale(k);
  d3.select(canvas).transition().duration(500).call(graphState.zoomBehavior.transform, t);
}

function fitGraph() {
  const nodes = graphState.nodes.filter(function(n) { return n.x != null; });
  if (!nodes.length || !graphState.canvas) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
  }
  const rect = graphState.canvas.getBoundingClientRect();
  const w = maxX - minX + 80, h = maxY - minY + 80;
  const k = Math.max(0.15, Math.min(2.5, Math.min(rect.width / w, rect.height / h)));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const t = d3.zoomIdentity.translate(-cx * k, -cy * k).scale(k);
  d3.select(graphState.canvas).transition().duration(450).call(graphState.zoomBehavior.transform, t);
}

function reheatGraph() {
  if (graphState.sim) graphState.sim.alpha(0.9).restart();
}

// ── Node selection + inspector drawer ────────────────────────────────
function selectNode(n, center) {
  graphState.selectedNode = n;
  if (center) centerOnNode(n);
  renderDrawer(n);
  drawGraph();
}
function selectNodeById(id, center) {
  const n = graphState.nodes.find(function(x) { return x.id === id; });
  if (n) selectNode(n, center);
}
function closeDrawer() {
  document.getElementById('nodeDrawer').classList.remove('open');
  graphState.selectedNode = null;
  drawGraph();
}

function linkListHtml(items) {
  if (!items.length) return '<div class="link-empty">None</div>';
  return items.map(function(it) {
    return '<div class="link-item" onclick="selectNodeById(' + escapeHtml(JSON.stringify(it.id)) + ', true)">' +
      '<span class="swatch" style="background:' + groupColor(it.group) + '"></span>' +
      '<span>' + escapeHtml(it.label) + '</span>' +
      (it.rel ? '<span class="rel">' + escapeHtml(it.rel) + '</span>' : '') +
      '</div>';
  }).join('');
}

function renderDrawer(n) {
  const drawer = document.getElementById('nodeDrawer');
  const color = groupColor(n.group);
  document.getElementById('drawerTitle').textContent = n.label;
  const groupLabel = n.kind === 'skill' ? (CATEGORY_LABELS[n.group] || n.group) : n.group;
  document.getElementById('drawerSub').innerHTML =
    '<span class="drawer-chip" style="color:' + color + ';background:color-mix(in srgb, ' + color + ' 14%, transparent);border:1px solid color-mix(in srgb, ' + color + ' 40%, transparent);">' + escapeHtml(groupLabel) + '</span>' +
    '<span class="drawer-meta">' + n.degree + ' connections</span>';

  const outgoing = [];
  const incoming = [];
  const byId = new Map(graphState.nodes.map(function(x) { return [x.id, x]; }));
  for (const l of graphState.links) {
    const sId = l.source.id || l.source, tId = l.target.id || l.target;
    if (sId === n.id) {
      const t = byId.get(tId);
      if (t) outgoing.push({ id: t.id, label: t.label, group: t.group, rel: l.relation });
    } else if (tId === n.id) {
      const s = byId.get(sId);
      if (s) incoming.push({ id: s.id, label: s.label, group: s.group, rel: l.relation });
    }
  }

  let bodyHtml = '';
  if (n.kind === 'skill' && SKILL_CATALOG[n.id]) {
    bodyHtml += '<div class="drawer-desc">' + escapeHtml(SKILL_CATALOG[n.id].description) + '</div>';
  } else if (n.kind === 'workflow') {
    const wf = WORKFLOW_CATALOG.find(function(w) { return 'wf:' + w.name === n.id; });
    if (wf) bodyHtml += '<div class="drawer-desc">' + escapeHtml(wf.description) + ' · ' + wf.steps.length + ' steps · ' + wf.type + '</div>';
  } else if (n.kind === 'file') {
    bodyHtml += '<div class="drawer-desc" style="font-family:var(--mono);font-size:0.72rem;word-break:break-all;">' + escapeHtml(n.id) + '</div>';
  } else if (n.kind === 'arch' && n.meta) {
    bodyHtml += '<div class="drawer-desc" style="font-family:var(--mono);font-size:0.72rem;word-break:break-all;">' + escapeHtml(n.meta.path || n.id) + '</div>';
    if (n.meta.confidence) bodyHtml += '<div class="drawer-section-title">Confidence</div><div class="drawer-desc">' + escapeHtml(n.meta.confidence) + '</div>';
    if (n.meta.evidence && n.meta.evidence.length) {
      bodyHtml += '<div class="drawer-section-title">Evidence</div><div class="drawer-desc" style="font-family:var(--mono);font-size:0.7rem;">' + n.meta.evidence.map(escapeHtml).join('<br>') + '</div>';
    }
  }
  bodyHtml += '<div class="drawer-section-title">Outgoing <span class="n">' + outgoing.length + '</span></div>' + linkListHtml(outgoing);
  bodyHtml += '<div class="drawer-section-title">Backlinks <span class="n">' + incoming.length + '</span></div>' + linkListHtml(incoming);
  document.getElementById('drawerBody').innerHTML = bodyHtml;

  const actions = document.getElementById('drawerActions');
  actions.innerHTML = '';
  const openBtn = document.createElement('button');
  openBtn.className = 'btn btn-sm btn-primary';
  if (n.kind === 'file') {
    openBtn.textContent = 'Open file';
    openBtn.onclick = function() { viewWorkspaceFileInModal(n.id); };
  } else if (n.kind === 'skill') {
    openBtn.textContent = 'View template';
    openBtn.onclick = function() { viewTemplate('skills/' + n.id, n.label); };
  } else if (n.kind === 'workflow') {
    openBtn.textContent = 'View template';
    openBtn.onclick = function() { viewTemplate('workflows/' + n.id.substring(3), n.label); };
  } else {
    openBtn.textContent = 'Center';
    openBtn.onclick = function() { centerOnNode(n); };
  }
  actions.appendChild(openBtn);
  const centerBtn = document.createElement('button');
  centerBtn.className = 'btn btn-sm';
  centerBtn.textContent = 'Center';
  centerBtn.onclick = function() { centerOnNode(n); };
  if (openBtn.textContent !== 'Center') actions.appendChild(centerBtn);

  drawer.classList.add('open');
}

function openNodeContent(n) {
  if (n.kind === 'file') viewWorkspaceFileInModal(n.id);
  else if (n.kind === 'skill') viewTemplate('skills/' + n.id, n.label);
  else if (n.kind === 'workflow') viewTemplate('workflows/' + n.id.substring(3), n.label);
}

// ── Graph controls ───────────────────────────────────────────────────
function setGraphMode(mode) {
  graphState.mode = mode;
  graphState.hiddenGroups = new Set();
  graphState.groupColors = new Map();
  graphState.userMoved = false;
  document.querySelectorAll('.mode-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.mode === mode); });
  document.getElementById('archLayersSection').style.display = mode === 'arch' ? 'block' : 'none';
  if (graphState.initialized) rebuildGraph();
}

function toggleSetting(name) {
  graphState.settings[name] = !graphState.settings[name];
  const el = document.getElementById(name === 'labels' ? 'toggleLabels' : name === 'orphans' ? 'toggleOrphans' : 'toggleArrows');
  el.classList.toggle('on', graphState.settings[name]);
  if (name === 'orphans') rebuildGraph(); else drawGraph();
}

function renderLegend() {
  const legend = document.getElementById('graphLegend');
  legend.innerHTML = '';
  const groups = Array.from(graphState.groupCounts.keys()).sort();
  for (const g of groups) {
    const item = document.createElement('div');
    item.className = 'legend-item' + (graphState.hiddenGroups.has(g) ? ' off' : '');
    const color = groupColor(g);
    const label = graphState.mode === 'skills' ? (CATEGORY_LABELS[g] || g) : g.replace(/-/g, ' ');
    item.innerHTML = '<span class="swatch" style="background:' + color + ';color:' + color + '"></span><span>' + escapeHtml(label) + '</span><span class="count">' + graphState.groupCounts.get(g) + '</span>';
    item.onclick = function() {
      if (graphState.hiddenGroups.has(g)) graphState.hiddenGroups.delete(g); else graphState.hiddenGroups.add(g);
      rebuildGraph();
    };
    legend.appendChild(item);
  }
}

document.querySelectorAll('.layer-chip').forEach(function(chip) {
  chip.addEventListener('click', function() {
    const layer = chip.dataset.layer;
    graphState.layers[layer] = !graphState.layers[layer];
    chip.classList.toggle('active', graphState.layers[layer]);
    if (graphState.initialized && graphState.mode === 'arch') rebuildGraph();
  });
});

document.getElementById('graphSearch').addEventListener('input', function(e) {
  graphState.searchTerm = e.target.value.trim().toLowerCase();
  drawGraph();
});

document.getElementById('forceRepel').addEventListener('input', function() { if (graphState.initialized) restartSimulation(); });
document.getElementById('forceDist').addEventListener('input', function() { if (graphState.initialized) restartSimulation(); });

// Jump to a node in the graph from anywhere in the dashboard.
function focusGraphNode(mode, id) {
  switchTab('graph');
  if (graphState.mode !== mode) {
    graphState.pendingFocus = id;
    setGraphMode(mode);
  } else {
    ensureGraph();
    const n = graphState.nodes.find(function(x) { return x.id === id; });
    if (n) selectNode(n, true);
    else { graphState.pendingFocus = id; rebuildGraph(); }
  }
}

// ── Command palette (⌘K) ─────────────────────────────────────────────
let paletteIndex = [];
let paletteSelected = 0;

function buildPaletteIndex() {
  paletteIndex = [];
  for (const id of Object.keys(SKILL_CATALOG)) {
    paletteIndex.push({ kind: 'skill', icon: '⬡', label: SKILL_CATALOG[id].name, sub: id, action: function() { focusGraphNode('skills', id); } });
  }
  for (const wf of WORKFLOW_CATALOG) {
    (function(wf) {
      paletteIndex.push({ kind: 'workflow', icon: '⇶', label: wf.name, sub: wf.description, action: function() { focusGraphNode('skills', 'wf:' + wf.name); } });
    })(wf);
  }
  for (const filePath of Object.keys(WORKSPACE_FILES)) {
    (function(filePath) {
      paletteIndex.push({ kind: 'file', icon: '◈', label: basename(filePath), sub: filePath, action: function() { openFileInExplorer(filePath); } });
    })(filePath);
  }
}

function openPalette() {
  buildPaletteIndex();
  document.getElementById('paletteOverlay').classList.add('active');
  const input = document.getElementById('paletteInput');
  input.value = '';
  renderPaletteResults('');
  setTimeout(function() { input.focus(); }, 30);
}
function closePalette() {
  document.getElementById('paletteOverlay').classList.remove('active');
}
function renderPaletteResults(query) {
  const q = query.trim().toLowerCase();
  const results = paletteIndex.filter(function(item) {
    return !q || item.label.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q);
  }).slice(0, 12);
  paletteSelected = 0;
  const container = document.getElementById('paletteResults');
  if (!results.length) {
    container.innerHTML = '<div class="palette-empty">No matches.</div>';
    return;
  }
  container.innerHTML = '';
  results.forEach(function(item, i) {
    const div = document.createElement('div');
    div.className = 'palette-item' + (i === 0 ? ' selected' : '');
    div.innerHTML = '<span class="p-icon">' + item.icon + '</span><span><div class="p-label">' + escapeHtml(item.label) + '</div><div class="p-sub">' + escapeHtml(item.sub) + '</div></span><span class="p-kind">' + item.kind + '</span>';
    div.onclick = function() { closePalette(); item.action(); };
    div.__action = item.action;
    container.appendChild(div);
  });
}
document.getElementById('paletteInput').addEventListener('input', function(e) { renderPaletteResults(e.target.value); });
document.getElementById('paletteInput').addEventListener('keydown', function(e) {
  const items = document.querySelectorAll('.palette-item');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    paletteSelected = (paletteSelected + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
    items.forEach(function(it, i) { it.classList.toggle('selected', i === paletteSelected); });
    items[paletteSelected].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    if (items[paletteSelected]) { closePalette(); items[paletteSelected].__action(); }
  } else if (e.key === 'Escape') {
    closePalette();
  }
});
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
  } else if (e.key === 'Escape') {
    closePalette();
    closeModal();
  }
});

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  renderFileList();

  // topbar link count from the vault graph (computed eagerly, graph lazily)
  try {
    const vault = buildVaultGraph();
    document.getElementById('vault-links-count').innerText = vault.links.length;
  } catch (e) { /* ignore */ }

  for (const skillId of Object.keys(SKILL_CATALOG || {})) {
    const wsPath = findWorkspaceSkillPath(skillId);
    if (wsPath) {
      const wsBtn = document.getElementById('ws-btn-' + skillId);
      if (wsBtn) wsBtn.style.display = 'inline-flex';
    }
  }
  for (const wf of WORKFLOW_CATALOG || []) {
    const wsPath = findWorkspaceWorkflowPath(wf.name);
    if (wsPath) {
      const wsBtn = document.getElementById('ws-btn-' + wf.name);
      if (wsBtn) wsBtn.style.display = 'inline-flex';
    }
  }
  const rulesPath = findWorkspaceRulesPath();
  if (rulesPath) {
    const wsBtn = document.getElementById('ws-rules-btn');
    if (wsBtn) wsBtn.style.display = 'inline-flex';
  }

  // Graph tab is the landing tab — initialize it immediately.
  ensureGraph();
});
</script>
</body>
</html>`;
}
