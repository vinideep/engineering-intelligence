import { AGENT_NAMES, SKILL_NAMES, WORKFLOW_NAMES, readTemplate } from "../templates.js";
import { IDE_IDS, type IdeId, type RenderedFile } from "../types.js";

const BLOCK_ID = "engineering-intelligence";

const sharedInstructions = `# Engineering Intelligence OS

This repository uses installed engineering intelligence workflows.

- For initial understanding and documentation, invoke \`initialize-engineering-intelligence\` or ask the agent to initialize engineering intelligence.
- For implementation work, invoke \`engineering-intelligence\` with the request or ask the agent to apply the engineering intelligence workflow. This workflow embeds AI-DLC and Agile delivery modes internally.
- For architecture mapping, impact analysis, synchronization, or review, invoke \`map-architecture\`, \`analyze-impact\`, \`sync-engineering-intelligence\`, or \`review-engineering-change\`; these workflows do not modify product code.
- Canonical generated outputs live in \`knowledge-base/\`, \`.engineering-intelligence/aidlc/\`, \`.engineering-intelligence/memory/\`, \`.engineering-intelligence/context/\`, \`.engineering-intelligence/events/\`, \`.engineering-intelligence/graph/\`, \`.engineering-intelligence/reports/\`, and \`.changes/\`.
- Before non-trivial edits, write an impact report; after edits, validate and incrementally synchronize only affected intelligence and graph artifacts.
- AI-DLC work must preserve durable state in \`.engineering-intelligence/aidlc/aidlc-state.md\`, maintain Agile artifacts, use environmental backpressure, and end with an \`AI-DLC: <phase> -> <stage> -> <status>\` breadcrumb.
- Base documentation claims on repository evidence and identify unknowns explicitly.
`;

function file(path: string, content: string, owner: IdeId): RenderedFile {
  return { path, content, kind: "file", owners: [owner] };
}

function block(path: string, content: string, owner: IdeId): RenderedFile {
  return { path, content, kind: "block", blockId: BLOCK_ID, owners: [owner] };
}

async function skillsAt(directory: string, owner: IdeId): Promise<RenderedFile[]> {
  return Promise.all(
    SKILL_NAMES.map(async (name) =>
      file(`${directory}/${name}/SKILL.md`, await readTemplate("skills", name), owner),
    ),
  );
}

async function workflowsAt(directory: string, owner: IdeId): Promise<RenderedFile[]> {
  return Promise.all(
    WORKFLOW_NAMES.map(async (name) =>
      file(`${directory}/${name}.md`, await readTemplate("workflows", name), owner),
    ),
  );
}

async function agentsAt(directory: string, owner: IdeId): Promise<RenderedFile[]> {
  return Promise.all(
    AGENT_NAMES.map(async (name) =>
      file(`${directory}/${name}.md`, await readTemplate("agents", name), owner),
    ),
  );
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m);
  if (!match) return { meta: {}, body: content };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    meta[key] = value;
  }
  return { meta, body: match[2] };
}

const AGENT_METADATA: Record<
  (typeof AGENT_NAMES)[number],
  { context: string[]; agents?: string[]; skills?: string[]; autoRoute?: boolean; parallel?: boolean }
> = {
  "engineering-orchestrator": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/context", ".engineering-intelligence/memory", ".changes"],
    agents: ["product-analyst", "system-architect", "change-agent", "test-engineer", "quality-agent", "knowledge-agent"],
    autoRoute: true,
    parallel: false,
  },
  "change-agent": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/context", ".changes"],
    skills: ["engineering-intelligence-skill", "context-budget-optimizer", "aidlc-lifecycle-engine", "impact-analysis-engine", "change-detection-engine", "type-safety-engine", "api-backward-compatibility-engine", "api-snapshot-testing-engine", "environment-variable-auditor", "adr-compliance-checker", "llm-prompt-injection-guard"],
  },
  "quality-agent": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/context"],
    skills: ["engineering-change-review", "knowledge-base-validator", "testing-intelligence-engine", "environmental-backpressure-engine", "contract-test-generator", "adr-compliance-checker"],
  },
  "knowledge-agent": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/context", ".engineering-intelligence/memory", ".changes"],
    skills: ["knowledge-sync-engine", "memory-sync-engine", "context-sync-engine", "context-budget-optimizer", "graph-engine", "change-history-engine", "dead-code-detector"],
  },
  "product-analyst": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/context", ".engineering-intelligence/graph"],
    skills: ["requirement-scoper", "context-budget-optimizer", "aidlc-lifecycle-engine"],
  },
  "system-architect": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/graph", ".engineering-intelligence/memory"],
    skills: ["aidlc-lifecycle-engine", "nfr-adr-governor", "architecture-review-engine", "graph-engine", "adr-compliance-checker"],
  },
  "security-officer": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/graph"],
    skills: ["security-audit-engine", "mcp-security-governor", "nfr-adr-governor", "llm-prompt-injection-guard", "environment-variable-auditor"],
  },
  "database-administrator": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/graph"],
    skills: ["nfr-adr-governor", "impact-analysis-engine", "database-migration-safety-engine"],
  },
  "test-engineer": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/context"],
    skills: ["testing-intelligence-engine", "environmental-backpressure-engine", "type-safety-engine", "api-snapshot-testing-engine", "contract-test-generator"],
  },
  "adversary": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/graph"],
    skills: ["security-audit-engine", "testing-intelligence-engine", "environmental-backpressure-engine"],
  },
  "performance-analyst": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/graph"],
    skills: ["performance-analysis-engine", "environmental-backpressure-engine", "nfr-adr-governor"],
  },
  "compliance-auditor": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/reports"],
    skills: ["nfr-adr-governor", "mcp-security-governor", "engineering-change-review"],
  },
  "release-engineer": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".changes"],
    skills: ["git-intelligence-engine", "pr-intelligence-engine", "operations-readiness-engine", "api-backward-compatibility-engine", "database-migration-safety-engine"],
  },
  "site-reliability-engineer": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/graph"],
    skills: ["operations-readiness-engine", "performance-analysis-engine"],
  },
  "documentation-writer": {
    context: ["knowledge-base", ".engineering-intelligence/aidlc", ".engineering-intelligence/context", ".engineering-intelligence/memory", ".changes"],
    skills: ["knowledge-sync-engine", "memory-sync-engine", "context-sync-engine", "change-history-engine"],
  },
};

async function agentsAsJsonAt(directory: string, owner: IdeId): Promise<RenderedFile[]> {
  const results: RenderedFile[] = [];
  for (const name of AGENT_NAMES) {
    const raw = await readTemplate("agents", name);
    const { meta, body } = parseFrontmatter(raw);
    const agentName = meta["name"] ?? name;
    const description = meta["description"] ?? "";
    const extra = AGENT_METADATA[name];
    const manifest: Record<string, unknown> = {
      name: agentName,
      description,
      version: "1.0.0",
      instructions: "./prompt.md",
      memory: true,
      context: extra.context,
    };
    if (extra.agents) manifest["agents"] = extra.agents;
    if (extra.skills) manifest["skills"] = extra.skills;
    if (extra.autoRoute !== undefined) {
      manifest["execution"] = { autoRoute: extra.autoRoute, parallel: extra.parallel ?? false };
    }
    results.push(file(`${directory}/${name}/agent.json`, JSON.stringify(manifest, null, 4), owner));
    results.push(file(`${directory}/${name}/prompt.md`, body.replace(/^\n/, ""), owner));
  }
  return results;
}

async function renderAdapter(ide: IdeId): Promise<RenderedFile[]> {
  switch (ide) {
    case "antigravity":
      return [
        ...(await skillsAt(".agent/skills", ide)),
        ...(await agentsAsJsonAt(".agent/agents", ide)),
        ...(await workflowsAt(".agent/workflows", ide)),
        file(
          ".agent/rules/engineering-intelligence.md",
          await readTemplate("rules", "engineering-intelligence"),
          ide,
        ),
      ];
    case "antigravity-cli":
      return [
        ...(await skillsAt(".agents/skills", ide)),
        ...(await agentsAsJsonAt(".agents/agents", ide)),
        ...(await workflowsAt(".agents/workflows", ide)),
        block("AGENTS.md", sharedInstructions, ide),
      ];
    case "codex":
      return [...(await skillsAt(".agents/skills", ide)), block("AGENTS.md", sharedInstructions, ide)];
    case "generic":
      return [...(await skillsAt(".agents/skills", ide)), block("AGENTS.md", sharedInstructions, ide)];
    case "claude-code":
      return [
        ...(await skillsAt(".claude/skills", ide)),
        ...(await agentsAt(".claude/agents", ide)),
        ...(await workflowsAt(".claude/commands", ide)),
        block("CLAUDE.md", sharedInstructions, ide),
      ];
    case "cursor": {
      const rule = `---\ndescription: Engineering Intelligence orchestration and synchronization rules\nalwaysApply: true\n---\n\n${await readTemplate("rules", "engineering-intelligence")}`;
      return [
        file(".cursor/rules/engineering-intelligence.mdc", rule, ide),
        ...(await workflowsAt(".cursor/commands", ide)),
      ];
    }
    case "github-copilot": {
      const agentFiles = await agentsAt(".github/agents", ide);
      const promptFiles = await Promise.all(
        WORKFLOW_NAMES.map(async (name) =>
          file(`.github/prompts/${name}.prompt.md`, await readTemplate("workflows", name), ide),
        ),
      );
      return [
        ...(await skillsAt(".github/skills", ide)),
        ...agentFiles,
        ...promptFiles,
        block(".github/copilot-instructions.md", sharedInstructions, ide),
      ];
    }
    case "gemini-cli": {
      const workflowDescriptions: Record<(typeof WORKFLOW_NAMES)[number], string> = {
        "initialize-engineering-intelligence": "Initialize engineering intelligence for this project.",
        "engineering-intelligence": "Implement a request using engineering intelligence.",
        "map-architecture": "Build or refresh evidence-backed architecture graph intelligence.",
        "analyze-impact": "Analyze an intended change or existing diff without modifying product code.",
        "sync-engineering-intelligence": "Synchronize affected project intelligence without modifying product code.",
        "review-engineering-change": "Review an engineering change without applying fixes.",
        "scope-requirement": "Scope requirements and create a technical requirement prompt without modifying product code.",
        "discover-codebase": "Autonomously discover and map codebase architecture and patterns.",
        "create-project": "Create and bootstrap a new project with full AI-driven development lifecycle setup.",
      };
      const inputWorkflows = new Set<(typeof WORKFLOW_NAMES)[number]>([
        "engineering-intelligence",
        "analyze-impact",
        "sync-engineering-intelligence",
        "review-engineering-change",
        "scope-requirement",
        "create-project",
      ]);
      const commands = await Promise.all(
        WORKFLOW_NAMES.map(async (name) => {
          const workflow = await readTemplate("workflows", name);
          const prompt = inputWorkflows.has(name)
            ? `${workflow}\n\nUser supplied scope or request: {{args}}`
            : workflow;
          return file(
            `.gemini/commands/${name}.toml`,
            toGeminiCommand(workflowDescriptions[name], prompt),
            ide,
          );
        }),
      );
      return [
        ...(await skillsAt(".agents/skills", ide)),
        ...commands,
        block("GEMINI.md", sharedInstructions, ide),
      ];
    }
    case "commandcode": {
      const inputWorkflows = new Set<(typeof WORKFLOW_NAMES)[number]>([
        "engineering-intelligence",
        "analyze-impact",
        "sync-engineering-intelligence",
        "review-engineering-change",
        "scope-requirement",
        "create-project",
      ]);
      const commands = await Promise.all(
        WORKFLOW_NAMES.map(async (name) => {
          const workflow = await readTemplate("workflows", name);
          const prompt = inputWorkflows.has(name)
            ? `${workflow}\n\nUser supplied scope or request: $ARGUMENTS`
            : workflow;
          return file(`.commandcode/commands/${name}.md`, prompt, ide);
        }),
      );
      return [
        ...(await skillsAt(".commandcode/skills", ide)),
        ...commands,
        block("AGENTS.md", sharedInstructions, ide),
      ];
    }
  }
}

function toGeminiCommand(description: string, prompt: string): string {
  const escaped = prompt.replaceAll('"""', '\\"\\"\\"');
  return `description = ${JSON.stringify(description)}\nprompt = """\n${escaped}\n"""\n`;
}

function mergeRenderedFiles(files: RenderedFile[]): RenderedFile[] {
  const merged = new Map<string, RenderedFile>();
  for (const candidate of files) {
    const existing = merged.get(candidate.path);
    if (!existing) {
      merged.set(candidate.path, candidate);
      continue;
    }
    if (
      existing.kind !== candidate.kind ||
      existing.content !== candidate.content ||
      existing.blockId !== candidate.blockId
    ) {
      throw new Error(`Adapters produce incompatible managed content for ${candidate.path}`);
    }
    existing.owners = [...new Set([...existing.owners, ...candidate.owners])];
  }
  return [...merged.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function isIdeId(input: string): input is IdeId {
  return (IDE_IDS as readonly string[]).includes(input);
}

export async function renderAdapters(ides: IdeId[]): Promise<RenderedFile[]> {
  const unique = [...new Set(ides)];
  const outputs = await Promise.all(unique.map(renderAdapter));
  return mergeRenderedFiles(outputs.flat());
}
