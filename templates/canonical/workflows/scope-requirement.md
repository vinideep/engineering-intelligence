---
description: Scope requirements and generate the final implementation prompt with the Product Analyst agent without modifying product code.
---

# Scope Requirement

Use the `requirement-scoper` capability to interactively scope and document a user's requirement.

## Pipeline

1. **Read Context** — Read `knowledge-base/`, `.engineering-intelligence/memory/`, and `.engineering-intelligence/graph/` mapping files.
2. **Draft Questions** — Generate 3 to 5 targeted business/tech questions clarifying the requirements.
3. **Iterate** — Prompt the user for answers in the chat pane.
4. **Document Scoping** — Create or update `knowledge-base/19-requirements.md` with goals, logic configuration, edge cases, UI structures, and the Q&A log.
5. **Finalize Prompt** — Output the exact `/engineering-intelligence` command required to build the feature.

## Completion Report

Finish with:
- Summary of scoped requirements
- Location of the requirements document (`knowledge-base/19-requirements.md`)
- The exact implementation command prompt

**Contract**: This workflow does not modify product code.
