---
name: impact-analysis-engine
description: Determines direct and indirect impact of a proposed or implemented change across modules, APIs, schemas, runtime flows, infrastructure, integrations, and tests. Use before implementation and during synchronization.
---

# Impact Analysis

Determine what can break before changing code. Analyze imports, callers, routes, data schemas, events, configuration, services, infrastructure, and existing tests.

Read `.engineering-intelligence/graph/` when available. If graphs are missing or stale for the assessed scope, invoke `graph-engine` to establish or refresh the necessary graph context.

Write a reusable `.engineering-intelligence/reports/IMP-XXX-<slug>.md` impact report containing:

- mode (`proposal` or `diff`) and inspected scope
- graph inputs consulted or refreshed
- directly affected files and systems
- indirect dependencies and risks
- required validation and tests
- documentation, memory, context, event, and graph artifacts affected by the change
- evidence, unknowns, and an explicit statement that impact analysis did not modify product code
