---
name: git-intelligence-engine
description: Extracts structural intelligence from git history — hotspot analysis, ownership mapping, change coupling, velocity tracking, and drift detection. Feeds graph intelligence and impact analysis with git-derived edges.
version: 3.0.0
---

# Git Intelligence Engine

Extract actionable intelligence from git history to reveal hidden dependencies, ownership patterns, and codebase evolution trends.

## Inputs

- Repository root path
- Mode: `full` (analyze complete history) or `incremental` (analyze since last run)
- Optional: time window (e.g., last 90 days, last 6 months)
- Optional: branch filter (specific branches to analyze)

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
