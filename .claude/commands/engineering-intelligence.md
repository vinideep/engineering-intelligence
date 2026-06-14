> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
description: Implement an engineering request with impact analysis, tests, validation, and intelligence synchronization.
argument-hint: <implementation request>
---

# Engineering Intelligence

Use the `engineering-intelligence-skill` capability for the user's accompanying request. For non-trivial work, use `aidlc-lifecycle-engine` inside this workflow to merge Agile delivery with AI-DLC durable state.

## Pipeline

1. **Read Intelligence** — Consult `knowledge-base/`, `$EImemory/`, `$EIcontext/`, `$EIgraph/`
2. **Select Delivery Mode** — Choose standard Agile, adversarial, TDD, design-first, or hypothesis debugging based on risk
3. **Write Impact Report** — Create `$EIreports/IMP-XXX-<summary>.md` before any code edit
4. **Plan Agile + AI-DLC Work** — Update backlog, acceptance criteria, Definition of Ready, `$AIDLCexecution-plan.md`, and `aidlc-state.md`
5. **Implement** — Make the requested code changes following established patterns
6. **Test** — Add/update tests proportional to risk; execute and record results
7. **Safety Gates** — Run freshness, type safety, API compatibility, API snapshot replay, migration safety, convention, acceptance-mapping, dependency-risk, env-var, ADR compliance, LLM prompt-injection, and rollback gates when applicable
8. **Validate** — Run available linters, type checks, test suites, scans, and architecture checks as environmental backpressure
9. **Sync Intelligence** — Incrementally update only affected knowledge, memory, context, event, graph artifacts, and AI-DLC artifacts
10. **Record Change** — Write `.changes/CHG-XXX-<summary>.md` referencing related reports and acceptance verification
11. **Review Gate** — For high-risk changes, run engineering-change review before completion

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


User supplied scope or request: $ARGUMENTS