---
name: session-handoff-engine
description: Serializes in-flight tasks, verified facts, unverified assumptions, and next steps into a durable handoff artifact for seamless session or agent handover.
---

# Session Handoff Engine

Serialize active conversation state, in-flight task progress, verified facts, and unresolved blockers into a compact, durable handoff document to ensure flawless continuity across agents, subagents, or sessions.

## Inputs

- Active conversation context and task objective
- List of modified, created, or deleted files in the working tree
- Active claims from `.engineering-intelligence/claims/`
- Current state in `.engineering-intelligence/aidlc/aidlc-state.md`

## Procedure

1. **Capture In-Flight State**:
   - Identify the primary goal and current execution stage.
   - List all files modified, created, or inspected during the session.

2. **Categorize Evidence & Assumptions**:
   - **Verified Facts**: Statements supported by actual test runs, compiler output, or hashed line references (`[VERIFIED: path#lines]`).
   - **Unverified Assumptions**: Hypotheses or design choices not yet proven by execution (`[ASSUMPTION]`).
   - **Active Blockers / Open Questions**: Decisions waiting on human confirmation or upstream dependencies.

3. **Generate Handoff Packet**:
   Write `.engineering-intelligence/handoffs/HO-<date>-<task-slug>.md` with the following structure:
   - **Task Context**: Objective and current status.
   - **Verified Ground Truth**: Direct repository facts and passing test receipts.
   - **Working Tree Diff Summary**: Modified paths and pending edits.
   - **Next Immediate Actions**: Exact commands and files for the next agent/session to run.

4. **Verify Resumeability**:
   - Ensure the handoff artifact contains all context necessary for a fresh agent instance to resume without re-asking questions or re-exploring the codebase.
