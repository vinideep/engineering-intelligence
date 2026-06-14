/**
 * Lossless token optimization for rendered toolkit files.
 *
 * Techniques used:
 * 1. Path aliasing — dictionary substitution of repeated long path strings (saves ~3,266 tokens)
 * 2. Skills index — compact 1-line-per-skill routing table (saves ~10,000t vs reading full skills)
 * 3. Workflow routing — pre-computed primary/optional skill map per command (saves ~2,000t)
 *
 * Inspired by Headroom's ContentRouter + CacheAligner patterns:
 * - The routing table is the CacheAligner equivalent: stable prefix that benefits from KV-cache hits
 * - The skills index is the relevance-ranking layer: AI routes to the right 2-3 skills, not all 44
 * - Full SKILL.md files are preserved as the CCR (compressed content retrieval) fallback
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
    optional: ["issue-tracker-sync-engine", "aidlc-lifecycle-engine"],
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
    optional: ["context-budget-optimizer", "aidlc-lifecycle-engine"],
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

export function generateWorkflowRouting(): string {
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
    "> Load **primary** skills in the listed order before executing a workflow.",
    "> Load **optional** skills only when the request explicitly requires that capability.",
    "> Full skill content is in `.claude/skills/<name>/SKILL.md` (load when executing).",
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
    "> Identify the 1-3 skills relevant to the request, then load only those full `SKILL.md` files.",
    "> Full skill files are at `.claude/skills/<name>/SKILL.md`.",
    "",
    "| Skill | Purpose |",
    "|---|---|",
    ...rows,
    "",
  ].join("\n");
}

// --- Token savings estimator (used in tests) ---------------------------------

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
