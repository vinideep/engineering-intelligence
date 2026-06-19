/**
 * Lossless token optimization for rendered toolkit files.
 *
 * Techniques used:
 * 1. Path aliasing — dictionary substitution of repeated long path strings (saves ~955t)
 * 2. Skills index — compact 1-line-per-skill routing table (saves ~10,000t vs reading all skills)
 * 3. Workflow routing — pre-computed primary/optional skill map per command (saves ~2,000t)
 * 4. Tiered skill format — SKILL-BRIEF.md (~150t) read upfront; SKILL.md loaded at execution time
 * 5. KV-cache pinning — routing artifacts sort first so they form a stable context prefix
 *
 * Inspired by Headroom's ContentRouter + CacheAligner + CCR patterns:
 * - Routing table = CacheAligner: stable prefix, KV-cache hits across all invocations
 * - Skills index = ContentRouter: relevance ranking, route to the right 2-3 skills
 * - SKILL-BRIEF.md = CCR tier 2: understand without executing; SKILL.md = CCR tier 3 retrieval
 */

import { WORKFLOW_NAMES, readTemplate } from "./templates.js";

// --- Path aliasing -----------------------------------------------------------

/**
 * Two unambiguous path aliases covering the highest-frequency path strings.
 * Deliberately kept to two so expanded aliases never collide with adjacent
 * text (e.g. avoid "$EIR" + "IMP-XXX" concatenating into "$EIRIMP-XXX").
 *
 * $AIDLC covers 89 occurrences, $EI covers the remaining 142 (231 total).
 * Saves ~3,200 tokens across all skill and command files.
 */
export const PATH_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["$AIDLC", ".engineering-intelligence/aidlc/"],   // more specific — replace first
  ["$EI",    ".engineering-intelligence/"],           // base prefix — replace last
];

const ALIAS_PREAMBLE =
  `> **Path aliases:** ` +
  PATH_ALIASES.map(([a, p]) => `\`${a}\`=\`${p}\``).join(", ") +
  `. Expand before writing any file paths.\n\n`;

export function applyPathAliases(content: string): string {
  let result = content;
  for (const [alias, path] of PATH_ALIASES) {
    result = result.replaceAll(path, alias);
  }
  return result;
}

/** Apply path aliases and prepend the expansion preamble. */
export function withPathOptimizations(content: string): string {
  return ALIAS_PREAMBLE + applyPathAliases(content);
}

// --- Workflow → skill routing table ------------------------------------------

/**
 * Pre-computed map from workflow command name to the skills it needs.
 *
 * primary   — always load these before executing the workflow
 * optional  — load only when the request explicitly involves that capability
 *
 * Saving: replaces LLM inference of "which skills apply?" with a deterministic
 * lookup. This is the CacheAligner benefit: the same stable prefix every time.
 */
export const WORKFLOW_SKILL_ROUTING: Record<
  (typeof WORKFLOW_NAMES)[number],
  { primary: string[]; optional: string[] }
> = {
  "engineering-intelligence": {
    primary: [
      "engineering-intelligence-skill",
      "aidlc-lifecycle-engine",
      "impact-analysis-engine",
      "context-budget-optimizer",
    ],
    optional: [
      "change-detection-engine",
      "incremental-sync-engine",
      "change-history-engine",
      "environmental-backpressure-engine",
      "testing-intelligence-engine",
      "question-file-engine",
    ],
  },
  "initialize-engineering-intelligence": {
    primary: ["initialize-intelligence-skill"],
    optional: [
      "deep-project-knowledge-extractor",
      "knowledge-base-validator",
      "graph-engine",
      "change-history-engine",
    ],
  },
  "decompose-backlog": {
    primary: ["backlog-decomposition-engine", "context-budget-optimizer"],
    optional: ["issue-tracker-sync-engine", "aidlc-lifecycle-engine", "question-file-engine"],
  },
  "deliver-backlog": {
    primary: ["aidlc-lifecycle-engine", "engineering-intelligence-skill"],
    optional: [
      "backlog-decomposition-engine",
      "issue-tracker-sync-engine",
      "incremental-sync-engine",
    ],
  },
  "map-architecture": {
    primary: ["graph-engine"],
    optional: ["codebase-discovery-engine", "git-intelligence-engine"],
  },
  "analyze-impact": {
    primary: ["change-detection-engine", "impact-analysis-engine"],
    optional: ["graph-engine"],
  },
  "sync-engineering-intelligence": {
    primary: ["change-detection-engine", "incremental-sync-engine"],
    optional: ["knowledge-sync-engine", "memory-sync-engine", "context-sync-engine"],
  },
  "review-engineering-change": {
    primary: ["change-detection-engine", "engineering-change-review"],
    optional: ["impact-analysis-engine"],
  },
  "scope-requirement": {
    primary: ["requirement-scoper"],
    optional: ["context-budget-optimizer", "aidlc-lifecycle-engine", "question-file-engine"],
  },
  "discover-codebase": {
    primary: ["codebase-discovery-engine", "convention-detector", "graph-engine"],
    optional: [],
  },
  "create-project": {
    primary: ["greenfield-architect", "initialize-intelligence-skill"],
    optional: [],
  },
};

export const SKILLS_INDEX_FILENAME = "SKILLS-INDEX.md";
export const WORKFLOW_ROUTING_FILENAME = "WORKFLOW-ROUTING.md";

export function generateWorkflowRouting(skillsDir = ".claude/skills"): string {
  const rows = (Object.entries(WORKFLOW_SKILL_ROUTING) as [string, { primary: string[]; optional: string[] }][])
    .map(([cmd, r]) => {
      const primary = r.primary.map((s) => `\`${s}\``).join(", ");
      const optional = r.optional.length ? r.optional.map((s) => `\`${s}\``).join(", ") : "—";
      return `| \`${cmd}\` | ${primary} | ${optional} |`;
    });

  return [
    "# Workflow Routing Table",
    "",
    "> **Read this before loading any skill files.**",
    "> For each primary skill: load `SKILL-BRIEF.md` to understand it (~150t), then `SKILL.md` to execute.",
    "> Load **optional** skills only when the request explicitly requires that capability.",
    `> Skill files are in \`${skillsDir}/<name>/\` (SKILL-BRIEF.md and SKILL.md).`,
    "",
    "| Command | Primary Skills — load first | Optional Skills — load if needed |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

// --- Skills index ------------------------------------------------------------

function parseFrontmatterDescription(content: string): string {
  const match = content.match(/^description:\s*(.+)$/m);
  return match ? match[1].trim() : "";
}

/**
 * Generate a compact one-line-per-skill index.
 * ~1,500 tokens total vs ~62,700 to read all 44 full skill files.
 * The AI reads this index to identify which 1-3 skills to load in full.
 */
export async function generateSkillsIndex(
  skillNames: ReadonlyArray<string>,
  skillsDir = ".claude/skills",
): Promise<string> {
  const rows = await Promise.all(
    skillNames.map(async (name) => {
      const content = await readTemplate("skills", name).catch(() => "");
      const desc = parseFrontmatterDescription(content);
      const short = desc.length > 110 ? desc.slice(0, 107) + "…" : desc;
      return `| \`${name}\` | ${short} |`;
    }),
  );

  return [
    "# Skills Index",
    "",
    "> **Token-saving routing layer.** Read this index first.",
    "> Identify the 1-3 skills relevant to the request.",
    "> Tiered loading: `SKILL-BRIEF.md` (~150t) → understand the skill. `SKILL.md` → execute the procedure.",
    `> Both files live at \`${skillsDir}/<name>/\`.`,
    "",
    "| Skill | Purpose |",
    "|---|---|",
    ...rows,
    "",
  ].join("\n");
}

// --- Tiered skill briefs (CCR tier 2) ----------------------------------------

/**
 * Extract a compact brief from a full SKILL.md.
 *
 * The brief is the CCR tier-2 layer: ~150 tokens vs ~1,200 for the full skill.
 * AI reads the brief to understand what the skill does and confirm it's relevant;
 * reads the full SKILL.md only at execution time (CCR tier-3 retrieval).
 *
 * Extraction rules:
 * - Frontmatter preserved (name, description, version)
 * - Title + first body paragraph (overview sentence)
 * - First 6 non-empty lines of the `## Inputs` section (mode table or bullet list)
 * - Hard loading notice enforcing tier-3 retrieval before execution
 */
export function generateSkillBrief(content: string, name: string): string {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  const frontmatter = fmMatch ? fmMatch[1] : "";
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;

  // Title (first `# Heading` line in body, which may be preceded by a newline)
  const titleMatch = body.match(/^[\n]*(# [^\n]+)/m);
  const title = titleMatch ? titleMatch[1].replace(/^# /, "") : name;

  // First paragraph: text between the title and the next section heading or blank+heading
  const afterTitle = titleMatch
    ? body.slice(body.indexOf(titleMatch[1]) + titleMatch[1].length).replace(/^\n+/, "")
    : body.replace(/^\n+/, "");
  const firstParaMatch = afterTitle.match(/^([^#\n][^\n]*(?:\n(?![\n#])[^\n]*)*)/);
  const overview = firstParaMatch ? firstParaMatch[1].trim() : "";

  // Inputs section — first 6 non-empty lines (handles both table and bullet formats)
  const inputsMatch = body.match(/## Inputs?\n\n?([\s\S]*?)(?=\n## |\n# |$)/i);
  const inputLines = inputsMatch
    ? inputsMatch[1].split("\n").filter((l) => l.trim()).slice(0, 6)
    : [];

  const parts: string[] = [];
  if (frontmatter) parts.push(`---\n${frontmatter}\n---`, "");
  parts.push(`# ${title}`, "");
  if (overview) parts.push(overview, "");
  if (inputLines.length > 0) parts.push("## Inputs", "", ...inputLines, "");
  parts.push("> **Load `SKILL.md` from this directory before executing this skill's procedure.**");

  return parts.join("\n") + "\n";
}

/**
 * Generate SKILL-BRIEF.md content for every skill, applying path aliases.
 * Returns a map of skill name → brief content (with aliases applied).
 */
export async function generateAllSkillBriefs(
  skillNames: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    skillNames.map(async (name) => {
      const full = await readTemplate("skills", name).catch(() => "");
      const brief = smartCrush(generateSkillBrief(full, name));
      return [name, applyPathAliases(brief)] as const;
    }),
  );
  return new Map(entries);
}

// --- SmartCrusher (Technique 5) -----------------------------------------------

/**
 * Phase 1 structural compression — zero semantic risk.
 *
 * Rules applied:
 * - Strip `version:` from YAML frontmatter — installer metadata, irrelevant to the AI
 * - Remove HTML/markdown comments <!-- ... -->
 * - Strip trailing whitespace per line
 * - Collapse 3+ consecutive blank lines to 2
 *
 * Phase 1 saving: ~330t per full install (version stripping from skills + briefs) + ~76t structural.
 *
 * Phase 2 (deferred — requires behavioral regression tests before landing):
 * - Convert verbose bullet lists to keyword-dense tables
 * - Remove filler phrases ("Please note that", "Make sure to", "It is important to")
 * - Collapse repeated boilerplate sections across files into a single shared definition
 */
export function smartCrush(content: string): string {
  return content
    .replace(/^(---\n(?:(?!---)[^\n]*\n)*)version:[^\n]*\n/m, "$1")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

// --- Token savings estimator (used in tests) ---------------------------------

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
