# TKT-019: Write E2E install-to-doctor test

- Feature: FEAT-007
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: none
- Files Likely Affected: test/e2e.test.mjs

## Acceptance Criteria
- Given the compiled `dist/` directory, when the E2E test runs, it creates a real temp directory, calls `install(tmpDir, ["claude-code"])`, asserts that `.claude/commands/decompose-backlog.md` exists on disk, calls `doctor(tmpDir)`, and asserts the result contains no errors. Cleans up after itself. Completes in under 10 s.

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
/engineering-intelligence Implement TKT-019: create test/e2e.test.mjs importing install and doctor from dist/, creating a temp dir with os.tmpdir(), running the full install, asserting key file existence with fs.access, running doctor, asserting zero errors, then cleaning up with fs.rm recursive.
```
