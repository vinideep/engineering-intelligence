---
name: refactoring-planner
description: Plans safe refactors by identifying dependencies, migration steps, validation needs, compatibility risk, and rollback strategy. Use before non-trivial refactors.
version: 3.0.0
---

# Refactoring Planner

Plan safe, incremental refactoring with clear migration steps, validation checkpoints, and rollback strategies.

## Inputs

- Refactoring goal (described by user or identified by architecture review)
- `.engineering-intelligence/graph/` (dependency relationships)
- `knowledge-base/12-technical-debt.md` (existing debt)
- `.engineering-intelligence/memory/architecture-decisions.md` (constraints)

## Refactoring Categories

| Category | Examples | Risk Level |
|---|---|---|
| **Extract** | Extract module, service, function, interface | Medium |
| **Rename** | Rename module, restructure directories | Low–Medium |
| **Consolidate** | Merge duplicate logic, unify patterns | Medium |
| **Decouple** | Break circular deps, introduce interfaces | Medium–High |
| **Migrate** | Change framework, database, language version | High |
| **Restructure** | Redefine boundaries, change architecture pattern | High–Critical |

## Risk Scoring

| Factor | Low (1) | Medium (2) | High (3) | Critical (4) |
|---|---|---|---|---|
| **Scope** | 1–3 files | 4–10 files | 10–25 files | 25+ files |
| **Dependents** | 0–2 consumers | 3–5 consumers | 6–10 consumers | 10+ consumers |
| **Test coverage** | Well-tested | Partial | Sparse | None |
| **Data impact** | None | Read-only paths | Write paths | Schema changes |
| **Rollback** | Git revert | Multi-step | Complex | Irreversible |

**Overall Risk** = max(all factors). If any factor is Critical, the refactor is Critical.

## Procedure

1. **Analyze Current State** — Using graphs and knowledge base:
   - Map the exact scope of the refactor
   - Identify all dependents of the code to be changed
   - Note test coverage for affected areas
   - Check for related technical debt

2. **Design Target State** — Define:
   - What the code should look like after refactoring
   - New module/file structure (if changing boundaries)
   - New interfaces or abstractions (if decoupling)
   - Migration strategy for data (if applicable)

3. **Plan Migration Steps** — Break into incremental, independently-deployable steps:
   ```markdown
   ### Step 1: <name>
   - Changes: <what to modify>
   - Validation: <how to verify this step>
   - Rollback: <how to revert just this step>
   - Dependencies: <what must be done first>
   ```

4. **Identify Validation Needs** — For each step:
   - Existing tests that must pass
   - New tests to add before refactoring
   - Integration tests to verify behavior preservation
   - Performance benchmarks (if applicable)

5. **Define Rollback Strategy** — For the overall refactor:
   - Can it be reverted with `git revert`?
   - Are there data migrations that need reverse migrations?
   - What's the point of no return?

6. **Write Plan** — Generate `knowledge-base/18-refactor-plan.md`

## Output Format

```markdown
# Refactoring Plan: <title>

## Motivation
<Why this refactor is needed — link to technical debt or architecture review>

## Current State
<What exists now, with file paths>

## Target State
<What should exist after, with proposed structure>

## Risk Assessment
| Factor | Rating | Justification |
|---|---|---|
| Scope | Medium | 8 files affected |
| Dependents | High | 7 modules import the target |

Overall Risk: **High**

## Migration Steps

### Step 1: Add new interface
- Files: src/interfaces/auth.ts (new)
- Validation: Type check passes
- Rollback: Delete the file

### Step 2: Implement adapter
- Files: src/auth/adapter.ts (new)
- Validation: Unit tests pass
- Rollback: Delete the file, revert imports

### Step 3: Migrate consumers (batch 1)
- Files: src/routes/users.ts, src/routes/admin.ts
- Validation: Integration tests pass
- Rollback: Revert consumer changes

## Validation Plan
- [ ] All existing tests pass after each step
- [ ] New tests added before behavior-preserving changes
- [ ] Integration suite green after full migration

## Rollback Strategy
- Steps 1-3 are independently revertible via git
- No data migrations required
- Point of no return: None — fully reversible

## Timeline Estimate
- Step 1: ~30 minutes
- Step 2: ~1 hour
- Step 3: ~2 hours
```

## Rules

- Never plan a refactor as a single big-bang change — break into steps
- Each step must be independently verifiable
- Add tests BEFORE making behavior-preserving changes
- Consider backward compatibility during migration
- This planning skill does not implement the refactor — it plans it

## Quality Gates

- [ ] All dependents are identified (not just direct consumers)
- [ ] Each step has a validation and rollback strategy
- [ ] Risk is scored with justification
- [ ] Migration steps are ordered by dependency

## Cross-References

- Depends on: `graph-engine` (dependency data), `architecture-review-engine` (findings)
- Used by: `engineering-intelligence-skill` (for refactor-type requests)
- Triggers: `impact-analysis-engine` (when the refactor is implemented)
