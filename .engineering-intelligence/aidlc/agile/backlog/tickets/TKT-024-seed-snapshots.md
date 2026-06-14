# TKT-024: Seed Initial Snapshots for All 9 Adapters

- Feature: FEAT-009
- Status: todo
- Type: chore
- Estimate: S
- Risk: low
- Depends On: TKT-023
- Files Likely Affected: test/snapshots/ (new directory)

## Acceptance Criteria
- Given `UPDATE_SNAPSHOTS=1 npm test`, when run, snapshot files are written for the `engineering-intelligence` command of each adapter and the managed instruction block (CLAUDE.md, AGENTS.md, GEMINI.md).
- On subsequent `npm test` without the flag, all snapshots pass.

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
/engineering-intelligence Implement TKT-024: in test/snapshots.test.mjs add test cases for each adapter calling renderAdapters([ide]) and passing the engineering-intelligence command content to checkSnapshot("${ide}-engineering-intelligence"), then run UPDATE_SNAPSHOTS=1 npm test to seed the files and commit the test/snapshots/ directory.
```
