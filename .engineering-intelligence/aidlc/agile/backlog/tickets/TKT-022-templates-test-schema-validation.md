# TKT-022: Add Templates Test for Skill Frontmatter Schema Validation

- Feature: FEAT-008
- Status: todo
- Type: feature
- Estimate: S
- Risk: low
- Depends On: TKT-021
- Files Likely Affected: test/templates.test.mjs

## Acceptance Criteria
- Given `validateCanonicalTemplates()` after TKT-021, when run against current templates, it returns no errors for missing frontmatter.
- A test that injects a mock skill with missing `version` confirms the error is returned.

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
/engineering-intelligence Implement TKT-022: in test/templates.test.mjs add a test block that calls validateCanonicalTemplates(), then asserts no errors contain "missing required frontmatter key", confirming all 44 current skills are valid.
```
