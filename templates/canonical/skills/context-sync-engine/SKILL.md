---
name: context-sync-engine
description: Maintains compact AI navigation context when modules, services, dependencies, runtime paths, or risk areas change. Use after significant implementation changes.
version: 3.0.0
---

# Context Synchronization

Maintain concise, navigational context maps optimized for AI agent use. Context maps help agents quickly find the right file, module, or service — not replace the knowledge base.

## Inputs

- Impact report and graph updates
- Current `.engineering-intelligence/context/` documents

## Context Maps

Maintain these maps in `.engineering-intelligence/context/`:

### `module-map.md` — Module Navigation

```markdown
# Module Map

| Module | Path | Responsibility | Key Files |
|---|---|---|---|
| auth | src/auth/ | Authentication, JWT, RBAC | middleware.ts, jwt.ts |
| api | src/routes/ | REST endpoint handlers | users.ts, products.ts |
```

### `service-map.md` — Service Topology

```markdown
# Service Map

| Service | Port | Protocol | Dependencies | Health Check |
|---|---|---|---|---|
| api-server | 3000 | HTTP | postgres, redis | /health |
| worker | — | — | rabbitmq, postgres | — |
```

### `runtime-map.md` — Request Flows

```markdown
# Runtime Map

## HTTP Request Flow
Entry → CORS → Auth → Rate Limit → Router → Handler → Response

## Background Job Flow
Queue → Worker → Process → DB Write → Notify
```

### `critical-paths.md` — Revenue & Safety Critical Flows

```markdown
# Critical Paths

| Flow | Entry Point | Risk | Last Verified |
|---|---|---|---|
| Payment processing | POST /api/checkout | High | CHG-005 |
| User registration | POST /api/auth/register | Medium | CHG-003 |
```

### `dangerous-areas.md` — Fragile & Risky Code

```markdown
# Dangerous Areas

| Area | Path | Risk | Reason |
|---|---|---|---|
| Legacy auth | src/auth/legacy.ts | High | No tests, race conditions |
| Payment retry | src/payments/retry.ts | High | Complex state machine |
```

### `dependency-map.md` — External Dependencies

```markdown
# Dependency Map

| Dependency | Version | Consumers | Risk |
|---|---|---|---|
| express | 4.18.x | api-server | Low — stable |
| stripe | 12.x | payments module | Medium — breaking changes |
```

## Procedure

1. **Context Relevance Selection** — Before reading broad intelligence, rank knowledge and context documents by graph proximity to the change scope:
   - direct graph neighbors first
   - critical-path maps next
   - impacted API/schema/security docs next
   - broad background docs last
   Estimate token cost and load in relevance order until roughly 40% of the available context budget is consumed. Reserve the rest for implementation, tests, diagnostics, and user interaction. If critical docs cannot fit, escalate with the missing docs and reason.

2. **Check Impact** — Review the impact report and graph updates. Identify which context maps are affected.

3. **Update Affected Maps** — For each affected map:
   - Update specific entries, not the entire map
   - Add new entries for new modules/services/paths
   - Remove entries for deleted modules/services
   - Update paths and descriptions for renamed elements

4. **Preserve Conciseness** — Each map should be:
   - Under 150 lines
   - Table-formatted where possible
   - Navigational (paths and quick descriptions), not explanatory
   - Optimized for AI agent context windows

5. **Verify Accuracy** — Cross-check updated maps against:
   - Current `.engineering-intelligence/graph/` data
   - Actual file system paths (do they still exist?)

## Rules

- Keep context concise and navigational — not a knowledge-base duplicate
- Load context by relevance, not by directory order
- Keep initial intelligence loading under 40% of the available context budget when possible
- Use tables over prose wherever possible
- Update only affected maps from the impact report
- Do not regenerate unrelated context
- Maps must reflect actual file system state (no phantom paths)

## Quality Gates

- [ ] Each map is under 150 lines
- [ ] Relevant docs were ranked by graph proximity before broad loading
- [ ] Context budget was preserved or an escalation was recorded
- [ ] Updated entries reference real, existing paths
- [ ] Only impact-affected maps were modified
- [ ] Table format used where appropriate

## Cross-References

- Depends on: `impact-analysis-engine` (identifies affected maps), `graph-engine` (provides topology data)
- Used by: `incremental-sync-engine`, `engineering-intelligence-skill`
- Consumed by: All agents (for navigation)
