---
description: Autonomously discover and understand an existing codebase through systematic analysis, interactive clarification, and finalized intelligence artifacts — without modifying product code.
---

# Discover Codebase

Use `codebase-discovery-engine` to build a complete understanding of an existing project, then present findings, resolve ambiguities through clarification, and finalize the intelligence baseline.

## Input

An existing repository to analyze. If the repository path is ambiguous, ask for clarification.

## Output

Finalized codebase understanding captured in intelligence artifacts:

| Category | Path | Content |
|---|---|---|
| Knowledge Base | `knowledge-base/` | Evidence-backed project documentation |
| Graphs | `.engineering-intelligence/graph/` | Architecture graphs and maps |
| Context | `.engineering-intelligence/context/` | AI navigation maps |
| Discovery Report | `.engineering-intelligence/reports/DISCOVERY-*.md` | Findings summary with confidence levels |

## Execution Steps

1. **Discover** — Invoke `codebase-discovery-engine` to scan the repository:
   - Technology stack, frameworks, and runtimes
   - Project structure and module organization
   - API surfaces, database schemas, and integrations
   - Build systems, CI/CD pipelines, and deployment targets
   - Test infrastructure and coverage
   - Authentication and authorization patterns

2. **Present Findings** — Surface the discovery results to the user:
   - Summarize what was found with confidence levels
   - Highlight areas of uncertainty or ambiguity
   - Call out architectural patterns and notable design decisions
   - Identify gaps where information could not be determined from code alone

3. **Ask Clarifications** — For areas with low confidence or ambiguity:
   - Ask targeted questions about unclear architectural decisions
   - Confirm assumptions about deployment topology
   - Verify business domain understanding
   - Clarify team conventions not evident from code

4. **Finalize Understanding** — Incorporate clarifications and produce final artifacts:
   - Update knowledge-base documents with confirmed information
   - Mark remaining unknowns explicitly
   - Generate architecture graphs via `graph-engine`
   - Write discovery report with confidence assessment

## Rules

- Begin with automated analysis — ask questions only for genuine ambiguity
- Every claim must cite evidence from the repository
- Do not fabricate details — mark uncertainty clearly
- Present findings before asking clarifications (show work first)
- This workflow does not modify product code

This workflow does not modify product code. It writes only intelligence artifacts.
