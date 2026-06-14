---
description: Analyze the impact of a proposed change or existing diff and write an evidence-backed impact report without changing product code.
argument-hint: <intended change or diff to analyze>
---

# Analyze Impact

Use `change-detection-engine`, `impact-analysis-engine`, and `graph-engine` when graph intelligence is missing or stale.

## Input

Analyze the user-supplied scope: proposed change description, working-tree diff, commit/range, or explicit changed paths. If the scope is ambiguous, ask for clarification instead of assuming.

## Output

Write `.engineering-intelligence/reports/IMP-XXX-<slug>.md` covering:

| Section | Content |
|---|---|
| Analysis mode & scope | `proposal` or `diff`, what was examined |
| Graph inputs | Graphs consulted, refreshed, or missing |
| Direct impact | Files and systems directly affected |
| Indirect impact | Downstream dependencies and consumers |
| Risk assessment | Risk level with justification |
| Validation needs | Tests and checks required |
| Intelligence artifacts | Knowledge, memory, context, events, and graphs needing sync |
| Evidence | File path citations for all claims |
| Unknowns | Areas where impact is uncertain |

## Rules

- Ask for scope clarification when ambiguous — never assume
- Consult graph intelligence before tracing impact manually
- Score risk with evidence-based justification
- This workflow may write intelligence reports or refresh necessary graph context
- It must not modify product code


User supplied scope or request: $ARGUMENTS