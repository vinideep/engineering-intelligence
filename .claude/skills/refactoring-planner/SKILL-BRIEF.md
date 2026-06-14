---
name: refactoring-planner
description: Plans safe refactors by identifying dependencies, migration steps, validation needs, compatibility risk, and rollback strategy. Use before non-trivial refactors.
---

# Refactoring Planner

Plan safe, incremental refactoring with clear migration steps, validation checkpoints, and rollback strategies.

## Inputs

- Refactoring goal (described by user or identified by architecture review)
- `$EIgraph/` (dependency relationships)
- `knowledge-base/12-technical-debt.md` (existing debt)
- `$EImemory/architecture-decisions.md` (constraints)

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
