---
name: debugging-engine
description: Performs structured root cause analysis using graph intelligence, log correlation, error propagation tracing, and reproduction step generation. Produces evidence-backed debug reports with fix suggestions and impact analysis.
---

# Debugging Engine

Systematically diagnose issues through evidence-driven root cause analysis, leveraging graph intelligence to trace error propagation and suggest fixes with assessed impact.

## Inputs

- Bug report or error description (symptoms, error messages, stack traces)
- Repository root path
- Graph intelligence from `$EIgraph/` (when available)
- Project intelligence from `knowledge-base/` and `$EI`
- Optional: log output, reproduction steps from reporter, environment details

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
