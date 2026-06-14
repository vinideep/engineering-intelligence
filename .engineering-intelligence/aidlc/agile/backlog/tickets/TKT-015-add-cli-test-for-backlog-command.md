# TKT-015: Add CLI test for backlog command

- Feature: FEAT-005
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: TKT-014
- Files Likely Affected: test/installer.test.mjs

## Acceptance Criteria
- Given a temp directory with backlog-index.md, when the backlog command runs via the CLI entry point, then stdout contains the expected IDs and status values. `--json` output parses as valid JSON.

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
/engineering-intelligence Implement TKT-015: add a CLI backlog command test in the installer test file or a new cli.test.mjs, using a temp dir with a seeded backlog-index.md.
```
