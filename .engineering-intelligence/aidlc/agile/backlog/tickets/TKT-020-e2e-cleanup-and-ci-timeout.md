# TKT-020: Add E2E Cleanup and CI Timeout Guard

- Feature: FEAT-007
- Status: todo
- Type: chore
- Estimate: S
- Risk: low
- Depends On: TKT-019
- Files Likely Affected: test/e2e.test.mjs

## Acceptance Criteria
- Given the E2E test, when it runs in CI, then it registers cleanup via `t.after()` even on failure and completes within a 15 s timeout.

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
/engineering-intelligence Implement TKT-020: in test/e2e.test.mjs add t.after() cleanup that calls fs.rm(tmpDir, { recursive: true, force: true }) and add { timeout: 15000 } to the test options object.
```
