---
name: impact-analysis-engine
description: Determines direct and indirect impact of a proposed or implemented change across modules, APIs, schemas, runtime flows, infrastructure, integrations, and tests. Use before implementation and during synchronization.
version: 3.0.0
---

# Impact Analysis Engine

Determine what can break before changing code. Produce a reusable impact report that guides implementation, testing, and synchronization decisions.

## Inputs

- Change scope from `change-detection-engine` (proposal description, diff, commit range, or file list)
- Graph intelligence from `.engineering-intelligence/graph/` (when available)
- Project intelligence from `.engineering-intelligence/knowledge-base/` and `.engineering-intelligence/`

## Procedure

1. **Resolve Scope** — Accept the change scope. If ambiguous, ask for clarification — never assume.

2. **Consult Graphs** — Read `.engineering-intelligence/graph/` for dependency, service, runtime, and business-flow relationships. If graphs are missing or stale for the assessed scope, invoke `graph-engine` to establish or refresh the necessary graph context.

3. **Trace Direct Impact** — Identify:
   - Files directly modified or proposed for modification
   - Functions, classes, types, and interfaces changed
   - TypeScript interfaces, type aliases, enums, declaration files, Python annotations, Pydantic/dataclass models, and other typed contracts changed
   - API contracts affected (routes, request/response shapes)
   - Database schemas or migrations affected
   - Configuration changes

   For typed languages, invoke `type-safety-engine` in dependency-tracing mode. Add type-only dependencies as `imports-type` edges in `dependency-graph.json` and include them in direct impact when the changed symbol is a shared type or annotation.

4. **Trace Indirect Impact** — Using graph intelligence, identify:
   - Downstream consumers of changed modules (from dependency-graph)
   - Services communicating with changed services (from service-graph)
   - Runtime flows passing through changed code (from runtime-graph)
   - Business processes affected (from business-flow-graph)
   - Data pipelines affected (from data-flow-graph)
   - Test suites covering affected code
   - Cross-reference with git change coupling data from `git-intelligence-engine` for hidden dependencies
   - Query paths referencing changed schema fields from schema-to-query mapping
   - API clients or contract tests affected by additive, deprecated, or breaking API changes

5. **Traverse Sensitive Data Paths** — Query `data-flow-graph.json` for sensitive-source to sensitive-sink reachability involving the changed scope. Sensitive data propagation to unencrypted channels, logs, analytics events, prompt/RAG memory, or unvalidated sinks escalates risk and becomes a security finding in the impact report.

6. **Trace Transitive Impact** — Follow 2nd and 3rd order effects through the graph. Identify files that are indirectly affected by consumers of the directly affected modules. Walk the dependency chain until impact attenuates or reaches a service boundary.

7. **Score Risk** — Assign risk based on:

| Factor | Low | Medium | High | Critical |
|---|---|---|---|---|
| **Blast radius** | 1–2 files | 3–10 files | 10+ files | Cross-service |
| **Data impact** | None | Read paths | Write paths | Schema migration |
| **Auth impact** | None | UI changes | Permission logic | Auth flow |
| **API contract** | None | Additive | Deprecated | Breaking |
| **Test coverage** | Well-tested | Partial | Sparse | None |
| **Change coupling** | None | Low (1-2 coupled files) | Medium (3-5 coupled files) | High (6+ coupled files) |
| **Hot path** | Cold path | Normal | Critical path | Revenue/security/SLO path |

8. **Identify Validation Needs** — Map impact to required validation:

| Impact Area | Validation Required |
|---|---|
| API contract change | Integration tests, contract tests |
| Schema change | Migration test, rollback test |
| Auth change | Security test, permission matrix |
| Runtime flow change | End-to-end test |
| UI change | Visual regression, accessibility |
| Infrastructure | Deploy to staging, smoke test |

9. **Map Intelligence Artifacts** — Determine which intelligence artifacts need synchronization after the change is implemented.

> **Surprise Impact Detection**: Flag any dependency discovered during analysis that is NOT in the current graph. Submit the edge to `graph-engine` incremental mode as an `inferred` edge with evidence so the graph learns from the surprise. Surprise impacts must also be reported in the Unknowns section of the impact report until the graph update is complete.

## Output Format

Write `.engineering-intelligence/reports/IMP-XXX-<slug>.md`:

```markdown
# IMP-XXX: <descriptive title>

## Meta
- Generated: <ISO timestamp>
- Mode: proposal | diff
- Scope: <description of what was analyzed>
- Risk: low | medium | high | critical

## Graph Inputs
- Consulted: <list of graph artifacts read>
- Refreshed: <list of graphs rebuilt, if any>
- Missing: <graphs not available>

## Direct Impact
| File/Module | Change Type | Dependency Type | Risk |
|---|---|---|---|
| path/to/file.ts | Modified function `handleAuth` | runtime call | high |
| path/to/types.ts | Modified interface `User` | imports-type | high |

## Indirect Impact
| Affected Area | Relationship | Confidence |
|---|---|---|
| UserService | Imports changed module | verified |
| /api/users endpoint | Calls modified handler | inferred |

## Contract And Data Impact
| Surface | Classification | Required Gate |
|---|---|---|
| API <name> | additive | api-backward-compatibility-engine |
| Table.column | schema-to-query impact | database-migration-safety-engine |
| Sensitive data path | unencrypted sink | security-audit-engine |

## Risk Assessment
- Overall risk: <level>
- Key risk factors: <list>
- Mitigations: <recommended actions>

## Validation Requirements
- [ ] <specific test or check needed>

## Intelligence Artifacts Affected
| Artifact | Reason |
|---|---|
| .engineering-intelligence/knowledge-base/04-api-documentation.md | API contract changed |
| .engineering-intelligence/graph/service-graph.json | New service dependency |

## Evidence
- <file path citations>

## Unknowns
- <uncertain impact areas>

---
*This impact analysis did not modify product code.*
```

## Rules

- Never assume scope — ask when ambiguous
- Always consult available graphs before tracing impact manually
- Risk scoring must be justified with evidence
- The output report is reusable by `incremental-sync-engine` and `engineering-change-review`
- This capability is analytical only — it must not modify product code

## Quality Gates

- [ ] Scope is explicitly stated (not assumed)
- [ ] Graph inputs are listed (consulted, refreshed, or missing)
- [ ] Direct and indirect impact are separated
- [ ] Type-level dependencies are traced for typed languages
- [ ] API and schema/query impact are classified when relevant
- [ ] Sensitive data path traversal was performed for data-flow changes
- [ ] Surprise impacts were submitted to graph-engine incremental mode
- [ ] Risk score is justified with evidence
- [ ] Validation requirements are specific (not generic)
- [ ] Report ends with the "did not modify product code" statement

## Cross-References

- Depends on: `change-detection-engine`, `graph-engine`, `git-intelligence-engine`, `type-safety-engine`
- Consults: `data-flow-graph.json` (for data pipeline impact)
- Consults: `api-backward-compatibility-engine`, `database-migration-safety-engine` when contracts or schemas change
- Used by: `engineering-intelligence-skill`, `incremental-sync-engine`, `analyze-impact` workflow
- Consumed by: `engineering-change-review`, `testing-intelligence-engine`
