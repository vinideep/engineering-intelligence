---
description: Incrementally synchronize intelligence artifacts for an identified change without modifying product code.
---

# Sync Engineering Intelligence

Use `change-detection-engine`, `impact-analysis-engine`, and `incremental-sync-engine`.

Read the supplied changed scope, diff, or completed change record. Create an impact report first if none exists for that scope. Update only affected knowledge, memory, context, event, graph, and report artifacts.

Standalone synchronization must not create a `.changes/CHG-XXX-*` implementation record and must not modify product code.
