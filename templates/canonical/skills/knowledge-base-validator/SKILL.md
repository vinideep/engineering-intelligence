---
name: knowledge-base-validator
description: Validates project knowledge documentation against source and configuration evidence, identifying stale, unsupported, or uncertain claims. Use after initialization or documentation synchronization.
---

# Knowledge Base Validator

Read `knowledge-base/*.md`, identify significant claims, and verify them against code, config, infrastructure, and tests.

Write `knowledge-base/15-validation-report.md` with:

- supported, partially supported, unsupported, and unclear findings
- evidence paths
- confidence and stale-documentation risks
- areas needing human review

Do not silently rewrite other knowledge documents; update them only as part of an explicit synchronization workflow.
