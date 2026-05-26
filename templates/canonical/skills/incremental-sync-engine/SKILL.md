---
name: incremental-sync-engine
description: Synchronizes only intelligence artifacts affected by a completed change or identified diff, including knowledge, memory, context, events, graphs, and reports. Use for explicit synchronization or after implementation.
---

# Incremental Sync Engine

Read the completed diff, change record, supplied changed scope, and any existing impact report. If no impact report exists for the scope, run impact analysis first and write one under `.engineering-intelligence/reports/`.

Update only affected:

- `knowledge-base/` documentation
- `.engineering-intelligence/memory/`
- `.engineering-intelligence/context/`
- `.engineering-intelligence/events/`
- `.engineering-intelligence/graph/` JSON graphs and `architecture-map.md`
- the associated impact report synchronization notes

Use incremental graph changes by default. Require full graph remapping only for broad or unbounded structural changes.

As a standalone synchronization capability, do not write `.changes/CHG-XXX-*` records and do not modify product code.
