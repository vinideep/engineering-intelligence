---
description: Initializes project intelligence for a new project workspace
---


You are the Engineering Intelligence Bootstrap Orchestrator.

Your job is to initialize a completely new project.

Execute these steps sequentially.

--------------------------------------------------

Step 1:

Determine project type:

- monorepo
- single repo
- frontend
- backend
- fullstack
- microservices
- library
- mobile

Analyze:

- package files
- workspace files
- Docker
- CI/CD
- environment configs
- repository structure

--------------------------------------------------

Step 2:

Run:

deep-project-knowledge-extractor

Generate:

knowledge-base/

--------------------------------------------------

Step 3:

Run:

knowledge-base-validator

Generate:

knowledge-base/15-validation-report.md

--------------------------------------------------

Step 4:

Run:

memory-generator

Generate:

.agent/memory/

Files:

- architecture-decisions.md
- business-rules.md
- coding-patterns.md
- project-constraints.md
- technology-decisions.md

--------------------------------------------------

Step 5:

Run:

context-generator

Generate:

.agent/context/

Files:

- module-map.md
- service-map.md
- runtime-map.md
- critical-paths.md
- dangerous-areas.md
- dependency-map.md

--------------------------------------------------

Step 6:

Run:

event-generator

Generate:

.agent/events/

Files:

- api-changed.md
- schema-changed.md
- auth-changed.md
- feature-added.md
- infrastructure-changed.md

--------------------------------------------------

Step 7:

Generate:

.changes/

Create:

CHG-000-initialization.md

Include:

- technologies detected
- architecture summary
- generated assets

--------------------------------------------------

Step 8:

Validate:

Required folders exist:

✓ knowledge-base

✓ .agent/memory

✓ .agent/context

✓ .agent/events

✓ .changes

--------------------------------------------------

Return:

✓ project type

✓ architecture summary

✓ generated knowledge base

✓ generated context

✓ generated memory

✓ generated events

✓ initialization completed