---
description: Autonomously decompose a high-level initiative into a durable Epic to Feature to Ticket backlog with dependencies, execution order, and a per-feature approval gate, without modifying product code.
argument-hint: <initiative or epic-sized request to decompose>
---

# Decompose Backlog

Use the `backlog-decomposition-engine` capability to turn a high-level initiative into a complete, durable backlog. Optionally use `issue-tracker-sync-engine` to mirror the result to an external tracker.

## Input

Analyze the user-supplied initiative: a product brief, epic-sized request, or large feature description. If the intent, personas, or success criteria are ambiguous, ask focused questions or run discovery before decomposing — never assume.

## Pipeline

1. **Read Intelligence** — Consult `knowledge-base/`, `.engineering-intelligence/graph/`, `.engineering-intelligence/memory/`, and existing `.engineering-intelligence/aidlc/` artifacts.
2. **Decompose** — Run `backlog-decomposition-engine` to frame epics, slice features, and cut tickets with stable IDs (`EPIC-XXX`, `FEAT-XXX`, `TKT-XXX`).
3. **Write Backlog** — Create artifacts under `.engineering-intelligence/aidlc/agile/backlog/`: `backlog-index.md`, `epics/`, `features/`, `tickets/`, and `dependency-graph.md`. Keep `agile/product-backlog.md` and `execution-plan.md` consistent.
4. **Map Dependencies** — Emit a topological execution order and mark parallel-safe work in `dependency-graph.md`.
5. **Set Approval Gates** — Every feature is created with `Approval: pending`. No implementation occurs in this workflow.
6. **Optional Sync** — If the user requested it, or a GitHub remote is detected and sync is enabled, run `issue-tracker-sync-engine` and record `sync/tracker-sync-map.md`.

## Completion Report

Finish with:
- The created epics, features, and tickets with their IDs and statuses
- The execution order and any parallel-safe features
- The features awaiting approval (`Approval: pending`)
- The exact next command: `/deliver-backlog` to begin gated delivery, or `/deliver-backlog FEAT-XXX` for a specific feature

## Rules

- Ask for clarification when the initiative is ambiguous — never assume scope.
- Produce independently implementable tickets, each mapping to one `/engineering-intelligence` command.
- Keep `backlog-index.md` counters and the child files consistent.

**Contract**: This workflow plans and writes backlog artifacts only. It must not modify product code.


User supplied scope or request: $ARGUMENTS