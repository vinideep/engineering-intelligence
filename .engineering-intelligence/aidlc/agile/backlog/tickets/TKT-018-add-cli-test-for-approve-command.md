# TKT-018: Add CLI test for approve command

- Feature: FEAT-006
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: TKT-017
- Files Likely Affected: test/installer.test.mjs

## Acceptance Criteria
- Given a temp dir with a seeded FEAT-001 file with `Approval: pending`, when `approve . FEAT-001` runs, then the file contains `Approval: approved` and audit.md has a new line. Idempotency and --changes-requested are also tested.

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
/engineering-intelligence Implement TKT-018: add approve command tests in test/installer.test.mjs or cli.test.mjs using temp dirs.
```
