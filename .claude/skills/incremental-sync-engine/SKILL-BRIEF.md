---
name: incremental-sync-engine
description: Synchronizes only intelligence artifacts affected by a completed change or identified diff, including knowledge, memory, context, events, graphs, and reports. Use for explicit synchronization or after implementation.
---

# Incremental Sync Engine

Update only the intelligence artifacts affected by a specific change. Never regenerate unrelated content.

## Inputs

- Completed diff, change record, or supplied changed scope
- Existing impact report (`$EIreports/IMP-XXX-*.md`)
- If no impact report exists for the scope, run `impact-analysis-engine` first

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
