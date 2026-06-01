---
name: incremental-sync-engine
description: Synchronizes only intelligence artifacts affected by a completed change or identified diff, including knowledge, memory, context, events, graphs, and reports. Use for explicit synchronization or after implementation.
version: 3.0.0
---

# Incremental Sync Engine

Update only the intelligence artifacts affected by a specific change. Never regenerate unrelated content.

## Inputs

- Completed diff, change record, or supplied changed scope
- Existing impact report (`.engineering-intelligence/reports/IMP-XXX-*.md`)
- If no impact report exists for the scope, run `impact-analysis-engine` first

## Sync Decision Matrix

Use this matrix to determine which artifact types need updating based on the change type:

| Change Type | Knowledge Base | Memory | Context | Events | Graphs | Reports |
|---|---|---|---|---|---|---|
| API route added/changed | `04-api-documentation.md` | — | `module-map.md` | `api-changed.md` | runtime-graph | IMP update |
| Database schema changed | `05-database.md` | — | — | `schema-changed.md` | dependency-graph | IMP update |
| Auth flow changed | `06-authentication.md` | `business-rules.md` | `critical-paths.md` | `auth-changed.md` | runtime-graph | IMP update |
| New feature added | `07/08-frontend/backend.md` | — | `module-map.md` | `feature-added.md` | dependency-graph | IMP update |
| Architecture decision | `02-architecture.md` | `architecture-decisions.md` | all maps | — | all graphs | IMP update |
| Dependency added/removed | `01-repository-structure.md` | `technology-decisions.md` | `dependency-map.md` | — | dependency-graph | IMP update |
| Infrastructure changed | `09-infrastructure.md` | — | — | `infrastructure-changed.md` | service-graph | IMP update |
| Refactor (no behavior change) | — | `coding-patterns.md` | affected maps | — | dependency-graph | — |
| Test changes only | — | — | — | — | — | — |
| Config/env changes | `09-infrastructure.md` | `project-constraints.md` | — | — | — | — |
| Convention changed | `16-conventions.md` | `coding-patterns.md` | — | — | — | — |
| Security concern detected | `20-security-assessment.md` | — | — | — | — | — |

## Procedure

1. **Read Impact Report** — Get the list of affected intelligence artifacts from the impact report. If no report exists, run `impact-analysis-engine` to create one.

2. **Classify Changes** — Match each change against the sync decision matrix above.

3. **Update Knowledge Base** — For each affected `knowledge-base/` document:
   - Read the current document
   - Identify the specific section(s) affected
   - Update only those sections with new evidence
   - Preserve all accurate existing content
   - Add evidence citations for all changed claims

4. **Update Memory** — Only if a durable decision, rule, constraint, pattern, or technology choice changed:
   - Update the specific entry in the relevant memory document
   - Add a `Last updated:` timestamp and reason

5. **Update Context** — Only if module, service, runtime, dependency, critical-path, or risk topology changed:
   - Update the specific entries in affected map documents
   - Keep maps concise and navigational

6. **Update Events** — Only if API, schema, auth, feature, or infrastructure contracts changed:
   - Verify the change-event guidance still reflects the current system

7. **Update Graphs** — Use `graph-engine` in incremental mode:
   - Update only affected nodes and edges
   - Preserve stable node IDs
   - Require full remapping only for unbounded structural changes

8. **Update Impact Report** — Add a synchronization notes section to the original impact report recording what was synced.

9. **Check Freshness** — After sync, update freshness metadata on all modified documents. If any document freshness score drops below 40, flag for full re-verification using `staleness-detector`.

## Confidence Decay

Confidence scores decrease over time without re-verification:

| Changes Since Last Verification | Confidence Level |
|---|---|
| 0–9 changes | Maintains current confidence |
| 10–24 changes | Drops from `verified` to `inferred` |
| 25+ changes | Drops to `unknown` |

During sync, check how many changes have occurred since each artifact was last verified. Apply decay rules and flag artifacts that have dropped confidence for re-verification.

## Rules

- **Incremental only**: Update only artifacts identified by the impact report — never regenerate unrelated content
- **Evidence required**: Attach evidence for every changed claim
- **Preserve accuracy**: Don't modify correct existing content
- **Full remap trigger**: Require full graph remapping only for broad structural changes (major refactors, architecture changes)
- **No change records**: As a standalone synchronization capability, do not write `.changes/CHG-XXX-*` records
- **No product code**: Must not modify product code

## Quality Gates

- [ ] Impact report was consulted (or created) before syncing
- [ ] Only affected artifacts were modified
- [ ] Unrelated content was preserved unchanged
- [ ] Evidence citations were added for changed claims
- [ ] Graph updates used incremental mode (unless structural change required full remap)

## Cross-References

- Depends on: `change-detection-engine`, `impact-analysis-engine`, `graph-engine`
- Used by: `engineering-intelligence-skill`, `sync-engineering-intelligence` workflow
- Delegates to: `knowledge-sync-engine`, `memory-sync-engine`, `context-sync-engine`
- Integrates with: `staleness-detector` (freshness checks), `convention-detector` (convention sync)
