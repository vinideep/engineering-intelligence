---
name: initialize-engineering-intelligence
description: Initialize evidence-based engineering intelligence for the current project.
---

# Initialize Engineering Intelligence

Use the `initialize-intelligence-skill` capability.

## What This Does

Analyzes this repository thoroughly without changing product code. Produces a complete project intelligence baseline.

## Outputs Generated

| Category | Path | Content |
|---|---|---|
| Knowledge Base | `.engineering-intelligence/knowledge-base/` | 16 evidence-backed documents (00-15) |
| Memory | `.engineering-intelligence/memory/` | 5 durable decision/pattern documents |
| Context | `.engineering-intelligence/context/` | 6 compact navigation maps |
| Events | `.engineering-intelligence/events/` | 5 change-event guidance documents |
| Graphs | `.engineering-intelligence/graph/` | 4 JSON graphs + architecture-map.md |
| AI-DLC + Agile | `.engineering-intelligence/aidlc/` | Lifecycle state, audit, discovery placeholders, open questions, Agile backlog/sprint/DoR/DoD, cross-unit discovery log |
| History | `.engineering-intelligence/changes/CHG-000-initialization.md` | Initialization record |

## Execution Steps

1. **Bootstrap deterministically** — Run `engineering-intelligence initialize . --providers auto --yes`. This installs/verifies pinned local providers, applies the shared file policy, creates Graphify structural evidence, reconciles EI's canonical graph, indexes the approved CCE scope, derives claims, and writes the knowledge-generation brief. Report degraded native fallback honestly; use `--require-providers` only when requested.
2. **Discover** — Read `initialization-evidence.json` and `KNOWLEDGE-GENERATION-BRIEF.md`, then call `get_engineering_context` before direct source exploration. Scan only unresolved packages, runtimes, build systems, APIs, databases, auth, CI, and tests.
3. **Extract** — Generate EI-owned knowledge-base documents with source citations. Graphify and CCE are evidence providers, never canonical authors.
4. **Validate** — Audit claims against current source; write validation report; quarantine stale, contested, unverifiable, and out-of-scope evidence
5. **Generate Memory** — Extract durable decisions and patterns
6. **Generate Context** — Create concise AI navigation maps
7. **Build remaining graphs** — Preserve the normalized dependency graph from bootstrap; invoke `graph-engine` for service, runtime, and business-flow graphs and `architecture-map.md`
8. **Initialize AI-DLC + Agile** — Create `aidlc-state.md`, `audit.md`, `open-questions.md`, `execution-plan.md`, `checkpoints.md`, Agile delivery artifacts, and `construction/cross-unit-discoveries.md`
9. **Audit Memory** — Run memory pruning audit and initialize `.engineering-intelligence/memory/regression-patterns.md`
10. **Publish and record** — Require strict claims, citation, knowledge, graph-scope, and health gates before writing the completed initialization record

## Important

- Do not fabricate details — mark uncertainty clearly
- Every claim must cite evidence from the repository
- EI remains canonical; provider health/version/fallback and evidence trust states must be recorded
- Raw provider tools are unavailable unless expert mode was explicitly enabled
- Finish with: created artifacts, confidence assessment, and human-review items
