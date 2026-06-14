---
name: ongoing-learning-engine
description: Handles post-initialization continuous learning by detecting uncertainty, logging learning events, triggering targeted re-discovery, updating memory with newly learned patterns, tracking knowledge freshness scores, and enforcing staleness detection rules.
---

# Ongoing Learning Engine

Continuously maintain and improve the AI's understanding of a codebase after initial discovery. This engine activates whenever the AI encounters areas it does not understand, when code changes invalidate existing knowledge, or when knowledge freshness degrades below acceptable thresholds.

## Inputs

- Current task context (what the AI is trying to do when uncertainty is encountered)
- Repository root path
- Existing knowledge base, memory, and context documents
- Optional: specific module or area to re-learn
- Optional: trigger event (uncertainty, staleness, explicit request)

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
