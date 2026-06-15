---
description: Scope requirements and generate the final implementation prompt with the Product Analyst agent without modifying product code.
---

# Scope Requirement

Use the `requirement-scoper` capability to interactively scope and document a user's requirement.

## Pipeline

1. **Read Context** — Read `knowledge-base/`, `.engineering-intelligence/aidlc/`, `.engineering-intelligence/memory/`, and `.engineering-intelligence/graph/` mapping files.
2. **Draft Questions** — Assess clarity level:
   - **Vague or Incomplete** (3+ ambiguities, unclear scope, or missing critical info): Use `question-file-engine` to write a structured MCQ clarification file at `.engineering-intelligence/aidlc/open-questions/`. Stop and wait for the user to fill answers and signal "questions answered, continue" before proceeding.
   - **Clear** (0–2 minor gaps): Ask 3–5 targeted questions inline and iterate.
3. **Iterate** — Wait for user responses (from question file or inline). Adjust assumptions based on answers.
4. **Document Scoping** — Create or update `knowledge-base/19-requirements.md` and `.engineering-intelligence/aidlc/agile/` artifacts with goals, user stories, acceptance criteria, edge cases, dependencies, and the Q&A log.
5. **Finalize Prompt** — Output the exact `/engineering-intelligence` command required to build the ready story.

## Completion Report

Finish with:
- Summary of scoped requirements
- Location of the requirements document (`knowledge-base/19-requirements.md`)
- Agile artifacts updated under `.engineering-intelligence/aidlc/agile/`
- The exact implementation command prompt

**Contract**: This workflow does not modify product code.
