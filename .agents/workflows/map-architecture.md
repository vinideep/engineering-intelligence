> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
description: Build or refresh evidence-backed architecture graph intelligence without changing product code.
---

# Map Architecture

Use the `graph-engine` capability.

Inspect repository evidence and generate or comprehensively refresh:

| Artifact | Content |
|---|---|
| `$EIgraph/dependency-graph.json` | Module/package dependency relationships |
| `$EIgraph/service-graph.json` | Service-to-service communication topology |
| `$EIgraph/runtime-graph.json` | Runtime call flows and middleware chains |
| `$EIgraph/business-flow-graph.json` | Business process flows across boundaries |
| `$EIgraph/architecture-map.md` | Mermaid diagrams derived from JSON graphs |

## Requirements

- Use stable node IDs across updates
- Mark every edge with `verified`, `inferred`, or `unknown` confidence
- Back every `verified` edge with evidence file paths
- List unresolved relationships in the `unknowns` array
- Derive Mermaid diagrams from JSON graph data — not hand-authored
- Update graph-connected navigation context when necessary

This workflow may update graph and context intelligence artifacts. It must not modify product code.
