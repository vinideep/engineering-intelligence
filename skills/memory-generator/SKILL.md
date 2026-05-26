---
name: memory-generator
description: Generates and updates persistent project memory.
tools:
  - Read
  - Grep
  - Glob
  - Write
  - Edit
---

# Objective

Generate:

.agent/memory/

Files:

- architecture-decisions.md
- business-rules.md
- coding-patterns.md
- project-constraints.md
- technology-decisions.md

Rules:

Only include:

- long-term project knowledge
- architectural decisions
- constraints
- business rules

Never include:

- temporary implementation details
- generated routes
- runtime traces
