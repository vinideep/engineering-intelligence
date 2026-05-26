---
name: engineering-intelligence
description: Executes engineering changes with impact analysis, implementation, tests, validation, and incremental synchronization of project intelligence. Use for feature, bugfix, update, refactor, architecture, infrastructure, or security requests.
---

# Engineering Intelligence Workflow

Use this workflow for implementation requests after project intelligence has been initialized.

## Procedure

1. Read relevant files from `knowledge-base/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, and `.engineering-intelligence/graph/`. If missing, run the initialization capability first.
2. Classify the request and write a pre-change `.engineering-intelligence/reports/IMP-XXX-<summary>.md` impact report before editing.
3. Implement the requested change in the project code.
4. Add or update relevant tests and execute the appropriate validation available in the project.
5. Use incremental synchronization to update only affected knowledge-base, memory, context, event, graph, and report artifacts.
6. Create the next `.changes/CHG-XXX-<summary>.md` record referencing related impact and any review reports.
7. For high-risk changes, run engineering-change review before final reporting.
8. Report code changes, tests run, affected systems, synchronized documentation/graph artifacts, and unresolved risks.

Do not claim validation succeeded unless it ran successfully. Do not update unrelated documents merely to regenerate them.
