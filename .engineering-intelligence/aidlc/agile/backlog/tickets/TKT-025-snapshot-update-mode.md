# TKT-025: Add UPDATE_SNAPSHOTS Env-Var Update Mode and CI Guard

- Feature: FEAT-009
- Status: todo
- Type: chore
- Estimate: S
- Risk: low
- Depends On: TKT-024
- Files Likely Affected: test/snapshots.test.mjs

## Acceptance Criteria
- Given CI (UPDATE_SNAPSHOTS not set), when a snapshot differs, the test fails with a readable diff.
- Given UPDATE_SNAPSHOTS=1, the test updates the file and passes.
- CI fails loudly if snapshots are stale — no silent pass.

## Definition of Ready
- [ ] Dependencies are done
- [ ] Acceptance criteria are testable
- [ ] Affected files identified from graph intelligence

## Definition of Done
- [ ] Code implemented and tests added proportional to risk
- [ ] Safety gates run or explicitly not applicable
- [ ] Intelligence synchronized and change record written

## Implementation Command
```text
/engineering-intelligence Implement TKT-025: verify the checkSnapshot helper from TKT-023 already handles the CI guard correctly (fails without UPDATE_SNAPSHOTS, updates with it); add a comment in snapshots.test.mjs explaining the update workflow; add a note to package.json scripts: "test:update": "UPDATE_SNAPSHOTS=1 npm test".
```
