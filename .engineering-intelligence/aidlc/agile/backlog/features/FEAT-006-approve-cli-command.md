# FEAT-006: `approve` CLI Sub-Command

- Epic: EPIC-002
- Status: proposed
- Approval: pending
- Priority: P1
- Depends On: FEAT-005

## User Story
As an engineering lead, I want to run `npx engineering-intelligence approve . FEAT-001`
to mark a feature as approved, so that I can gate delivery from the terminal
without editing markdown files directly.

## Acceptance Criteria
- Given `FEAT-001` exists with `Approval: pending`, when I run
  `engineering-intelligence approve . FEAT-001`, then the feature file is
  updated to `Approval: approved` and an entry is appended to `aidlc/audit.md`.
- Given an unknown feature ID, the CLI prints an error and exits 1.
- Given `Approval: approved` already, the CLI prints "already approved" and
  exits 0 (idempotent).
- `engineering-intelligence approve . FEAT-001 --changes-requested` sets
  `Approval: changes-requested` instead.

## Tickets
- TKT-016 — Add `approve` command to CLI argument parser
- TKT-017 — Implement feature file update and audit log append
- TKT-018 — Add CLI test for `approve` and `--changes-requested`

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
