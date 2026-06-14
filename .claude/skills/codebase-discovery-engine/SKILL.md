> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: codebase-discovery-engine
description: Autonomously explores and deeply understands a codebase before asking any questions. Scans repo structure, identifies tech stack with confidence scores, builds architecture hypotheses, maps entry points, detects conventions, analyzes git history, and produces a structured discovery report. Invoke when onboarding to a new repository or when deep understanding is required.
version: 3.0.0
---

# Codebase Discovery Engine

Autonomously explore and understand a codebase with minimal human interaction. The engine operates in four phases: automated discovery, hypothesis verification, targeted clarification, and confidence reporting. The goal is to build a comprehensive mental model of the project before asking any questions.

This capability does not modify product code.

## Inputs

- Repository root path (current working directory by default)
- Optional: scope constraints (specific package, service, directory, or monorepo workspace)
- Optional: depth limit (shallow = top-level only, deep = full recursive analysis)

## Outputs

- `$EIreports/DISCOVERY-report.md` — structured discovery findings with per-area confidence scores
- Feeds directly into `initialize-intelligence-skill` for knowledge base generation

---

## Phase 1: Automated Discovery (No User Interaction)

Execute ALL of the following scans silently. Do not prompt the user during this phase.

### 1.1 Repository Structure Scan

1. **File tree analysis** — Generate annotated directory tree (top 3 levels). Identify:
   - Source code directories vs configuration vs documentation vs generated output
   - Monorepo workspace boundaries
   - Hidden directories with significance (`.github`, `.gitlab`, `.circleci`, `.husky`, `.changeset`)
2. **File count distribution** — Count files by extension to determine primary and secondary languages
3. **Gitignore analysis** — Read `.gitignore` to understand build outputs, generated files, and secrets patterns
4. **Workspace root markers** — Identify the true project root vs nested project roots

### 1.2 Package Management Detection

Scan for ALL of the following package manifests and extract dependency information:

| Ecosystem | Manifest Files | Lock Files | What to Extract |
|---|---|---|---|
| **Node.js** | `package.json` | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb` | dependencies, devDependencies, scripts, workspaces, engines |
| **Go** | `go.mod`, `go.sum` | — | module path, Go version, require directives |
| **Rust** | `Cargo.toml` | `Cargo.lock` | dependencies, features, workspace members, edition |
| **Python** | `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements.txt`, `Pipfile`, `poetry.lock` | `poetry.lock`, `Pipfile.lock` | dependencies, python version, build system |
| **Java/Kotlin** | `pom.xml`, `build.gradle`, `build.gradle.kts`, `settings.gradle` | — | dependencies, plugins, modules, Java version |
| **Ruby** | `Gemfile`, `*.gemspec` | `Gemfile.lock` | gems, ruby version, groups |
| **PHP** | `composer.json` | `composer.lock` | require, autoload, scripts |
| **.NET** | `*.csproj`, `*.sln`, `Directory.Build.props` | — | PackageReference, TargetFramework |
| **Elixir** | `mix.exs` | `mix.lock` | deps, elixir version |
| **Swift** | `Package.swift` | `Package.resolved` | dependencies, targets |

### 1.3 Build System Identification

| Build Tool | Detection Files | What to Extract |
|---|---|---|
| **Webpack** | `webpack.config.*` | entry points, output config, loaders, plugins |
| **Vite** | `vite.config.*` | plugins, build target, SSR config |
| **Turbopack** | `turbo.json` (with Next.js) | — |
| **Turborepo** | `turbo.json` | pipeline tasks, cache config, workspace dependencies |
| **Nx** | `nx.json`, `project.json` | targets, executors, affected config |
| **Lerna** | `lerna.json` | versioning strategy, packages |
| **Bazel** | `WORKSPACE`, `BUILD`, `*.bzl` | targets, rules, dependencies |
| **Make** | `Makefile`, `GNUmakefile` | targets, phony targets, key variables |
| **Cargo** | `Cargo.toml` (already scanned) | build scripts, features |
| **Gradle** | `build.gradle*`, `gradlew` | tasks, plugins, subprojects |
| **Maven** | `pom.xml` (already scanned) | phases, plugins, profiles |
| **CMake** | `CMakeLists.txt` | targets, find_package calls |
| **pnpm workspaces** | `pnpm-workspace.yaml` | workspace packages |

### 1.4 Framework Detection

Identify frameworks with **confidence scores** by cross-referencing dependencies, file patterns, and configuration:

| Category | Frameworks to Detect | Key Signals |
|---|---|---|
| **Frontend** | Next.js, Nuxt, Remix, SvelteKit, Astro, Gatsby, Create React App, Vite+React, Vite+Vue, Vite+Svelte, Angular, Solid.js, Qwik | `next.config.*`, `nuxt.config.*`, `remix.config.*`, `svelte.config.*`, `astro.config.*`, `angular.json`, framework deps in package.json |
| **Backend** | Express, Fastify, Koa, Hono, NestJS, Django, Flask, FastAPI, Spring Boot, Rails, Phoenix, Gin, Fiber, Echo, ASP.NET | Framework imports in entry files, decorator patterns, config files |
| **Mobile** | React Native, Flutter, Swift UI, Jetpack Compose, Expo | `app.json`, `pubspec.yaml`, `*.swift`, `build.gradle` with Android plugins |
| **Desktop** | Electron, Tauri | `electron-builder.*`, `tauri.conf.json` |
| **Full-stack** | T3 Stack, Blitz.js, RedwoodJS, Wasp | Meta-framework config patterns |

### 1.5 Database & ORM Detection

| ORM / DB Tool | Detection Signals |
|---|---|
| **Prisma** | `prisma/schema.prisma`, `@prisma/client` in deps |
| **TypeORM** | `typeorm` in deps, `ormconfig.*`, entity decorators |
| **Drizzle** | `drizzle-orm` in deps, `drizzle.config.*` |
| **Sequelize** | `sequelize` in deps, `.sequelizerc`, migration dirs |
| **Mongoose** | `mongoose` in deps, schema definitions |
| **SQLAlchemy** | `sqlalchemy` in deps, `alembic/` dir, model files |
| **Django ORM** | `models.py` in Django apps, `DATABASES` in settings |
| **Hibernate** | `hibernate.cfg.xml`, JPA annotations |
| **ActiveRecord** | `db/migrate/`, `app/models/`, Rails conventions |
| **Knex** | `knex` in deps, `knexfile.*`, migration dirs |
| **MikroORM** | `@mikro-orm/*` in deps, `mikro-orm.config.*` |
| **Diesel** | `diesel` in Cargo.toml, `diesel.toml`, migrations dir |
| **GORM** | `gorm.io/gorm` in go.mod |
| **Ent** | `entgo.io/ent` in go.mod, `ent/schema/` dir |
| **Raw SQL** | `.sql` files, query builder usage without ORM |
| **Database engines** | Connection strings, Docker services: PostgreSQL, MySQL, MongoDB, Redis, SQLite, DynamoDB, Cassandra, CockroachDB |

### 1.6 Authentication Detection

| Auth Solution | Detection Signals |
|---|---|
| **NextAuth / Auth.js** | `next-auth` in deps, `[...nextauth].ts`, `auth.config.*` |
| **Passport.js** | `passport` in deps, strategy configurations |
| **JWT patterns** | `jsonwebtoken` / `jose` in deps, token signing/verification code |
| **OAuth / OpenID** | OAuth client configs, redirect URIs, provider setup |
| **SAML** | `passport-saml`, SAML metadata files |
| **Clerk** | `@clerk/*` in deps, Clerk middleware |
| **Auth0** | `@auth0/*` in deps, Auth0 config |
| **Supabase Auth** | `@supabase/supabase-js` with auth usage |
| **Firebase Auth** | `firebase/auth` imports |
| **Keycloak** | Keycloak adapter configs |
| **Custom auth** | Hand-rolled middleware with session/token logic |
| **RBAC/ABAC** | Role definitions, permission matrices, guard patterns |

### 1.7 CI/CD Detection

| CI/CD Platform | Detection Files | What to Extract |
|---|---|---|
| **GitHub Actions** | `.github/workflows/*.yml` | Jobs, triggers, matrix strategies, secrets refs |
| **GitLab CI** | `.gitlab-ci.yml` | Stages, jobs, rules, includes |
| **Jenkins** | `Jenkinsfile` | Pipeline stages, agents, post actions |
| **CircleCI** | `.circleci/config.yml` | Jobs, workflows, orbs |
| **Travis CI** | `.travis.yml` | Language, stages, deploy |
| **Azure Pipelines** | `azure-pipelines.yml` | Stages, pools, templates |
| **Bitbucket Pipelines** | `bitbucket-pipelines.yml` | Steps, caches, deployments |
| **Drone CI** | `.drone.yml` | Steps, triggers, volumes |
| **Vercel** | `vercel.json` | Build config, rewrites, functions |
| **Netlify** | `netlify.toml` | Build command, plugins, redirects |
| **Railway** | `railway.json`, `Procfile` | Start commands, services |
| **Render** | `render.yaml` | Services, build/start commands |

### 1.8 Infrastructure Detection

| Infrastructure | Detection Signals |
|---|---|
| **Docker** | `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-compose.*.yml` |
| **Kubernetes** | `k8s/`, `kubernetes/`, `*.yaml` with `apiVersion: apps/v1`, Helm charts (`Chart.yaml`) |
| **Terraform** | `*.tf`, `.terraform/`, `terraform.tfstate` |
| **Pulumi** | `Pulumi.yaml`, `Pulumi.*.yaml` |
| **CDK** | `cdk.json`, `lib/*-stack.ts` |
| **CloudFormation** | `template.yaml` with `AWSTemplateFormatVersion` |
| **Ansible** | `ansible.cfg`, `playbooks/`, `roles/` |
| **Serverless** | `serverless.yml`, `serverless.ts` |
| **SST** | `sst.config.ts` |

### 1.9 Testing Detection

| Testing Tool | Detection Signals | What to Extract |
|---|---|---|
| **Jest** | `jest.config.*`, `jest` in deps | Test file patterns, coverage config, transforms |
| **Vitest** | `vitest.config.*`, `vitest` in deps | Test file patterns, coverage |
| **Mocha** | `.mocharc.*`, `mocha` in deps | Reporter, timeout, spec patterns |
| **pytest** | `pytest.ini`, `pyproject.toml [tool.pytest]`, `conftest.py` | Markers, fixtures, plugins |
| **JUnit** | `@Test` annotations, JUnit deps in build files | Test runners, assertion libs |
| **RSpec** | `.rspec`, `spec/`, `spec_helper.rb` | Configuration, shared contexts |
| **Go test** | `*_test.go` files | Test functions, benchmarks, table-driven tests |
| **Rust test** | `#[test]`, `#[cfg(test)]` | Unit vs integration test organization |
| **Cypress** | `cypress.config.*`, `cypress/` | E2E specs, component tests, fixtures |
| **Playwright** | `playwright.config.*` | Test projects, browsers, base URL |
| **Testing Library** | `@testing-library/*` in deps | Which framework variant (React, Vue, etc.) |
| **Storybook** | `.storybook/`, `*.stories.*` | Addons, framework, static dirs |
| **Supertest** | `supertest` in deps | API integration test patterns |

### 1.10 Documentation & Existing Knowledge

1. Read `README.md` — extract project description, setup instructions, architecture notes
2. Scan `docs/` directory — identify existing architecture docs, API docs, guides
3. Read `CONTRIBUTING.md` — extract development workflow, code standards, PR process
4. Read `CHANGELOG.md` — understand release cadence, versioning strategy
5. Read `ADR/` or `adr/` or `docs/decisions/` — existing architectural decision records
6. Scan inline comments — look for `TODO`, `FIXME`, `HACK`, `XXX`, `NOTE` patterns
7. Read `LICENSE` — identify license type

### 1.11 Git History Analysis

1. **Hotspot analysis** — Identify the 20 most-changed files via `git log --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20`
2. **Change velocity** — Commits per week/month over the last 6 months
3. **Primary contributors per module** — `git shortlog -sn -- <path>` for major directories
4. **Recent activity** — Files changed in the last 30 days (indicates active development areas)
5. **Large commits** — Identify bulk refactors or migrations from git history
6. **Branch patterns** — `git branch -r` to understand branching strategy (feature branches, release branches, trunk-based)
7. **Tag/release pattern** — `git tag --sort=-creatordate | head -10` to understand versioning cadence

### 1.12 Monorepo Detection

| Tool | Detection Signal |
|---|---|
| **Nx** | `nx.json`, `project.json` in subdirectories |
| **Turborepo** | `turbo.json` with `pipeline` |
| **Lerna** | `lerna.json` |
| **pnpm workspaces** | `pnpm-workspace.yaml` |
| **Yarn workspaces** | `workspaces` field in root `package.json` |
| **npm workspaces** | `workspaces` field in root `package.json` + npm lock |
| **Cargo workspaces** | `[workspace]` section in root `Cargo.toml` |
| **Go workspaces** | `go.work` file |
| **Bazel** | `WORKSPACE` + multiple `BUILD` files |

When a monorepo is detected:
- Enumerate all workspace packages/apps
- Identify shared libraries vs applications
- Map inter-package dependency graph
- Identify independent vs coupled packages

---

## Phase 2: Hypothesis Verification

After automated discovery, classify every finding by confidence level:

### Confidence Classification Rules

| Level | Score | Action | Example |
|---|---|---|---|
| **HIGH** | >85% | State as fact with evidence | "The project uses Next.js 14 with App Router (evidence: `next.config.mjs`, `app/` directory structure, `next` v14.2.3 in package.json)" |
| **MEDIUM** | 50–85% | Present as belief with reasoning | "I believe the project uses a modular monolith pattern because modules communicate via direct imports rather than HTTP/events, and there are clear directory boundaries — correct?" |
| **LOW** | <50% | Ask a direct question | "I see Redis in docker-compose but no Redis client in dependencies. Is Redis used in production, or is it only for development?" |

### Confidence Scoring Heuristic

- **Config file explicitly declares it** → 95% confidence
- **Dependency present + matching file patterns** → 85% confidence
- **Dependency present but no matching usage found** → 60% confidence
- **File patterns suggest it but no dependency** → 50% confidence
- **Inferred from indirect evidence only** → 30% confidence
- **Single ambiguous signal** → 15% confidence

---

## Phase 3: Targeted Clarification (Maximum 5–10 Questions)

After Phases 1 and 2, ask ONLY questions that cannot be answered from code evidence. Group them into these categories:

### 3.1 Business Domain
- What is the core business domain? What problem does this solve for users?
- Are there domain-specific terms or jargon the team uses?

### 3.2 Deployment & Environments
- Where is this deployed? (cloud provider, region, multi-region?)
- What environments exist? (dev, staging, preview, production)
- What is the deployment process? (manual, CD, blue-green, canary)

### 3.3 Team Conventions
- What is the code review process? (required approvals, automated checks)
- What is the release cadence? (continuous, weekly, sprints)
- Are there unwritten rules not captured in linters or configs?

### 3.4 Pain Points & Tech Debt
- What areas of the codebase cause the most friction?
- Is there an active migration or refactoring effort?
- Are there known reliability or performance issues?

### 3.5 Future Direction
- What major changes are planned for the architecture?
- Are there technology migrations in progress or planned?

**Rules for clarification questions:**
- Never ask about something discoverable from code
- Never ask more than 10 questions total
- Group related questions together
- Provide your best guess alongside each question so the user can simply confirm or correct

---

## Phase 4: Confidence Report

Generate `$EIreports/DISCOVERY-report.md` with this structure:

```markdown
# Codebase Discovery Report

Generated: <timestamp>
Repository: <repo path>
Scope: <full repo | specific scope>

## Executive Summary

<2-3 paragraph overview of the project, its purpose, tech stack, and architecture>

## Tech Stack (Confidence Scores)

| Category | Detection | Confidence | Evidence |
|---|---|---|---|
| Primary Language | TypeScript | 95% | `tsconfig.json`, 847 `.ts` files |
| Framework | Next.js 14 (App Router) | 95% | `next.config.mjs`, `app/` dir |
| Database | PostgreSQL via Prisma | 90% | `prisma/schema.prisma`, `@prisma/client` |
| Auth | NextAuth v5 | 85% | `auth.config.ts`, `next-auth` dep |
| CI/CD | GitHub Actions | 95% | `.github/workflows/ci.yml` |
| ... | ... | ... | ... |

## Architecture Hypothesis

<architecture pattern, layer definitions, module boundaries, communication patterns>

### Architecture Confidence: <overall score>%

## Entry Points

| Entry Point | Type | Path | Purpose |
|---|---|---|---|
| ... | ... | ... | ... |

## Module Map

| Module | Path | Responsibility | Confidence |
|---|---|---|---|
| ... | ... | ... | ... |

## Git Insights

### Hotspots (Most Changed Files)
| File | Changes | Last Modified | Primary Contributor |
|---|---|---|---|
| ... | ... | ... | ... |

### Change Velocity
<commits per week trend>

### Active Areas (Last 30 Days)
<list of recently active directories/modules>

## Detected Patterns

### Naming Conventions
<observed patterns>

### Code Organization
<folder structure patterns>

### Import Patterns
<import style and organization>

### Test Patterns
<test file placement, naming, assertion style>

## Unknowns & Uncertainties

| Area | What's Unknown | Why It Matters | Suggested Resolution |
|---|---|---|---|
| ... | ... | ... | ... |

## Clarification Questions

<numbered list of 5-10 targeted questions from Phase 3>

## Per-Area Confidence Summary

| Area | Confidence | Status |
|---|---|---|
| Tech Stack | 92% | ✅ High |
| Architecture | 75% | ⚠️ Medium |
| Data Model | 88% | ✅ High |
| Auth & Security | 60% | ⚠️ Medium |
| Infrastructure | 45% | ❌ Low |
| Business Domain | 20% | ❌ Low — needs human input |
```

---

## Procedure

1. **Scan repository structure** — Execute file tree analysis, file count distribution, and gitignore analysis from §1.1.

2. **Detect package management** — Scan for all manifest files from §1.2. Record ecosystem, versions, and dependency counts.

3. **Identify build system** — Check for all build tool indicators from §1.3. Note build commands from package scripts.

4. **Detect frameworks** — Cross-reference dependencies, config files, and file patterns from §1.4. Assign initial confidence scores.

5. **Detect data layer** — Scan for ORM configs, schema files, migration directories, and database connection patterns from §1.5.

6. **Detect authentication** — Look for auth libraries, middleware, token patterns, and role definitions from §1.6.

7. **Scan CI/CD** — Read all CI/CD configuration files from §1.7. Extract pipeline stages, triggers, and deployment targets.

8. **Scan infrastructure** — Identify containerization, orchestration, and IaC tools from §1.8.

9. **Detect testing setup** — Find test configs, test files, and coverage settings from §1.9. Identify testing strategy (unit, integration, e2e).

10. **Read existing documentation** — Extract knowledge from README, docs, ADRs, and changelogs from §1.10.

11. **Analyze git history** — Run hotspot analysis, contributor mapping, and change velocity calculations from §1.11.

12. **Check for monorepo** — Detect workspace tools and map package dependencies from §1.12.

13. **Map entry points** — Trace application entry points, routing, and middleware chains from discovered framework and config evidence.

14. **Build architecture hypothesis** — Synthesize findings into an architecture hypothesis: monolith vs microservices, layer boundaries, communication patterns.

15. **Classify confidence** — Apply confidence scoring from Phase 2 to every finding.

16. **Generate clarification questions** — Formulate 5-10 targeted questions from Phase 3 for areas with <50% confidence.

17. **Write DISCOVERY-report.md** — Generate the full report following the Phase 4 template.

18. **Present findings** — Share high-confidence facts, medium-confidence hypotheses (seeking confirmation), and low-confidence questions with the user.

## Quality Gates

- [ ] All 12 discovery scans (§1.1–§1.12) were executed
- [ ] Every tech stack detection has a confidence score with evidence
- [ ] Architecture hypothesis is stated with supporting evidence
- [ ] No findings are stated without evidence citations
- [ ] Clarification questions number between 5 and 10
- [ ] No question asks about something discoverable from code
- [ ] DISCOVERY-report.md exists at `$EIreports/DISCOVERY-report.md`
- [ ] Per-area confidence summary covers all major areas
- [ ] Git history analysis includes hotspots and change velocity
- [ ] Monorepo detection was performed (even if result is "not a monorepo")
- [ ] Unknowns and uncertainties are explicitly listed

## Cross-References

- Used by: `initialize-intelligence-skill`, `engineering-orchestrator`
- Consumed by: all sync engines, `convention-detector`, `ongoing-learning-engine`
- Depends on: git history access, file system read access
- Feeds into: `knowledge-base/00-project-overview.md`, `$EImemory/technology-decisions.md`

This capability does not modify product code.
