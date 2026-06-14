---
name: backlog-decomposition-engine
description: Autonomously decomposes a high-level initiative into a durable Epic to Feature to Ticket backlog with stable IDs, acceptance criteria, dependencies, execution order, and a per-feature human approval gate. Use to plan large product work before implementation.
version: 1.0.0
---

# Backlog Decomposition Engine

Turn a single high-level initiative, product brief, or large request into a complete, durable, hierarchical backlog. This skill plans and structures work; it does **not** modify product code. Implementation happens later through `deliver-backlog` and `engineering-intelligence-skill`.

## Inputs

- The user's high-level initiative or request
- `knowledge-base/` (domain context)
- `$EIgraph/` (dependency, service, runtime, business-flow graphs)
- `$EImemory/` (durable architecture and business decisions)
- `$AIDLCdiscovery/vision.md` and `agile/product-backlog.md` when present

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
