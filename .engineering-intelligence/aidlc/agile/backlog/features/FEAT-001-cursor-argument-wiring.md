# FEAT-001: Cursor Argument Wiring

- Epic: EPIC-001
- Status: proposed
- Approval: pending
- Priority: P0
- Depends On: none

## User Story
As a developer using Cursor, I want `/engineering-intelligence Add rate limiting`
to pass my request text into the workflow, so that my instruction is not silently
dropped when I invoke a slash command.

## Acceptance Criteria
- Given a `cursor` adapter render, when I inspect `.cursor/commands/engineering-intelligence.md`,
  then it contains a Cursor-native argument placeholder (e.g. `$ARGUMENTS` or the
  Cursor-supported equivalent), and non-input workflows like `map-architecture` do not.
- Given the adapter renders with `argument-hint` or equivalent, when a developer opens
  the Cursor command palette, then the hint text is visible.

## Tickets
- TKT-001 — Research Cursor's native argument placeholder syntax
- TKT-002 — Implement `cursorCommandsAt` renderer with argument wiring
- TKT-003 — Add adapter test for Cursor argument wiring

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
