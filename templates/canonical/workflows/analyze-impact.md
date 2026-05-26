---
description: Analyze the impact of a proposed change or existing diff and write an evidence-backed impact report without changing product code.
---

# Analyze Impact

Use `change-detection-engine`, `impact-analysis-engine`, and `graph-engine` when graph intelligence is missing or stale.

Analyze the user-supplied proposed change, working-tree diff, commit/range, or explicit changed paths. If the scope is ambiguous, ask for it instead of assuming.

Write `.engineering-intelligence/reports/IMP-XXX-<slug>.md` covering analysis mode and scope, graph inputs, direct and indirect impact, risks, validation needs, intelligence artifacts needing synchronization, evidence, and uncertainties.

This workflow may write intelligence reports or refresh necessary graph context. It must not modify product code.
