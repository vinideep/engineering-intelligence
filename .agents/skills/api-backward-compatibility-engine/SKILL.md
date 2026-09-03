---
name: api-backward-compatibility-engine
description: Diffs API contracts (additive/deprecated/breaking), requires versioning or migration notes for breaking changes, and captures/replays request-response snapshots to catch semantic regressions.
---

# API Backward Compatibility & Snapshot Engine

Use this skill when routes, handlers, request schemas, response schemas, GraphQL schemas, RPC contracts, events, SDKs, webhooks, or public service interfaces change. It covers both **contract diffing** (is this change breaking?) and **snapshot/replay verification** (did the actual responses change semantically?).

**Run the deterministic gate first:** `npx engineering-intelligence gate api-diff . --base <ref>` (e.g. `--base origin/main`; add `--json`). It extracts HTTP route registrations, method decorators, and OpenAPI path/method pairs from the working tree and the base ref, and fails on any endpoint removed or method-changed (breaking). Use the steps below to classify request/response schema, GraphQL, and RPC contract changes the gate does not yet parse.

## Procedure

1. **Load Current API Contract**
   - `.engineering-intelligence/knowledge-base/04-api-documentation.md`
   - OpenAPI / Swagger specs
   - GraphQL schemas
   - Protobuf / gRPC definitions
   - Route files, request validators, response serializers
   - Event schema registries or webhook docs

2. **Diff Proposed Or Actual Change**
   - Endpoints added/removed/renamed
   - Methods changed
   - Request fields added/removed/renamed/type-changed
   - Response fields added/removed/renamed/type-changed
   - Auth/permission requirements changed
   - Error codes/status codes changed
   - Pagination, sorting, idempotency, or rate-limit semantics changed

3. **Classify Each Change**
   - `additive`: backward-compatible addition
   - `deprecated`: old behavior still works but has deprecation path
   - `breaking`: existing clients can fail or observe incompatible semantics

4. **Require Versioning For Breaking Changes**
   - Require explicit version bump, migration notes, or recorded human approval.
   - Block change finalization if breaking changes lack versioning/migration documentation.

5. **Generate Compatibility Notes**
   - Update API docs and change record.
   - Identify impacted tests and client contracts.

## Snapshot & Replay Verification

Contract diffing catches *declared* breaks; snapshots catch *observed* ones. For changed endpoints, capture request/response pairs and replay them to detect semantic regressions the static diff misses. Store snapshots under `.engineering-intelligence/snapshots/`.

1. **Select scenarios** for changed endpoints from `04-api-documentation.md`, `service-graph.json`, route files, and existing API tests: happy path, auth failure, validation error, downstream/dependency failure, edge-case response shape.
2. **Capture pre-change** request/response pairs before implementation when feasible; if runtime capture is unavailable, extract examples from existing tests or API docs and mark confidence accordingly.
3. **Replay post-change** against the changed code or test harness. Diff status code, contract headers, response shape, computed values, pagination metadata, error format, and auth behavior.
4. **Classify differences**: `expected` (intentional, covered by acceptance criteria), `compatible` (additive/non-contractual), `regression-candidate` (semantic difference that may break callers), `breaking` (incompatible response/status without approval).
5. **Block on unexplained regressions**: `regression-candidate` and `breaking` diffs block Definition of Done until resolved, approved, or recorded as open risk.

Write `.engineering-intelligence/snapshots/<unit>/snapshot-report.md` with the pre-change/post-change sources, a replay-results table (scenario, endpoint, pre-change, post-change, classification, evidence), blocking differences, and approval rationale.

## Output

Write `.engineering-intelligence/aidlc/construction/<unit>/api-compatibility.md`:

```markdown
# API Backward Compatibility: <unit>

## Contract Sources
- <path>

## Change Classification
| API Surface | Change | Class | Client Impact | Required Action |
|---|---|---|---|---|

## Breaking Changes
- <change>
- Version bump: <path/evidence or missing>
- Migration notes: <path/evidence or missing>

## Validation
- Contract tests:
- Snapshot/replay checks:
- Manual verification:
```

## Blocking Conditions

- Breaking change without version bump, migration notes, or explicit approval
- Removed API without deprecation path
- Response contract changed without compatibility test
- Auth requirement changed without security/permission test

## Quality Gates

- [ ] Contract sources were loaded
- [ ] Every API change is classified as additive, deprecated, or breaking
- [ ] Breaking changes have version bump or explicit approval
- [ ] API docs and tests are updated for contract changes
- [ ] Changed API surfaces have snapshot scenarios (or an explicit unavailable rationale), with post-change replay performed
- [ ] Semantic differences are classified; unexplained regression candidates block completion
