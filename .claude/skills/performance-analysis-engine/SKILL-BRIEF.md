---
name: performance-analysis-engine
description: Identifies performance issues through static analysis of database query patterns, frontend bundle size, render performance, API response patterns, and caching opportunities. Use during initialization, before releases, or when performance-sensitive changes are detected.
version: 3.0.0
---

# Performance Analysis Engine

Identify performance risks and optimization opportunities through evidence-based static analysis of code patterns, queries, bundles, and caching strategies.

## Inputs

- Repository root path
- Mode: `full` (comprehensive analysis) or `targeted` (specific area or post-change)
- Optional: scope constraints (specific modules, change diff)
- Optional: previous assessment (`knowledge-base/21-performance-assessment.md`) for delta comparison

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
