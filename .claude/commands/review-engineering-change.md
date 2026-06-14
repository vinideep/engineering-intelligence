---
description: Review changed engineering work, tests, graphs, and synchronized intelligence without applying fixes.
argument-hint: <scope, e.g. the current working-tree diff>
---

# Review Engineering Change

Use `change-detection-engine` and `engineering-change-review`.

## Procedure

1. **Detect scope** — Identify the implementation diff or changed scope
2. **Read context** — Load associated impact report, test evidence, and graph artifacts
3. **Review** — Inspect across five dimensions:

| Dimension | What to Check |
|---|---|
| Implementation | Correctness, request fulfillment, error handling |
| Tests | Coverage, execution, results, gaps |
| Architecture | Boundary respect, pattern compliance, dependency direction |
| Graph consistency | New/changed nodes and edges reflected |
| Documentation sync | Knowledge, memory, context accuracy |

4. **Write report** — Generate `.engineering-intelligence/reports/REV-XXX-<slug>.md` with:
   - Severity-ordered findings (🔴 Blocker → 🟢 Positive)
   - Evidence paths for each finding
   - Test gaps and coverage concerns
   - Stale-intelligence risks
   - Verdict: Approved / Approved with findings / Changes required

## Rules

- Do not modify product code
- Do not auto-fix findings — report only
- Include positive observations alongside issues
- Flag unrun validation honestly


User supplied scope or request: $ARGUMENTS