---
description: Initialize evidence-based engineering intelligence for the current project.
---

# Initialize Engineering Intelligence

Use the `initialize-intelligence-skill` capability.

## What This Does

Analyzes this repository thoroughly without changing product code. Produces a complete project intelligence baseline.

## Outputs Generated

| Category | Path | Content |
|---|---|---|
| Knowledge Base | `knowledge-base/` | 16 evidence-backed documents (00-15) |
| Memory | `.engineering-intelligence/memory/` | 5 durable decision/pattern documents |
| Context | `.engineering-intelligence/context/` | 6 compact navigation maps |
| Events | `.engineering-intelligence/events/` | 5 change-event guidance documents |
| Graphs | `.engineering-intelligence/graph/` | 4 JSON graphs + architecture-map.md |
| AI-DLC + Agile | `.engineering-intelligence/aidlc/` | Lifecycle state, audit, discovery placeholders, open questions, Agile backlog/sprint/DoR/DoD, cross-unit discovery log |
| History | `.changes/CHG-000-initialization.md` | Initialization record |

## Execution Steps

1. **Discover** — Scan repository for packages, runtimes, build systems, APIs, databases, auth, CI, and tests
2. **Extract** — Generate knowledge-base documents with evidence citations
3. **Validate** — Audit claims against source code; write validation report
4. **Generate Memory** — Extract durable decisions and patterns
5. **Generate Context** — Create concise AI navigation maps
6. **Build Graphs** — Run `engineering-intelligence map .` (or `npx engineering-intelligence map .`) to generate the real computed dependency graph at `.engineering-intelligence/graph/dependency-graph.json`. Then invoke `graph-engine` to produce service, runtime, and business-flow graphs and `architecture-map.md`
7. **Initialize AI-DLC + Agile** — Create `aidlc-state.md`, `audit.md`, `open-questions.md`, `execution-plan.md`, `checkpoints.md`, Agile delivery artifacts, and `construction/cross-unit-discoveries.md`
8. **Audit Memory** — Run memory pruning audit and initialize `.engineering-intelligence/memory/regression-patterns.md`
9. **Record** — Write initialization change record

## Important

- Do not fabricate details — mark uncertainty clearly
- Every claim must cite evidence from the repository
- Finish with: created artifacts, confidence assessment, and human-review items
