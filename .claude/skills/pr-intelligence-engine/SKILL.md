> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: pr-intelligence-engine
description: Generates intelligent PR descriptions, reviewer suggestions, impact summaries, and split recommendations from change records and git intelligence. Use before submitting or reviewing pull requests.
version: 3.0.0
---

# PR Intelligence Engine

Produce evidence-backed PR artifacts that accelerate review cycles and improve change quality.

## Inputs

- Change records from `.changes/CHG-XXX-*.md`
- Git diff or commit range for the PR
- Ownership mapping from `git-intelligence-engine` (`$EIreports/GIT-intelligence.md`)
- Impact report from `impact-analysis-engine` (when available)
- Architecture decisions from `knowledge-base/`

## Procedure

1. **Analyze Change Scope** — Parse the diff or commit range to determine:
   - Files modified, added, deleted
   - Total lines changed (additions + deletions)
   - Modules touched (distinct top-level directories or packages)
   - Change classification (feature, bugfix, refactor, infrastructure, docs)

2. **Generate PR Description** — From change records and diff, produce:

   ```markdown
   ## What
   <concise summary of what changed and why>

   ## Why
   <link to change record CHG-XXX, issue/ticket if available>

   ## How
   <technical approach summary — key design decisions>

   ## Impact
   <blast radius summary from impact analysis>

   ## Testing
   <tests added/modified, validation performed>

   ## Migration / Rollback
   <if applicable — schema changes, feature flags, rollback steps>
   ```

3. **Suggest Reviewers** — Using ownership mapping from `git-intelligence-engine`:

   | Priority | Criteria |
   |---|---|
   | Required | Primary owner of any modified module |
   | Recommended | Secondary owner with recent activity in modified files |
   | Optional | Contributors to change-coupled files not in the diff |
   | Domain expert | Owner of upstream/downstream modules from impact analysis |

   Flag when no active owner exists for a modified module (orphaned module risk).

4. **Generate Impact Summary** — Produce a reviewer-focused impact digest:
   - Risk level (from impact report or assessed from diff)
   - Breaking changes (API contracts, schema migrations)
   - Cross-service effects (if any)
   - Intelligence artifacts that will need sync after merge

5. **Evaluate PR Size and Suggest Split** — If the PR exceeds thresholds:

   | Metric | Threshold | Action |
   |---|---|---|
   | Total lines changed | >500 | Suggest split |
   | Modules touched | >3 | Suggest split |
   | Mixed concerns | Feature + refactor | Suggest split |
   | Schema + code | Migration + logic | Suggest split |

   When suggesting split, propose concrete split boundaries:
   - Group by module or concern
   - Identify which changes can land independently
   - Suggest merge order if dependencies exist between splits

6. **Check Architecture Compliance** — Compare changes against:
   - `knowledge-base/05-architecture-decisions.md` (ADRs)
   - `knowledge-base/06-conventions-and-standards.md`
   - Module boundary rules from `dependency-graph.json`

   Flag violations with evidence:

   | Violation Type | Example |
   |---|---|
   | Dependency direction | Service A importing from Service B's internals |
   | Convention breach | Naming pattern, file structure deviation |
   | ADR contradiction | Change conflicts with recorded architecture decision |
   | Missing ADR | Architectural change without corresponding decision record |

## Output Format

Generate the following artifacts (do not write to the repository — present to the user):

- **PR description** — Markdown ready to paste into PR body
- **Reviewer suggestions** — Ranked list with rationale
- **Impact summary** — Reviewer-focused digest
- **Split recommendations** — Only if thresholds are exceeded
- **Architecture flags** — Only if violations are detected

## Rules

- PR descriptions must reference change records (CHG-XXX) when available
- Reviewer suggestions must cite ownership evidence, not guess from file paths
- Never suppress architecture violations — always surface them
- Split suggestions must include concrete boundaries, not vague advice
- This capability is analytical only — it must not modify product code

## Quality Gates

- [ ] PR description covers what, why, how, impact, and testing
- [ ] Reviewer suggestions cite ownership data with evidence
- [ ] Impact summary includes risk level and blast radius
- [ ] Split recommendations (if any) propose concrete boundaries
- [ ] Architecture violations cite specific ADRs or conventions breached
- [ ] All claims reference change records, diffs, or intelligence artifacts

## Cross-References

- Depends on: `git-intelligence-engine` (ownership mapping), `impact-analysis-engine` (impact reports), `change-detection-engine` (change records)
- Used by: `engineering-intelligence-skill`
- Consumed by: `engineering-change-review`

This capability is analytical only. It must not modify product code.
