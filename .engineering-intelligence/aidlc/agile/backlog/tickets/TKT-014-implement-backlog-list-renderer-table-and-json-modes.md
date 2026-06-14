# TKT-014: Implement backlog list renderer (table + JSON modes)

- Feature: FEAT-005
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: TKT-013
- Files Likely Affected: src/cli/index.ts, src/visualizer/index.ts

## Acceptance Criteria
- Given a valid backlog-index.md, when `engineering-intelligence backlog .` runs, then each epic/feature/ticket is printed as `<ID>  <Type>  <Status>  <Approval>  <Title>` aligned in columns. `--json` prints a JSON array. No backlog prints "No backlog found" and exits 0.

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
/engineering-intelligence Implement TKT-014: extract the backlog-index parser from TKT-010 into a shared utility in src/visualizer/index.ts, call it from the CLI backlog command, and render both table and JSON output modes.
```
