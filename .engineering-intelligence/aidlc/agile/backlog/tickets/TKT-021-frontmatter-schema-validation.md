# TKT-021: Add Frontmatter Schema Validation to validateCanonicalTemplates

- Feature: FEAT-008
- Status: todo
- Type: feature
- Estimate: M
- Risk: low
- Depends On: none
- Files Likely Affected: src/templates.ts

## Acceptance Criteria
- Given a SKILL.md missing the `version` frontmatter key, when `validateCanonicalTemplates()` runs, then it returns an error like "skill-name is missing required frontmatter key: version".
- Given all 44 current skills with valid frontmatter, it returns no new errors.

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
/engineering-intelligence Implement TKT-021: in src/templates.ts inside validateCanonicalTemplates, after reading each skill via readTemplate, parse its frontmatter using a local regex (match /^---\n([\s\S]*?)\n---/) and for each required key in ["name","description","version"] push an error "${name} is missing required frontmatter key: ${key}" if absent.
```
