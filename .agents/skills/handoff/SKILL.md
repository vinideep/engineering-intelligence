---
name: handoff
description: Serialize active conversation context, verified facts, working tree diffs, and pending actions into a durable handoff packet for seamless session transfer.
---

# Handoff

Use the `session-handoff-engine` capability to package the current execution state into a portable, resumeable handoff artifact.

## Pipeline

1. **Scan In-Flight Changes** — Inspect working tree status, modified files, and active task progress.
2. **Classify Claims** — Separate machine-verified repository facts (`[VERIFIED: path#lines]`) from unverified assumptions (`[ASSUMPTION]`).
3. **Write Handoff Artifact** — Generate `.engineering-intelligence/handoffs/HO-YYYYMMDD-<task-slug>.md` with task summary, ground truth, modified files, and next immediate steps.
4. **Output Continuity Instructions** — Provide the exact command for a new session or agent to resume without context loss.

## Completion Report

Finish with:
- Location of the generated handoff document
- Summary of verified ground truth vs. pending work
- Resume command for the next agent/session

**Contract**: This workflow does not modify product code.
