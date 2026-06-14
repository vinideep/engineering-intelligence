---
name: change-detection-engine
description: Determines analysis scope from a proposed engineering change, working-tree diff, commit range, or explicit changed files. Use before impact analysis, synchronization, or review.
---

# Change Detection Engine

Resolve the scope of a change into a structured representation that downstream skills (impact analysis, synchronization, review) can consume.

## Inputs

Accept exactly one of these input modes:
| Mode | Input | Example |
|---|---|---|
| `proposal` | User-described change request | "Add rate limiting to auth endpoints" |
| `working-diff` | Unstaged/staged working-tree diff | `git diff` or `git diff --cached` output |
| `commit` | Single commit hash | `abc1234` |

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
