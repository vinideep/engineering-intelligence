# Product Backlog

High-level epic registry. Detailed hierarchical decomposition lives under
`.engineering-intelligence/aidlc/agile/backlog/` (see `backlog-index.md`).

| Epic | Title | Priority | Status | Features |
|---|---|---|---|---|
| EPIC-001 | IDE Adapter Argument Parity | P0 | proposed | FEAT-001, FEAT-002, FEAT-003 |
| EPIC-002 | Backlog CLI Surface & Dashboard Integration | P1 | proposed | FEAT-004, FEAT-005, FEAT-006 |
| EPIC-003 | Test Harness Quality & E2E Coverage | P1 | proposed | FEAT-007, FEAT-008, FEAT-009 |

## Priority Rationale
- **P0 (EPIC-001)**: User-supplied arguments being silently dropped is a broken contract
  in 4 of 9 adapters. Any developer testing `/engineering-intelligence Add X` in Cursor or
  Copilot gets no value from X. Fix this first.
- **P1 (EPIC-002)**: The new backlog capability has no CLI surface — can't list or approve
  without opening files. Dashboard unaware of backlog.
- **P1 (EPIC-003)**: No E2E test means install regressions are invisible until a user
  reports them. Schema validation + snapshots prevent silent template drift.
