# TKT-008: Implement argument wiring in antigravity and antigravity-cli renderers

- Feature: FEAT-003
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: TKT-007
- Files Likely Affected: src/adapters/index.ts

## Acceptance Criteria
- Given `antigravity` and `antigravity-cli` adapter renders, when inspecting the `engineering-intelligence.md` workflow file, then it contains the Antigravity-native argument placeholder for input-driven workflows; `map-architecture.md` does not.

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
/engineering-intelligence Implement TKT-008: in src/adapters/index.ts update the antigravity and antigravity-cli cases to inject argument placeholders into INPUT_WORKFLOWS using a dedicated `antigravityWorkflowsAt` function, paralleling claudeCommandsAt.
```
