---
name: knowledge-base-validator
description: Validates project knowledge documentation against source and configuration evidence, identifying stale, unsupported, or uncertain claims. Use after initialization or documentation synchronization.
version: 4.0.0
---

# Knowledge Base Validator

Systematically audit every significant claim in `.engineering-intelligence/knowledge-base/*.md` against actual repository evidence. Produce a structured validation report that identifies exactly what is supported, what is stale, and what needs human review.

**Run the deterministic claim check first:** `npx engineering-intelligence claims verify --json`. Derived claims are re-computed from source, so `verified` means the statement itself still holds and `refuted` means it no longer does. Asserted claims are free text: their evidence is hash-checked (`stale` / `missing`), but the sentence is never machine-checked, so they report `unverified` and must not be treated as confirmed. Work the refuted/stale/missing list first, then audit the `unverified` assertions by hand — those are exactly the statements nothing else can vouch for.

Apply the authority hierarchy during every audit: current source is ground truth; EI artifacts are canonical knowledge; Graphify and CCE are supporting evidence only. Provider agreement can corroborate a source-backed relationship, but provider-only/unverifiable or contested output cannot promote prose to Supported. Record provider version, health, freshness, fallback, and any scope rejection in the validation report.

## Inputs

- Repository root path with `.engineering-intelligence/knowledge-base/` present
- Optional: specific documents to validate (defaults to all)

## Procedure

1. **Enumerate Claims** — Read each `.engineering-intelligence/knowledge-base/*.md` document. Extract every material claim about architecture, APIs, schemas, dependencies, configurations, flows, and behavior.

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

5. **Cross-Document Consistency Check** — Extract key claims from all knowledge documents and compare claims across documents for contradictions, such as different framework versions, conflicting ownership, incompatible API signatures, or mismatched data model descriptions.

6. **Auto-Heal Unsupported Claims** — During explicit synchronization workflows only, re-extract the smallest affected section for unsupported or stale claims, update that section with fresh evidence citations, and record the heal. Escalate claims requiring product judgment instead of guessing.

7. **Write Report** — Generate `.engineering-intelligence/knowledge-base/15-validation-report.md`

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

## Cross-Document Contradictions

| Claim A | Document A | Claim B | Document B | Suggested Canonical Resolution |
|---|---|---|---|---|

## Auto-Heal Actions

| Document | Section | Action | Evidence | Result |
|---|---|---|---|---|

## Recommended Actions

- <specific documents needing update>
- <claims needing human confirmation>
```

## Rules

- Do NOT silently rewrite knowledge documents during read-only validation
- Auto-heal unsupported claims only as part of an explicit synchronization workflow and record every edit
- Report honestly — a low-confidence score is valuable information
- Flag areas where you lack sufficient context to validate

## Quality Gates

- [ ] Every knowledge document (00-14) is covered in the report
- [ ] Each finding has an evidence path or explicit "no evidence found"
- [ ] Summary table has accurate counts
- [ ] Stale documentation risks are identified
- [ ] Cross-document contradictions are listed or explicitly absent
- [ ] Auto-heal actions are recorded when synchronization mode is active
- [ ] Recommended actions are actionable
- [ ] No provider-only, stale, contested, or out-of-scope evidence is categorized as Supported
- [ ] Strict claims, citation freshness, and cross-document consistency gates pass before publication

## Cross-References

- Used by: `initialize-intelligence-skill`, `incremental-sync-engine`
- Depends on: `deep-project-knowledge-extractor` (produces the docs to validate)
