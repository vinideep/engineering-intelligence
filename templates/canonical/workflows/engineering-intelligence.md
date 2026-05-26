---
description: Implement an engineering request with impact analysis, tests, validation, and intelligence synchronization.
---

# Engineering Intelligence

Use the `engineering-intelligence-skill` capability for the user's accompanying request.

## Pipeline

1. **Read Intelligence** — Consult `knowledge-base/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, `.engineering-intelligence/graph/`
2. **Write Impact Report** — Create `.engineering-intelligence/reports/IMP-XXX-<summary>.md` before any code edit
3. **Implement** — Make the requested code changes following established patterns
4. **Test** — Add/update tests proportional to risk; execute and record results
5. **Validate** — Run available linters, type checks, and test suites
6. **Sync Intelligence** — Incrementally update only affected knowledge, memory, context, event, graph artifacts
7. **Record Change** — Write `.changes/CHG-XXX-<summary>.md` referencing related reports
8. **Review Gate** — For high-risk changes, run engineering-change review before completion

## Completion Report

Finish with:
- Code changes made (files, what changed)
- Tests run and results (pass/fail counts)
- Affected systems and services
- Synchronized intelligence artifacts
- Related reports (IMP-XXX, REV-XXX)
- Unresolved risks or follow-ups
