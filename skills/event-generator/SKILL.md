---
name: event-generator
description: Detects project events and generates event definitions.
tools:
  - Read
  - Grep
  - Glob
  - Write
---

# Objective

Generate:

.agent/events/

Files:

- api-changed.md
- schema-changed.md
- auth-changed.md
- feature-added.md
- infrastructure-changed.md

Determine:

- Trigger
- Actions
- Affected docs
- Affected systems
