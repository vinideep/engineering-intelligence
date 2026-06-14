---
name: codebase-discovery-engine
description: Autonomously explores and deeply understands a codebase before asking any questions. Scans repo structure, identifies tech stack with confidence scores, builds architecture hypotheses, maps entry points, detects conventions, analyzes git history, and produces a structured discovery report. Invoke when onboarding to a new repository or when deep understanding is required.
---

# Codebase Discovery Engine

Autonomously explore and understand a codebase with minimal human interaction. The engine operates in four phases: automated discovery, hypothesis verification, targeted clarification, and confidence reporting. The goal is to build a comprehensive mental model of the project before asking any questions.

## Inputs

- Repository root path (current working directory by default)
- Optional: scope constraints (specific package, service, directory, or monorepo workspace)
- Optional: depth limit (shallow = top-level only, deep = full recursive analysis)

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
