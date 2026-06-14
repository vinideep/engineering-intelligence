# TKT-010: Parse backlog-index.md in generateDashboardHTML

- Feature: FEAT-004
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: none
- Files Likely Affected: src/visualizer/index.ts

## Acceptance Criteria
- Given a `backlog-index.md` at `.engineering-intelligence/aidlc/agile/backlog/backlog-index.md`, when `generateDashboardHTML` reads workspace files, then the parsed epic/feature/ticket counts and status breakdown are available in the template data. Given the file is absent, the data is `null` (no error).

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
/engineering-intelligence Implement TKT-010: in src/visualizer/index.ts add a `readBacklogIndex` function that reads and parses the status rollup table from backlog-index.md into a structured object; call it inside `generateDashboardHTML` alongside the existing workspace file reads.
```
