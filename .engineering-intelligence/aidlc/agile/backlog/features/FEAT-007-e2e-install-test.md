# FEAT-007: E2E Install-to-Doctor Test

- Epic: EPIC-003
- Status: proposed
- Approval: pending
- Priority: P1
- Depends On: none

## User Story
As a maintainer, I want a test that actually installs the toolkit into a real
temporary directory and runs `doctor`, so that I catch regressions that only
appear when files are physically written — not just in-memory rendered.

## Acceptance Criteria
- Given the compiled package, when the E2E test runs, it creates a temp
  directory, installs all adapters, asserts the expected file count and key
  paths exist on disk, runs `doctor`, and asserts zero errors — all in < 10 s.
- The test cleans up the temp directory after itself.
- The test runs in CI without network access (uses the local `dist/` directly,
  not `npx`).

## Tickets
- TKT-019 — Write `test/e2e.test.mjs` with real-disk install + doctor assertion
- TKT-020 — Add cleanup and CI timeout guard

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
