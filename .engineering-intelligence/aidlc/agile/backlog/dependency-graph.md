# Backlog Dependency Graph

## Feature Dependencies

| Feature | Depends On | Parallel-Safe With | Notes |
|---|---|---|---|
| FEAT-001 | none | FEAT-002, FEAT-003, FEAT-004, FEAT-007, FEAT-008 | No overlapping files with FEAT-002/003 at design; share `withArgumentHint` helper pattern |
| FEAT-002 | FEAT-001 (shared helper pattern) | FEAT-003 | Both FEAT-002 and FEAT-003 can start in parallel once FEAT-001 is done |
| FEAT-003 | FEAT-001 (shared helper pattern) | FEAT-002 | Same as FEAT-002 |
| FEAT-004 | none | FEAT-001, FEAT-002, FEAT-003, FEAT-007, FEAT-008 | Isolated to visualizer |
| FEAT-005 | FEAT-004 (shares parser) | FEAT-007 | CLI uses backlog parser from FEAT-004 |
| FEAT-006 | FEAT-005 | FEAT-007, FEAT-008 | Builds on backlog list infrastructure |
| FEAT-007 | none | FEAT-001, FEAT-002, FEAT-003, FEAT-004 | Isolated to test harness |
| FEAT-008 | FEAT-007 | FEAT-009 | Validation logic sits in src/templates.ts |
| FEAT-009 | FEAT-008 | none | Terminal in EPIC-003 |

## Ticket Dependencies

| Ticket | Depends On | Parallel-Safe | Files Owned |
|---|---|---|---|
| TKT-001 | none | TKT-004, TKT-007, TKT-010, TKT-013, TKT-019, TKT-021, TKT-023 | none (research) |
| TKT-002 | TKT-001 | TKT-005, TKT-008 | src/adapters/index.ts |
| TKT-003 | TKT-002 | TKT-006, TKT-009 | test/adapters.test.mjs |
| TKT-004 | none | TKT-001, TKT-007 | none (research) |
| TKT-005 | TKT-004 | TKT-002, TKT-008 | src/adapters/index.ts |
| TKT-006 | TKT-005 | TKT-003, TKT-009 | test/adapters.test.mjs |
| TKT-007 | none | TKT-001, TKT-004 | none (research) |
| TKT-008 | TKT-007 | TKT-002, TKT-005 | src/adapters/index.ts |
| TKT-009 | TKT-008 | TKT-003, TKT-006 | test/adapters.test.mjs |
| TKT-010 | none | TKT-002, TKT-013, TKT-019, TKT-021 | src/visualizer/index.ts |
| TKT-011 | TKT-010 | — | src/visualizer/index.ts |
| TKT-012 | TKT-011 | TKT-015, TKT-018, TKT-022 | test/visualizer.test.mjs |
| TKT-013 | none | TKT-010, TKT-019, TKT-021 | src/cli/index.ts |
| TKT-014 | TKT-013 | TKT-011 | src/cli/index.ts, src/visualizer/index.ts |
| TKT-015 | TKT-014 | TKT-012, TKT-018, TKT-022 | test/installer.test.mjs |
| TKT-016 | TKT-013 | TKT-014 | src/cli/index.ts |
| TKT-017 | TKT-016 | — | src/cli/index.ts, src/installer/index.ts |
| TKT-018 | TKT-017 | TKT-015, TKT-012 | test/installer.test.mjs |
| TKT-019 | none | TKT-010, TKT-013, TKT-021 | test/e2e.test.mjs |
| TKT-020 | TKT-019 | — | test/e2e.test.mjs |
| TKT-021 | none | TKT-010, TKT-013, TKT-019 | src/templates.ts |
| TKT-022 | TKT-021 | TKT-012, TKT-015, TKT-018 | test/templates.test.mjs |
| TKT-023 | none | TKT-010, TKT-013, TKT-019, TKT-021 | test/snapshots.test.mjs |
| TKT-024 | TKT-023 | — | test/snapshots/ |
| TKT-025 | TKT-024 | — | test/snapshots.test.mjs |

## Topological Execution Order

### Wave 1 (no dependencies — start in parallel)
- TKT-001, TKT-004, TKT-007 (research spikes — fast, parallel-safe)
- TKT-010 (visualizer parser)
- TKT-013 (CLI backlog command parser stub)
- TKT-019 (E2E test harness)
- TKT-021 (frontmatter schema validation)
- TKT-023 (snapshot helper)

### Wave 2 (after their wave-1 prerequisite)
- TKT-002 (after TKT-001), TKT-005 (after TKT-004), TKT-008 (after TKT-007) — parallel
- TKT-011 (after TKT-010)
- TKT-014 (after TKT-013)
- TKT-016 (after TKT-013)
- TKT-020 (after TKT-019)
- TKT-022 (after TKT-021)
- TKT-024 (after TKT-023)

### Wave 3
- TKT-003 (after TKT-002), TKT-006 (after TKT-005), TKT-009 (after TKT-008) — parallel
- TKT-012 (after TKT-011)
- TKT-015 (after TKT-014)
- TKT-017 (after TKT-016)
- TKT-025 (after TKT-024)

### Wave 4
- TKT-018 (after TKT-017)

## Conflict Risk

- `src/adapters/index.ts` is owned by TKT-002, TKT-005, and TKT-008 in sequence (FEAT-001 → FEAT-002 → FEAT-003). These must not run in parallel on the same file.
- `test/adapters.test.mjs` is similarly sequenced via TKT-003, TKT-006, TKT-009.
- `src/cli/index.ts` is owned by TKT-013 and TKT-016 — both in Wave 2 but from different features; schedule sequentially.
