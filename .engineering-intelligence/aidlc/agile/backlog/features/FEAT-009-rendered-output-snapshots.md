# FEAT-009: Rendered Output Snapshot Tests

- Epic: EPIC-003
- Status: proposed
- Approval: pending
- Priority: P2
- Depends On: FEAT-008

## User Story
As a maintainer, I want snapshot tests that catch accidental changes to what
the installer writes to disk, so that a template edit that inadvertently
changes a command's behaviour is detected immediately in CI.

## Acceptance Criteria
- Given a snapshot directory under `test/snapshots/`, when the snapshot test
  runs and no templates have changed, it passes without updating any files.
- Given a template that changed, the test fails and prints a diff of the changed
  rendered file.
- Running with `UPDATE_SNAPSHOTS=1 npm test` regenerates snapshots.
- Snapshots cover at minimum: one command per adapter (the `engineering-intelligence`
  command) and the `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` managed blocks.

## Tickets
- TKT-023 — Implement snapshot write/compare helper in `test/snapshots.test.mjs`
- TKT-024 — Seed initial snapshots for all 9 adapters' primary command
- TKT-025 — Add `UPDATE_SNAPSHOTS` env-var update mode and CI guard

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
