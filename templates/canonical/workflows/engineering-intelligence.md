---
description: Implement an engineering request with impact analysis, tests, validation, and intelligence synchronization.
---

# Engineering Intelligence

Use the `engineering-intelligence-skill` capability for the user's accompanying request. For non-trivial work, use `aidlc-lifecycle-engine` inside this workflow to merge Agile delivery with AI-DLC durable state.

## Pipeline

1. **Read Intelligence** — Consult `.engineering-intelligence/knowledge-base/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, `.engineering-intelligence/graph/`
2. **Establish Baseline** — Run `npx engineering-intelligence verify .` before any edit (use `environmental-backpressure-engine` to resolve "no check commands detected" by configuring `hooks.verifyCommands`, never by skipping). A failure here is pre-existing, not something this change caused — note it so the post-implementation result isn't misread as a regression.
3. **Select Delivery Mode** — Choose standard Agile, adversarial, TDD, design-first, or hypothesis debugging based on risk
4. **Write Impact Report** — Create `.engineering-intelligence/reports/IMP-XXX-<summary>.md` before any code edit
5. **Plan Agile + AI-DLC Work** — Update backlog, acceptance criteria, Definition of Ready, `.engineering-intelligence/aidlc/execution-plan.md`, and `aidlc-state.md`
6. **Implement** — Make the requested code changes following established patterns
7. **Test** — Add/update tests proportional to risk; execute and record results
8. **Safety Gates** — Run freshness, type safety, API compatibility, API snapshot replay, migration safety, convention, acceptance-mapping, dependency-risk, env-var, ADR compliance, LLM prompt-injection, and rollback gates when applicable
9. **Validate** — Re-run `npx engineering-intelligence verify .` (via `environmental-backpressure-engine`) against the finished change. This is the receipt the Stop gate and CI both check — it must pass, or the failure must be recorded as a residual risk, not silently dropped.
10. **Sync Intelligence** — Incrementally update only affected knowledge, memory, context, event, graph artifacts, and AI-DLC artifacts
11. **Record Change** — Write `.engineering-intelligence/changes/CHG-XXX-<summary>.md` referencing related reports and acceptance verification
12. **Review Gate** — For high-risk changes, run engineering-change review before completion

## Completion Report

Finish with:
- Code changes made (files, what changed)
- Tests run and results (pass/fail counts)
- Affected systems and services
- Synchronized intelligence artifacts
- Related reports (IMP-XXX, REV-XXX)
- Agile artifacts updated (backlog, stories, acceptance criteria, Definition of Done)
- Safety gates run (freshness, type, API, snapshots, migration, dependency, env, ADR, LLM, acceptance mapping, rollback)
- Unresolved risks or follow-ups
- AI-DLC breadcrumb (`AI-DLC: <phase> -> <stage> -> <status>`)
