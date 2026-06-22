---
name: api-backward-compatibility-engine
description: Diffs API contracts, classifies changes as additive, deprecated, or breaking, and requires versioning or migration notes for breaking changes.
version: 1.0.0
---

# API Backward Compatibility Engine

Use this skill when routes, handlers, request schemas, response schemas, GraphQL schemas, RPC contracts, events, SDKs, webhooks, or public service interfaces change.

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
