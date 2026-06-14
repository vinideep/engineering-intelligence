# EPIC-002: Backlog CLI Surface & Dashboard Integration

- Status: proposed
- Priority: P1
- Owner: maintainer

## Business Outcome
The newly added `decompose-backlog` / `deliver-backlog` workflows generate
backlog artifacts that are invisible to the CLI lifecycle commands (`doctor`,
`visualize`). This epic adds CLI-level awareness: the visualizer dashboard
renders backlog status, and new lifecycle sub-commands let users list the
backlog and approve features without opening markdown files.

## Success Metrics
- `visualize` HTML dashboard includes a backlog panel showing epic/feature/ticket
  counts and status rollup read from `backlog-index.md`.
- `npx engineering-intelligence backlog .` lists all epics, features, and tickets
  with status and pending approvals.
- `npx engineering-intelligence approve . FEAT-001` sets `Approval: approved` in
  the feature file and appends to `audit.md`.
- `doctor` reports a warning when `backlog-index.md` is missing but feature files
  exist (drift detection).

## Features
- FEAT-004 — Dashboard backlog panel
- FEAT-005 — `backlog` CLI sub-command (list)
- FEAT-006 — `approve` CLI sub-command

## Definition of Success
- [ ] Dashboard panel renders real backlog data from installed project
- [ ] `backlog` and `approve` CLI commands work end-to-end with test coverage
- [ ] `doctor` detects backlog drift
