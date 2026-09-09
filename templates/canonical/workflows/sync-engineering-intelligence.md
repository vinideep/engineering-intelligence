---
name: sync-engineering-intelligence
description: Incrementally synchronize intelligence artifacts for an identified change without modifying product code.
---

# Sync Engineering Intelligence

Use `change-detection-engine`, `impact-analysis-engine`, and `incremental-sync-engine`.

## Procedure

1. **Detect scope** — Read the supplied changed scope, diff, or completed change record
2. **Analyze impact** — Create an impact report first if none exists for this scope
3. **Synchronize deterministic evidence** — Call `sync_engineering_knowledge` to refresh/reconcile the EI graph, isolated provider indexes, and derived claims with native fallback when needed
4. **Sync canonical artifacts** — Update only affected intelligence:

| Artifact Type | Engine | Update Rule |
|---|---|---|
| Knowledge Base | `incremental-sync-engine` (Knowledge Base sync) | Only docs mapped to the change type |
| Memory | `incremental-sync-engine` (Memory sync) | Only if durable decisions changed |
| Context | `incremental-sync-engine` (Context sync) | Only affected navigation maps |
| Events | Direct update | Only if API/schema/auth contracts changed |
| Graphs | `graph-engine` (incremental) + CLI | Run `engineering-intelligence map . --update --files <changed-files>` to refresh the dependency graph, then apply `graph-engine` incremental update for service/runtime/business-flow graphs |
| Reports | Impact report update | Add sync notes |

## Rules

- Standalone synchronization must not create `.engineering-intelligence/changes/CHG-XXX-*` implementation records
- Must not modify product code
- Update only artifacts identified by the impact report
- Preserve accurate existing content in all artifacts
- Run `validate_change` after synchronization; do not re-record citation hashes to conceal drift
- Provider output remains supporting evidence and raw provider access remains expert-only
