> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: contract-test-generator
description: Generates consumer-driven contract test stubs for service boundaries based on API contracts and service graph topology.
---

# Contract Test Generator

Use this skill when service boundaries, API clients, webhooks, events, GraphQL schemas, or RPC contracts change.

## Procedure

1. Read `service-graph.json`, `knowledge-base/04-api-documentation.md`, OpenAPI/GraphQL/protobuf schemas, and existing contract tests.
2. Detect the project’s contract-test framework if any: Pact, Spring Cloud Contract, protobuf conformance tests, schema snapshots, custom integration harness, or plain test framework.
3. Generate or recommend stubs matching the project’s exact test structure and assertion style.
4. Cover canonical scenarios:
   - happy path
   - auth failure
   - validation error
   - downstream timeout
   - unexpected response shape
5. Feed generated stubs and commands into `testing-intelligence-engine`.

## Output

Write `$AIDLCconstruction/<unit>/contract-test-plan.md`:

```markdown
# Contract Test Plan: <unit>

| Boundary | Consumer | Provider | Scenario | Stub/Test Path | Status |
|---|---|---|---|---|---|
```

## Quality Gates

- [ ] Changed service boundaries are identified
- [ ] Existing contract-test style is matched
- [ ] Canonical failure scenarios are covered or explicitly not applicable
- [ ] Contract tests are linked to acceptance criteria
