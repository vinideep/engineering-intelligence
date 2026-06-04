---
name: graph-engine
description: Builds and maintains evidence-backed JSON architecture graphs and Mermaid architecture maps representing project dependencies, services, runtime flows, and business processes.
version: 3.0.0
---

# Graph Engine

Build and maintain structured, evidence-backed architecture graphs that enable impact analysis, dependency tracing, and architectural understanding.

## Inputs

- Repository root path
- Mode: `full` (initialization/remapping) or `incremental` (post-change update)
- Optional: scope constraints for incremental updates

## Graph Artifacts

All graphs are stored in `.engineering-intelligence/graph/`.

### Graph JSON Schema

Each JSON graph uses this envelope:

```json
{
  "schemaVersion": 1,
  "graphType": "dependency | service | runtime | business-flow",
  "generatedAt": "<ISO timestamp>",
  "scope": "<repository/package/scope examined>",
  "nodes": [
    {
      "id": "<stable identifier>",
      "kind": "<graph-specific kind>",
      "label": "<human name>",
      "path": "<repository path when applicable>",
      "confidence": "verified | inferred | unknown",
      "metadata": {},
      "evidence": ["<file path or configuration evidence>"]
    }
  ],
  "edges": [
    {
      "from": "<node id>",
      "to": "<node id>",
      "relation": "<relationship>",
      "confidence": "verified | inferred | unknown",
      "metadata": {},
      "evidence": ["<file path or configuration evidence>"]
    }
  ],
  "unknowns": ["<unconfirmed relationship or flow>"]
}
```

### 1. `dependency-graph.json` — Module/Package Dependencies

| Node Kind | Description |
|---|---|
| `package` | npm/pip/cargo/go package |
| `module` | Internal code module or directory |
| `config` | Configuration file or env dependency |
| `external` | Third-party library or service SDK |

| Edge Relation | Description |
|---|---|
| `imports` | Direct import/require dependency |
| `devDependency` | Development-only dependency |
| `peerDependency` | Peer/optional dependency |
| `configures` | Configuration dependency |
| `implicit-dependency` | Shared database tables, shared config |
| `event-coupling` | Event-driven coupling |
| `imports-type` | Type-only or annotation-level dependency between interfaces, aliases, declarations, schemas, or annotations |
| `co-change` | Git history coupling above confidence threshold |

### 2. `service-graph.json` — Service Communication Topology

| Node Kind | Description |
|---|---|
| `service` | Deployable service or process |
| `database` | Data store (SQL, NoSQL, cache) |
| `queue` | Message queue or event bus |
| `gateway` | API gateway or load balancer |
| `external-api` | Third-party API endpoint |

| Edge Relation | Description |
|---|---|
| `http` | HTTP/REST communication |
| `grpc` | gRPC communication |
| `publishes` | Event/message publishing |
| `subscribes` | Event/message consumption |
| `reads` | Data store read access |
| `writes` | Data store write access |
| `shares-data` | Shared database/cache |
| `feature-flag` | Feature-flag-controlled behavior |

### 3. `runtime-graph.json` — Runtime Call Flows

| Node Kind | Description |
|---|---|
| `entrypoint` | Application entry point |
| `middleware` | Request middleware/interceptor |
| `handler` | Route handler or controller |
| `service-layer` | Business logic service |
| `repository` | Data access layer |
| `background` | Background job or worker |
| `function` | Function or method on a critical path |

| Edge Relation | Description |
|---|---|
| `calls` | Synchronous function/method call |
| `delegates` | Async delegation or queue dispatch |
| `wraps` | Middleware wrapping |
| `returns` | Response return path |

### 4. `business-flow-graph.json` — Business Process Flows

| Node Kind | Description |
|---|---|
| `user-action` | User-initiated action |
| `system-step` | System processing step |
| `decision` | Conditional branch point |
| `integration` | External system interaction |
| `outcome` | Terminal state or result |

| Edge Relation | Description |
|---|---|
| `triggers` | Causal trigger |
| `on-success` | Happy path flow |
| `on-failure` | Error/failure path |
| `requires` | Prerequisite relationship |

### 5. `data-flow-graph.json` — Data Transformation Graph

| Node Kind | Description |
|---|---|
| `source` | Data origin |
| `transform` | Processing step |
| `store` | Persistence |
| `sink` | Data output/consumer |
| `validator` | Validation step |
| `sensitive-source` | PII, token, payment, health, credential, or regulated data origin |
| `sensitive-sink` | Sink that persists, transmits, logs, or exports sensitive data |

| Edge Relation | Description |
|---|---|
| `feeds` | Data feed |
| `transforms` | Data transformation |
| `validates` | Data validation |
| `persists` | Data persistence |
| `emits` | Data emission/output |

### 6. `architecture-map.md` — Mermaid Visualization

Derive Mermaid diagrams from the JSON graphs. Include:

- **System Overview** — High-level service topology (from service-graph)
- **Module Dependencies** — Package/module dependency flow (from dependency-graph)
- **Request Flow** — Primary request lifecycle (from runtime-graph)
- **Key Business Flows** — Critical business processes (from business-flow-graph)
- **Data Flow** — Data transformation pipelines (from data-flow-graph)

## Procedure

### Full Mode (initialization or remapping)

1. Scan all package manifests, imports, route definitions, service configs, and infrastructure files
2. Build all five graphs from scratch
3. Assign `verified` confidence to edges backed by explicit code evidence
4. Assign `inferred` confidence to edges derived from patterns or naming conventions
5. Integrate git change coupling data from `git-intelligence-engine` as `co-change` edges when coupling strength is above `0.7`, confidence is `inferred`, and evidence cites commit ranges or reports
6. Build `imports-type` edges from type checker/compiler API evidence when typed languages are detected
7. Build function-level call graph nodes for critical paths in `runtime-graph.json`
8. Annotate runtime edges with `metadata.hotness` derived from `critical-paths.md`, test coverage frequency, and git co-change strength
9. Classify sensitive data nodes in `data-flow-graph.json` with `metadata.sensitivity` (`pii`, `token`, `payment`, `credential`, `health`, `regulated`, `none`) and track propagation to sinks
10. Mark unresolvable relationships as `unknown` and add to `unknowns` array
11. Generate Mermaid diagrams in `architecture-map.md`

### Incremental Mode (post-change update)

1. Accept changed files/scope from the impact report or diff
2. Identify affected nodes and edges across all graphs
3. Update, add, or remove only affected nodes and edges
4. Preserve stable node IDs — only change an ID if the represented element was renamed
5. Update `imports-type`, `co-change`, function call, hotness, and sensitive data annotations where affected
6. Re-derive affected sections of `architecture-map.md`
7. Require full remapping only when structural impact cannot be bounded

## Rules

- Keep node IDs stable across incremental updates while the represented element still exists
- Never mark an edge `verified` without evidence paths
- Distinguish `inferred` and `unknown` relationships clearly
- Derive Mermaid diagrams in `architecture-map.md` from the JSON graph content — never hand-author diagrams that contradict the JSON
- For ordinary changes, update only impacted nodes, edges, maps, and connected context documents
- Rebuild all graphs on initialization, explicit mapping request, or when structural impact cannot be bounded
- Do not add `co-change` edges below `0.7` coupling strength
- Sensitive data propagation to unencrypted channels, logs, or unvalidated sinks must become a security finding in the impact report

## Quality Gates

- [ ] All five JSON graphs (`dependency-graph.json`, `service-graph.json`, `runtime-graph.json`, `business-flow-graph.json`, `data-flow-graph.json`) validate against the schema above
- [ ] Every `verified` edge has at least one evidence path
- [ ] No `unknown` relationships are left out of the `unknowns` array
- [ ] `architecture-map.md` Mermaid diagrams are syntactically valid
- [ ] Node IDs are stable across incremental updates
- [ ] Type dependencies are represented as `imports-type` where applicable
- [ ] Co-change edges above `0.7` are represented or explicitly unavailable
- [ ] Runtime critical paths include function-level nodes where detectable
- [ ] Sensitive data nodes and propagation edges are annotated in `data-flow-graph.json`
- [ ] Hot path edges include `metadata.hotness` when evidence exists

## Cross-References

- Used by: `initialize-intelligence-skill`, `impact-analysis-engine`, `incremental-sync-engine`
- Supports: `map-architecture` workflow, `analyze-impact` workflow
- Feeds context to: `context-sync-engine`
- Integrates data from: `git-intelligence-engine`

This capability may write intelligence artifacts. It must not modify product code.
