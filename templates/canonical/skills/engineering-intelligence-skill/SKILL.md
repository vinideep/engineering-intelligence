---
name: engineering-intelligence-skill
description: Executes engineering changes with impact analysis, implementation, tests, validation, and incremental synchronization of project intelligence. Use for feature, bugfix, update, refactor, architecture, infrastructure, or security requests.
version: 3.0.0
---

# Engineering Intelligence Implementation

The core implementation skill for engineering work. Use after project intelligence has been initialized.

## Inputs

- User request describing the desired change
- Repository with initialized intelligence (`knowledge-base/`, `.engineering-intelligence/`)

## Request Classification

Classify the incoming request before starting:

| Type | Description | Risk Level |
|---|---|---|
| `feature` | New user-facing functionality | Medium–High |
| `bugfix` | Correction of incorrect behavior | Low–Medium |
| `update` | Dependency, config, or version updates | Low–Medium |
| `refactor` | Structural improvement without behavior change | Medium |
| `architecture` | Boundary, layer, or pattern changes | High |
| `infrastructure` | CI, deployment, environment changes | Medium–High |
| `security` | Auth, permissions, vulnerability fixes | High |
| `documentation` | Knowledge-only changes (no product code) | Low |

## Procedure

### 1. Pre-Flight: Read Intelligence

Read these artifacts and identify relevant context:
- `knowledge-base/` — architecture, APIs, runtime flow relevant to the change
- `.engineering-intelligence/aidlc/` — active AI-DLC state, plan, audit, open questions, construction units
- `.engineering-intelligence/memory/` — decisions, constraints, patterns that apply
- `.engineering-intelligence/context/` — module map, critical paths, dangerous areas near the change
- `.engineering-intelligence/graph/` — dependency and service relationships

**If intelligence is missing or stale**: Run `initialize-intelligence-skill` first.

#### Pre-Flight Freshness Gate

Before impact analysis or code edits:

1. Resolve the likely changed modules from the request, graph proximity, or `change-detection-engine`.
2. Run `staleness-detector` scoped to those modules and related knowledge/context/memory artifacts.
3. If any freshness score is below `60`, run `incremental-sync-engine` for the stale artifacts before editing product code, or explicitly mark stale context in the impact report with the affected documents and scores.
4. If any score is below `50`, implementation is blocked until incremental sync runs or the user explicitly accepts stale-context risk.
5. Skip stale H2 sections that carry low confidence metadata unless they are refreshed or verified against source.

### 2. Impact Analysis: Write Report

Before any code edit, write `.engineering-intelligence/reports/IMP-XXX-<summary>.md`:

```markdown
# IMP-XXX: <summary>

## Classification
- Type: <feature|bugfix|update|refactor|architecture|infrastructure|security>
- Risk: <low|medium|high|critical>
- Scope: <files and modules affected>

## Analysis
- Mode: <proposal|diff>
- Freshness gate: <passed|synced|stale risk accepted> with scores
- Graph inputs consulted: <list>
- Directly affected: <files, modules, services>
- Indirectly affected: <downstream consumers, dependent services>
- Risk factors: <breaking changes, data migration, auth impact>

## Validation Requirements
- <test types needed>
- Type safety: <required|not applicable>
- API compatibility: <required|not applicable>
- Migration safety: <required|not applicable>
- Acceptance mapping: required
- <manual verification needed>

## Intelligence Artifacts Affected
- <knowledge docs, memory entries, context maps, graph nodes>

## Evidence
- <file paths supporting each claim>

## Unknowns
- <areas where impact is uncertain>
```

### 3. Implement the Change

- Select the adaptive delivery mode inside the existing Engineering Intelligence workflow:
  - Standard Agile delivery for normal feature, bugfix, update, and refactor work
  - Adversarial delivery for auth, payment, public API, secrets, or compliance-sensitive work
  - TDD delivery for high-reliability business rules and service contracts
  - Design-first delivery for migrations, new architecture, and broad system boundaries
  - Hypothesis debugging for unknown-cause defects
- Update Agile artifacts when product behavior is in scope:
  - `.engineering-intelligence/aidlc/agile/product-backlog.md`
  - `.engineering-intelligence/aidlc/agile/sprint-plan.md`
  - `.engineering-intelligence/aidlc/agile/acceptance-criteria.md`
  - `.engineering-intelligence/aidlc/agile/definition-of-ready.md`
  - `.engineering-intelligence/aidlc/agile/definition-of-done.md`
- Update `.engineering-intelligence/aidlc/execution-plan.md` and `.engineering-intelligence/aidlc/aidlc-state.md`
- Split broad changes into construction units and keep `.engineering-intelligence/aidlc/construction/cross-unit-discoveries.md` current
- Edit only the files necessary for the request
- Follow existing coding patterns from `.engineering-intelligence/memory/coding-patterns.md`
- Read conventions from `knowledge-base/16-conventions.md` and `.engineering-intelligence/memory/coding-patterns.md` — match naming patterns, import style, error handling patterns, and code structure
- If conventions document is missing or outdated, run `convention-detector` first
- After generating or modifying each file, compare it against `coding-patterns.md` for naming, import order, error handling, logging, folder structure, test style, and framework idioms. Auto-correct minor violations. Structural convention violations become review findings and block completion when critical.
- Respect architectural boundaries from `.engineering-intelligence/memory/architecture-decisions.md`
- Consult `dangerous-areas.md` before modifying flagged code

#### Strict TDD Red-Green Gate

When TDD delivery mode is selected:

1. Add or update the required tests first.
2. Run the new/targeted tests before implementation code changes.
3. Confirm they fail for the expected reason.
4. Save failing output in `.engineering-intelligence/aidlc/construction/<unit>/build-and-test/build-and-test-summary.md`.
5. Only then implement production code.
6. If this sequence is skipped, mark the construction unit blocked unless the user explicitly approves non-TDD execution.

### 4. Add/Update Tests

- Add tests proportional to the change risk level
- Map each acceptance criterion to at least one automated test, manual verification step, or explicitly recorded unavailable check
- For `bugfix`: add a regression test reproducing the original issue
- For `feature`: add unit tests and integration tests for the new behavior
- For `architecture`/`security`: add boundary and negative-path tests
- Run the project's test suite and record actual results

### 5. Validate

- Run linters, type checks, and test suites available in the project
- Use environmental backpressure: analyze failed diagnostics, fix, and rerun the relevant command until it passes or a blocker is recorded
- Run `type-safety-engine` for typed projects or record why no type system applies
- Run `api-backward-compatibility-engine` when API, event, webhook, SDK, route, or schema contracts changed
- Run `database-migration-safety-engine` when schema, ORM model, migration, index, or data persistence contracts changed
- Write `.engineering-intelligence/aidlc/construction/<unit>/build-and-test/build-and-test-summary.md` for non-trivial units
- **Never claim validation passed unless it actually ran and passed**
- Record partial or failed validation honestly

#### Acceptance Criteria Verification Matrix

Before Definition of Done can pass, map every criterion from `.engineering-intelligence/aidlc/agile/acceptance-criteria.md` to evidence:

```markdown
## Acceptance Criteria Verification Matrix
| Criterion | Evidence Type | Evidence | Result | Open Item |
|---|---|---|---|---|
| Given..., when..., then... | automated test | `test/file.test.ts` / command result | pass | — |
| ... | manual verification | <steps required> | pending | <owner/reason> |
```

Missing mappings block the Done gate and must be copied into the CHG record as open items.

### 6. Incremental Sync

Use `incremental-sync-engine` to update only affected artifacts:
- Knowledge docs reflecting changed behavior
- Memory entries if decisions/patterns changed
- Context maps if module/service topology changed
- Graph nodes/edges if dependencies or services changed
- Event guidance if API/schema/auth contracts changed
- AI-DLC lifecycle artifacts if state, plan, NFRs, ADRs, operations readiness, or unit discoveries changed
- Agile artifacts if backlog, story status, acceptance criteria, Ready/Done gates, or retrospective learning changed

### 7. Record Change

Create `.changes/CHG-XXX-<summary>.md`:

```markdown
# CHG-XXX: <summary>

## Request
<original user request>

## Classification
- Type: <type> | Risk: <level>

## Implementation Summary
<what was changed and why>

## Files Changed
- <path> — <description of change>

## Tests
- <tests added/modified>
- <test results: passed/failed/skipped>

## Acceptance Criteria Verification
<copy the Acceptance Criteria Verification Matrix, including open items>

## Safety Gates
- Freshness gate: <passed|synced|stale risk accepted>
- Type safety: <passed|failed|not applicable>
- API compatibility: <passed|failed|not applicable>
- Migration safety: <passed|failed|not applicable>
- Convention enforcement: <passed|findings>

## Related Reports
- IMP-XXX: <link to impact report>
- REV-XXX: <link to review report, if applicable>

## Synchronized Artifacts
- <list of updated intelligence artifacts>

## Unresolved Risks
- <any remaining concerns>
```

### 8. High-Risk Review Gate

For changes classified as `high` or `critical` risk:
- Run `engineering-change-review` before final reporting
- Address any blocking findings before marking complete

### 9. Report

Summarize to the user:
- Code changes made (files, lines)
- Tests run and results
- Affected systems and services
- Synchronized intelligence artifacts
- Unresolved risks or follow-ups
- Final AI-DLC breadcrumb: `AI-DLC: <phase> -> <stage> -> <status>`

## Quality Gates

- [ ] Impact report written before any code edit
- [ ] Pre-Flight Freshness Gate passed, synced stale artifacts, or stale risk was explicit in the impact report
- [ ] All changed behavior has corresponding test coverage
- [ ] Validation was actually executed (not just claimed)
- [ ] Only affected intelligence artifacts were updated
- [ ] AI-DLC state, execution plan, and unit artifacts are current for non-trivial work
- [ ] Story meets Definition of Ready before implementation starts
- [ ] Story meets Definition of Done before final report
- [ ] Acceptance criteria are mapped to validation evidence
- [ ] Acceptance Criteria Verification Matrix has no unmapped criteria unless recorded as open items
- [ ] Type safety, API compatibility, and migration safety gates ran when applicable
- [ ] Environmental backpressure was used for validation failures
- [ ] Change record references the correct impact report
- [ ] High-risk changes went through review gate
- [ ] Generated code follows detected project conventions (naming, imports, structure)

## Cross-References

- Depends on: `initialize-intelligence-skill` (prerequisite), `change-detection-engine`, `impact-analysis-engine`, `graph-engine`, `staleness-detector`
- Uses during execution: `testing-intelligence-engine`, `type-safety-engine`, `api-backward-compatibility-engine`, `database-migration-safety-engine`, `incremental-sync-engine`, `change-history-engine`
- Optional: `engineering-change-review` (for high-risk), `refactoring-planner` (for refactors), `convention-detector` (for convention compliance)
