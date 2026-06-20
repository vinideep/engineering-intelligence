---
description: Drive delivery of a decomposed backlog feature by feature, enforcing a human approval gate before implementing each feature, then implementing its tickets through the engineering intelligence pipeline.
---

# Deliver Backlog

Execute a backlog produced by `decompose-backlog`. This workflow **does** modify product code, one approved feature at a time. It uses `aidlc-lifecycle-engine` for durable state and `engineering-intelligence-skill` to implement each ticket.

## Input

Optional scope: a feature ID (`FEAT-XXX`) or epic ID (`EPIC-XXX`) to deliver. With no scope, select the next ready feature from the execution order in `.engineering-intelligence/aidlc/agile/backlog/dependency-graph.md`.

## Pipeline

1. **Load Backlog** — Read `backlog-index.md`, `dependency-graph.md`, and the relevant feature and ticket files. Resume from `aidlc-state.md`/`checkpoints.md` if a feature was already in progress.
2. **Select Feature** — Pick the highest-priority feature whose dependencies are `done`, honoring any user-supplied scope.
3. **Approval Gate (mandatory)** — If the feature's `Approval` is not `approved`:
   - Present the feature: user story, acceptance criteria, child tickets, affected files, risk, and execution order.
   - Ask the human to approve, request changes, or skip.
   - Record the decision in the feature file (`Approval: approved | changes-requested`) and append it to `aidlc/audit.md`.
   - Do **not** implement until `Approval: approved` is recorded. On `changes-requested`, return to `decompose-backlog` for that feature.
4. **Implement Tickets** — For each ticket in dependency order, when its Definition of Ready holds:
   - Mark the ticket `in-progress`.
   - Run the ticket's implementation command through `engineering-intelligence-skill` (impact report, delivery-mode selection, implementation, tests, safety gates, validation, sync, change record).
   - Mark the ticket `in-review`, then `done` once its Definition of Done is satisfied with evidence.
5. **Roll Up Status** — Update `backlog-index.md`, the feature status, and the epic status as tickets complete. A feature is `done` when all its tickets are `done`; an epic is `done` when all its features are `done`.
6. **Optional Sync** — If tracker sync is enabled, run `issue-tracker-sync-engine` so the external tracker reflects new statuses (closing issues for `done` work).
7. **Continue Or Stop** — After a feature completes, stop and report, or proceed to the next ready feature only if the user requested continuous delivery. Each new feature re-enters the approval gate.

## Stop Conditions

- A feature awaiting approval halts delivery until a human approves.
- Irreversible actions (database migrations, destructive changes, deletions) require explicit approval even within an approved feature.
- A hard blocker (failing safety gate that cannot be resolved, missing dependency) is logged in `open-questions.md` and halts the affected feature.

## Completion Report

Finish with:
- Features and tickets delivered this run with their final statuses
- Validation evidence per ticket (tests, type checks, scans run/failed/unavailable)
- Updated rollup in `backlog-index.md`
- The next ready feature awaiting approval, if any
- `AI-DLC: <phase> -> <stage> -> <status>` breadcrumb

## Rules

- Never implement a feature whose `Approval` is not `approved`.
- One feature at a time; re-enter the approval gate for every feature.
- Validate honestly through environmental backpressure; never claim success without execution.
- Keep backlog status, AI-DLC state, and any tracker mirror consistent.
