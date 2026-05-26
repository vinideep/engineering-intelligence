---
name: engineering-change-review
description: Reviews changed implementation, tests, impact analysis, graph consistency, and synchronized project intelligence without applying fixes. Use after engineering changes or before completion.
---

# Engineering Change Review

Review changed code and tests against the request, impact report, validation evidence, graph artifacts, and synchronized intelligence.

Write `.engineering-intelligence/reports/REV-XXX-<slug>.md` with:

- findings first, ordered by severity
- code and evidence paths
- regression, validation, graph-staleness, and documentation-staleness risks
- test gaps and unresolved questions
- a short reviewed-change summary only after findings

This review capability may write its report. It must not modify product code or auto-fix findings.
