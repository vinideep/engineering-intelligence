---
name: initialize-engineering-intelligence
description: Initializes project engineering intelligence by analyzing repository evidence and generating knowledge, context, memory, event guidance, architecture graphs, and an initialization change record. Use when onboarding a repository or when asked to initialize engineering intelligence.
---

# Initialize Engineering Intelligence

Create a trustworthy project intelligence baseline. Analyze only evidence present in source code, configuration, tests, infrastructure, and existing documentation. Mark unknowns and uncertainties explicitly; never invent architecture, APIs, schemas, or business rules.

## Outputs

Generate:

- `knowledge-base/00-project-overview.md` through `knowledge-base/15-validation-report.md`
- `.engineering-intelligence/memory/` for durable decisions, rules, patterns, constraints, and technology decisions
- `.engineering-intelligence/context/` for module, service, runtime, dependency, critical-path, and dangerous-area maps
- `.engineering-intelligence/events/` for API, schema, auth, feature, and infrastructure change guidance
- `.engineering-intelligence/graph/` for JSON dependency, service, runtime, and business-flow graphs plus a Mermaid architecture map
- `.changes/CHG-000-initialization.md`

## Procedure

1. Discover repositories, packages, runtimes, build systems, entrypoints, CI, deployment, environment examples, databases, APIs, auth, and tests.
2. Trace architecture and critical runtime flows from code evidence.
3. Write the knowledge base with file-backed evidence and clearly labeled unknowns.
4. Validate major documentation claims against the project and write `15-validation-report.md`.
5. Generate compact durable memory and navigation context from validated findings.
6. Use `graph-engine` to generate a full evidence-backed graph baseline and `architecture-map.md`.
7. Generate change-event guidance and initialization history.
8. Report generated artifacts, confidence limits, and areas requiring human confirmation.

This initialization workflow documents and validates the project. It does not implement product changes.
