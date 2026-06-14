---
name: convention-detector
description: Detects and codifies project conventions by analyzing naming patterns, import organization, code structure, API patterns, test patterns, git conventions, and architecture patterns. Produces a conventions document and enhances coding-patterns memory.
---

# Convention Detector

Systematically analyze a codebase to detect, classify, and document conventions that are implicitly followed but not explicitly written down. Conventions are inferred from statistical patterns across the codebase — a pattern must appear in >70% of relevant files to be classified as a convention.

## Inputs

- Repository root path
- Optional: scope constraints (specific package, service, or directory)
- Optional: output from `codebase-discovery-engine` (tech stack, framework, file patterns)

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
