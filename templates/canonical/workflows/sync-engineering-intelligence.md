---
description: Incrementally synchronize intelligence artifacts for an identified change without modifying product code.
---

# Sync Engineering Intelligence

Use `change-detection-engine`, `impact-analysis-engine`, and `incremental-sync-engine`.

## Procedure

1. **Detect scope** — Read the supplied changed scope, diff, or completed change record
2. **Analyze impact** — Create an impact report first if none exists for this scope
3. **Sync artifacts** — Update only affected intelligence:

| Artifact Type | Engine | Update Rule |
|---|---|---|
| Knowledge Base | `knowledge-sync-engine` | Only docs mapped to the change type |
| Memory | `memory-sync-engine` | Only if durable decisions changed |
| Context | `context-sync-engine` | Only affected navigation maps |
| Events | Direct update | Only if API/schema/auth contracts changed |
| Graphs | `graph-engine` (incremental) + CLI | Run `engineering-intelligence map . --update --files <changed-files>` to refresh the dependency graph, then apply `graph-engine` incremental update for service/runtime/business-flow graphs |
| Reports | Impact report update | Add sync notes |

## Rules

- Standalone synchronization must not create `.changes/CHG-XXX-*` implementation records
- Must not modify product code
- Update only artifacts identified by the impact report
- Preserve accurate existing content in all artifacts
