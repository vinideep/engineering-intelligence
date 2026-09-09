import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type {
  AidlcState,
  OpenQuestionItem,
  FrozenRequirements,
  RequirementRecord,
} from "./types.js";

function aidlcDir(root: string): string {
  return path.join(root, ".engineering-intelligence", "aidlc");
}

export function defaultAidlcState(): AidlcState {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    position: {
      phase: "discovery",
      stage: "Initial discovery and environment mapping",
      activeWorkflow: "initialize-engineering-intelligence",
      activeHat: "Engineering Orchestrator",
      completionStatus: "in-progress",
    },
    breadcrumb: "AI-DLC: Discovery -> Initial discovery and environment mapping -> in-progress",
  };
}

export async function loadAidlcState(root: string): Promise<AidlcState> {
  const jsonPath = path.join(aidlcDir(root), "aidlc-state.json");
  if (existsSync(jsonPath)) {
    try {
      const content = await readFile(jsonPath, "utf8");
      return JSON.parse(content) as AidlcState;
    } catch {
      // fallback to md scraping
    }
  }

  const mdPath = path.join(aidlcDir(root), "aidlc-state.md");
  if (existsSync(mdPath)) {
    try {
      const mdContent = await readFile(mdPath, "utf8");
      return parseAidlcStateMarkdown(mdContent);
    } catch {
      // fallback to default
    }
  }

  return defaultAidlcState();
}

export async function saveAidlcState(root: string, state: AidlcState): Promise<void> {
  const dir = aidlcDir(root);
  await mkdir(dir, { recursive: true });

  state.updatedAt = new Date().toISOString();

  // 1. Write JSON machine-readable source of truth
  const jsonPath = path.join(dir, "aidlc-state.json");
  await writeFile(jsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  // 2. Project to Markdown
  const mdPath = path.join(dir, "aidlc-state.md");
  const mdContent = renderAidlcStateMarkdown(state);
  await writeFile(mdPath, mdContent, "utf8");
}

export function renderAidlcStateMarkdown(state: AidlcState): string {
  const lines: string[] = [];
  lines.push("# AI-DLC State");
  lines.push(`<!-- freshness: last_checked=${state.updatedAt.slice(0, 10)} -->`);
  lines.push("");
  lines.push("## Current Position");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Phase | ${state.position.phase} |`);
  lines.push(`| Stage | ${state.position.stage} |`);
  if (state.position.activeWorkflow) lines.push(`| Active workflow | \`${state.position.activeWorkflow}\` |`);
  if (state.position.activeHat) lines.push(`| Active hat | ${state.position.activeHat} |`);
  if (state.position.activeUnit) lines.push(`| Active unit | ${state.position.activeUnit} |`);
  if (state.position.completionStatus) lines.push(`| Completion status | ${state.position.completionStatus} |`);
  lines.push("");

  if (state.classification) {
    lines.push("## Workspace Classification");
    lines.push("");
    lines.push(`**${state.classification.type.charAt(0).toUpperCase() + state.classification.type.slice(1)}.** ${state.classification.details || ""}`);
    lines.push("");
  }

  if (state.reverseEngineeringOutputs && Object.keys(state.reverseEngineeringOutputs).length > 0) {
    lines.push("## Reverse Engineering Outputs");
    lines.push("");
    lines.push("| Artifact | Status |");
    lines.push("|---|---|");
    for (const [k, v] of Object.entries(state.reverseEngineeringOutputs)) {
      lines.push(`| ${k} | ${v} |`);
    }
    lines.push("");
  }

  lines.push("## Progress Breadcrumb");
  lines.push("");
  lines.push("```");
  lines.push(state.breadcrumb);
  lines.push("```");
  lines.push("");

  if (state.activeDelivery) {
    lines.push("## Active Delivery");
    lines.push("");
    lines.push(state.activeDelivery);
    lines.push("");
  }

  if (state.unknowns && state.unknowns.length > 0) {
    lines.push("## Unknowns");
    lines.push("");
    for (const u of state.unknowns) {
      lines.push(`- ${u}`);
    }
    lines.push("");
  }

  if (state.currentValidationUnit) {
    lines.push("## Current Validation Unit");
    lines.push("");
    lines.push(state.currentValidationUnit);
    lines.push("");
  }

  return lines.join("\n");
}

function parseAidlcStateMarkdown(md: string): AidlcState {
  const state = defaultAidlcState();
  const lines = md.split("\n");

  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("| Field | Value |")) {
      inTable = true;
      continue;
    }
    if (inTable && trimmed.startsWith("|")) {
      const parts = trimmed.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const field = parts[0].toLowerCase();
        const val = parts[1].replace(/`/g, "");
        if (field === "phase") state.position.phase = val;
        else if (field === "stage") state.position.stage = val;
        else if (field === "active workflow") state.position.activeWorkflow = val;
        else if (field === "active hat") state.position.activeHat = val;
        else if (field === "active unit") state.position.activeUnit = val;
        else if (field === "completion status") state.position.completionStatus = val;
      }
    } else if (trimmed.startsWith("##") && inTable) {
      inTable = false;
    }

    if (trimmed.startsWith("AI-DLC:")) {
      state.breadcrumb = trimmed;
    }
  }

  return state;
}

export async function loadOpenQuestions(root: string): Promise<OpenQuestionItem[]> {
  const jsonPath = path.join(aidlcDir(root), "open-questions.json");
  if (existsSync(jsonPath)) {
    try {
      const content = await readFile(jsonPath, "utf8");
      return JSON.parse(content) as OpenQuestionItem[];
    } catch {
      // fallback to md
    }
  }

  const mdPath = path.join(aidlcDir(root), "open-questions.md");
  if (!existsSync(mdPath)) return [];

  const content = await readFile(mdPath, "utf8");
  return parseOpenQuestionsMarkdown(content);
}

export async function saveOpenQuestions(root: string, questions: OpenQuestionItem[]): Promise<void> {
  const dir = aidlcDir(root);
  await mkdir(dir, { recursive: true });

  // 1. Write JSON
  const jsonPath = path.join(dir, "open-questions.json");
  await writeFile(jsonPath, `${JSON.stringify(questions, null, 2)}\n`, "utf8");

  // 2. Project to Markdown
  const mdPath = path.join(dir, "open-questions.md");
  const mdContent = renderOpenQuestionsMarkdown(questions);
  await writeFile(mdPath, mdContent, "utf8");
}

export function renderOpenQuestionsMarkdown(questions: OpenQuestionItem[]): string {
  const lines: string[] = [];
  lines.push("# Open Questions");
  lines.push(`<!-- freshness: last_checked=${new Date().toISOString().slice(0, 10)} -->`);
  lines.push("");
  lines.push("| # | Question | Owner | Status | Priority |");
  lines.push("|---|---|---|---|---|");

  const openList = questions.filter((q) => q.status !== "resolved");
  const resolvedList = questions.filter((q) => q.status === "resolved");

  for (const q of openList) {
    lines.push(`| ${q.id} | ${q.question.replace(/\|/g, "\\|")} | ${q.owner || "Unassigned"} | ${q.status} | ${q.priority || "normal"} |`);
  }

  lines.push("");
  lines.push("## Resolved Questions");
  lines.push("");
  if (resolvedList.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| # | Question | Resolution | Resolved At |");
    lines.push("|---|---|---|---|");
    for (const q of resolvedList) {
      lines.push(`| ${q.id} | ${q.question.replace(/\|/g, "\\|")} | ${q.resolution || "Resolved"} | ${q.resolvedAt || "Recorded"} |`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

export function parseOpenQuestionsMarkdown(md: string): OpenQuestionItem[] {
  const items: OpenQuestionItem[] = [];
  const lines = md.split("\n");

  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();

    // Checkbox support
    if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
      const isResolved = trimmed.startsWith("- [x]");
      const text = trimmed.slice(5).trim();
      const isBlocking = /(blocking|critical|required|must|p0)/i.test(text);
      items.push({
        id: items.length + 1,
        question: text,
        status: isResolved ? "resolved" : "open",
        priority: isBlocking ? "blocking" : "normal",
      });
      continue;
    }

    // Markdown table support
    if (trimmed.startsWith("| # |") || trimmed.startsWith("|#|")) {
      inTable = true;
      continue;
    }
    if (inTable && trimmed.startsWith("|") && !trimmed.includes("---")) {
      const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
        const id = cells[0];
        const question = cells[1];
        const owner = cells[2];
        const statusRaw = (cells[3] || "open").toLowerCase();
        const priorityRaw = (cells[4] || "").toLowerCase();
        const isResolved = statusRaw.includes("resolved") || statusRaw.includes("closed") || statusRaw.includes("done");
        const isBlocking = priorityRaw.includes("p0") || priorityRaw.includes("block") || /(blocking|critical|required|must|p0)/i.test(question);
        items.push({
          id,
          question,
          owner,
          status: isResolved ? "resolved" : "open",
          priority: isBlocking ? "blocking" : "normal",
        });
      }
    } else if (trimmed.startsWith("##") && inTable) {
      inTable = false;
    }
  }

  return items;
}

export async function loadRequirements(root: string): Promise<FrozenRequirements> {
  const jsonPath = path.join(aidlcDir(root), "inception", "requirements.json");
  if (existsSync(jsonPath)) {
    try {
      const content = await readFile(jsonPath, "utf8");
      return JSON.parse(content) as FrozenRequirements;
    } catch {
      // fallback to empty
    }
  }
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    requirements: [],
  };
}

export async function saveRequirements(root: string, reqs: FrozenRequirements): Promise<void> {
  const dir = path.join(aidlcDir(root), "inception");
  await mkdir(dir, { recursive: true });

  reqs.updatedAt = new Date().toISOString();

  // 1. Save JSON
  const jsonPath = path.join(dir, "requirements.json");
  await writeFile(jsonPath, `${JSON.stringify(reqs, null, 2)}\n`, "utf8");

  // 2. Project to Markdown
  const mdPath = path.join(dir, "requirements.md");
  const mdContent = renderRequirementsMarkdown(reqs);
  await writeFile(mdPath, mdContent, "utf8");
}

export function renderRequirementsMarkdown(reqs: FrozenRequirements): string {
  const lines: string[] = [];
  lines.push("# System Requirements");
  lines.push(`<!-- freshness: last_checked=${reqs.updatedAt.slice(0, 10)} -->`);
  lines.push("");

  const byTopic = new Map<string, RequirementRecord[]>();
  for (const r of reqs.requirements) {
    const list = byTopic.get(r.topic) || [];
    list.push(r);
    byTopic.set(r.topic, list);
  }

  for (const [topic, items] of byTopic) {
    lines.push(`## Topic: ${topic}`);
    lines.push("");
    lines.push("| Question ID | Decision / Selected Option | Custom Rationale | Confirmed At |");
    lines.push("|---|---|---|---|");
    for (const item of items) {
      lines.push(`| ${item.questionId} | ${item.decision} | ${item.rationale || "Standard trade-off accepted"} | ${item.confirmedAt} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
