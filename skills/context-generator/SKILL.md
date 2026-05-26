---
name: context-generator
description: Generates AI-readable navigation context.
tools:
  - Read
  - Grep
  - Glob
  - Write
---

# Objective

Generate:

.agent/context/

Files:

- module-map.md
- service-map.md
- runtime-map.md
- critical-paths.md
- dangerous-areas.md
- dependency-map.md

Analyze:

- imports
- runtime flow
- architecture
- business logic
