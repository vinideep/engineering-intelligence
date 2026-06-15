> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
description: Autonomously decompose a high-level initiative into a durable Epic to Feature to Ticket backlog with dependencies, execution order, and a per-feature approval gate, without modifying product code.
argument-hint: <initiative or epic-sized request to decompose>
---

# Decompose Backlog

Use the `backlog-decomposition-engine` capability to turn a high-level initiative into a complete, durable backlog. Optionally use `issue-tracker-sync-engine` to mirror the result to an external tracker.

## Input

Analyze the user-supplied initiative: a product brief, epic-sized request, or large feature description. If the intent, personas, or success criteria are ambiguous, ask focused questions or run discovery before decomposing — never assume.

## Pipeline

1. **Clarify Scope** — If the initiative description is vague or missing key decisions (target users, excluded scope, phasing, integration boundaries), use `question-file-engine` to write a structured clarification file at `$AIDLCopen-questions/`. Stop and wait for the user to fill answers and signal "questions answered, continue" before decomposing.
2. **Read Intelligence** — Consult `knowledge-base/`, `$EIgraph/`, `$EImemory/`, and existing `$AIDLC` artifacts.
3. **Decompose** — Run `backlog-decomposition-engine` to frame epics, slice features, and cut tickets with stable IDs (`EPIC-XXX`, `FEAT-XXX`, `TKT-XXX`).
4. **Write Backlog** — Create artifacts under `$AIDLCagile/backlog/`: `backlog-index.md`, `epics/`, `features/`, `tickets/`, and `dependency-graph.md`. Keep `agile/product-backlog.md` and `execution-plan.md` consistent.
5. **Map Dependencies** — Emit a topological execution order and mark parallel-safe work in `dependency-graph.md`.
6. **Set Approval Gates** — Every feature is created with `Approval: pending`. No implementation occurs in this workflow.
7. **Optional Sync** — If the user requested it, or a GitHub remote is detected and sync is enabled, run `issue-tracker-sync-engine` and record `sync/tracker-sync-map.md`.

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