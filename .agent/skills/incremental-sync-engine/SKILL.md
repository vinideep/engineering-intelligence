---
name: incremental-sync-engine
description: Synchronizes only the intelligence artifacts affected by a completed change — knowledge base, durable memory, navigation context, events, graphs, claims, and reports. The single sync engine; use for explicit synchronization or after implementation.
---

# Sync Engine

Update only the intelligence affected by a specific change; never regenerate unrelated content. This one skill covers all artifact types — knowledge base, memory, context, events, graphs, and claims.

## Inputs

- A completed diff, change record, or explicitly supplied changed scope
- Existing impact report (`.engineering-intelligence/reports/IMP-XXX-*.md`); if none exists for the scope, run `impact-analysis-engine` first

## Deterministic first steps (run the tools, don't hand-simulate)

1. **Run consolidated synchronization**: call `sync_engineering_knowledge` with the changed files. It refreshes Graphify evidence when healthy, rebuilds/reconciles EI's canonical graph, reindexes CCE's isolated approved source mirror, falls back natively when required, derives claims, and returns knowledge/evidence drift that still needs model synthesis.
2. **Re-check evidence** the knowledge base already committed to: `npx engineering-intelligence claims verify --json` — derived claims are re-computed (`verified` / `refuted`), asserted claims are hash-checked (`unverified` / `stale` / `missing`). Refuted, stale and missing claims are your precise worklist.
3. **Score document freshness**: `npx engineering-intelligence freshness . --json` — flags which knowledge/memory/context docs lag their cited source.
4. **Update canonical prose narrowly**, then call `validate_change` and re-run strict claims/evidence/health checks. Never refresh citation hashes merely to hide drift.

These replace the old prose "confidence decay" heuristic (which nothing enforced) with real, evidence-level signals.

## Sync Decision Matrix

Match each change to the artifact types it affects — touch nothing else.

| Change Type | Knowledge Base | Memory | Context | Events | Graphs |
|---|---|---|---|---|---|
| API route added/changed | `04-api-documentation.md` | — | `module-map.md` | `api-changed.md` | runtime-graph |
| Database schema changed | `05-database.md` | — | — | `schema-changed.md` | dependency-graph |
| Auth flow changed | `06-authentication.md` | `business-rules.md` | `critical-paths.md` | `auth-changed.md` | runtime-graph |
| New feature added | `07/08-frontend/backend.md` | — | `module-map.md` | `feature-added.md` | dependency-graph |
| Architecture decision | `02-architecture.md` | `architecture-decisions.md` | all maps | — | all graphs |
| Dependency added/removed | `01-repository-structure.md` | `technology-decisions.md` | `dependency-map.md` | — | dependency-graph |
| Infrastructure changed | `09-infrastructure.md` | — | — | `infrastructure-changed.md` | service-graph |
| Refactor (no behavior change) | — | `coding-patterns.md` | affected maps | — | dependency-graph |
| Convention changed | `16-conventions.md` | `coding-patterns.md` | — | — | — |
| Config/env changes | `09-infrastructure.md` | `project-constraints.md` | — | — | — |
| Security concern detected | `20-security-assessment.md` | — | — | — | — |
| Test changes only | — | — | — | — | — |

## Knowledge Base sync

Update only the sections that reference changed code. Preserve accurate content; never regenerate a whole document. Attach an evidence citation to every changed claim — `(evidence: src/mw/auth.ts:L15-L28)` — and mark uncertainty as `**Unclear from evidence** — <reason>`. For anything durable and code-backed, prefer `claims derive` (machine-checkable); use `npx engineering-intelligence claims add --statement "<fact>" --evidence "<path>:<start>-<end>" --author "<who>"` only for statements derivation cannot express, and remember those stay `unverified`. Re-run `claims verify` after editing; a claim that still reads `stale` means the doc text and the code still disagree.

## Memory sync (durable only)

Most changes do **not** touch memory — leaving it unchanged is usually correct. Update only when a durable decision, rule, constraint, pattern, or technology choice changed.

| Document | Content | Update trigger |
|---|---|---|
| `architecture-decisions.md` | ADRs, boundaries, communication patterns | Architecture changes, new boundaries |
| `business-rules.md` | Domain invariants, validation, business constraints | Business-logic / regulatory changes |
| `coding-patterns.md` | Conventions, idioms, naming, file organization | Refactors establishing new patterns |
| `project-constraints.md` | Perf budgets, compatibility, SLAs, compliance | Infra changes, new compliance |
| `technology-decisions.md` | Stack, framework versions, migration plans | Dependency/tech migrations |
| `regression-patterns.md` | Recurring bug categories + regression templates | Bugfixes revealing reusable failure modes |
| `team-preferences.md` | Team-wide preferences (≥2 developer consensus) | Promoted by `user-intelligence-engine` |
| `users/<slug>/user-intelligence.md` | Personal profile (gitignored) | Per session / `ei user-profile` |

Rules: cite evidence on every entry; mark superseded decisions `Superseded` rather than deleting them; retire stale memory only with evidence. `testing-intelligence-engine` proposes regression patterns; persist them here only when durable.

## Context sync (navigation maps)

Keep `.engineering-intelligence/context/` maps concise and navigational (tables, under ~150 lines each) — they help an agent find the right file fast, not duplicate the knowledge base. Maintain: `module-map.md`, `service-map.md`, `runtime-map.md`, `critical-paths.md`, `dangerous-areas.md`, `dependency-map.md`. Update only affected entries; remove phantom paths; cross-check against `.engineering-intelligence/graph/` and the real filesystem. For assembling context under a token budget, prefer `npx engineering-intelligence context "<task>" --files <...>` (the `get_context` tool) over reading maps by hand.

## Events, graphs, reports

- **Events**: verify `.engineering-intelligence/events/*.md` guidance still matches the current contracts when API/schema/auth/feature/infra changed.
- **Graphs**: already refreshed in step 1 (incremental `map --update`); require a full remap only for broad structural changes.
- **Report**: append a synchronization-notes section to the originating impact report recording exactly what was synced.

## Rules

- Incremental only — modify only artifacts the impact report (and the tools above) identify.
- Evidence required for every changed claim; prefer recorded claims for durable facts.
- Preserve correct existing content; never regenerate unrelated artifacts.
- No `CHG-XXX` records here (that is the change-history engine's job); never modify product code.

## Quality Gates

- [ ] Graph refreshed (`map --update`) and claims re-verified before editing docs
- [ ] Only impact-identified artifacts were modified; unrelated content preserved
- [ ] Evidence citations added for changed claims; durable facts recorded as claims
- [ ] `claims verify` reports no refuted/stale/missing claims left unaddressed for the change scope
- [ ] Context maps reference real paths; impact report updated with sync notes
- [ ] Provider graph/index freshness and native fallback status are recorded
- [ ] No stale, contested, or out-of-scope provider result entered canonical knowledge

## Cross-References

- Depends on: `change-detection-engine`, `impact-analysis-engine`, `graph-engine`
- Used by: `engineering-intelligence-skill`, `sync-engineering-intelligence` workflow
- Integrates with: `knowledge-base-validator` (validates after sync), `convention-detector` (convention sync), `user-intelligence-engine` (memory promotion)
