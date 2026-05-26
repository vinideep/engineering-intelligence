---
name: knowledge-sync-engine
description: Incrementally synchronizes the project knowledge base after code changes, updating only documents affected by verified behavior changes. Use after implementation or architectural decisions.
version: 3.0.0
---

# Knowledge Synchronization

Update only the knowledge-base documents affected by a verified behavior change. Preserve accurate existing content — never regenerate entire documents.

## Inputs

- Persisted impact report (`.engineering-intelligence/reports/IMP-XXX-*.md`)
- Actual diff or change record showing what changed
- Current `knowledge-base/` documents

## Document-to-Change Mapping

| Change Category | Primary Document | Also Check |
|---|---|---|
| API routes, endpoints, payloads | `04-api-documentation.md` | `03-runtime-flow.md` |
| Database schema, migrations | `05-database.md` | `02-architecture.md` |
| Auth flows, permissions | `06-authentication.md` | `03-runtime-flow.md`, `11-complex-areas.md` |
| Frontend components, routing | `07-frontend.md` | `01-repository-structure.md` |
| Backend services, middleware | `08-backend.md` | `03-runtime-flow.md` |
| CI/CD, deployment, hosting | `09-infrastructure.md` | — |
| Third-party integrations | `10-integrations.md` | `01-repository-structure.md` |
| New complex logic | `11-complex-areas.md` | — |
| Debt introduced or resolved | `12-technical-debt.md` | — |
| Dev workflow changes | `13-onboarding.md` | — |
| New domain terms | `14-glossary.md` | — |
| Architecture changes | `02-architecture.md` | `01-repository-structure.md`, `03-runtime-flow.md` |
| New packages or modules | `01-repository-structure.md` | `02-architecture.md` |
| Project overview changes | `00-project-overview.md` | — |

## Procedure

1. **Read Impact Report** — Identify which knowledge documents are flagged as affected.

2. **Read Affected Documents** — Load only the documents identified in step 1.

3. **Identify Stale Sections** — For each affected document, find the specific sections that reference changed code, APIs, schemas, or behavior.

4. **Update Sections** — For each stale section:
   - Rewrite with current, accurate information
   - Add evidence citations: `(evidence: path/to/file:L42)`
   - Mark uncertain areas: `**Unclear from evidence** — [reason]`
   - Preserve all unaffected content exactly as-is

5. **Verify Consistency** — Check that updated sections don't contradict other sections in the same document or other knowledge documents.

## Evidence Attachment Format

Every changed claim must include an evidence citation:

```markdown
The auth middleware now validates JWT tokens using RS256 algorithm
(evidence: src/middleware/auth.ts:L15-L28)
```

For removed features:
```markdown
~~OAuth2 PKCE flow support~~ — Removed in CHG-015
(evidence: git diff, src/auth/oauth.ts deleted)
```

## Rules

- Update only documents and sections identified by the impact report
- Preserve all accurate existing content unchanged
- Attach evidence for every changed claim
- Never regenerate entire documents during incremental sync
- If unsure whether a claim is stale, flag it rather than silently rewriting

## Quality Gates

- [ ] Only impact-identified documents were modified
- [ ] Changed sections have evidence citations
- [ ] Accurate existing content was preserved
- [ ] No documents were fully regenerated

## Cross-References

- Depends on: `impact-analysis-engine` (identifies affected documents)
- Used by: `incremental-sync-engine`, `engineering-intelligence-skill`
- Related: `knowledge-base-validator` (validates after sync)
