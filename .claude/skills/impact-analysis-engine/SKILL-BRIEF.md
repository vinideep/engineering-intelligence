---
name: impact-analysis-engine
description: Determines direct and indirect impact of a proposed or implemented change across modules, APIs, schemas, runtime flows, infrastructure, integrations, and tests. Use before implementation and during synchronization.
---

# Impact Analysis Engine

Determine what can break before changing code. Produce a reusable impact report that guides implementation, testing, and synchronization decisions.

## Inputs

- Change scope from `change-detection-engine` (proposal description, diff, commit range, or file list)
- Graph intelligence from `$EIgraph/` (when available)
- Project intelligence from `knowledge-base/` and `$EI`

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
