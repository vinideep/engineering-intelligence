---
name: context-budget-optimizer
description: Minimizes AI IDE token usage by ranking, slicing, summarizing, and lazy-loading project intelligence while preserving required gates and output quality.
version: 1.0.0
---

# Context Budget Optimizer

Use this skill before broad intelligence reads in implementation, analysis, review, and synchronization workflows. The goal is to produce the same engineering output with fewer tokens by loading only the most relevant evidence.

## Token Budget Policy

Default budget allocation:

| Budget Area | Target |
|---|---:|
| Intelligence context | <= 40% |
| Source/test snippets | 30% |
| Tool diagnostics | 20% |
| User interaction and final answer | 10% |

If the AI IDE exposes a context-window size, estimate against that. If not, use relative budgets and prefer compact artifacts over full documents.

## Context Manifest

Before loading full documents, create or update:

```text
.engineering-intelligence/context/context-manifest.md
```

Format:

```markdown
# Context Manifest

## Scope
- Request:
- Candidate modules:
- Risk:

## Ranked Context
| Rank | Artifact | Sections / Keys | Reason | Estimated Tokens | Load Mode |
|---:|---|---|---|---:|---|
| 1 | `.engineering-intelligence/context/module-map.md` | auth row | direct scope | 120 | slice |
| 2 | `.engineering-intelligence/knowledge-base/04-api-documentation.md` | H2: Auth API | API contract | 500 | section |
```

## Procedure

0. **Load User Intelligence Profile (pinned, ~50t, always first)**

   Before ranking any other artifact:
   - Run `npx engineering-intelligence user-profile .` if `.engineering-intelligence/memory/users/` doesn't exist yet.
   - Resolve identity: `git config user.email` → slug → `memory/users/<slug>/user-intelligence.md`.
   - If CI environment detected (`$CI`, `$GITHUB_ACTIONS`, etc.) → skip personal profile; load `team-preferences.md` only.
   - Load the **Active Predictions block only** (~50t) from the personal profile.
   - Load `team-preferences.md` (~100t) for any dimensions not set in the personal profile.
   - Apply Active Predictions immediately: calibrate test generation, response depth, implementation depth, and type strictness before touching any other context.

1. **Resolve Scope**
   - Use the user request, changed files, graph proximity, and impact report.
   - Identify candidate modules, services, APIs, schemas, tests, and risk areas.

2. **Rank Artifacts**
   - Load compact maps first: context maps, graph node summaries, `aidlc-state.md`, active unit, acceptance criteria.
   - Rank knowledge docs by graph proximity and section confidence.
   - Prefer H2 sections with high/medium confidence.
   - Penalize stale or low-confidence sections unless they are required for risk.

3. **Slice Before Full Read**
   - Load only relevant H2 sections, table rows, graph nodes/edges, and file snippets.
   - Do not load an entire knowledge document when a section or table row is enough.
   - Do not load all skills. Invoke only skills triggered by the current change.

4. **Lazy Loading**
   - Defer expensive artifacts until a gate requires them.
   - Examples:
     - Load API docs only when API surfaces are touched.
     - Load migration docs only when schema/persistence changes.
     - Load security assessment only for security-sensitive paths.
     - Load snapshots only when API replay applies.

5. **Summarize And Cache**
   - Write compact summaries to `.engineering-intelligence/context/context-manifest.md`.
   - Store pointers to source evidence instead of copying long excerpts.
   - Reuse manifest rankings during resume/checkpoint flows.

6. **Escalate When Budget Is Insufficient**
   - If critical context cannot fit, stop and report what was excluded, why it matters, and whether the user wants a narrower scope.

## Rules

- Never sacrifice required safety gates to save tokens.
- Prefer evidence pointers over pasted content.
- Prefer graph node/edge slices over full graph JSON.
- Prefer section-level confidence metadata over full-document reads.
- Keep initial intelligence loading under 40% of context budget whenever possible.
- Lazy Loading is mandatory for large projects.

## Quality Gates

- [ ] Context Manifest exists for non-trivial workflows
- [ ] Ranked context explains why each artifact was loaded
- [ ] Initial context stayed within 40% budget or escalation was recorded
- [ ] Full documents were avoided when slices were enough
- [ ] Required gates still had enough evidence to run
