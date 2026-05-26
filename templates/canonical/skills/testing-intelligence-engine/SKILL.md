---
name: testing-intelligence-engine
description: Determines risk-based testing needs for engineering changes and identifies coverage gaps in critical runtime flows. Use during implementation and validation.
version: 3.0.0
---

# Testing Intelligence Engine

Determine the minimum sufficient test coverage for a change based on risk assessment and existing test patterns.

## Inputs

- Impact report (`.engineering-intelligence/reports/IMP-XXX-*.md`)
- Existing test patterns in the repository
- Change classification (feature, bugfix, refactor, etc.)

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
   - Identify untested critical paths

2. **Map Change to Tests** — Using the impact report:
   - List source files/functions changed
   - Find existing tests covering those files
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

4. **Identify Coverage Gaps** — Report:
   - Critical paths with no test coverage
   - Changed behavior with no corresponding test
   - Error paths and edge cases not covered

5. **Recommend Test Strategy** — For the specific change, recommend:
   - Test files to create or modify
   - Test cases to write (describe what, not write the test code)
   - Validation commands to run

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

## Running Tests
- All tests: `<command>`
- Specific suite: `<command>`
- Coverage report: `<command>`
```

## Rules

- Recommend tests proportional to risk — don't mandate full-suite runs for low-risk changes
- Always note when validation was not actually run (only recommended)
- Never claim test coverage without checking existing tests
- Record test results honestly, including failures

## Quality Gates

- [ ] Impact report was consulted for risk level
- [ ] Test recommendations match the risk level
- [ ] Existing test coverage was checked before recommending new tests
- [ ] Coverage gaps in critical paths are flagged

## Cross-References

- Depends on: `impact-analysis-engine` (for risk assessment)
- Used by: `engineering-intelligence-skill` (step 4: tests and validation)
- Updates: `knowledge-base/17-testing-strategy.md` (broad posture only)
