---
name: pr-intelligence-engine
description: Generates intelligent PR descriptions, reviewer suggestions, impact summaries, and split recommendations from change records and git intelligence. Use before submitting or reviewing pull requests.
---

# PR Intelligence Engine

Produce evidence-backed PR artifacts that accelerate review cycles and improve change quality.

## Inputs

- Change records from `.changes/CHG-XXX-*.md`
- Git diff or commit range for the PR
- Ownership mapping from `git-intelligence-engine` (`$EIreports/GIT-intelligence.md`)
- Impact report from `impact-analysis-engine` (when available)
- Architecture decisions from `knowledge-base/`

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
