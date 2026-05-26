---
name: deep-project-knowledge-extractor
description: Analyzes an existing software repository and produces evidence-based architecture, runtime, API, infrastructure, risk, and onboarding documentation. Use when creating or refreshing the project knowledge base.
---

# Deep Project Knowledge Extractor

Inspect package/workspace manifests, source entrypoints, dependency boundaries, routes, schemas, middleware, tests, CI and infrastructure. Generate the structured documents in `knowledge-base/`.

Every material statement must be supported by repository evidence. Cite relevant paths in the documents. State `Not detected` or `Unclear from repository evidence` where appropriate.

Required documents:

- `00-project-overview.md` through `14-glossary.md`

Cover repository structure, architecture, runtime flow, APIs, persistence, authentication, frontend, backend, infrastructure, integrations, complex areas, technical debt, onboarding, and glossary.
