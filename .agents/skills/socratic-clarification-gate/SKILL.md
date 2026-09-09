---
name: socratic-clarification-gate
description: Mandatory pre-flight alignment gate that assesses prompt clarity, identifies underspecified architectural constraints, poses concrete multiple-choice trade-offs, and freezes verified requirements into AI-DLC state before code modification.
---

# Socratic Clarification Gate

Never begin writing code or generating impact reports while requirements, non-functional constraints, or architectural trade-offs remain unverified.

## Execution Rules

1. **Assess Clarity First**: Call `assess_prompt_clarity` on the user prompt before exploring or editing files.
2. **Halt on Ambiguity**:
   - If clarity score is below 75 or blocking architectural ambiguities are detected (e.g. unspecified auth strategy, payment processor, caching tier, or schema evolution strategy): **STOP execution**.
   - Do NOT guess or assume the user's intent.
3. **Present Concrete Trade-offs**:
   - Present 2–4 targeted multiple-choice options highlighting trade-offs (e.g. Option A: JWT vs Option B: Server-side cookies).
   - If 1–2 ambiguities exist: pose them inline in the response.
   - If 3+ ambiguities exist: write a question file to `.engineering-intelligence/aidlc/open-questions/YYYYMMDD-<slug>.md` using `question-file-engine`.
4. **Freeze Requirements in AI-DLC**:
   - When the user answers, call `freeze_clarified_requirements` to lock decisions into `.engineering-intelligence/aidlc/inception/requirements.md`.
   - Update `.engineering-intelligence/aidlc/aidlc-state.md` and remove resolved items from `open-questions.md`.
5. **Phase Gate Enforcement**:
   - Call `check_aidlc_gate` with `phase: "inception"` before transitioning into Construction.
   - Construction is strictly blocked while unresolved blocking questions remain.
