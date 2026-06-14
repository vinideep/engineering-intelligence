# TKT-003: Add adapter test for Cursor argument wiring

- Feature: FEAT-001
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: TKT-002
- Files Likely Affected: test/adapters.test.mjs

## Acceptance Criteria
- Given renderAdapters(["cursor"]), when I inspect `.cursor/commands/engineering-intelligence.md`, then it contains the argument placeholder; `map-architecture.md` does not.

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
/engineering-intelligence Implement TKT-003: add a test block in test/adapters.test.mjs for Cursor argument wiring asserting input workflows have the placeholder and non-input ones do not, mirroring the existing Claude Code argument test.
```
