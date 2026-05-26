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
- `.engineering-intelligence/memory/` — decisions, constraints, patterns that apply
- `.engineering-intelligence/context/` — module map, critical paths, dangerous areas near the change
- `.engineering-intelligence/graph/` — dependency and service relationships

**If intelligence is missing or stale**: Run `initialize-intelligence-skill` first.

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
- Graph inputs consulted: <list>
- Directly affected: <files, modules, services>
- Indirectly affected: <downstream consumers, dependent services>
- Risk factors: <breaking changes, data migration, auth impact>

## Validation Requirements
- <test types needed>
- <manual verification needed>

## Intelligence Artifacts Affected
- <knowledge docs, memory entries, context maps, graph nodes>

## Evidence
- <file paths supporting each claim>

## Unknowns
- <areas where impact is uncertain>
```

### 3. Implement the Change

- Edit only the files necessary for the request
- Follow existing coding patterns from `.engineering-intelligence/memory/coding-patterns.md`
- Respect architectural boundaries from `.engineering-intelligence/memory/architecture-decisions.md`
- Consult `dangerous-areas.md` before modifying flagged code

### 4. Add/Update Tests

- Add tests proportional to the change risk level
- For `bugfix`: add a regression test reproducing the original issue
- For `feature`: add unit tests and integration tests for the new behavior
- For `architecture`/`security`: add boundary and negative-path tests
- Run the project's test suite and record actual results

### 5. Validate

- Run linters, type checks, and test suites available in the project
- **Never claim validation passed unless it actually ran and passed**
- Record partial or failed validation honestly

### 6. Incremental Sync

Use `incremental-sync-engine` to update only affected artifacts:
- Knowledge docs reflecting changed behavior
- Memory entries if decisions/patterns changed
- Context maps if module/service topology changed
- Graph nodes/edges if dependencies or services changed
- Event guidance if API/schema/auth contracts changed

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

## Quality Gates

- [ ] Impact report written before any code edit
- [ ] All changed behavior has corresponding test coverage
- [ ] Validation was actually executed (not just claimed)
- [ ] Only affected intelligence artifacts were updated
- [ ] Change record references the correct impact report
- [ ] High-risk changes went through review gate

## Cross-References

- Depends on: `initialize-intelligence-skill` (prerequisite), `change-detection-engine`, `impact-analysis-engine`, `graph-engine`
- Uses during execution: `testing-intelligence-engine`, `incremental-sync-engine`, `change-history-engine`
- Optional: `engineering-change-review` (for high-risk), `refactoring-planner` (for refactors)
