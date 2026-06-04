# Engineering Intelligence Rules

## Pre-Edit Requirements

When `knowledge-base/` exists, consult relevant slices of the documents, `.engineering-intelligence/context/`, and `.engineering-intelligence/graph/` before non-trivial project edits. Do not load entire intelligence directories by default.

When `.engineering-intelligence/aidlc/` exists, also consult `aidlc-state.md`, `execution-plan.md`, `open-questions.md`, and the active construction unit before edits.

Run `context-budget-optimizer` for non-trivial workflows. Create `.engineering-intelligence/context/context-manifest.md`, rank context by graph proximity, keep initial intelligence loading under 40% of available context budget when possible, and lazy-load gate-specific evidence only when needed.

## AI-DLC Operating Model

Use the AI-Driven Development Lifecycle inside the existing Engineering Intelligence workflows for non-trivial work. Do not fork work into a separate lifecycle; merge AI-DLC with Agile delivery artifacts.

| Phase | Purpose | Required Outputs |
|---|---|---|
| Discovery | Capture business intent and technical environment | `.engineering-intelligence/aidlc/discovery/vision.md`, `technical-environment.md`, `open-questions.md` |
| Inception | Detect workspace, reverse engineer brownfield systems, validate requirements, plan workflow | `aidlc-state.md`, `execution-plan.md`, `inception/requirements.md`, Agile backlog/story/acceptance artifacts, reverse-engineering docs when brownfield |
| Construction | Design and implement per independent unit | `construction/<unit>/`, `cross-unit-discoveries.md`, build/test summary |
| Operations | Prepare deployment, observability, rollback, runbooks | `operations/operations-readiness.md`, MCP/security review when relevant |

Select the delivery mode inside `engineering-intelligence`: standard Agile delivery, adversarial delivery, TDD delivery, design-first delivery, or hypothesis debugging.

Maintain these Agile artifacts when product work is in scope:

| Path | Purpose |
|---|---|
| `.engineering-intelligence/aidlc/agile/product-backlog.md` | Epics, stories, priorities, dependencies, status |
| `.engineering-intelligence/aidlc/agile/sprint-plan.md` | Sprint goal, selected stories, risks, commitments |
| `.engineering-intelligence/aidlc/agile/acceptance-criteria.md` | Story-level acceptance criteria mapped to tests |
| `.engineering-intelligence/aidlc/agile/definition-of-ready.md` | Gate before construction starts |
| `.engineering-intelligence/aidlc/agile/definition-of-done.md` | Gate before completion |
| `.engineering-intelligence/aidlc/agile/retrospective.md` | Lessons and process improvements |

End AI-DLC-enabled workflow responses with:

```text
AI-DLC: <phase> -> <stage> -> <status>
```

## Engineering Change Protocol

For every engineering change, follow this sequence:

| Step | Action | Output |
|---|---|---|
| 1 | Write impact report before editing | `.engineering-intelligence/reports/IMP-XXX-*.md` |
| 2 | Update AI-DLC plan/state when the change is non-trivial | `.engineering-intelligence/aidlc/execution-plan.md`, `aidlc-state.md` |
| 3 | Implement code changes and tests | Modified source and test files |
| 4 | Validate honestly with environmental backpressure and safety gates — report unrun checks | Test results, lint/type/API/migration results, build/test summary |
| 5 | Incrementally update affected intelligence and graph artifacts | Updated knowledge/memory/context/graph/aidlc |
| 6 | Record completed work | `.changes/CHG-XXX-*.md` |

## Read-Only Workflows

These workflows analyze and report but do **not** modify product code:

| Workflow | Purpose | Output |
|---|---|---|
| `map-architecture` | Build evidence-backed graphs | Graph JSON, architecture-map.md, context updates |
| `analyze-impact` | Write impact report for a proposal or diff | `.engineering-intelligence/reports/IMP-XXX-*.md` |
| `sync-engineering-intelligence` | Synchronize intelligence for a change | Updated knowledge/memory/context/graph |
| `review-engineering-change` | Write review findings | `.engineering-intelligence/reports/REV-XXX-*.md` |

Only the `engineering-intelligence` implementation workflow is intended to modify product code.

## Canonical Paths

Use these as the canonical project-intelligence paths — never invent alternatives:

| Path | Purpose |
|---|---|
| `knowledge-base/` | Evidence-based project documentation |
| `.engineering-intelligence/memory/` | Durable decisions, rules, patterns |
| `.engineering-intelligence/aidlc/` | AI-DLC durable lifecycle state, plans, audit, unit artifacts, operations readiness |
| `.engineering-intelligence/context/` | Compact AI navigation maps |
| `.engineering-intelligence/events/` | Change-event guidance |
| `.engineering-intelligence/graph/` | Architecture graph JSON + Mermaid maps |
| `.engineering-intelligence/reports/` | Impact (IMP) and review (REV) reports |
| `.changes/` | Sequential change history records |

## Evidence Rules

- Never invent undocumented implementation facts
- Back every material claim with a file path reference
- Mark uncertainty explicitly — silence is worse than "unknown"
- Use `**Not detected**` for absent features, not omission
- Prefer file/section pointers over long pasted context. Load full files only when slices are insufficient.

## Safety And Governance

- Use measurable NFRs for latency, reliability, security, compliance, data, and compatibility targets.
- Create ADRs only when real alternatives were considered; accepted ADRs are immutable except supersession links.
- Require explicit human approval before destructive actions, production deployments, merges, irreversible migrations, or broad permission grants.
- For MCP or external tool execution, prefer tool-level permissions, schema pinning, sandboxed execution, and raw-parameter approval for destructive operations.
- Run the pre-flight freshness gate before implementation; stale scoped context below 50 blocks work unless explicitly accepted by the user.
- Map every acceptance criterion to automated test, manual verification, or open item before Definition of Done can pass.
- Run type safety, API compatibility, and database migration safety gates when applicable.
- Medium-and-above risk changes require rollback instructions and operations readiness.
