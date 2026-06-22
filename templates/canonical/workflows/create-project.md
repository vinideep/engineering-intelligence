---
description: Create a new project from scratch with full AIDLC — from architectural interview through scaffolding, intelligence initialization, and convention detection.
---

# Create Project

Chain `greenfield-architect` → scaffold → `initialize-intelligence-skill` → `convention-detector` to produce a fully instrumented project with engineering intelligence from day one.

## Input

A description of the project to create: purpose, domain, technology preferences, and constraints. If insufficient context is provided, the architectural interview in step 1 will gather it.

## Output

A complete, scaffolded project with:

| Category | Content |
|---|---|
| Project scaffold | Directory structure, configuration, dependencies, build system |
| Knowledge Base | `.engineering-intelligence/knowledge-base/` — initialized project intelligence |
| Memory | `.engineering-intelligence/memory/` — initial decisions and patterns |
| Context | `.engineering-intelligence/context/` — AI navigation maps |
| Graphs | `.engineering-intelligence/graph/` — initial architecture graphs |
| Conventions | `.engineering-intelligence/knowledge-base/06-conventions-and-standards.md` — detected and configured conventions |
| Change Record | `.engineering-intelligence/changes/CHG-000-initialization.md` — project creation record |

## Execution Steps

1. **Architectural Interview** — Invoke `greenfield-architect` to conduct a structured interview:
   - Gather requirements: domain, scale, team size, deployment targets
   - Explore technology choices: language, framework, database, infrastructure
   - Define architecture: monolith vs microservices, API style, data patterns
   - Record decisions as ADRs in `.engineering-intelligence/knowledge-base/05-architecture-decisions.md`
   - Produce a project blueprint before proceeding

2. **Scaffold Project** — Based on the architectural blueprint:
   - Create directory structure following chosen conventions
   - Initialize package manifests and dependency management
   - Configure build system, linting, and formatting
   - Set up test infrastructure
   - Create initial CI/CD pipeline configuration
   - Add README, LICENSE, and contributing guidelines
   - Initialize git repository with initial commit

3. **Initialize Intelligence** — Invoke `initialize-intelligence-skill`:
   - Generate knowledge-base documents from the scaffolded project
   - Build initial architecture graphs
   - Create AI context and navigation maps
   - Write initialization change record (CHG-000)

4. **Detect Conventions** — Invoke `convention-detector`:
   - Codify the conventions established during scaffolding
   - Document naming patterns, file organization, and code style
   - Record testing conventions and patterns
   - Update `.engineering-intelligence/knowledge-base/06-conventions-and-standards.md`

## Rules

- Complete the architectural interview before scaffolding — do not assume technology choices
- Every architectural decision must be recorded as an ADR
- The scaffold must be functional — buildable and testable from the start
- Intelligence initialization must produce evidence-backed artifacts, not templates
- This workflow creates a new project and modifies the scaffolded project code
