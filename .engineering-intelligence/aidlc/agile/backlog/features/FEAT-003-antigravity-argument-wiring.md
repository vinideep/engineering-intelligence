# FEAT-003: Antigravity / Antigravity-CLI Argument Wiring

- Epic: EPIC-001
- Status: proposed
- Approval: pending
- Priority: P1
- Depends On: FEAT-001 (shares the pattern)

## User Story
As a developer using Antigravity or Antigravity-CLI, I want workflow invocations
to receive my supplied request text, so that large initiative workflows pick up
my input without being silently dropped.

## Acceptance Criteria
- Given an `antigravity` adapter render, when I inspect
  `.agent/workflows/engineering-intelligence.md`, then it contains Antigravity's
  native argument placeholder.
- Same for `antigravity-cli` under `.agents/workflows/`.
- Non-input workflows stay verbatim.

## Tickets
- TKT-007 — Research Antigravity workflow argument placeholder syntax
- TKT-008 — Implement argument wiring in `antigravity` and `antigravity-cli` renderers
- TKT-009 — Add adapter tests for Antigravity argument wiring

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
