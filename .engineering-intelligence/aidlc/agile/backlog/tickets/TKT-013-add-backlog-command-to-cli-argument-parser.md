# TKT-013: Add `backlog` command to CLI argument parser

- Feature: FEAT-005
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: none
- Files Likely Affected: src/cli/index.ts

## Acceptance Criteria
- Given `engineering-intelligence backlog .`, when the CLI parses arguments, then `command` is `"backlog"` and `root` is `"."`. Given `--json` flag, `options.json` is true.

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
/engineering-intelligence Implement TKT-013: in src/cli/index.ts add "backlog" to the Command type, parse `--json` flag, and add the backlog dispatch branch that reads backlog-index.md and prints a formatted table.
```
