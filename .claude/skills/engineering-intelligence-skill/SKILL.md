> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: engineering-intelligence-skill
description: Executes engineering changes with impact analysis, implementation, tests, validation, and incremental synchronization of project intelligence. Use for feature, bugfix, update, refactor, architecture, infrastructure, or security requests.
---

# Engineering Intelligence Implementation

The core implementation skill for engineering work. Use after project intelligence has been initialized.

## Inputs

- User request describing the desired change
- Repository with initialized intelligence (`knowledge-base/`, `$EI`)

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

## Depth Level

Determine execution depth from the user's request before proceeding:

| Signal words | Depth | Effect |
|---|---|---|
| "minimal", "quick", "sketch", "spike", "prototype" | **Minimal** | Skip optional gates; lightweight impact report; no full sync; use existing intelligence as-is |
| (default — no explicit signal) | **Standard** | Full procedure; all applicable gates; incremental sync after changes |
| "comprehensive", "thorough", "production-critical", "audit" | **Comprehensive** | All gates mandatory; extended scope analysis; full intelligence sync; cross-reference all ADRs |

Record the depth on line 2 of the impact report header. For **Minimal** depth, list which gates were skipped and why.

**Context gate (Standard and Comprehensive):** On high-risk or architecture-level changes, commit all intelligence artifacts and the current execution plan to git before starting implementation. This creates a clean recovery point if the context window fills mid-implementation.

## Procedure

### 1. Pre-Flight: Read Intelligence

Use `context-budget-optimizer` before loading broad intelligence. Do not read all of `knowledge-base/` or all graph JSON by default. Build `$EIcontext/context-manifest.md`, then load only relevant slices:
- `knowledge-base/` — only H2 sections relevant to the changed modules, APIs, schemas, or risk areas
- `$AIDLC` — `aidlc-state.md`, active checkpoint, active unit, acceptance criteria, and execution-plan rows relevant to the request
- `$EImemory/` — only matching decisions, constraints, conventions, regression patterns, and ADR references
- `$EIcontext/` — module/service/runtime rows near the change scope
- `$EIgraph/` — only relevant nodes/edges by graph proximity

**If intelligence is missing or stale**: Run `initialize-intelligence-skill` first.

Token rule: keep initial intelligence loading under 40% of the available context budget whenever possible. Lazy-load safety-gate evidence only when the trigger applies.

#### Pre-Flight Freshness Gate

Before impact analysis or code edits:

1. Resolve the likely changed modules from the request, graph proximity, or `change-detection-engine`.
2. Run `staleness-detector` scoped to those modules and related knowledge/context/memory artifacts.
3. If any freshness score is below `60`, run `incremental-sync-engine` for the stale artifacts before editing product code, or explicitly mark stale context in the impact report with the affected documents and scores.
4. If any score is below `50`, implementation is blocked until incremental sync runs or the user explicitly accepts stale-context risk.
5. Use the `staleness-detector` **Pre-Implementation Drift Trigger** decision: `Proceed`, `Sync before implementation`, or `Block implementation`.
6. Carry that exact decision into the impact report's freshness-gate line.
7. Skip stale H2 sections that carry low confidence metadata unless they are refreshed or verified against source.

### 2. Impact Analysis: Write Report

Before any code edit, write `$EIreports/IMP-XXX-<summary>.md`:

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
  - `$AIDLCagile/product-backlog.md`
  - `$AIDLCagile/sprint-plan.md`
  - `$AIDLCagile/acceptance-criteria.md`
  - `$AIDLCagile/definition-of-ready.md`
  - `$AIDLCagile/definition-of-done.md`
- Update `$AIDLCexecution-plan.md` and `$AIDLCaidlc-state.md`
- Split broad changes into construction units and keep `$AIDLCconstruction/cross-unit-discoveries.md` current
- Edit only the files necessary for the request
- Follow existing coding patterns from `$EImemory/coding-patterns.md`
- Read conventions from `knowledge-base/16-conventions.md` and `$EImemory/coding-patterns.md` — match naming patterns, import style, error handling patterns, and code structure
- If conventions document is missing or outdated, run `convention-detector` first
- After generating or modifying each file, compare it against `coding-patterns.md` for naming, import order, error handling, logging, folder structure, test style, and framework idioms. Auto-correct minor violations. Structural convention violations become review findings and block completion when critical.
- Respect architectural boundaries from `$EImemory/architecture-decisions.md`
- Consult `dangerous-areas.md` before modifying flagged code

#### Strict TDD Red-Green Gate

When TDD delivery mode is selected:

1. Add or update the required tests first.
2. Run the new/targeted tests before implementation code changes.
3. Confirm they fail for the expected reason.
4. Save failing output in `$AIDLCconstruction/<unit>/build-and-test/build-and-test-summary.md`.
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
- Run `api-snapshot-testing-engine` when API response behavior can be replayed or sampled
- Run `database-migration-safety-engine` when schema, ORM model, migration, index, or data persistence contracts changed
- Run `security-audit-engine` in targeted dependency-risk mode when package manifests add or upgrade dependencies; critical CVEs block completion
- Run `environment-variable-auditor` when environment variable reads, validation schemas, deployment config, or CI secrets change
- Run `adr-compliance-checker` when accepted ADRs or architecture decisions apply to the changed area
- Run `llm-prompt-injection-guard` when user-controlled data reaches prompts, RAG, agent tools, LLM calls, or durable AI memory
- Write `$AIDLCconstruction/<unit>/build-and-test/build-and-test-summary.md` for non-trivial units
- **Never claim validation passed unless it actually ran and passed**
- Record partial or failed validation honestly

#### Acceptance Criteria Verification Matrix

Before Definition of Done can pass, map every criterion from `$AIDLCagile/acceptance-criteria.md` to evidence:

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
- API snapshots: <passed|failed|not applicable>
- Migration safety: <passed|failed|not applicable>
- Dependency security: <passed|failed|not applicable>
- Environment variables: <passed|failed|not applicable>
- ADR compliance: <passed|failed|not applicable>
- LLM prompt injection: <passed|failed|not applicable>
- Convention enforcement: <passed|findings>

## Rollback
- Code rollback: <git revert command or branch rollback>
- Data rollback: <down migration / compensating operation / N/A with justification>
- Feature flag rollback: <toggle / N/A with justification>
- Infrastructure rollback: <IaC rollback / N/A with justification>
- Irreversible steps requiring approval: <list or none>

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
- [ ] API snapshot replay ran for changed API behavior when feasible
- [ ] Dependency security ran for new or upgraded packages
- [ ] Environment variable audit ran when config/env usage changed
- [ ] ADR compliance checked applicable accepted decisions
- [ ] LLM prompt injection guard ran for LLM/user-input paths
- [ ] Medium-and-above risk changes include rollback instructions or explicit N/A justification
- [ ] Environmental backpressure was used for validation failures
- [ ] Change record references the correct impact report
- [ ] High-risk changes went through review gate
- [ ] Generated code follows detected project conventions (naming, imports, structure)

## Rules

- **Never vibe-code** — Do not edit files directly without first recording the change in the impact report. If an urgent direct edit is unavoidable, log the file and reason in the impact report's "direct edits" section and update design artifacts before marking the work done.
- Always write the impact report before any code edit.
- Never claim validation passed unless it actually ran and passed.
- Record partial or failed validation honestly.

## Cross-References

- Depends on: `initialize-intelligence-skill` (prerequisite), `context-budget-optimizer`, `change-detection-engine`, `impact-analysis-engine`, `graph-engine`, `staleness-detector`
- Uses during execution: `testing-intelligence-engine`, `api-snapshot-testing-engine`, `type-safety-engine`, `api-backward-compatibility-engine`, `database-migration-safety-engine`, `security-audit-engine`, `environment-variable-auditor`, `adr-compliance-checker`, `llm-prompt-injection-guard`, `incremental-sync-engine`, `change-history-engine`
- Optional: `engineering-change-review` (for high-risk), `refactoring-planner` (for refactors), `convention-detector` (for convention compliance)
