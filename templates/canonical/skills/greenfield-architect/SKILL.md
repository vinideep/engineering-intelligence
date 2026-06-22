---
name: greenfield-architect
description: Interview-based skill for new greenfield projects. Conducts a structured requirements interview (7-12 questions), generates architecture recommendations with tech stack selection, and scaffolds a complete project with pre-filled knowledge base, memory, context, configuration, CI/CD, and environment setup.
version: 3.0.0
---

# Greenfield Architect

Guide a developer from zero to a fully scaffolded, opinionated project with engineering intelligence pre-configured. This skill operates in three phases: requirements interview, architecture generation, and scaffold output.

## Inputs

- Project name
- Optional: partial requirements (if the user already knows some answers)
- Optional: preferred tech stack constraints (e.g., "must use Python", "no React")

## Phase 1: Requirements Interview (7–12 Questions)

Ask questions in this order. Skip questions the user has already answered. Present sensible defaults where possible so the user can simply confirm.

### 1.1 Core Questions (Always Ask)

| # | Question | Why It Matters | Default |
|---|---|---|---|
| 1 | **What are you building?** Describe the product in 2-3 sentences. | Determines domain, complexity, core features | — |
| 2 | **Who are the users?** (internal team, B2B, B2C, developers/API consumers) | Determines auth complexity, UI needs, scale expectations | B2C web app |
| 3 | **What are the 3-5 core features?** List the must-have capabilities for v1. | Scopes the architecture, identifies bounded contexts | — |
| 4 | **What scale do you expect?** (hobby, startup MVP, growth stage, enterprise) | Determines infrastructure complexity, database choice, caching needs | Startup MVP |
| 5 | **Where will this run?** (Vercel, AWS, GCP, Azure, self-hosted, edge) | Determines deployment strategy, serverless vs containers | Vercel |
| 6 | **Solo developer or team?** How many developers, what experience levels? | Determines convention strictness, CI complexity, review process | Solo |
| 7 | **Any hard tech constraints?** (must use language X, must integrate with Y, must comply with Z) | Constrains tech stack selection | None |

### 1.2 Conditional Questions (Ask Based on Answers)

| # | Condition | Question | Default |
|---|---|---|---|
| 8 | Users = B2C or B2B | **Auth requirements?** (email/password, social login, SSO, MFA) | Email/password + social |
| 9 | Scale ≥ growth | **Real-time features?** (WebSockets, SSE, live updates) | No |
| 10 | Features include payments | **Payment provider preference?** (Stripe, PayPal, custom) | Stripe |
| 11 | Team > 1 | **Monorepo or polyrepo?** | Monorepo if > 2 services |
| 12 | Features include content | **CMS needs?** (headless CMS, built-in, markdown) | Markdown/MDX |

### Interview Rules

- Present each question with the default value: "I'd suggest X because Y — does that work?"
- Allow batch answers: the user can answer multiple questions at once
- If the user provides a project brief, extract answers from it before asking remaining questions
- Never ask more than 12 questions total
- Confirm the full requirements summary before proceeding to Phase 2

## Phase 2: Architecture Generation

Based on interview answers, generate architecture recommendations.

### 2.1 Tech Stack Selection

Use this decision matrix to recommend a tech stack:

| Requirement | Next.js | Vite+React | Solid.js | Express | FastAPI | Django | Spring Boot |
|---|---|---|---|---|---|---|---|
| SSR/SSG needed | ✅ Best | ❌ SPA only | ⚠️ SolidStart | N/A | N/A | ✅ Templates | N/A |
| API-only backend | ❌ Overkill | N/A | N/A | ✅ Best | ✅ Best | ✅ Good | ✅ Best |
| Full-stack | ✅ Best | ⚠️ Need backend | ⚠️ Emerging | ⚠️ Need frontend | ⚠️ Need frontend | ✅ Good | ⚠️ Need frontend |
| Real-time | ⚠️ Via API routes | ⚠️ Need backend | ⚠️ Need backend | ✅ Socket.io | ✅ WebSockets | ⚠️ Channels | ✅ WebSocket |
| Enterprise/Java team | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Best |
| Python team | ❌ | ❌ | ❌ | ❌ | ✅ Best | ✅ Best | ❌ |
| Rapid prototyping | ✅ Good | ✅ Good | ⚠️ Smaller ecosystem | ✅ Good | ✅ Best | ✅ Good | ❌ Slower |
| Edge deployment | ✅ Best | ✅ Good | ✅ Good | ⚠️ Node only | ❌ | ❌ | ❌ |

Present the recommendation with reasoning: "I recommend X because [reasons based on your answers]."

### 2.2 Database Selection

| Requirement | PostgreSQL | MySQL | MongoDB | SQLite | DynamoDB |
|---|---|---|---|---|---|
| Relational data | ✅ Best | ✅ Good | ❌ | ✅ Good | ❌ |
| Document-heavy | ⚠️ JSONB | ⚠️ JSON | ✅ Best | ❌ | ✅ Good |
| Hobby/MVP | ✅ Good | ✅ Good | ✅ Good | ✅ Best | ⚠️ Overkill |
| Enterprise scale | ✅ Best | ✅ Good | ✅ Good | ❌ | ✅ Best |
| Serverless | ⚠️ Need pooling | ⚠️ Need pooling | ✅ Atlas | ✅ Turso/Litestream | ✅ Native |

### 2.3 Folder Structure Generation

Generate an opinionated folder structure based on the selected stack. Example for Next.js:

```
project-root/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Auth route group
│   │   ├── (dashboard)/        # Dashboard route group
│   │   ├── api/                # API routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # Reusable UI primitives
│   │   └── features/           # Feature-specific components
│   ├── lib/                    # Shared utilities
│   ├── server/                 # Server-only code
│   │   ├── db/                 # Database client & queries
│   │   ├── auth/               # Auth configuration
│   │   └── services/           # Business logic
│   └── types/                  # Shared type definitions
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .github/
│   └── workflows/
├── .engineering-intelligence/knowledge-base/             # Pre-filled engineering intelligence
├── .engineering-intelligence/
│   ├── memory/
│   ├── context/
│   ├── events/
│   ├── graph/
│   └── reports/
├── engineering.config.json
├── .env.example
└── ...config files
```

### 2.4 ADR Generation

Generate initial Architectural Decision Records for key choices:

| ADR | Content |
|---|---|
| `ADR-001-tech-stack.md` | Why this framework/language was chosen |
| `ADR-002-database.md` | Why this database and ORM were chosen |
| `ADR-003-auth.md` | Why this auth strategy was chosen |
| `ADR-004-deployment.md` | Why this deployment target was chosen |
| `ADR-005-testing.md` | Why this testing strategy was chosen |
| `ADR-006-project-structure.md` | Why this folder structure was chosen |

Each ADR follows the format:
```markdown
# ADR-NNN: <Title>

## Status: Accepted
## Date: <date>

## Context
<what prompted this decision>

## Decision
<what was decided>

## Consequences
<positive and negative impacts>

## Alternatives Considered
<what else was evaluated and why it was rejected>
```

### 2.5 CI/CD Generation

Generate CI/CD configuration based on deployment target:

| Deployment | CI/CD Tool | Pipeline Stages |
|---|---|---|
| Vercel | GitHub Actions + Vercel | Lint → Type Check → Test → Preview Deploy → Prod Deploy |
| AWS | GitHub Actions + AWS CDK/SAM | Lint → Test → Build → Staging Deploy → Prod Deploy |
| GCP | GitHub Actions + Cloud Build | Lint → Test → Build → Cloud Run Deploy |
| Self-hosted | GitHub Actions + Docker | Lint → Test → Build Image → Push → Deploy |

### 2.6 Testing Strategy

| Test Type | Tool | What to Test | Coverage Target |
|---|---|---|---|
| Unit | Jest/Vitest/pytest | Business logic, utilities, pure functions | 80% |
| Integration | Supertest/httpx/Spring Test | API endpoints, database queries, auth flows | Key paths |
| E2E | Playwright/Cypress | Critical user journeys (signup, core feature, payment) | Happy paths |
| Component | Testing Library/Storybook | UI components in isolation | Key components |

## Phase 3: Scaffold Output

Generate all files for the new project.

### 3.1 Configuration Files

| File | Content |
|---|---|
| `engineering.config.json` | Project metadata, tech stack, conventions, sync settings |
| `.env.example` | All required environment variables with placeholder values and comments |
| `tsconfig.json` / `pyproject.toml` / etc. | Language-appropriate config with strict settings |
| `.eslintrc` / `ruff.toml` / etc. | Linter config matching conventions |
| `.prettierrc` / etc. | Formatter config |
| `.gitignore` | Comprehensive gitignore for the selected stack |

### 3.2 Pre-filled Knowledge Base

Generate starter versions of all knowledge base documents (00–16) with:
- Architecture decisions from Phase 2 as content
- `**Not yet implemented**` for areas that will be built
- Evidence citations pointing to generated config files
- Conventions from Phase 2 decisions pre-populated in `16-conventions.md`

### 3.3 Pre-filled Memory

| Memory File | Pre-filled Content |
|---|---|
| `architecture-decisions.md` | ADRs from Phase 2 |
| `technology-decisions.md` | Tech stack rationale |
| `coding-patterns.md` | Conventions chosen during scaffold |
| `project-constraints.md` | Scale, deployment, team constraints from interview |
| `business-rules.md` | Core features and domain concepts from interview |

### 3.4 Pre-filled Context

| Context File | Pre-filled Content |
|---|---|
| `module-map.md` | Planned module structure from folder layout |
| `critical-paths.md` | Core feature flows identified in interview |

### 3.5 Event Guidance

Generate starter event guidance files with generic templates appropriate for the chosen stack.

### 3.6 Engineering Config

```json
{
  "project": "<name>",
  "version": "0.1.0",
  "stack": {
    "language": "<primary language>",
    "framework": "<framework>",
    "database": "<database>",
    "orm": "<orm>",
    "auth": "<auth solution>",
    "deployment": "<deployment target>"
  },
  "conventions": {
    "naming": "<chosen naming convention>",
    "testing": "<chosen test strategy>",
    "branching": "<chosen git strategy>"
  },
  "intelligence": {
    "initialized": true,
    "initializedAt": "<timestamp>",
    "method": "greenfield-architect"
  }
}
```

## Procedure

1. **Greet and assess** — Check if the user has provided any upfront context. Extract answers from any provided brief.
2. **Run interview** — Ask Phase 1 questions, skipping any already answered. Present defaults.
3. **Summarize requirements** — Present a complete requirements summary and get confirmation.
4. **Select tech stack** — Apply Phase 2 decision matrices. Present recommendation with reasoning.
5. **Get stack approval** — Allow the user to override any recommendation.
6. **Generate folder structure** — Create the directory layout based on approved stack.
7. **Generate ADRs** — Write ADR documents for each major decision.
8. **Generate CI/CD** — Create pipeline configuration for the deployment target.
9. **Generate configs** — Create all configuration files (linter, formatter, tsconfig, etc.).
10. **Generate knowledge base** — Pre-fill all knowledge base documents.
11. **Generate memory** — Pre-fill memory with decisions and constraints.
12. **Generate context** — Pre-fill context with planned module structure.
13. **Generate event guidance** — Create starter event guidance templates.
14. **Write engineering.config.json** — Create the project configuration file.
15. **Create .env.example** — List all required environment variables.
16. **Report** — Summarize everything generated and list next steps for the developer.

## Quality Gates

- [ ] Requirements interview asked between 7 and 12 questions
- [ ] Requirements summary was confirmed before architecture generation
- [ ] Tech stack recommendation includes reasoning tied to interview answers
- [ ] At least 5 ADRs are generated for major decisions
- [ ] Folder structure matches the selected framework's conventions
- [ ] CI/CD pipeline includes at minimum: lint, test, build, deploy stages
- [ ] `.env.example` lists all required environment variables with descriptions
- [ ] Knowledge base documents (00–16) are pre-filled with scaffolded content
- [ ] Memory files contain only durable decisions (not transient implementation details)
- [ ] `engineering.config.json` exists with complete project metadata
- [ ] Testing strategy is defined with tool selection and coverage targets
- [ ] All generated files use evidence citations pointing to other generated files

## Cross-References

- Uses: `codebase-discovery-engine` (for post-scaffold verification)
- Feeds into: `initialize-intelligence-skill` (provides the initial knowledge baseline)
- Consumed by: `engineering-intelligence-skill`, `engineering-orchestrator`
- Related: `convention-detector` (validates conventions after initial development)
