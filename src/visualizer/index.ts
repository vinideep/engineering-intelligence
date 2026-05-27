import { SKILL_NAMES, AGENT_NAMES, WORKFLOW_NAMES } from "../templates.js";

interface SkillInfo {
  name: string;
  category: "initialization" | "implementation" | "analysis" | "sync" | "review" | "planning";
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
};

const CATEGORY_COLORS: Record<string, string> = {
  initialization: "#6366f1",
  implementation: "#22c55e",
  analysis: "#f59e0b",
  sync: "#06b6d4",
  review: "#ef4444",
  planning: "#a855f7",
};

const CATEGORY_LABELS: Record<string, string> = {
  initialization: "Initialization",
  implementation: "Implementation",
  analysis: "Analysis",
  sync: "Synchronization",
  review: "Review & Validation",
  planning: "Planning",
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
];

export function generateDashboardHTML(): string {
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
        ${typeBadge}
        <h3>${wf.name}</h3>
        <p>${wf.description}</p>
      </div>
      <div class="wf-pipeline">${steps}</div>
    </div>`;
  }).join("\n");

  const agentCards = [
    { name: "Engineering Orchestrator", role: "Classifies requests, routes work, coordinates agents", skills: "All skills", color: "#6366f1" },
    { name: "Change Agent", role: "Implements code changes, adds tests, collects evidence", skills: "engineering-intelligence-skill, testing-intelligence-engine", color: "#22c55e" },
    { name: "Quality Agent", role: "Validates correctness, runs tests, reviews architecture", skills: "engineering-change-review, testing-intelligence-engine", color: "#ef4444" },
    { name: "Knowledge Agent", role: "Maintains all intelligence artifacts", skills: "All sync engines, graph-engine, change-history-engine", color: "#06b6d4" },
    { name: "Product Analyst", role: "Scopes requirements, asks clarifying questions, generates prompts", skills: "requirement-scoper, deep-project-knowledge-extractor", color: "#a855f7" },
  ].map((agent) => `<div class="agent-card">
    <div class="agent-icon" style="background:${agent.color}">${agent.name.charAt(0)}</div>
    <div class="agent-body">
      <h3>${agent.name}</h3>
      <p>${agent.role}</p>
      <div class="agent-skills"><strong>Skills:</strong> ${agent.skills}</div>
    </div>
  </div>`).join("\n");

  const artifactTree = `
    <div class="tree">
      <div class="tree-node root">knowledge-base/<span class="tree-count">16 documents</span></div>
      <div class="tree-node root">.engineering-intelligence/
        <div class="tree-node">memory/<span class="tree-count">5 documents</span></div>
        <div class="tree-node">context/<span class="tree-count">6 maps</span></div>
        <div class="tree-node">events/<span class="tree-count">5 guides</span></div>
        <div class="tree-node">graph/<span class="tree-count">4 JSON + 1 map</span></div>
        <div class="tree-node">reports/<span class="tree-count">IMP-*/REV-* reports</span></div>
      </div>
      <div class="tree-node root">.changes/<span class="tree-count">CHG-* records</span></div>
    </div>`;

  const categoryFilters = Object.entries(CATEGORY_LABELS)
    .map(([id, label]) => `<button class="filter-btn active" data-filter="${id}" style="--btn-color:${CATEGORY_COLORS[id]}">${label}</button>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Engineering Intelligence — Dashboard</title>
<style>
:root {
  --bg: #0a0a0f;
  --surface: #12121a;
  --surface-hover: #1a1a26;
  --border: #2a2a3a;
  --text: #e4e4ef;
  --text-dim: #8888a0;
  --accent: #6366f1;
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
.skill-deps { font-size: 0.85rem; }
.dep-row { margin-bottom: 0.4rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
.dep-label { color: var(--text-dim); font-weight: 500; margin-right: 0.3rem; }
.dep-tag { background: var(--bg); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
.dep-none { color: var(--text-dim); font-size: 0.75rem; font-style: italic; }

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
.wf-header h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }
.wf-header p { color: var(--text-dim); font-size: 0.9rem; }
.wf-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
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

/* Agent cards */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
.agent-body h3 { font-size: 1rem; margin-bottom: 0.25rem; }
.agent-body p { color: var(--text-dim); font-size: 0.85rem; margin-bottom: 0.5rem; }
.agent-skills { font-size: 0.8rem; color: var(--text-dim); }

/* Artifact tree */
.tree { padding: 1rem; }
.tree-node {
  padding: 0.5rem 0 0.5rem 1.5rem;
  border-left: 2px solid var(--border);
  position: relative;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
}
.tree-node::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 50%;
  width: 12px;
  height: 2px;
  background: var(--border);
}
.tree-node.root {
  border-left: none;
  padding-left: 0;
  font-weight: 600;
  color: var(--accent);
  margin-top: 0.75rem;
}
.tree-node.root::before { display: none; }
.tree-count {
  color: var(--text-dim);
  font-weight: 400;
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
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
    <div class="stats">
      <div class="stat"><div class="stat-num">${SKILL_NAMES.length}</div><div class="stat-label">Skills</div></div>
      <div class="stat"><div class="stat-num">${AGENT_NAMES.length}</div><div class="stat-label">Agents</div></div>
      <div class="stat"><div class="stat-num">${WORKFLOW_NAMES.length}</div><div class="stat-label">Workflows</div></div>
      <div class="stat"><div class="stat-num">37+</div><div class="stat-label">Artifacts</div></div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="skills">Skills</button>
    <button class="tab" data-tab="workflows">Workflows</button>
    <button class="tab" data-tab="agents">Agents</button>
    <button class="tab" data-tab="artifacts">Artifacts</button>
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
    <h2 style="margin-bottom:1rem;">Generated Artifact Structure</h2>
    <p style="color:var(--text-dim);margin-bottom:1rem;">These artifacts are generated and maintained by the AI IDE agent after installation.</p>
    ${artifactTree}
  </div>
</div>

<script>
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const active = [...document.querySelectorAll('.filter-btn.active')].map(b => b.dataset.filter);
    document.querySelectorAll('.skill-card').forEach(card => {
      card.classList.toggle('hidden', !active.includes(card.dataset.category));
    });
  });
});
</script>
</body>
</html>`;
}
