---
name: question-file-engine
description: Writes structured MCQ clarification files to $AIDLCopen-questions/ instead of asking questions inline. Creates durable decision artifacts and enables context reset between question creation and answer processing. Use when a request has 3+ ambiguities or scope is unclear.
---

# Question File Engine

Write structured clarification question files rather than asking questions inline in chat. This pattern creates durable decision artifacts, lets users answer thoughtfully with full context visible, and enables a context reset between question creation and answer processing — so each phase starts with a fresh focused context.

## Inputs

- Original request or initiative description
- Ambiguity analysis from calling skill (requirement-scoper, backlog-decomposition-engine)
- Optional: project architecture from `knowledge-base/`, `$EI graph/`

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
