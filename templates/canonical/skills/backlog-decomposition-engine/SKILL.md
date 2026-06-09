---
name: backlog-decomposition-engine
description: Autonomously decomposes a high-level initiative into a durable Epic to Feature to Ticket backlog with stable IDs, acceptance criteria, dependencies, execution order, and a per-feature human approval gate. Use to plan large product work before implementation.
version: 1.0.0
---

# Backlog Decomposition Engine

Turn a single high-level initiative, product brief, or large request into a complete, durable, hierarchical backlog. This skill plans and structures work; it does **not** modify product code. Implementation happens later through `deliver-backlog` and `engineering-intelligence-skill`.

The hierarchy is three levels:

```text
Epic  (a business outcome / initiative)
 └─ Feature  (a shippable slice of the epic; the approval unit)
     └─ Ticket  (an implementable unit of work; maps to one /engineering-intelligence run)
```

## Inputs

- The user's high-level initiative or request
- `knowledge-base/` (domain context)
- `.engineering-intelligence/graph/` (dependency, service, runtime, business-flow graphs)
- `.engineering-intelligence/memory/` (durable architecture and business decisions)
- `.engineering-intelligence/aidlc/discovery/vision.md` and `agile/product-backlog.md` when present

## Runtime Artifacts

Write the backlog under `.engineering-intelligence/aidlc/agile/backlog/`:

| Path | Purpose |
|---|---|
| `.engineering-intelligence/aidlc/agile/backlog/backlog-index.md` | Master index, ID counters, and status rollup for every epic, feature, and ticket |
| `.engineering-intelligence/aidlc/agile/backlog/epics/EPIC-XXX-<slug>.md` | One epic: outcome, success metrics, child features |
| `.engineering-intelligence/aidlc/agile/backlog/features/FEAT-XXX-<slug>.md` | One feature: user story, acceptance criteria, child tickets, approval state |
| `.engineering-intelligence/aidlc/agile/backlog/tickets/TKT-XXX-<slug>.md` | One ticket: executable acceptance criteria, affected files, Ready/Done gates, implementation command |
| `.engineering-intelligence/aidlc/agile/backlog/dependency-graph.md` | Feature and ticket dependency graph plus the derived execution order |
| `.engineering-intelligence/aidlc/agile/backlog/sync/tracker-sync-map.md` | Local ID to external tracker (e.g. GitHub issue) mapping, written only by `issue-tracker-sync-engine` |

This backlog is the structured expansion of `agile/product-backlog.md`; keep the high-level epic list in `product-backlog.md` consistent with `backlog-index.md`.

## Identifier Rules

- IDs are stable and zero-padded: `EPIC-001`, `FEAT-001`, `TKT-001`.
- Never renumber an existing ID. Allocate the next number from the counters in `backlog-index.md`.
- Slugs are lowercase, hyphenated, and derived from the title.
- Every feature names its parent epic; every ticket names its parent feature.

## Procedure

1. **Load Intelligence** — Read the inputs above. If project intelligence has not been initialized, run discovery/initialization first or record the gap in `open-questions.md`.

2. **Frame Epics** — Group the initiative into one or more epics by business outcome. Each epic gets an objective, success metrics, priority, and a verifiable definition of success.

3. **Slice Features** — Decompose each epic into the smallest set of independently shippable features. Each feature is the **approval unit**: it carries a user story, acceptance criteria, priority, dependencies, and an `Approval` state that starts at `pending`.

4. **Cut Tickets** — Decompose each feature into implementable tickets sized for a single `/engineering-intelligence` run (roughly half a day to two days of work). Use graph intelligence to predict affected files and to keep tickets cohesive. Each ticket carries executable acceptance criteria, a type, an estimate, a risk level, Definition of Ready, Definition of Done, and a ready-to-run implementation command.

5. **Map Dependencies** — Build `dependency-graph.md`. Record feature-to-feature and ticket-to-ticket dependencies, mark which can run in parallel (no dependency edge and no overlapping owned files), and emit a topologically ordered execution sequence. Flag conflict risk where owned files overlap.

6. **Assign Initial Status** — Tickets start `todo`; a ticket becomes `ready` only when its Definition of Ready is satisfied and its dependencies are `done`. Features start `proposed` with `Approval: pending`. Epics start `proposed`.

7. **Write Artifacts** — Create every epic, feature, and ticket file plus `backlog-index.md` and `dependency-graph.md`. Update `agile/product-backlog.md`, `agile/acceptance-criteria.md`, and `execution-plan.md` to reference the new IDs. Append the decomposition decisions to `aidlc/audit.md`.

8. **Optional Tracker Sync** — If the user asked to sync, or a GitHub remote is detected and sync is enabled, invoke `issue-tracker-sync-engine` to mirror epics/features/tickets to the external tracker and record the mapping in `sync/tracker-sync-map.md`.

9. **Stop At The Gate** — Decomposition ends with a plan only. Do not implement. Hand off to `deliver-backlog`, which enforces the per-feature approval gate.

## Artifact Templates

### `backlog-index.md`

```markdown
# Backlog Index

## Counters
- next-epic: 3
- next-feature: 7
- next-ticket: 21

## Status Rollup
| ID | Type | Title | Parent | Status | Approval | Priority |
|---|---|---|---|---|---|---|
| EPIC-001 | epic | <title> | — | in-progress | — | P0 |
| FEAT-001 | feature | <title> | EPIC-001 | proposed | pending | P0 |
| TKT-001 | ticket | <title> | FEAT-001 | ready | — | P0 |
```

### `epics/EPIC-XXX-<slug>.md`

```markdown
# EPIC-001: <title>

- Status: proposed | approved | in-progress | done
- Priority: P0 | P1 | P2
- Owner: <persona or team>

## Business Outcome
<the measurable outcome this epic delivers>

## Success Metrics
- <metric and target>

## Features
- FEAT-001 — <title>
- FEAT-002 — <title>

## Definition of Success
- [ ] <binary, evidence-backed completion condition>
```

### `features/FEAT-XXX-<slug>.md`

```markdown
# FEAT-001: <title>

- Epic: EPIC-001
- Status: proposed | approved | in-progress | in-review | done | blocked
- Approval: pending | approved | changes-requested
- Priority: P0 | P1 | P2
- Depends On: FEAT-XXX (or none)

## User Story
As a <persona>, I want <capability>, so that <outcome>.

## Acceptance Criteria
- Given <context>, when <action>, then <observable result>.

## Tickets
- TKT-001 — <title>
- TKT-002 — <title>

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
```

### `tickets/TKT-XXX-<slug>.md`

```markdown
# TKT-001: <title>

- Feature: FEAT-001
- Status: todo | ready | in-progress | in-review | done | blocked
- Type: feature | bugfix | chore | spike | migration
- Estimate: S | M | L
- Risk: low | medium | high
- Depends On: TKT-XXX (or none)
- Files Likely Affected: <paths from graph intelligence>

## Acceptance Criteria
- Given <context>, when <action>, then <observable result>.

## Definition of Ready
- [ ] Dependencies are done
- [ ] Acceptance criteria are testable
- [ ] Affected files identified from graph intelligence

## Definition of Done
- [ ] Code implemented and tests added proportional to risk
- [ ] Safety gates run or explicitly not applicable
- [ ] Intelligence synchronized and change record written

## Implementation Command
```text
/engineering-intelligence Implement TKT-001: <fully scoped request with file paths and constraints>
```
```

## Rules

- Do **not** modify product code; this skill only writes backlog and planning artifacts.
- Never renumber existing IDs; only append new ones using the counters.
- Every ticket must be independently implementable and map to exactly one implementation command.
- Features are the approval unit; tickets inherit their feature's approval state.
- Cite graph and knowledge evidence for affected-file predictions; record unknowns instead of guessing.
- Keep `backlog-index.md`, `product-backlog.md`, and child files consistent on every write.

## Quality Gates

- [ ] At least one epic, one feature, and one ticket exist with stable zero-padded IDs
- [ ] Every feature has a user story, acceptance criteria, and `Approval: pending`
- [ ] Every ticket has executable acceptance criteria and a runnable implementation command
- [ ] `dependency-graph.md` exists with a topological execution order and parallel-safe markings
- [ ] `backlog-index.md` counters and status rollup match the child files
- [ ] No product code was modified
- [ ] Decomposition decisions appended to `aidlc/audit.md`
