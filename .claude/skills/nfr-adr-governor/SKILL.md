> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: nfr-adr-governor
description: Captures non-functional requirements, maps them to architectural patterns, and governs ADR lifecycle states.
version: 1.0.0
---

# NFR And ADR Governor

Use this skill for performance, reliability, security, privacy, compliance, scalability, compatibility, migration, and operational constraints.

## NFR Requirements

Write `$AIDLCconstruction/<unit>/nfr-requirements.md`:

```markdown
# NFR Requirements: <unit>

| Dimension | Target | Evidence / Source | Validation Method |
|---|---|---|---|
| Latency | <p50/p95/p99> | <source> | <test/monitor> |
| Throughput | <target> | <source> | <load/perf test> |
| Reliability | <SLO/SLA> | <source> | <failure test> |
| Security | <standard/control> | <source> | <scan/review/test> |
| Data | <volume/retention/migration> | <source> | <migration/test> |
| Compatibility | <API/browser/runtime> | <source> | <contract test> |
```

## NFR Design

Write `$AIDLCconstruction/<unit>/nfr-design/design.md` with concrete patterns. Examples: circuit breaker with exponential backoff, idempotency keys, bulkheads, rate limits, schema expansion/contraction, cache invalidation, trace correlation, policy-based authorization.

## ADR Lifecycle

Create an ADR only when two or more distinct alternatives were considered.

Allowed states:
- `Proposed`
- `Accepted`
- `Rejected`
- `Superseded`

Accepted ADRs are immutable. To change one, create a new `Proposed` ADR and mark the old accepted ADR as `Superseded by ADR-NNNN` after the new decision is accepted.

ADR path:

```text
$AIDLCconstruction/<unit>/nfr-design/decision-records/ADR-NNNN-<slug>.md
```

ADR template:

```markdown
# ADR-NNNN: <decision>

## Status
Proposed

## Context
<problem, constraints, NFR drivers>

## Options Considered
- Option A: <tradeoffs>
- Option B: <tradeoffs>

## Decision
<chosen option when accepted>

## Consequences
- Positive: <benefits>
- Negative: <costs>
- Validation: <how this will be tested>

## Supersedes / Superseded By
<links or Not applicable>
```

## Quality Gates

- [ ] NFRs are measurable where possible
- [ ] Design patterns map back to NFR targets
- [ ] ADR exists only when alternatives were considered
- [ ] ADR state transitions are explicit
- [ ] Accepted ADRs are not edited except to mark supersession
