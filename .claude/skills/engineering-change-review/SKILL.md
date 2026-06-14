> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: engineering-change-review
description: Reviews engineering changes for correctness, test coverage, architecture alignment, graph consistency, and documentation accuracy. Use after implementation to validate quality before completion.
version: 3.0.0
---

# Engineering Change Review

Review completed engineering work for correctness, completeness, and alignment with project standards. Produce a structured review report with severity-ordered findings.

## Inputs

- Implementation diff or changed scope
- Impact report (`$EIreports/IMP-XXX-*.md`)
- Test and validation evidence
- Updated graph and intelligence artifacts

## Review Dimensions

### 1. Implementation Correctness

| Check | What to Verify |
|---|---|
| Request fulfillment | Does the implementation address the original request? |
| Logic correctness | Are algorithms and business logic correct? |
| Edge cases | Are boundary conditions handled? |
| Error handling | Are errors caught, logged, and reported appropriately? |
| Resource management | Are connections, files, and memory properly managed? |
| Concurrency safety | Are shared resources properly synchronized? |

### 2. Test Coverage

| Check | What to Verify |
|---|---|
| Happy path | Is the expected behavior tested? |
| Error path | Are error scenarios tested? |
| Regression | Does a test prevent the original issue from recurring (bugfix)? |
| Boundary | Are edge cases and limits tested? |
| Execution | Were tests actually run? (Not just written) |
| Results | Did all tests pass? Are failures explained? |

### 3. Architecture Alignment

| Check | What to Verify |
|---|---|
| Boundary respect | Does the change respect module/service boundaries? |
| Pattern compliance | Does it follow established patterns from memory? |
| Dependency direction | Are dependencies flowing in the correct direction? |
| Abstraction level | Is the code at the appropriate abstraction level? |

### 4. Graph Consistency

| Check | What to Verify |
|---|---|
| Node updates | Are new modules/services reflected in graphs? |
| Edge updates | Are new dependencies/relationships reflected? |
| Stale entries | Were removed elements cleaned from graphs? |
| Map alignment | Does architecture-map.md reflect JSON graph changes? |

### 5. Documentation Accuracy

| Check | What to Verify |
|---|---|
| Knowledge sync | Were affected knowledge docs updated? |
| Memory sync | Were durable decisions captured if needed? |
| Context sync | Were navigation maps updated? |
| Change record | Does the CHG record accurately reflect the work? |
| Impact report | Was the impact report referenced correctly? |

### 6. Rollback Readiness

| Check | What to Verify |
|---|---|
| Medium+ rollback | Medium, high, and critical risk changes include rollback instructions |
| Data rollback | Migration rollback, compensating SQL, or irreversible approval is recorded |
| Feature flags | Flag rollback is documented where applicable |
| Infrastructure | IaC or deployment rollback is documented where applicable |
| CHG alignment | CHG record rollback section matches operations readiness |

## Finding Severity Scale

| Severity | Symbol | Meaning | Action Required |
|---|---|---|---|
| Blocker | 🔴 | Breaks functionality or introduces security risk | Must fix before completion |
| Major | 🟠 | Significant issue but not immediately breaking | Should fix before completion |
| Minor | 🟡 | Code quality or style issue | Fix when convenient |
| Suggestion | 🔵 | Optional improvement | Consider for future |
| Positive | 🟢 | Good practice or improvement observed | No action needed |

## Procedure

1. **Read Context** — Load the impact report, implementation diff, and test results.
2. **Review Each Dimension** — Walk through all six review dimensions above.
3. **Score Findings** — Assign severity to each finding.
4. **Check Intelligence** — Verify graph, knowledge, memory, and context were appropriately synced.
5. **Write Report** — Generate the review report.

## Output Format

Write `$EIreports/REV-XXX-<slug>.md`:

```markdown
# REV-XXX: <summary>

## Meta
- Date: <ISO timestamp>
- Related: IMP-XXX, CHG-XXX
- Scope: <what was reviewed>

## Summary
- Total findings: X
- 🔴 Blocker: Y | 🟠 Major: Z | 🟡 Minor: W | 🔵 Suggestion: V

## Verdict
- [ ] ✅ Approved — No blocking issues
- [ ] ⚠️ Approved with findings — Non-blocking issues noted
- [ ] ❌ Changes required — Blocking issues must be addressed

## Findings

### 🔴 [Finding Title]
- **Dimension**: Implementation / Testing / Architecture / Graph / Documentation
- **Location**: <file:line or artifact path>
- **Description**: <what was found>
- **Evidence**: <code reference or comparison>
- **Recommendation**: <how to fix>

### 🟢 [Positive Finding]
- **Description**: <good practice observed>

## Test Gaps
- <untested areas that should be tested>

## Intelligence Sync Status
| Artifact | Status | Notes |
|---|---|---|
| knowledge-base/ | ✅ Synced | API docs updated |
| graph/ | ⚠️ Partial | Missing new service node |

## Stale Intelligence Risks
- <areas where docs may drift from code>

## Rollback Readiness
| Area | Status | Evidence |
|---|---|---|
| Code rollback | ✅/⚠️/❌ | <CHG or operations-readiness evidence> |
```

## Rules

- Review is read-only — do not apply fixes during a review-only workflow
- Be honest about gaps and risks — sugar-coating helps nobody
- Include positive findings alongside issues — balanced review
- All findings must cite specific evidence (file paths, code references)
- If tests were not actually run, flag it as a major finding

## Quality Gates

- [ ] All six review dimensions were evaluated
- [ ] Each finding has severity, location, and evidence
- [ ] Test execution was verified (not assumed)
- [ ] Intelligence sync status was checked
- [ ] Report includes verdict (approved/changes required)

## Cross-References

- Depends on: `change-detection-engine` (identifies what to review)
- Used by: `engineering-intelligence-skill` (high-risk review gate), `review-engineering-change` workflow
- Reads: Impact reports, change records, graph artifacts
