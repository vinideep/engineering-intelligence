> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: testing-intelligence-engine
description: Determines risk-based testing needs for engineering changes and identifies coverage gaps in critical runtime flows. Use during implementation and validation.
version: 3.0.0
---

# Testing Intelligence Engine

Determine the minimum sufficient test coverage for a change based on risk assessment and existing test patterns.

## Inputs

- Impact report (`$EIreports/IMP-XXX-*.md`)
- Existing test patterns in the repository
- Change classification (feature, bugfix, refactor, etc.)
- Coverage reports when available (`coverage-final.json`, `coverage.xml`, `lcov.info`, `go test -cover`, pytest coverage output)
- Agile acceptance criteria from `$AIDLCagile/acceptance-criteria.md`

## Risk-Based Test Selection Matrix

| Risk Level | Unit Tests | Integration Tests | E2E Tests | Security Tests | Migration Tests | Manual |
|---|---|---|---|---|---|---|
| **Low** | Changed functions | — | — | — | — | — |
| **Medium** | Changed + adjacent | Affected APIs | — | — | — | — |
| **High** | Changed + adjacent | Affected APIs | Critical paths | If auth touched | If schema touched | Recommended |
| **Critical** | Comprehensive | All affected | Full suite | Required | Required | Required |

## Procedure

1. **Assess Existing Coverage** — Scan the test suite:
   - Identify test framework(s) in use (Jest, Mocha, pytest, Go testing, etc.)
   - Locate test directories and naming patterns
   - Map tests to source files (by convention or configuration)
   - Parse real coverage reports where available:
     - Jest/Vitest/Istanbul JSON (`coverage-final.json`)
     - LCOV (`lcov.info`)
     - pytest `coverage.xml`
     - Go `go test -cover` output
   - Map uncovered lines to modules and critical paths

2. **Map Change to Tests** — Using the impact report:
   - List source files/functions changed
   - Find existing tests covering those files
   - Build a source-line to test-file map from coverage where possible
   - Run or recommend targeted impacted tests first, then broader validation
   - Identify tests that should exist but don't (coverage gaps)

3. **Determine Required Tests** — Using the risk matrix above:

   **For `bugfix`**:
   - Regression test reproducing the original bug (required)
   - Verify fix doesn't break adjacent behavior

   **For `feature`**:
   - Unit tests for new functions/methods
   - Integration tests for new API endpoints or service interactions
   - Happy path + error path coverage

   **For `refactor`**:
   - All existing tests must still pass (no new tests needed if behavior unchanged)
   - Add tests if coverage gaps are discovered during refactoring

   **For `architecture` / `security`**:
   - Boundary tests between new/changed architectural boundaries
   - Negative-path and permission tests for security changes
   - Data migration and rollback tests for schema changes

   **For API/service integration changes**:
   - Generate integration test stubs from `knowledge-base/04-api-documentation.md` and `service-graph.json`
   - Cover happy path, auth failure, downstream timeout, and validation error
   - Match existing test framework, describe/it nesting, mock setup, assertion library, and factory style

   **For complex validators or combinatorial logic**:
   - Recommend property-based tests (`fast-check`, `hypothesis`, `proptest`, or project equivalent)
   - Include seed examples and rationale

4. **Identify Coverage Gaps** — Report:
   - Critical paths with no test coverage
   - Changed behavior with no corresponding test
   - Error paths and edge cases not covered

5. **Recommend Test Strategy** — For the specific change, recommend:
   - Test files to create or modify
   - Test cases to write (describe what, not write the test code)
   - Validation commands to run

6. **Verify Acceptance Criteria** — Produce an Acceptance Criteria Verification Matrix mapping every criterion to automated tests, manual verification, or an unavailable check. Missing mappings block Definition of Done.

7. **Propose Regression Patterns** — For bugfixes, compare against `$EImemory/regression-patterns.md`. Reuse matching templates. If a new recurring bug category is found, propose a durable pattern to `memory-sync-engine`; Memory Sync owns durable persistence.

## Output

### Per-Change Testing (in `.changes/CHG-XXX-*.md`)

```markdown
## Tests
- Added: <test file> — <what it tests>
- Modified: <test file> — <what changed>
- Run command: `npm test` / `pytest` / etc.
- Results: X passed, Y failed, Z skipped
- Coverage gaps: <untested areas remaining>
```

### Broad Testing Strategy (in `knowledge-base/17-testing-strategy.md`)

Only update when documenting project-wide testing posture:

```markdown
# Testing Strategy

## Test Framework
- Framework: <name and version>
- Configuration: <config file path>

## Test Organization
| Directory | Type | Coverage |
|---|---|---|
| test/unit/ | Unit tests | Core business logic |
| test/integration/ | Integration | API endpoints |

## Coverage Gaps
- <critical untested areas>

## Evidence-Based Coverage
| Source File | Changed Lines | Covering Tests | Uncovered Lines |
|---|---|---|---|

## Acceptance Criteria Verification Matrix
| Criterion | Covering Test / Manual Check | Result |
|---|---|---|

## Running Tests
- All tests: `<command>`
- Specific suite: `<command>`
- Coverage report: `<command>`
```

## Rules

- Recommend tests proportional to risk — don't mandate full-suite runs for low-risk changes
- Always note when validation was not actually run (only recommended)
- Never claim test coverage without checking existing tests
- Prefer real coverage reports over proximity estimates when reports exist
- Target impacted tests first, then run broader suites according to risk
- Missing acceptance-criteria mappings block Definition of Done
- Record test results honestly, including failures

## Quality Gates

- [ ] Impact report was consulted for risk level
- [ ] Test recommendations match the risk level
- [ ] Existing test coverage was checked before recommending new tests
- [ ] Coverage reports were parsed when available
- [ ] Impacted tests were identified separately from full-suite validation
- [ ] Coverage gaps in critical paths are flagged
- [ ] Acceptance criteria are mapped to validation evidence

## Cross-References

- Depends on: `impact-analysis-engine` (for risk assessment)
- Used by: `engineering-intelligence-skill` (step 4: tests and validation)
- Updates: `knowledge-base/17-testing-strategy.md` (broad posture only)
