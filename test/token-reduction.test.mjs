/**
 * Token-reduction measurement harness.
 *
 * Measures per-invocation token cost before vs. after the optimization pipeline,
 * using a per-invocation model with explicit, transparent assumptions. The total
 * install size GROWS (we add routing/index/brief files), but per-invocation cost
 * SHRINKS because the agent no longer loads all skills to find the relevant ones.
 *
 * Per-invocation model:
 *
 *   Baseline (unoptimized): agent loads N_NAIVE raw full skills per invocation
 *   to identify which ones are relevant (no routing table, no index).
 *   → N_NAIVE × avg_raw_skill_tokens
 *
 *   Optimized:
 *   - IDEs with briefs (claude-code, commandcode):
 *       routing + index + N_BRIEF briefs + N_EXEC compressed full skills
 *   - IDEs without briefs (all others with a skills folder):
 *       routing + index + N_EXEC compressed full skills
 *       (routing + index guide the agent to load only the 1-2 relevant skills)
 *   - cursor (no skills folder):
 *       optimized workflow commands only; compression savings measured directly
 *
 * Assumptions are explicit constants below — adjust if the model needs tuning.
 * estimateTokens() uses length/4; both sides use the same measure, so the
 * relative reduction is a valid regression signal even if not tokenizer-exact.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { renderAdapters } from "../dist/adapters/index.js";
import { SKILL_NAMES, WORKFLOW_NAMES, readTemplate } from "../dist/templates.js";
import { estimateTokens } from "../dist/token-optimizer.js";

// --- Per-invocation model parameters ----------------------------------------
const N_NAIVE = 4;  // skills an unguided agent loads per invocation (no routing/index)
const N_BRIEF = 3;  // skill briefs read to confirm relevance (with-brief IDEs)
const N_EXEC  = 1;  // full skills loaded at execution time per invocation

// Conservative minimum reduction floors (set well below current measured values
// to guard against regressions, not to assert a target).
// Measured values (N_NAIVE=4): claude-code ~28%, commandcode ~24%, others ~15-70%.
// cursor is excluded — it ships no skills folder, so the per-invocation skills
// model does not apply; it is tested separately for workflow compression.
const MIN_REDUCTION_PCT = {
  "claude-code":     20,   // routing + index + briefs + SmartCrush + aliases
  "commandcode":     18,   // same pipeline, emitBriefs: true
  "github-copilot":   8,   // routing + index + SmartCrush + aliases
  "gemini-cli":       8,
  "antigravity":      8,
  "antigravity-cli":  8,
  "codex":            8,
  "generic":          8,
};

// IDEs that emit SKILL-BRIEF.md (tiered loading enabled).
const EMIT_BRIEFS = new Set(["claude-code", "commandcode"]);

// --- Helpers ----------------------------------------------------------------

async function allRawSkillTokens() {
  const contents = await Promise.all(SKILL_NAMES.map(n => readTemplate("skills", n)));
  return contents.reduce((sum, c) => sum + estimateTokens(c), 0);
}

async function allRawWorkflowTokens() {
  const contents = await Promise.all(WORKFLOW_NAMES.map(n => readTemplate("workflows", n)));
  return contents.reduce((sum, c) => sum + estimateTokens(c), 0);
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

// --- Tests ------------------------------------------------------------------

test("per-adapter per-invocation token reduction meets floor and is printed", async () => {
  const [rawSkillTotal, rawWorkflowTotal] = await Promise.all([
    allRawSkillTokens(),
    allRawWorkflowTokens(),
  ]);
  const avgRawSkill = rawSkillTotal / SKILL_NAMES.length;

  // Unoptimized per-invocation baseline: agent loads N_NAIVE raw full skills.
  // (No routing table → agent must read multiple skills to find relevant ones.)
  const baselinePerInvocation = N_NAIVE * avgRawSkill;

  const IDEs = Object.keys(MIN_REDUCTION_PCT);
  const rows = [];

  for (const ide of IDEs) {
    const files = await renderAdapters([ide]);
    const hasSkills = files.some(f => f.path.endsWith("/SKILL.md") && f.path.includes("/skills/"));

    let optimizedPerInvocation;

    if (!hasSkills) {
      // No skills folder — skip per-invocation model; adapter is tested separately.
      rows.push({ ide, baseline: 0, optimized: 0, skip: true });
    } else {
      const routingFile = files.find(f => f.path.endsWith("WORKFLOW-ROUTING.md"));
      const indexFile   = files.find(f => f.path.endsWith("SKILLS-INDEX.md"));
      const routingT = routingFile ? estimateTokens(routingFile.content) : 0;
      const indexT   = indexFile   ? estimateTokens(indexFile.content)   : 0;

      const compressedSkillTokens = files
        .filter(f => f.path.endsWith("/SKILL.md") && f.path.includes("/skills/"))
        .map(f => estimateTokens(f.content));
      const avgCompressedSkill = avg(compressedSkillTokens);

      if (EMIT_BRIEFS.has(ide)) {
        const briefTokens = files
          .filter(f => f.path.endsWith("/SKILL-BRIEF.md"))
          .map(f => estimateTokens(f.content));
        const avgBrief = avg(briefTokens);
        optimizedPerInvocation = routingT + indexT + N_BRIEF * avgBrief + N_EXEC * avgCompressedSkill;
      } else {
        // Without briefs: routing + index guide agent to load only N_EXEC skills
        optimizedPerInvocation = routingT + indexT + N_EXEC * avgCompressedSkill;
      }

      rows.push({ ide, baseline: Math.round(baselinePerInvocation), optimized: Math.round(optimizedPerInvocation) });
    }

    const row = rows[rows.length - 1];
    if (row.skip) continue;

    const { baseline, optimized } = row;
    const pct = (1 - optimized / baseline) * 100;
    const floor = MIN_REDUCTION_PCT[ide];

    assert.ok(
      pct >= floor,
      `${ide}: per-invocation reduction ${pct.toFixed(1)}% is below floor ${floor}% ` +
      `(baseline=${baseline}t optimized=${optimized}t; model: N_NAIVE=${N_NAIVE} raw skills vs ` +
      `routing+index${EMIT_BRIEFS.has(ide) ? `+${N_BRIEF} briefs` : ""}+${N_EXEC} skill)`,
    );
  }

  // Print summary (visible in test output / CI logs).
  console.log(`\n  Per-invocation token savings (N_NAIVE=${N_NAIVE} raw skills baseline):`);
  console.log("  ┌─────────────────────┬────────────┬────────────┬────────────┐");
  console.log("  │ IDE                 │ Baseline   │ Optimized  │ Reduction  │");
  console.log("  ├─────────────────────┼────────────┼────────────┼────────────┤");
  for (const { ide, baseline, optimized, skip } of rows) {
    if (skip) continue;
    const pct = (1 - optimized / baseline) * 100;
    const name = ide.padEnd(19);
    const b = (baseline + "t").padStart(10);
    const o = (optimized + "t").padStart(10);
    const p = (pct.toFixed(1) + "%").padStart(10);
    console.log(`  │ ${name} │ ${b} │ ${o} │ ${p} │`);
  }
  console.log("  └─────────────────────┴────────────┴────────────┴────────────┘");
  console.log(`  Assumptions: N_NAIVE=${N_NAIVE} (skills loaded unguided), N_BRIEF=${N_BRIEF}, N_EXEC=${N_EXEC}.`);
  console.log("  estimateTokens uses length/4; relative deltas are regression-guarded.\n");
});

test("all adapters ship skill files with path aliases applied (SmartCrush + aliasing universal)", async () => {
  const skippedIDEs = new Set(["cursor"]);

  for (const ide of Object.keys(MIN_REDUCTION_PCT)) {
    if (skippedIDEs.has(ide)) continue;

    const files = await renderAdapters([ide]);
    const skillFile = files.find(f => f.path.endsWith("/aidlc-lifecycle-engine/SKILL.md"));
    assert.ok(skillFile, `${ide}: aidlc-lifecycle-engine/SKILL.md not found`);

    assert.match(
      skillFile.content,
      /\$AIDLC/,
      `${ide}: skill files must contain $AIDLC alias (path aliasing not applied)`,
    );

    assert.doesNotMatch(
      skillFile.content,
      /^version:/m,
      `${ide}: skill files must not contain version: (SmartCrush not applied)`,
    );
  }
});

test("all skills-carrying adapters ship WORKFLOW-ROUTING.md and SKILLS-INDEX.md", async () => {
  const skippedIDEs = new Set(["cursor"]);

  for (const ide of Object.keys(MIN_REDUCTION_PCT)) {
    if (skippedIDEs.has(ide)) continue;

    const files = await renderAdapters([ide]);
    const paths = new Set(files.map(f => f.path));

    const routing = [...paths].find(p => p.endsWith("WORKFLOW-ROUTING.md"));
    const index   = [...paths].find(p => p.endsWith("SKILLS-INDEX.md"));

    assert.ok(routing, `${ide}: no WORKFLOW-ROUTING.md found`);
    assert.ok(index,   `${ide}: no SKILLS-INDEX.md found`);

    const routingContent = files.find(f => f.path === routing).content;
    assert.match(routingContent, /Workflow Routing Table/, `${ide}: routing table missing header`);
    assert.match(routingContent, /engineering-intelligence/,  `${ide}: routing table missing workflow`);
  }
});

test("commandcode adapter ships SKILL-BRIEF.md files (emitBriefs: true)", async () => {
  const files = await renderAdapters(["commandcode"]);
  const paths = new Set(files.map(f => f.path));

  assert.ok(
    paths.has(".commandcode/skills/engineering-intelligence-skill/SKILL-BRIEF.md"),
    "commandcode must ship engineering-intelligence-skill/SKILL-BRIEF.md",
  );
  assert.ok(
    paths.has(".commandcode/skills/aidlc-lifecycle-engine/SKILL-BRIEF.md"),
    "commandcode must ship aidlc-lifecycle-engine/SKILL-BRIEF.md",
  );

  const brief = files.find(f => f.path === ".commandcode/skills/engineering-intelligence-skill/SKILL-BRIEF.md");
  const full  = files.find(f => f.path === ".commandcode/skills/engineering-intelligence-skill/SKILL.md");
  const briefTokens = estimateTokens(brief.content);
  const fullTokens  = estimateTokens(full.content);

  assert.ok(
    briefTokens < fullTokens * 0.5,
    `commandcode brief (${briefTokens}t) must be < 50% of full (${fullTokens}t)`,
  );
});

test("AGENTS.md block carries the 'prefer persisted intelligence' directive and routing mention", async () => {
  for (const ide of ["codex", "generic", "antigravity-cli", "commandcode"]) {
    const files = await renderAdapters([ide]);
    const agentsMd = files.find(f => f.path === "AGENTS.md");
    assert.ok(agentsMd, `${ide}: AGENTS.md not found`);
    assert.match(
      agentsMd.content,
      /Prefer persisted intelligence/i,
      `${ide}: AGENTS.md must carry the 'prefer persisted intelligence' directive`,
    );
    assert.match(
      agentsMd.content,
      /WORKFLOW-ROUTING\.md/,
      `${ide}: AGENTS.md must mention WORKFLOW-ROUTING.md`,
    );
  }
});

test("KV-cache pinned routing files sort first across every IDE that ships them", async () => {
  const idesTested = ["claude-code", "github-copilot", "gemini-cli", "commandcode", "antigravity", "codex"];
  for (const ide of idesTested) {
    const files = await renderAdapters([ide]);
    const routing = files.findIndex(f => f.path.endsWith("WORKFLOW-ROUTING.md"));
    const index   = files.findIndex(f => f.path.endsWith("SKILLS-INDEX.md"));
    const firstNonPinned = files.findIndex(
      f => !f.path.endsWith("WORKFLOW-ROUTING.md") && !f.path.endsWith("SKILLS-INDEX.md"),
    );

    assert.ok(routing !== -1, `${ide}: WORKFLOW-ROUTING.md not found`);
    assert.ok(index   !== -1, `${ide}: SKILLS-INDEX.md not found`);
    assert.ok(routing < firstNonPinned, `${ide}: WORKFLOW-ROUTING.md must precede non-pinned files`);
    assert.ok(index   < firstNonPinned, `${ide}: SKILLS-INDEX.md must precede non-pinned files`);
  }
});

test("cursor adapter optimizes command files with SmartCrush and path aliases", async () => {
  const files = await renderAdapters(["cursor"]);
  const engCmd = files.find(f => f.path === ".cursor/commands/engineering-intelligence.md");
  assert.ok(engCmd, "cursor must ship engineering-intelligence command");
  assert.match(engCmd.content, /\$AIDLC/, "cursor commands must use $AIDLC alias");
  assert.doesNotMatch(engCmd.content, /^version:/m, "cursor commands must not contain version:");
});
