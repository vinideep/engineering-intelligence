> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
description: Incrementally synchronize intelligence artifacts for an identified change without modifying product code.
argument-hint: <scope, e.g. the current working-tree diff>
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
| Graphs | `graph-engine` (incremental) | Only affected nodes and edges |
| Reports | Impact report update | Add sync notes |

## Rules

- Standalone synchronization must not create `.changes/CHG-XXX-*` implementation records
- Must not modify product code
- Update only artifacts identified by the impact report
- Preserve accurate existing content in all artifacts


User supplied scope or request: $ARGUMENTS