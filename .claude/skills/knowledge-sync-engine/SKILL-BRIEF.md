---
name: knowledge-sync-engine
description: Incrementally synchronizes the project knowledge base after code changes, updating only documents affected by verified behavior changes. Use after implementation or architectural decisions.
version: 3.0.0
---

# Knowledge Synchronization

Update only the knowledge-base documents affected by a verified behavior change. Preserve accurate existing content — never regenerate entire documents.

## Inputs

- Persisted impact report (`$EIreports/IMP-XXX-*.md`)
- Actual diff or change record showing what changed
- Current `knowledge-base/` documents

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
