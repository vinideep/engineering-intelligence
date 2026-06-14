# TKT-016: Add `approve` command to CLI argument parser

- Feature: FEAT-006
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: TKT-013
- Files Likely Affected: src/cli/index.ts

## Acceptance Criteria
- Given `engineering-intelligence approve . FEAT-001`, when parsed, then `command` is `"approve"`, `root` is `"."`, and `featureId` is `"FEAT-001"`. Given `--changes-requested`, `options.changesRequested` is true.

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
/engineering-intelligence Implement TKT-016: add "approve" to the Command type in src/cli/index.ts, parse the feature ID positional argument and --changes-requested flag, and add the dispatch stub.
```
