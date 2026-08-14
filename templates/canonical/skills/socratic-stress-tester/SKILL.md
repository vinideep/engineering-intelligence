---
name: socratic-stress-tester
description: Interactively interrogates architectural proposals, PRDs, trade-offs, security assumptions, and edge cases before coding. Use for pre-flight alignment.
version: 3.0.0
---

# Socratic Stress Tester

Interactively stress-test technical proposals, PRDs, or architecture plans using Socratic interrogation to uncover hidden assumptions, failure modes, and edge cases before implementation begins.

## Inputs

- Proposed plan, PRD, or architectural RFC
- Target scope or feature requirements
- Relevant ADRs and constraints from `.engineering-intelligence/knowledge-base/`
- Verified claims and active context maps from `.engineering-intelligence/context/`

## Procedure

1. **Deconstruct Proposal & Assumptions**:
   - Extract the core problem statement, primary solution path, and critical architectural assumptions.
   - Differentiate explicitly between verified repository evidence (`[VERIFIED: file#lines]`) and unverified assumptions (`[ASSUMPTION]`).

2. **Conduct the Socratic Gauntlet**:
   Challenge the proposal across five distinct failure categories:
   - **Boundary & Edge Conditions**: What happens at null, empty, extreme scale, high concurrency, or network partition?
   - **Failure Modes & Rollback**: If this change fails halfway through execution, how is state recovered or rolled back?
   - **Breaking Changes & Blast Radius**: What dependent services, API clients, or schema consumers are silently impacted?
   - **Non-Functional Requirements**: Does this meet latency, memory, authorization, and rate-limiting constraints?
   - **Simplification & YAGNI**: Can 80% of the value be delivered with 20% of the proposed complexity?

3. **Formulate High-Impact Probing Questions**:
   - Pose 2 to 4 concise, targeted questions focused strictly on unresolved ambiguities or high-risk trade-offs.
   - For each question, offer 2–3 viable paths with concrete pros and cons rather than open-ended ambiguity.

4. **Converge on Signed-Off Decisions**:
   - Once the user resolves the ambiguities, document the agreed decisions and trade-offs.
   - Update the proposal or PRD with explicit decision rationales before proceeding to implementation.
