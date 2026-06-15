> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
description: Scope requirements and generate the final implementation prompt with the Product Analyst agent without modifying product code.
argument-hint: <requirement to scope>
---

# Scope Requirement

Use the `requirement-scoper` capability to interactively scope and document a user's requirement.

## Pipeline

1. **Read Context** — Read `knowledge-base/`, `$AIDLC`, `$EImemory/`, and `$EIgraph/` mapping files.
2. **Draft Questions** — Assess clarity level:
   - **Vague or Incomplete** (3+ ambiguities, unclear scope, or missing critical info): Use `question-file-engine` to write a structured MCQ clarification file at `$AIDLCopen-questions/`. Stop and wait for the user to fill answers and signal "questions answered, continue" before proceeding.
   - **Clear** (0–2 minor gaps): Ask 3–5 targeted questions inline and iterate.
3. **Iterate** — Wait for user responses (from question file or inline). Adjust assumptions based on answers.
4. **Document Scoping** — Create or update `knowledge-base/19-requirements.md` and `$AIDLCagile/` artifacts with goals, user stories, acceptance criteria, edge cases, dependencies, and the Q&A log.
5. **Finalize Prompt** — Output the exact `/engineering-intelligence` command required to build the ready story.

## Completion Report

Finish with:
- Summary of scoped requirements
- Location of the requirements document (`knowledge-base/19-requirements.md`)
- Agile artifacts updated under `$AIDLCagile/`
- The exact implementation command prompt

**Contract**: This workflow does not modify product code.


User supplied scope or request: $ARGUMENTS