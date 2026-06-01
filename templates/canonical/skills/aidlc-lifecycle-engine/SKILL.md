---
name: aidlc-lifecycle-engine
description: Runs the adaptive AI-DLC lifecycle with Discovery, Inception, Construction, Operations, durable artifacts, hatted agents, and objective completion gates.
version: 1.0.0
---

# AI-DLC Lifecycle Engine

Use this skill inside the existing Engineering Intelligence workflows. It is not a separate command family. It turns Agile intent into an adaptive, artifact-driven delivery path while preserving familiar Agile concepts: vision, backlog, user stories, acceptance criteria, sprint planning, implementation, review, release readiness, and retrospective learning.

## Runtime Artifacts

Use `.engineering-intelligence/aidlc/` as the canonical AI-DLC root:

| Path | Purpose |
|---|---|
| `.engineering-intelligence/aidlc/aidlc-state.md` | Active phase, stage, workflow, hat, unit, and completion status |
| `.engineering-intelligence/aidlc/audit.md` | Append-only chronological log of decisions, user answers, tool checks, and transitions |
| `.engineering-intelligence/aidlc/open-questions.md` | Unresolved ambiguities and owner/status |
| `.engineering-intelligence/aidlc/execution-plan.md` | Adaptive stage plan with mandatory/conditional/skipped stages |
| `.engineering-intelligence/aidlc/discovery/vision.md` | Business objectives, personas, value, success metrics |
| `.engineering-intelligence/aidlc/discovery/technical-environment.md` | Runtime, deployment, integrations, data stores, auth, constraints |
| `.engineering-intelligence/aidlc/agile/product-backlog.md` | Epics, stories, priorities, dependencies, and status |
| `.engineering-intelligence/aidlc/agile/sprint-plan.md` | Active sprint goal, selected stories, capacity, risks, and commitments |
| `.engineering-intelligence/aidlc/agile/acceptance-criteria.md` | Story-level acceptance criteria expressed as executable validation targets |
| `.engineering-intelligence/aidlc/agile/definition-of-ready.md` | Readiness checklist before construction |
| `.engineering-intelligence/aidlc/agile/definition-of-done.md` | Completion checklist after validation and sync |
| `.engineering-intelligence/aidlc/agile/retrospective.md` | Lessons, process improvements, recurring risks, and follow-ups |
| `.engineering-intelligence/aidlc/inception/requirements.md` | Validated functional requirements and edge cases |
| `.engineering-intelligence/aidlc/inception/reverse-engineering/` | Brownfield architecture, API, code structure, component inventory, technology stack |
| `.engineering-intelligence/aidlc/construction/cross-unit-discoveries.md` | Shared discoveries from parallel or sequential units |
| `.engineering-intelligence/aidlc/construction/<unit>/` | Unit functional design, NFR design, ADRs, code plan, build/test evidence |
| `.engineering-intelligence/aidlc/operations/` | Deployment readiness, observability, runbooks, rollback notes |

These AI-DLC files complement `knowledge-base/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, `.engineering-intelligence/graph/`, `.engineering-intelligence/reports/`, and `.changes/`.

## Embedded Agile + AI-DLC Model

Map Agile to AI-DLC this way:

| Agile Concept | AI-DLC Phase | Artifact |
|---|---|---|
| Product vision | Discovery | `discovery/vision.md` |
| Product backlog | Discovery / Inception | `agile/product-backlog.md` |
| User stories | Inception | `inception/requirements.md`, `agile/product-backlog.md` |
| Acceptance criteria | Inception / Construction | `agile/acceptance-criteria.md`, tests |
| Sprint planning | Inception | `agile/sprint-plan.md`, `execution-plan.md` |
| Development | Construction | `construction/<unit>/` |
| Daily inspection | Construction | `aidlc-state.md`, `audit.md`, `cross-unit-discoveries.md` |
| Sprint review | Construction / Operations | validation summary, review report |
| Release | Operations | `operations/operations-readiness.md` |
| Retrospective | Operations | `agile/retrospective.md` |

## Adaptive Phase Model

### 0. Discovery

Use when project intent, deployment environment, ownership, or constraints are unclear.

Outputs:
- `discovery/vision.md`
- `discovery/technical-environment.md`
- `open-questions.md`

Ask role-aware questions. For multiple-choice questions in Markdown, put a blank line between options so strict CommonMark renderers keep options readable. Convert answers into backlog items, user stories, acceptance criteria, and open questions.

### 1. Inception

Always run workspace detection. Classify the repository as `greenfield` or `brownfield`.

For brownfield systems, run reverse engineering and write:
- `business-overview.md`
- `architecture.md`
- `code-structure.md`
- `api-documentation.md`
- `component-inventory.md`
- `technology-stack.md`

Then compile validated requirements, backlog updates, acceptance criteria, sprint plan, and an adaptive `execution-plan.md`.

### 2. Construction

Execute per unit of work. Each unit may include:
- Functional design
- NFR requirements
- NFR design
- Infrastructure design
- Code generation plan
- Build and test summary

Before starting each unit, read `cross-unit-discoveries.md`. If new constraints appear, append finding, impact, and action taken.

### 3. Operations

Use when deployment, infrastructure, observability, or production readiness is in scope. Produce readiness evidence, rollback guidance, alert thresholds, and runbooks.

## Delivery Mode Selection

Within `/engineering-intelligence`, choose a delivery mode:

| Mode | Use When | Required Hats |
|---|---|---|
| Standard Agile Delivery | General feature, bugfix, refactor, or update | Product Analyst, System Architect, Component Builder, Test Engineer, Documentation Writer |
| Adversarial Delivery | Auth, payment, public API, data exposure, critical business rules | Security Officer, Adversary, Compliance Auditor, Test Engineer |
| TDD Delivery | High-reliability business logic or service contracts | Product Analyst, Test Engineer, Component Builder |
| Design-First Delivery | Major migrations, new architecture, data model redesign | System Architect, Database Administrator, Security Officer, Compliance Auditor |
| Hypothesis Debugging | Production bugs, regressions, memory leaks, trace failures | Orchestration Lead, Performance Analyst, SRE, Component Builder |

## Objective Completion Criteria

Each stage must end with binary evidence:
- Artifact exists at the expected path
- Story is Ready before implementation and Done before completion
- Unknowns are recorded or resolved
- Required tests, type checks, linters, scans, or build commands ran, failed, or were explicitly unavailable
- Human approval is recorded before irreversible actions
- Breadcrumb is updated in `aidlc-state.md`

## Environmental Backpressure

Use compilers, strict linters, type systems, test suites, security scanners, architecture checks, and local reproducer scripts as direct feedback. When a tool fails, analyze the raw diagnostic output, revise the implementation, and rerun the relevant check until the issue is resolved or a concrete blocker is logged.

## Progress Breadcrumb

End AI-DLC-enabled workflow responses with one compact status line:

```text
AI-DLC: <phase> -> <stage> -> <status>
```

## Quality Gates

- [ ] Discovery artifacts exist when initial intent or environment was ambiguous
- [ ] Backlog, stories, acceptance criteria, Definition of Ready, and Definition of Done are updated for product work
- [ ] Workspace is classified as greenfield or brownfield
- [ ] Brownfield reverse engineering exists before broad changes
- [ ] Requirements and execution plan are durable files
- [ ] Construction is split into explicit units
- [ ] Cross-unit discoveries are loaded and updated
- [ ] Validation uses environmental backpressure
- [ ] Operations readiness is addressed when deployment or production behavior changes
