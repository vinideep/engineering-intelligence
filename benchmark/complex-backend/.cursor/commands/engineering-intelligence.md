---
name: engineering-intelligence
description: Implement an engineering request with impact analysis, tests, validation, and intelligence synchronization.
---

# Engineering Intelligence

Use the `engineering-intelligence-skill` capability for the user's accompanying request. For non-trivial work, use `aidlc-lifecycle-engine` inside this workflow to merge Agile delivery with AI-DLC durable state.

## Pipeline

1. **Read Intelligence** — Consult `.engineering-intelligence/knowledge-base/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, `.engineering-intelligence/graph/`
2. **Establish Baseline** — Run `npx engineering-intelligence verify .` before any edit (use `environmental-backpressure-engine` to resolve "no check commands detected" by configuring `hooks.verifyCommands`, never by skipping). A failure here is pre-existing, not something this change caused — note it so the post-implementation result isn't misread as a regression.
3. **Adaptive Pre-Flight Gauntlet** — If the request is classified as `architecture`, `security`, cross-cutting (`high`/`critical` risk), or has 3+ ambiguities, invoke `socratic-stress-tester` to stress-test edge cases and resolve trade-offs before writing the impact report.
4. **Select Delivery Mode** — Choose standard Agile, adversarial, TDD, design-first, or hypothesis debugging based on risk
5. **Write Impact Report** — Create `.engineering-intelligence/reports/IMP-XXX-<summary>.md` before any code edit
6. **Plan Agile + AI-DLC Work** — Update backlog, acceptance criteria, Definition of Ready, `.engineering-intelligence/aidlc/execution-plan.md`, and `aidlc-state.md`
7. **Adaptive Interface Exploration** — If introducing new public APIs, exported types, schema models, or SDK contracts, invoke `interface-design-explorer` to benchmark contrasting interface options before coding.
8. **Implement** — Make requested changes. When in TDD mode or implementing critical business logic/state machines, execute strict Red-Green-Refactor slices via `vertical-tdd-engine`.
9. **Test** — Add/update tests proportional to risk; execute and record results
10. **Safety Gates** — Run freshness, type safety, API compatibility, API snapshot replay, migration safety, convention, acceptance-mapping, dependency-risk, env-var, ADR compliance, LLM prompt-injection, and rollback gates when applicable
11. **Validate** — Re-run `npx engineering-intelligence verify .` (via `environmental-backpressure-engine`) against the finished change. This is the receipt the Stop gate and CI both check — it must pass, or the failure must be recorded as a residual risk, not silently dropped.
12. **Sync Intelligence & Session Continuity** — Incrementally update only affected knowledge, memory, context, event, graph artifacts, and AI-DLC artifacts. If the session is paused or context bounds approach, serialize state via `session-handoff-engine`.
13. **Record Change** — Write `.engineering-intelligence/changes/CHG-XXX-<summary>.md` referencing related reports and acceptance verification
14. **Review Gate** — For high-risk changes, run engineering-change review before completion

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
