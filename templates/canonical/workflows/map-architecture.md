---
name: map-architecture
description: Build or refresh evidence-backed architecture graph intelligence without changing product code.
---

# Map Architecture

Use the `graph-engine` capability.

Inspect repository evidence and generate or comprehensively refresh:

| Artifact | Content |
|---|---|
| `.engineering-intelligence/graph/dependency-graph.json` | Module/package dependency relationships |
| `.engineering-intelligence/graph/service-graph.json` | Service-to-service communication topology |
| `.engineering-intelligence/graph/runtime-graph.json` | Runtime call flows and middleware chains |
| `.engineering-intelligence/graph/business-flow-graph.json` | Business process flows across boundaries |
| `.engineering-intelligence/graph/architecture-map.md` | Mermaid diagrams derived from JSON graphs |

## Requirements

- EI's normalized graphs are canonical. Graphify code-only output may corroborate or enrich them; CCE's internal graph is not an authority.
- Apply the shared EI file policy and reject secrets, generated output, provider caches, vendored code, benchmark fixtures, and path/symlink escapes.
- Use stable node IDs across updates
- Mark every edge with `verified`, `inferred`, or `unknown` confidence
- Preserve provider/version, commit, source hash/span, extraction class, freshness, and trust state on provider-derived relationships
- Mark conflicts `contested`; exclude stale evidence and prevent provider-only/unverifiable edges from supporting claims
- Back every `verified` edge with evidence file paths
- List unresolved relationships in the `unknowns` array
- Derive Mermaid diagrams from JSON graph data — not hand-authored
- Update graph-connected navigation context when necessary
- Report provider health and native fallback explicitly

This workflow may update graph and context intelligence artifacts. It must not modify product code.
