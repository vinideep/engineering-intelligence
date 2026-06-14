> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: initialize-intelligence-skill
description: Initializes project engineering intelligence by analyzing repository evidence and generating knowledge, context, memory, event guidance, architecture graphs, and an initialization change record. Invoke when onboarding a repository or when asked to initialize engineering intelligence.
version: 3.0.0
---

# Initialize Engineering Intelligence

Create a trustworthy, evidence-backed project intelligence baseline. Analyze only artifacts present in source code, configuration, tests, infrastructure, and existing documentation. Mark unknowns and uncertainties explicitly — never invent architecture, APIs, schemas, or business rules.

## Inputs

- Repository root path (current working directory by default)
- Optional: explicit scope constraints (monorepo package, service boundary)

## Outputs

Generate the following artifacts in order:

### Knowledge Base (`knowledge-base/`)

| Document | Purpose |
|---|---|
| `00-project-overview.md` | Name, purpose, tech stack, repo structure summary |
| `01-repository-structure.md` | Directory tree, package boundaries, build artifacts |
| `02-architecture.md` | Layers, modules, boundaries, communication patterns |
| `03-runtime-flow.md` | Request lifecycle, startup, shutdown, async flows |
| `04-api-documentation.md` | Routes, endpoints, GraphQL schemas, RPC interfaces |
| `05-database.md` | Schemas, migrations, ORMs, data stores, caching |
| `06-authentication.md` | Auth flows, session management, RBAC, tokens |
| `07-frontend.md` | UI framework, routing, state management, components |
| `08-backend.md` | Server framework, middleware, service patterns |
| `09-infrastructure.md` | CI/CD, containers, cloud, deployment, environments |
| `10-integrations.md` | Third-party APIs, SDKs, webhooks, message queues |
| `11-complex-areas.md` | High-complexity modules, tricky logic, footguns |
| `12-technical-debt.md` | Known debt, deprecated patterns, migration needs |
| `13-onboarding.md` | Setup guide, dev workflow, common tasks |
| `14-glossary.md` | Domain terms, abbreviations, naming conventions |
| `15-validation-report.md` | Evidence audit of all claims made above |

### Durable Memory (`$EImemory/`)

| Document | Content |
|---|---|
| `architecture-decisions.md` | ADRs, architectural choices, rationale |
| `business-rules.md` | Domain rules, invariants, constraints from code |
| `coding-patterns.md` | Recurring patterns, conventions, idioms |
| `project-constraints.md` | Performance budgets, compatibility, regulatory |
| `technology-decisions.md` | Stack choices, version policies, deprecation plans |

### Navigation Context (`$EIcontext/`)

| Document | Content |
|---|---|
| `module-map.md` | Module names → paths → responsibilities |
| `service-map.md` | Services → ports → protocols → dependencies |
| `runtime-map.md` | Entry points → middleware chains → handlers |
| `critical-paths.md` | Revenue, auth, data-integrity flows |
| `dangerous-areas.md` | Fragile code, missing tests, race conditions |
| `dependency-map.md` | External deps → internal consumers → risk |

### Event Guidance (`$EIevents/`)

| Document | Trigger |
|---|---|
| `api-changed.md` | When API routes, payloads, or contracts change |
| `schema-changed.md` | When database schemas or migrations change |
| `auth-changed.md` | When auth flows or permissions change |
| `feature-added.md` | When new user-facing features are introduced |
| `infrastructure-changed.md` | When CI, deployment, or infra config changes |

### Architecture Graphs (`$EIgraph/`)

| Artifact | Content |
|---|---|
| `dependency-graph.json` | Module/package dependency relationships |
| `service-graph.json` | Service-to-service communication topology |
| `runtime-graph.json` | Runtime call flows and middleware chains |
| `business-flow-graph.json` | Business process flows across system boundaries |
| `architecture-map.md` | Mermaid diagrams derived from JSON graphs |

### Change History

| Artifact | Content |
|---|---|
| `.changes/CHG-000-initialization.md` | Record of this initialization run |

## Procedure

1. **Discover** — Scan for: package manifests, workspace configs, runtimes (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, etc.), build systems, entrypoints, CI configs, Dockerfiles, deployment manifests, environment examples, database schemas/migrations, API definitions, auth configs, test suites.

2. **Trace Architecture** — Follow imports, dependency injection, middleware registration, route definitions, event handlers, and service boundaries. Map the critical runtime flows from code evidence, not assumptions.

3. **Write Knowledge Base** — For each document:
   - Open with a one-paragraph summary
   - Back every material claim with a file path reference: `(evidence: path/to/file:L42)`
   - Use `**Not detected**` for absent features, not silence
   - Use `**Unclear from evidence** — [reason]` for ambiguous areas
   - Use tables, code blocks, and structured lists — never prose walls

4. **Validate Claims** — Re-read each knowledge document, check major claims against actual files, and write `15-validation-report.md` with findings categorized as: ✅ Supported, ⚠️ Partially Supported, ❌ Unsupported, ❓ Needs Human Review.

5. **Generate Memory** — Extract only durable, long-lived decisions and patterns. Do NOT store transient implementation details. Each entry needs a `Source:` evidence reference.

6. **Generate Context** — Create concise, navigational maps. Each map should fit in ~100 lines. Optimize for an AI agent quickly finding the right file, not for human reading.

7. **Build Graphs** — Invoke `graph-engine` to produce all four JSON graphs and `architecture-map.md`. Every node and edge must have `evidence` and `confidence` fields.

8. **Generate Events** — Write change-event guidance documents that describe what to check and update when specific types of changes occur.

9. **Write History** — Create `CHG-000-initialization.md` with: timestamp, artifacts generated, confidence summary, areas needing human confirmation.

10. **Report** — Summarize: total artifacts created, evidence coverage percentage estimate, high-confidence vs low-confidence areas, explicit list of items requiring human review.

## Quality Gates

- [ ] Every knowledge document has at least one evidence citation
- [ ] No document contains invented implementation details
- [ ] Validation report exists and covers all knowledge documents
- [ ] All four graph JSON files validate against the graph-engine schema
- [ ] Memory contains only durable, long-lived knowledge
- [ ] Context maps are concise (< 150 lines each)
- [ ] CHG-000 record exists and lists all generated artifacts

## Cross-References

- Uses: `deep-project-knowledge-extractor`, `knowledge-base-validator`, `graph-engine`, `change-history-engine`
- Consumed by: `engineering-intelligence-skill`, all sync engines, `impact-analysis-engine`

This initialization documents and validates the project. It does not implement product changes.
