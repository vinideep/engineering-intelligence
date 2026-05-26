---
name: deep-project-knowledge-extractor
description: Analyzes an existing software repository and produces evidence-based architecture, runtime, API, infrastructure, risk, and onboarding documentation. Use when creating or refreshing the project knowledge base.
version: 3.0.0
---

# Deep Project Knowledge Extractor

Produce comprehensive, evidence-backed project documentation by systematic repository analysis. Every material claim must cite a source file path. Silence is never acceptable — use `**Not detected**` for absent features.

## Inputs

- Repository root path
- Optional: scope constraints (specific package, service, or directory)

## Discovery Checklist

Scan the repository systematically for each category:

| Category | What to Look For |
|---|---|
| **Package Management** | `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, workspace configs |
| **Build System** | `Makefile`, `webpack.config.*`, `vite.config.*`, `tsconfig.json`, `build.gradle` |
| **Entrypoints** | `main.*`, `index.*`, `app.*`, `server.*`, bin scripts |
| **Routing** | Express/Koa/Fastify routes, Next.js pages/app dirs, API gateways |
| **Database** | Migration dirs, schema files, ORM configs, seed scripts |
| **Auth** | Passport/Auth0/JWT configs, middleware, RBAC definitions |
| **CI/CD** | `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `Dockerfile` |
| **Infrastructure** | `docker-compose.yml`, `terraform/`, `k8s/`, `serverless.yml` |
| **Tests** | `test/`, `__tests__/`, `spec/`, `*.test.*`, `*.spec.*`, test configs |
| **Environment** | `.env.example`, `.env.sample`, env validation schemas |
| **Documentation** | `README.md`, `docs/`, `CHANGELOG.md`, `CONTRIBUTING.md` |

## Output Specification

Generate each document in `knowledge-base/` with this structure:

```markdown
# <Document Title>

<One-paragraph executive summary>

## <Section>

<Content with inline evidence citations>

(evidence: path/to/file:L42-L58)

## Unknowns & Uncertainties

- <what is unclear and why>
```

### Required Documents

#### `00-project-overview.md`
- Project name, description, primary purpose
- Technology stack (languages, frameworks, major libraries)
- Repository type (monorepo, polyrepo, single-package)
- High-level architecture summary (1 paragraph)
- Key entry points and how to run the project

#### `01-repository-structure.md`
- Annotated directory tree (top 2-3 levels)
- Package/workspace boundaries
- Build output directories
- Generated vs authored code distinction

#### `02-architecture.md`
- Architectural pattern (monolith, microservices, serverless, modular monolith)
- Layer definitions (presentation, business, data, infrastructure)
- Module/package boundaries and their responsibilities
- Communication patterns (HTTP, gRPC, events, queues)
- Dependency direction rules

#### `03-runtime-flow.md`
- Application startup sequence
- Request lifecycle (from entry to response)
- Background job / worker flows
- Shutdown / graceful termination
- Async processing patterns

#### `04-api-documentation.md`
- REST endpoints: method, path, auth, request/response shapes
- GraphQL schemas and resolvers
- WebSocket channels
- RPC interfaces
- API versioning strategy

#### `05-database.md`
- Database engine(s) and connection configuration
- Schema overview (tables/collections, key relationships)
- Migration strategy and tooling
- Caching layers (Redis, Memcached, in-memory)
- Data access patterns (repository, active record, query builder)

#### `06-authentication.md`
- Auth provider and strategy (JWT, session, OAuth, SAML)
- Login/registration flows
- Token lifecycle and refresh
- Role/permission model (RBAC, ABAC)
- Protected route/middleware patterns

#### `07-frontend.md`
- UI framework and version
- Routing strategy (client-side, SSR, SSG)
- State management approach
- Component architecture and patterns
- Styling approach (CSS modules, Tailwind, styled-components)
- Build and bundling pipeline

#### `08-backend.md`
- Server framework and version
- Middleware stack (ordered list)
- Service/controller pattern
- Error handling strategy
- Logging and observability

#### `09-infrastructure.md`
- Hosting/cloud provider
- Container orchestration
- CI/CD pipeline stages
- Environment management (dev, staging, prod)
- Secrets management
- Monitoring and alerting

#### `10-integrations.md`
- Third-party API integrations
- Payment processors, email services, SMS
- Analytics and tracking
- External data sources
- Webhook consumers/producers

#### `11-complex-areas.md`
- High cyclomatic complexity modules
- Business logic with many edge cases
- Code with subtle race conditions or timing dependencies
- Areas with heavy tech debt affecting reliability

#### `12-technical-debt.md`
- Deprecated patterns still in use
- Missing test coverage in critical paths
- Known performance bottlenecks
- Planned but incomplete migrations
- Security improvements needed

#### `13-onboarding.md`
- Prerequisites (tools, accounts, access)
- Setup steps (clone, install, configure, run)
- Development workflow (branch, test, PR)
- Common tasks and commands
- Troubleshooting common issues

#### `14-glossary.md`
- Domain-specific terms with definitions
- Abbreviations and acronyms
- Naming conventions used in the codebase

#### `15-validation-report.md`
- Generated by `knowledge-base-validator` after extraction

## Evidence Rules

1. Every architectural claim must cite at least one source file
2. Use the format: `(evidence: relative/path/to/file:L<line>)` or `(evidence: relative/path/to/file)`
3. When evidence is indirect (inferred from patterns), use: `(inferred from: path/to/file)`
4. When no evidence exists: `**Not detected** — no relevant configuration or code found`
5. When evidence is ambiguous: `**Unclear from evidence** — [explanation of ambiguity]`

## Quality Gates

- [ ] All 16 documents generated (00 through 15)
- [ ] Every document has an executive summary paragraph
- [ ] Every material claim has an evidence citation
- [ ] Absent features use `**Not detected**` — not silence
- [ ] Ambiguous areas use `**Unclear from evidence**`
- [ ] No invented implementation details

## Cross-References

- Used by: `initialize-intelligence-skill`
- Feeds into: `knowledge-base-validator`, all sync engines
