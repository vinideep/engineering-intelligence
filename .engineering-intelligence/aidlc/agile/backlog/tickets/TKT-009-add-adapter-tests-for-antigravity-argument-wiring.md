# TKT-009: Add adapter tests for Antigravity argument wiring

- Feature: FEAT-003
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: TKT-008
- Files Likely Affected: test/adapters.test.mjs

## Acceptance Criteria
- Given renderAdapters(["antigravity","antigravity-cli"]), when inspecting workflow files, then input-driven ones contain the placeholder and non-input ones do not.

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
/engineering-intelligence Implement TKT-009: add an Antigravity argument wiring test block in test/adapters.test.mjs for both antigravity and antigravity-cli.
```
