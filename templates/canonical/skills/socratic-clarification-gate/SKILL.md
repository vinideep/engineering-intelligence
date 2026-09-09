---
name: socratic-clarification-gate
description: Mandatory pre-flight alignment gate that assesses prompt clarity, identifies underspecified architectural constraints, poses concrete multiple-choice trade-offs, and freezes verified requirements into AI-DLC state before code modification.
---

# Socratic Clarification Gate

Never begin writing code or generating impact reports while requirements, non-functional constraints, or architectural trade-offs remain unverified.

## Execution Rules

1. **Assess Clarity First**: Call `assess_prompt_clarity` on the user prompt before exploring or editing files.

2. **Happy Path (Clear Prompt)**:
   - If clarity score is **≥ 75** and no blocking architectural ambiguities are detected: proceed directly to the next pipeline step (impact analysis or implementation).
   - No questions needed. Log `[CLARITY: passed, score=<N>]` in the impact report.

3. **Halt on Ambiguity**:
   - If clarity score is **below 75** or blocking architectural ambiguities are detected (e.g. unspecified auth strategy, payment processor, caching tier, or schema evolution strategy): **STOP execution**.
   - Do NOT guess or assume the user's intent.

4. **Present Concrete Trade-offs**:
   - Present 2–4 targeted multiple-choice options highlighting trade-offs (e.g. Option A: JWT vs Option B: Server-side cookies).
   - If 1–2 ambiguities exist: pose them inline in the response.
   - If 3+ ambiguities exist: write a question file to `.engineering-intelligence/aidlc/open-questions/YYYYMMDD-<slug>.md` using `question-file-engine`.

5. **Freeze Requirements in AI-DLC**:
   - When the user answers with an option letter (A/B/C/D), map it to `selectedOptionId`.
   - When the user answers with free-form text instead of a letter, populate the `customText` field.
   - Call `freeze_clarified_requirements` with:
     ```
     {
       topic: "<feature or initiative topic>",
       decisions: [
         { questionId: "Q1", selectedOptionId: "A" },
         { questionId: "Q2", selectedOptionId: "B", customText: "user's elaboration" }
       ]
     }
     ```
     This writes decisions to `.engineering-intelligence/aidlc/inception/requirements.md`.
   - Call `update_aidlc_state` with `phase: "inception"`, `stage: "requirements-frozen"` to record the transition.
   - Mark resolved items in `open-questions.md` as `status: resolved` (do not delete them).

6. **Phase Gate Enforcement**:
   - Call `check_aidlc_gate` with `phase: "inception"` before transitioning into Construction.
   - If the gate returns `status: "blocked"`, read the `blockers` array, resolve each blocker, and re-run the gate. Construction is strictly blocked while unresolved blocking questions remain.

## Tools

- `assess_prompt_clarity`: Assess prompt ambiguity, missing NFRs, and architectural trade-offs. Returns `{ isClear, score, ambiguities, options }`.
- `freeze_clarified_requirements`: Lock user decisions into `inception/requirements.md`. Args: `topic` (string), `decisions` (array of `{ questionId, selectedOptionId, customText? }`).
- `check_aidlc_gate`: Validate phase exit criteria. Args: `phase` (enum: `discovery`, `inception`, `construction`, `operations`).
- `update_aidlc_state`: Transition lifecycle state. Args: `phase?`, `stage?`, `activeWorkflow?`, `activeHat?`, `activeUnit?`, `breadcrumb?`.

## Cross-References

- Depends on: `question-file-engine` (for 3+ ambiguities)
- Deeper analysis: `socratic-stress-tester` (for high-risk architectural stress-testing after clarity is established)
- Used by: `engineering-intelligence` (Step 3), `engineering-intelligence-skill` (Step 2), `engineering-orchestrator` (Pre-flight)
- Related: `aidlc-lifecycle-engine` (phase model and gate definitions)
