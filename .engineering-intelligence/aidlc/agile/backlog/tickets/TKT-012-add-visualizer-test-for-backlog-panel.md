# TKT-012: Add visualizer test for backlog panel

- Feature: FEAT-004
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: TKT-011
- Files Likely Affected: test/visualizer.test.mjs

## Acceptance Criteria
- Given generateDashboardHTML with a mock root containing backlog-index.md, then the HTML contains backlog panel content. Given no backlog-index.md, the HTML contains "No backlog" placeholder without error.

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
/engineering-intelligence Implement TKT-012: in test/visualizer.test.mjs add test cases for the backlog panel with and without backlog-index.md present.
```
