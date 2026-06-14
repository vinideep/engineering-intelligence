# EPIC-003: Test Harness Quality & E2E Coverage

- Status: proposed
- Priority: P1
- Owner: maintainer

## Business Outcome
The test suite covers adapter rendering and installer lifecycle but has no
end-to-end install test that actually writes files to disk and exercises
`doctor` / `update` / `uninstall` against real paths. Template contract
checks are string-match based with no schema validation. This epic adds
an E2E install test, SKILL.md schema validation, and snapshot-based
regression guards for rendered output.

## Success Metrics
- One E2E test installs all adapters into a real temp directory, asserts
  file count, runs `doctor`, and asserts zero errors — all in < 10 s.
- `validateCanonicalTemplates()` checks required SKILL.md frontmatter keys
  (`name`, `description`, `version`) for every skill.
- A rendered-output snapshot test catches accidental changes to
  installed file content across builds.

## Features
- FEAT-007 — E2E install-to-doctor test
- FEAT-008 — SKILL.md frontmatter schema validation
- FEAT-009 — Rendered output snapshot tests

## Definition of Success
- [ ] E2E test runs in CI without network access (uses local pack)
- [ ] Schema validation catches a skill missing `version` frontmatter
- [ ] Snapshot test fails when a template is accidentally changed
