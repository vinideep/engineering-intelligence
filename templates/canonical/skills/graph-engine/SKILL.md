---
name: graph-engine
description: Builds and incrementally maintains evidence-backed dependency, service, runtime, and business-flow graph artifacts with a human-readable architecture map. Use during initialization, explicit architecture mapping, or changes that affect relationships.
---

# Graph Engine

Generate project graph intelligence under `.engineering-intelligence/graph/`:

- `dependency-graph.json`: modules, packages, shared libraries, imports, and dependency relationships
- `service-graph.json`: deployable services, databases, queues, external integrations, and communication links
- `runtime-graph.json`: startup, request, job, and event execution paths
- `business-flow-graph.json`: verified business/user workflows and participating code or services
- `architecture-map.md`: Mermaid diagrams and human-readable interpretation of the JSON graphs

## Graph JSON Contract

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
      "evidence": ["<file path or configuration evidence>"]
    }
  ],
  "edges": [
    {
      "from": "<node id>",
      "to": "<node id>",
      "relation": "<relationship>",
      "confidence": "verified | inferred | unknown",
      "evidence": ["<file path or configuration evidence>"]
    }
  ],
  "unknowns": ["<unconfirmed relationship or flow>"]
}
```

## Rules

- Keep node IDs stable across incremental updates while the represented element still exists.
- Never mark an edge `verified` without evidence paths.
- Distinguish inferred and unknown relationships clearly.
- Derive Mermaid diagrams in `architecture-map.md` from the JSON graph content.
- Rebuild all graphs on initialization, explicit mapping, or when structural impact cannot be bounded.
- For ordinary changes, update only impacted nodes, edges, maps, and connected context documents.

This capability may write intelligence artifacts. It must not modify product code.
