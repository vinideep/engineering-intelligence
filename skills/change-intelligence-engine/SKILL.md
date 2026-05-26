---
name: change-intelligence-engine
description: Detects affected systems after code changes.
tools:
  - Read
  - Grep
  - Glob
  - Write
---

# Objective

Analyze changed files and determine impact.

Detect:
- APIs
- schemas
- services
- runtime flow
- business rules
- documentation impact

Generate:
.changes/CHG-XXX.md
