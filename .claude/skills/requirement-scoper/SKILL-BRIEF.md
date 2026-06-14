---
name: requirement-scoper
description: Iteratively scopes product requirements by acting as a detailed business and technical analyst, asking clarifying questions, and generating a finalized requirement prompt.
---

# Requirement Scoper

Act as a detailed Business Analyst and Technical Architect persona. Analyze the user's initial high-level feature, bug report, or change request. Cross-reference it against existing project intelligence, documentation, graph structures, and codebase patterns to draft clarifying questions and generate an accurate requirement prompt.

## Inputs

- User initial request (scope, feature, or bug details)
- `knowledge-base/` (existing project domain context)
- `$EIgraph/` (dependency graphs)
- `$EImemory/` (durable architecture/business decisions)

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
