---
name: knowledge-base-validator
description: Validates project knowledge documentation against source and configuration evidence, identifying stale, unsupported, or uncertain claims. Use after initialization or documentation synchronization.
version: 3.0.0
---

# Knowledge Base Validator

Systematically audit every significant claim in `knowledge-base/*.md` against actual repository evidence. Produce a structured validation report that identifies exactly what is supported, what is stale, and what needs human review.

## Inputs

- Repository root path with `knowledge-base/` present
- Optional: specific documents to validate (defaults to all)

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
