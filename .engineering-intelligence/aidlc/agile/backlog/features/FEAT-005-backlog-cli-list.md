# FEAT-005: `backlog` CLI Sub-Command (List)

- Epic: EPIC-002
- Status: proposed
- Approval: pending
- Priority: P1
- Depends On: FEAT-004 (shares backlog-index parsing logic)

## User Story
As an engineering lead, I want to run `npx engineering-intelligence backlog .`
to see all epics, features, and tickets with their statuses, so that I can
review what's planned and what's pending approval without opening markdown files.

## Acceptance Criteria
- Given a project with a valid `backlog-index.md`, when I run
  `engineering-intelligence backlog .`, then the CLI prints a table of
  epic/feature/ticket IDs, titles, statuses, and approval states.
- Given no backlog exists, the CLI prints "No backlog found" and exits 0.
- `engineering-intelligence backlog . --json` prints machine-readable JSON.

## Tickets
- TKT-013 — Add `backlog` command to CLI argument parser
- TKT-014 — Implement backlog list renderer (table + JSON modes)
- TKT-015 — Add CLI test for `backlog` command

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
