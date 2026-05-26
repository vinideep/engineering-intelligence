# Engineering Intelligence Rules

When `knowledge-base/` exists, consult its relevant documents, `.engineering-intelligence/context/`, and `.engineering-intelligence/graph/` before non-trivial project edits.

For engineering changes:

1. Write an impact report before editing.
2. Modify code and tests appropriate to the request.
3. Validate honestly and report unrun checks.
4. Incrementally update only intelligence and graph artifacts affected by changed behavior.
5. Record completed work in `.changes/`.

Read-only workflows:

- `map-architecture` maps evidence-backed graphs and may update graph-connected context.
- `analyze-impact` writes an impact report for a proposal or diff.
- `sync-engineering-intelligence` synchronizes intelligence for an identified change.
- `review-engineering-change` writes findings without applying fixes.

Only the `engineering-intelligence` implementation workflow is intended to modify product code.

Use `knowledge-base/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, `.engineering-intelligence/events/`, `.engineering-intelligence/graph/`, `.engineering-intelligence/reports/`, and `.changes/` as the canonical project-intelligence paths. Never invent undocumented implementation facts.
