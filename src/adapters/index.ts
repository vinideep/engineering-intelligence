import { AGENT_NAMES, SKILL_NAMES, WORKFLOW_NAMES, readTemplate } from "../templates.js";
import { IDE_IDS, type IdeId, type RenderedFile } from "../types.js";

const BLOCK_ID = "engineering-intelligence";

const sharedInstructions = `# Engineering Intelligence OS

This repository uses installed engineering intelligence workflows.

- For initial understanding and documentation, invoke \`initialize-engineering-intelligence\` or ask the agent to initialize engineering intelligence.
- For implementation work, invoke \`engineering-intelligence\` with the request or ask the agent to apply the engineering intelligence workflow.
- For architecture mapping, impact analysis, synchronization, or review, invoke \`map-architecture\`, \`analyze-impact\`, \`sync-engineering-intelligence\`, or \`review-engineering-change\`; these workflows do not modify product code.
- Canonical generated outputs live in \`knowledge-base/\`, \`.engineering-intelligence/memory/\`, \`.engineering-intelligence/context/\`, \`.engineering-intelligence/events/\`, \`.engineering-intelligence/graph/\`, \`.engineering-intelligence/reports/\`, and \`.changes/\`.
- Before non-trivial edits, write an impact report; after edits, validate and incrementally synchronize only affected intelligence and graph artifacts.
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

async function renderAdapter(ide: IdeId): Promise<RenderedFile[]> {
  switch (ide) {
    case "antigravity":
      return [
        ...(await skillsAt(".agent/skills", ide)),
        ...(await workflowsAt(".agent/workflows", ide)),
        file(
          ".agent/rules/engineering-intelligence.md",
          await readTemplate("rules", "engineering-intelligence"),
          ide,
        ),
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
      };
      const inputWorkflows = new Set<(typeof WORKFLOW_NAMES)[number]>([
        "engineering-intelligence",
        "analyze-impact",
        "sync-engineering-intelligence",
        "review-engineering-change",
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
