# FEAT-004: Dashboard Backlog Panel

- Epic: EPIC-002
- Status: proposed
- Approval: pending
- Priority: P1
- Depends On: none

## User Story
As an engineering lead, I want the `visualize` dashboard to show a live
backlog status panel, so that I can see how many epics, features, and tickets
exist and what their approval and delivery state is without opening individual
files.

## Acceptance Criteria
- Given a project with `backlog-index.md` present, when I run `visualize`,
  then the dashboard HTML contains a backlog panel with epic/feature/ticket
  counts and a status breakdown (proposed, approved, in-progress, done).
- Given a project without `backlog-index.md`, when I run `visualize`,
  then the dashboard renders without error and shows a "No backlog" placeholder.
- The visualizer test asserts both cases.

## Tickets
- TKT-010 — Parse `backlog-index.md` in `generateDashboardHTML`
- TKT-011 — Render backlog panel HTML in dashboard template
- TKT-012 — Add visualizer test for backlog panel with and without index

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
