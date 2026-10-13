# GraphWard Rules

## Agent-First Entry Point

When `.agents/agents/` is available, start non-trivial work with the
`engineering-orchestrator` custom agent. It routes the request to the right
specialist and keeps the evidence, tests, and AI-DLC state aligned.

The generated workflows remain available as explicit compatibility commands
such as `/graphward` and `/sync-graphward`. They
are not removed during an update, so existing projects can adopt agents
incrementally.

## Pre-Edit Requirements

When `.graphward/knowledge-base/` exists, consult relevant slices of the documents, `.graphward/context/`, and `.graphward/graph/` before non-trivial project edits. Do not load entire intelligence directories by default.

When `.graphward/aidlc/` exists, also consult `aidlc-state.md`, `execution-plan.md`, `open-questions.md`, and the active construction unit before edits.

Run `context-budget-optimizer` for non-trivial workflows. Create `.graphward/context/context-manifest.md`, rank context by graph proximity, keep initial intelligence loading under 40% of available context budget when possible, and lazy-load gate-specific evidence only when needed.

## AI-DLC Operating Model

Use the AI-Driven Development Lifecycle inside the existing GraphWard workflows for non-trivial work. Do not fork work into a separate lifecycle; merge AI-DLC with Agile delivery artifacts.

| Phase | Purpose | Required Outputs |
|---|---|---|
| Discovery | Capture business intent and technical environment | `.graphward/aidlc/discovery/vision.md`, `technical-environment.md`, `open-questions.md` |
| Inception | Detect workspace, reverse engineer brownfield systems, validate requirements, plan workflow | `aidlc-state.md`, `execution-plan.md`, `inception/requirements.md`, Agile backlog/story/acceptance artifacts, reverse-engineering docs when brownfield |
| Construction | Design and implement per independent unit | `construction/<unit>/`, `cross-unit-discoveries.md`, build/test summary |
| Operations | Prepare deployment, observability, rollback, runbooks | `operations/operations-readiness.md`, MCP/security review when relevant |

Select the delivery mode inside `graphward`: standard Agile delivery, adversarial delivery, TDD delivery, design-first delivery, or hypothesis debugging.

Maintain these Agile artifacts when product work is in scope:

| Path | Purpose |
|---|---|
| `.graphward/aidlc/agile/product-backlog.md` | High-level epics, priorities, dependencies, status |
| `.graphward/aidlc/agile/backlog/` | Hierarchical Epic → Feature → Ticket backlog with stable IDs, dependency graph, and per-feature approval gates |
| `.graphward/aidlc/agile/sprint-plan.md` | Sprint goal, selected stories, risks, commitments |
| `.graphward/aidlc/agile/acceptance-criteria.md` | Story-level acceptance criteria mapped to tests |
| `.graphward/aidlc/agile/definition-of-ready.md` | Gate before construction starts |
| `.graphward/aidlc/agile/definition-of-done.md` | Gate before completion |
| `.graphward/aidlc/agile/retrospective.md` | Lessons and process improvements |

End AI-DLC-enabled workflow responses with:

```text
AI-DLC: <phase> -> <stage> -> <status>
```

## Backlog Decomposition And Delivery

For epic-sized initiatives, decompose before implementing:

| Step | Workflow | Action |
|---|---|---|
| 1 | `decompose-backlog` | Autonomously create the Epic → Feature → Ticket hierarchy under `.graphward/aidlc/agile/backlog/` with stable IDs, dependency graph, and execution order. Plans only; does not modify product code. |
| 2 | (human) | Approve each feature. Implementation of a feature must not begin until `Approval: approved` is recorded in its feature file and `aidlc/audit.md`. |
| 3 | `deliver-backlog` | Implement an approved feature's tickets one at a time via `graphward`, rolling up ticket → feature → epic status. Re-enter the approval gate for every feature. |

Optionally mirror the backlog to GitHub Issues with `issue-tracker-sync-engine`; the local markdown backlog remains the source of truth.

## Engineering Change Protocol

For every engineering change, follow this sequence:

| Step | Action | Output |
|---|---|---|
| 1 | Write impact report before editing | `.graphward/reports/IMP-XXX-*.md` |
| 2 | Update AI-DLC plan/state when the change is non-trivial | `.graphward/aidlc/execution-plan.md`, `aidlc-state.md` |
| 3 | Implement code changes and tests | Modified source and test files |
| 4 | Validate honestly with environmental backpressure and safety gates — report unrun checks | Test results, lint/type/API/migration results, build/test summary |
| 5 | Incrementally update affected intelligence and graph artifacts | Updated knowledge/memory/context/graph/aidlc |
| 6 | Record completed work | `.graphward/changes/CHG-XXX-*.md` |

## Read-Only Workflows

These workflows analyze and report but do **not** modify product code:

| Workflow | Purpose | Output |
|---|---|---|
| `map-architecture` | Build evidence-backed graphs | Graph JSON, architecture-map.md, context updates |
| `analyze-impact` | Write impact report for a proposal or diff | `.graphward/reports/IMP-XXX-*.md` |
| `sync-graphward` | Synchronize intelligence for a change | Updated knowledge/memory/context/graph |
| `review-engineering-change` | Write review findings | `.graphward/reports/REV-XXX-*.md` |
| `decompose-backlog` | Create the Epic → Feature → Ticket backlog | `.graphward/aidlc/agile/backlog/` |

The `graphward` and `deliver-backlog` workflows are the only workflows intended to modify product code; `deliver-backlog` does so one approved feature at a time.

## Canonical Paths

Use these as the canonical project-intelligence paths — never invent alternatives:

| Path | Purpose |
|---|---|
| `.graphward/knowledge-base/` | Evidence-based project documentation |
| `.graphward/memory/` | Durable decisions, rules, patterns |
| `.graphward/aidlc/` | AI-DLC durable lifecycle state, plans, audit, unit artifacts, operations readiness |
| `.graphward/context/` | Compact AI navigation maps |
| `.graphward/events/` | Change-event guidance |
| `.graphward/graph/` | Architecture graph JSON + Mermaid maps |
| `.graphward/reports/` | Impact (IMP) and review (REV) reports |
| `.graphward/changes/` | Sequential change history records |

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
