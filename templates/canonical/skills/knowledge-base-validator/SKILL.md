---
name: knowledge-base-validator
description: Validates project knowledge documentation against source and configuration evidence, identifying stale, unsupported, or uncertain claims. Use after initialization or documentation synchronization.
version: 3.0.0
---

# Knowledge Base Validator

Systematically audit every significant claim in `knowledge-base/*.md` against actual repository evidence. Produce a structured validation report that identifies exactly what is supported, what is stale, and what needs human review.

## Inputs

- Repository root path with `knowledge-base/` present
- Optional: specific documents to validate (defaults to all)

## Procedure

1. **Enumerate Claims** — Read each `knowledge-base/*.md` document. Extract every material claim about architecture, APIs, schemas, dependencies, configurations, flows, and behavior.

2. **Verify Against Evidence** — For each claim, check:
   - Does the referenced file/path still exist?
   - Does the code at that location still support the claim?
   - Has the relevant code changed since the claim was written?
   - Are there new files/patterns that contradict the claim?

3. **Categorize Findings** — Assign each finding a status:

| Status | Symbol | Meaning |
|---|---|---|
| Supported | ✅ | Claim verified against current code |
| Partially Supported | ⚠️ | Claim is partly true but missing nuance or outdated in some aspect |
| Unsupported | ❌ | Claim contradicted by current code or evidence is missing |
| Unclear | ❓ | Cannot determine accuracy — needs human review |
| Stale | 🔄 | Claim references code that has changed significantly |

4. **Assess Confidence** — For each document, calculate:
   - Total claims examined
   - Distribution across statuses
   - Overall document confidence: High (>90% ✅), Medium (70-90% ✅), Low (<70% ✅)

5. **Write Report** — Generate `knowledge-base/15-validation-report.md`

## Output Format

```markdown
# Validation Report

Generated: <ISO timestamp>
Scope: <documents validated>

## Summary

| Document | Claims | ✅ | ⚠️ | ❌ | ❓ | Confidence |
|---|---|---|---|---|---|---|
| 00-project-overview.md | 12 | 10 | 1 | 0 | 1 | High |
| ... | ... | ... | ... | ... | ... | ... |

## Detailed Findings

### 00-project-overview.md

#### ✅ Supported
- "Uses Express.js 4.18" (evidence: package.json:L15)

#### ⚠️ Partially Supported
- "PostgreSQL is the primary database" — true, but Redis is also used for caching (evidence: docker-compose.yml:L22)

#### ❌ Unsupported
- "Uses Passport.js for auth" — no Passport dependency found; appears to use custom JWT middleware (evidence: package.json, src/middleware/auth.ts)

#### ❓ Needs Human Review
- "Supports multi-tenancy" — tenant isolation code exists but completeness is unclear

## Stale Documentation Risks

- <areas where code has diverged from docs>

## Recommended Actions

- <specific documents needing update>
- <claims needing human confirmation>
```

## Rules

- Do NOT silently rewrite knowledge documents during validation
- Update knowledge documents only as part of an explicit synchronization workflow
- Report honestly — a low-confidence score is valuable information
- Flag areas where you lack sufficient context to validate

## Quality Gates

- [ ] Every knowledge document (00-14) is covered in the report
- [ ] Each finding has an evidence path or explicit "no evidence found"
- [ ] Summary table has accurate counts
- [ ] Stale documentation risks are identified
- [ ] Recommended actions are actionable

## Cross-References

- Used by: `initialize-intelligence-skill`, `incremental-sync-engine`
- Depends on: `deep-project-knowledge-extractor` (produces the docs to validate)
