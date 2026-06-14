# TKT-011: Render backlog panel HTML in dashboard template

- Feature: FEAT-004
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: TKT-010
- Files Likely Affected: src/visualizer/index.ts

## Acceptance Criteria
- Given backlog data from TKT-010, when the dashboard HTML is generated, then it contains a visible "Backlog" panel section with epic/feature/ticket counts and a status breakdown table. Given no backlog, the panel shows "No backlog generated yet."

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
/engineering-intelligence Implement TKT-011: in src/visualizer/index.ts add a backlog panel HTML block to the dashboard template, conditionally rendering the status table from parsed backlog data or a placeholder if null.
```
