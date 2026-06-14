# TKT-023: Implement Snapshot Write/Compare Helper

- Feature: FEAT-009
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: none
- Files Likely Affected: test/snapshots.test.mjs (new)

## Acceptance Criteria
- Given a rendered file content and a snapshot name, when the helper runs and no snapshot exists, it writes the file.
- When the snapshot exists and content matches, the test passes.
- When content differs and UPDATE_SNAPSHOTS is unset, the test fails with a diff printed.
- When UPDATE_SNAPSHOTS=1, the file is updated and the test passes.

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
/engineering-intelligence Implement TKT-023: create test/snapshots.test.mjs with a checkSnapshot(name, content) async function that reads from test/snapshots/<name>.snap; if absent writes it; if present and matching passes; if different and UPDATE_SNAPSHOTS=1 updates; if different without flag calls assert.equal(content, existing) to produce a readable diff failure.
```
