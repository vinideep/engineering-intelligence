# TKT-006: Add adapter test for Copilot argument wiring

- Feature: FEAT-002
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: TKT-005
- Files Likely Affected: test/adapters.test.mjs

## Acceptance Criteria
- Given renderAdapters(["github-copilot"]), when inspecting prompt files, then input-driven ones contain the placeholder and non-input ones do not.

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
/engineering-intelligence Implement TKT-006: add a Copilot argument wiring test block in test/adapters.test.mjs.
```
