# TKT-017: Implement feature file update and audit log append

- Feature: FEAT-006
- Status: todo
- Type: feature
- Estimate: M
- Risk: medium
- Depends On: TKT-016
- Files Likely Affected: src/cli/index.ts, src/installer/index.ts

## Acceptance Criteria
- Given FEAT-001 with `Approval: pending`, when `approve . FEAT-001` runs, then the feature file's `Approval:` line is updated to `approved`, an ISO-timestamped entry is appended to `.engineering-intelligence/aidlc/audit.md`, and the CLI exits 0. Idempotent on re-run. `--changes-requested` sets `Approval: changes-requested`. Unknown ID exits 1.

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
/engineering-intelligence Implement TKT-017: in src/cli/index.ts implement the approve handler: read the feature file from backlog/features/, replace the Approval line, write it back, append to audit.md using writeFile/appendFile.
```
