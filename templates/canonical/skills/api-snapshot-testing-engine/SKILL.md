---
name: api-snapshot-testing-engine
description: Captures pre-change API request/response snapshots, replays them post-change, and flags semantic response regressions.
version: 1.0.0
---

# API Snapshot Testing Engine

Use this skill when an API endpoint, route handler, controller, serializer, GraphQL resolver, RPC method, webhook, or response-shaping code changes.

## Snapshot Root

Store snapshots under:

```text
.engineering-intelligence/snapshots/
```

## Procedure

1. **Select Snapshot Scenarios**
   - Read `.engineering-intelligence/knowledge-base/04-api-documentation.md`, `service-graph.json`, route files, and existing API tests.
   - Select representative requests for changed endpoints:
     - happy path
     - auth failure
     - validation error
     - downstream timeout or dependency failure
     - edge-case response shape

2. **Capture Pre-Change Snapshots**
   - Before implementation edits when feasible, capture pre-change request/response pairs.
   - If runtime capture is unavailable, extract examples from existing tests or API docs and mark confidence accordingly.

3. **Replay Post-Change**
   - After implementation, replay the same requests against the changed code or test harness.
   - Diff status code, headers that are part of the contract, response shape, computed values, pagination metadata, error format, and auth behavior.

4. **Classify Differences**
   - `expected`: intentional change covered by acceptance criteria or API compatibility notes
   - `compatible`: additive or non-contractual difference
   - `regression-candidate`: semantic difference that may break callers
   - `breaking`: incompatible response or status change without approval

5. **Block On Unexplained Regressions**
   - `regression-candidate` and `breaking` diffs block Definition of Done until resolved, approved, or recorded as open risk.

## Output

Write `.engineering-intelligence/snapshots/<unit>/snapshot-report.md`:

```markdown
# API Snapshot Report: <unit>

## Snapshot Sources
- pre-change: <runtime|test fixture|documentation|unavailable>
- post-change: <runtime|test fixture|unavailable>

## Replay Results
| Scenario | Endpoint | Pre-Change | Post-Change | Classification | Evidence |
|---|---|---|---|---|---|

## Blocking Differences
- <regression or breaking difference>

## Approval / Rationale
- <expected difference and evidence>
```

## Quality Gates

- [ ] Changed API surfaces have snapshot scenarios or explicit unavailable rationale
- [ ] Pre-change snapshots are captured before implementation when feasible
- [ ] Post-change replay was performed or blocked with evidence
- [ ] Semantic differences are classified
- [ ] Unexplained regression candidates block completion
