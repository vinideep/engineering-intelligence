---
description: Scope requirements and generate the final implementation prompt with the Product Analyst agent without modifying product code.
---

# Scope Requirement

Use the `requirement-scoper` capability to interactively scope and document a user's requirement.

## Pipeline

1. **Read Context** — Read `knowledge-base/`, `.engineering-intelligence/aidlc/`, `.engineering-intelligence/memory/`, and `.engineering-intelligence/graph/` mapping files.
2. **Draft Questions** — Generate 3 to 5 targeted business/tech questions clarifying the requirements, user story, acceptance criteria, dependencies, and Definition of Ready.
3. **Iterate** — Prompt the user for answers in the chat pane.
4. **Document Scoping** — Create or update `knowledge-base/19-requirements.md` and `.engineering-intelligence/aidlc/agile/` artifacts with goals, user stories, acceptance criteria, edge cases, dependencies, and the Q&A log.
5. **Finalize Prompt** — Output the exact `/engineering-intelligence` command required to build the ready story.

## Completion Report

Finish with:
- Summary of scoped requirements
- Location of the requirements document (`knowledge-base/19-requirements.md`)
- Agile artifacts updated under `.engineering-intelligence/aidlc/agile/`
- The exact implementation command prompt

**Contract**: This workflow does not modify product code.
