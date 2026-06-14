# TKT-002: Implement cursorCommandsAt renderer with argument wiring

- Feature: FEAT-001
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: TKT-001
- Files Likely Affected: src/adapters/index.ts

## Acceptance Criteria
- Given the Cursor adapter case in `renderAdapter`, when rendered, then `.cursor/commands/engineering-intelligence.md` contains the Cursor argument placeholder for input-driven workflows and `map-architecture.md` does not.

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
/engineering-intelligence Implement TKT-002: in src/adapters/index.ts add a `cursorCommandsAt` function mirroring `claudeCommandsAt` but using Cursor's native placeholder (determined by TKT-001 research), wire it into the `cursor` case replacing `workflowsAt`, and add argument-hint frontmatter injection matching `withArgumentHint`.
```
