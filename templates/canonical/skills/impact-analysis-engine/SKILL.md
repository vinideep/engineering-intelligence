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
- Project intelligence from `knowledge-base/` and `.engineering-intelligence/`

## Procedure

1. **Resolve Scope** — Accept the change scope. If ambiguous, ask for clarification — never assume.

2. **Consult Graphs** — Read `.engineering-intelligence/graph/` for dependency, service, runtime, and business-flow relationships. If graphs are missing or stale for the assessed scope, invoke `graph-engine` to establish or refresh the necessary graph context.

3. **Trace Direct Impact** — Identify:
   - Files directly modified or proposed for modification
   - Functions, classes, types, and interfaces changed
   - API contracts affected (routes, request/response shapes)
   - Database schemas or migrations affected
   - Configuration changes

4. **Trace Indirect Impact** — Using graph intelligence, identify:
   - Downstream consumers of changed modules (from dependency-graph)
   - Services communicating with changed services (from service-graph)
   - Runtime flows passing through changed code (from runtime-graph)
   - Business processes affected (from business-flow-graph)
   - Data pipelines affected (from data-flow-graph)
   - Test suites covering affected code
   - Cross-reference with git change coupling data from `git-intelligence-engine` for hidden dependencies

5. **Trace Transitive Impact** — Follow 2nd and 3rd order effects through the graph. Identify files that are indirectly affected by consumers of the directly affected modules. Walk the dependency chain until impact attenuates or reaches a service boundary.

6. **Score Risk** — Assign risk based on:

| Factor | Low | Medium | High | Critical |
|---|---|---|---|---|
| **Blast radius** | 1–2 files | 3–10 files | 10+ files | Cross-service |
| **Data impact** | None | Read paths | Write paths | Schema migration |
| **Auth impact** | None | UI changes | Permission logic | Auth flow |
| **API contract** | None | Additive | Deprecated | Breaking |
| **Test coverage** | Well-tested | Partial | Sparse | None |
| **Change coupling** | None | Low (1-2 coupled files) | Medium (3-5 coupled files) | High (6+ coupled files) |

7. **Identify Validation Needs** — Map impact to required validation:

| Impact Area | Validation Required |
|---|---|
| API contract change | Integration tests, contract tests |
| Schema change | Migration test, rollback test |
| Auth change | Security test, permission matrix |
| Runtime flow change | End-to-end test |
| UI change | Visual regression, accessibility |
| Infrastructure | Deploy to staging, smoke test |

8. **Map Intelligence Artifacts** — Determine which intelligence artifacts need synchronization after the change is implemented.

> **Surprise Impact Detection**: Flag any dependency discovered during analysis that is NOT in the current graph — these are surprise impacts that should be added to the graph. Surprise impacts indicate missing edges or nodes and must be reported in the Unknowns section of the impact report.

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
| File/Module | Change Type | Risk |
|---|---|---|
| path/to/file.ts | Modified function `handleAuth` | high |

## Indirect Impact
| Affected Area | Relationship | Confidence |
|---|---|---|
| UserService | Imports changed module | verified |
| /api/users endpoint | Calls modified handler | inferred |

## Risk Assessment
- Overall risk: <level>
- Key risk factors: <list>
- Mitigations: <recommended actions>

## Validation Requirements
- [ ] <specific test or check needed>

## Intelligence Artifacts Affected
| Artifact | Reason |
|---|---|
| knowledge-base/04-api-documentation.md | API contract changed |
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
- [ ] Risk score is justified with evidence
- [ ] Validation requirements are specific (not generic)
- [ ] Report ends with the "did not modify product code" statement

## Cross-References

- Depends on: `change-detection-engine`, `graph-engine`, `git-intelligence-engine`
- Consults: `data-flow-graph.json` (for data pipeline impact)
- Used by: `engineering-intelligence-skill`, `incremental-sync-engine`, `analyze-impact` workflow
- Consumed by: `engineering-change-review`, `testing-intelligence-engine`
