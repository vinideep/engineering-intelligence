# FEAT-008: SKILL.md Frontmatter Schema Validation

- Epic: EPIC-003
- Status: proposed
- Approval: pending
- Priority: P2
- Depends On: FEAT-007 (runs after E2E, uses same validation path)

## User Story
As a maintainer adding a new skill, I want `validateCanonicalTemplates()` to
catch a missing `name`, `description`, or `version` key in a SKILL.md file,
so that malformed skills are caught before release.

## Acceptance Criteria
- Given a SKILL.md missing the `version` frontmatter key, when
  `validateCanonicalTemplates()` runs, then it returns an error naming the
  skill and the missing key.
- Given all 44 current skills with valid frontmatter, `validateCanonicalTemplates()`
  returns no errors.
- The templates test asserts both cases.

## Tickets
- TKT-021 — Add frontmatter parser + required-key check to `validateCanonicalTemplates`
- TKT-022 — Add templates test asserting schema validation catches missing keys

## Approval Gate
Implementation of this feature's tickets must not begin until a human records
`Approval: approved` here and in `aidlc/audit.md`.
