# TKT-005: Implement argument injection in github-copilot prompt renderer

- Feature: FEAT-002
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: TKT-004
- Files Likely Affected: src/adapters/index.ts

## Acceptance Criteria
- Given the `github-copilot` case, when rendered, then `.github/prompts/engineering-intelligence.prompt.md` contains the Copilot-native argument placeholder; `map-architecture.prompt.md` does not.

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
/engineering-intelligence Implement TKT-005: in src/adapters/index.ts update the github-copilot promptFiles generation to inject INPUT_WORKFLOWS argument placeholder using the syntax confirmed by TKT-004, paralleling the claudeCommandsAt pattern.
```
