# FEAT-002: GitHub Copilot Argument Wiring

- Epic: EPIC-001
- Status: proposed
- Approval: pending
- Priority: P0
- Depends On: FEAT-001 (shares the `withArgumentHint` helper pattern)

## User Story
As a developer using GitHub Copilot, I want prompt files for request-driven
workflows to include my supplied text, so that I can use the workflow through
Copilot's prompt picker without losing my request.

## Acceptance Criteria
- Given a `github-copilot` adapter render, when I inspect
  `.github/prompts/engineering-intelligence.prompt.md`, then it contains
  the Copilot-native argument placeholder.
- Non-input prompt files (`map-architecture`, `initialize-engineering-intelligence`)
  do not contain a placeholder.

## Tickets
- TKT-004 — Research Copilot prompt file argument syntax
- TKT-005 — Implement argument injection in `github-copilot` prompt renderer
- TKT-006 — Add adapter test for Copilot argument wiring

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
