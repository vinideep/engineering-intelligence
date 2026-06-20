<h1 align="center">Engineering Intelligence OS</h1>

<p align="center">
  <strong>Turn any AI coding IDE into a disciplined engineering team.</strong><br>
  One install drops 45 skills, 15 specialist agents, and 11 workflows into your repo —<br>
  teaching the agent to plan, implement, validate, and keep its own project knowledge in sync.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/engineering-intelligence"><img src="https://img.shields.io/npm/v/engineering-intelligence?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/engineering-intelligence"><img src="https://img.shields.io/npm/dm/engineering-intelligence?color=cb3837&logo=npm" alt="npm downloads"></a>
  <a href="https://github.com/vinideep/engineering-intelligence/stargazers"><img src="https://img.shields.io/github/stars/vinideep/engineering-intelligence?style=flat&logo=github&color=yellow" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/engineering-intelligence?color=blue" alt="MIT license"></a>
  <img src="https://img.shields.io/node/v/engineering-intelligence?color=brightgreen&logo=node.js" alt="node version">
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-supported-ides">Supported IDEs</a> ·
  <a href="#-workflow-commands">Workflow Commands</a> ·
  <a href="#-lifecycle-commands">Lifecycle</a> ·
  <a href="#-toolkit-contents">What's Included</a> ·
  <a href="WORKFLOW_GUIDE.md">Full Guide</a>
</p>

---

## Why This Exists

AI coding agents are powerful but undisciplined: they forget architecture between sessions, skip impact analysis, drift from your conventions, and burn context re-reading the same files. `engineering-intelligence` installs the missing scaffolding so the agent works like a senior engineering team.

| Without Engineering Intelligence | With Engineering Intelligence |
|---|---|
| Agent re-learns the codebase every session | Evidence-based knowledge base + architecture graphs persist across sessions |
| Jumps straight to code | Writes an impact report and plans Agile/AI-DLC work first |
| Ad-hoc, one prompt at a time | Autonomous Epic → Feature → Ticket backlog with per-feature human approval gates |
| Locked to one tool | One toolkit, **9 AI IDEs** — Claude Code, Cursor, Copilot, Gemini, Codex, Antigravity, CommandCode, and more |
| Bloated context on every call | **28–37% fewer tokens per invocation** via path aliasing, tiered skill loading, routing tables, and KV-cache ordering — applied across all 9 IDEs |

> The installer does **not** inspect your source, call an AI model, or generate docs itself. It ships the skills, agents, and workflows — the real work happens inside your IDE when you invoke them.

---

## ⚡ Quick Start

**Step 1 — Install into your project** (run once per project, from the project root):

```bash
# Interactive — the CLI will ask which IDE you use
npx engineering-intelligence

# Or install for a specific IDE directly (no prompt)
npx engineering-intelligence install . --ide claude-code --yes
```

**Step 2 — Initialize** (run once inside your AI IDE after installing):

```
/initialize-engineering-intelligence
```

**Step 3 — Start building:**

```
/engineering-intelligence Add rate limiting to the authentication endpoints
```

That's it. The agent now plans, implements, validates, and self-documents.

---

## 🖥 Supported IDEs

Install the adapter that matches your IDE. Each adapter writes to the IDE's native file locations so skills and commands are discovered automatically.

| IDE | Adapter ID | Install Command |
|-----|-----------|----------------|
| **Claude Code** (CLI, Desktop, Web) | `claude-code` | `npx engineering-intelligence install . --ide claude-code --yes` |
| **Cursor** | `cursor` | `npx engineering-intelligence install . --ide cursor --yes` |
| **GitHub Copilot** (VS Code) | `github-copilot` | `npx engineering-intelligence install . --ide github-copilot --yes` |
| **Gemini CLI** | `gemini-cli` | `npx engineering-intelligence install . --ide gemini-cli --yes` |
| **OpenAI Codex CLI** | `codex` | `npx engineering-intelligence install . --ide codex --yes` |
| **CommandCode** | `commandcode` | `npx engineering-intelligence install . --ide commandcode --yes` |
| **Antigravity** (GUI) | `antigravity` | `npx engineering-intelligence install . --ide antigravity --yes` |
| **Antigravity CLI** | `antigravity-cli` | `npx engineering-intelligence install . --ide antigravity-cli --yes` |
| **Any other AI IDE** | `generic` | `npx engineering-intelligence install . --ide generic --yes` |

**Installing for multiple IDEs at once:**

```bash
npx engineering-intelligence install . --ide claude-code,cursor,github-copilot --yes
```

### What gets installed per IDE

| IDE | Files Written |
|-----|--------------|
| Claude Code | `.claude/skills/` · `.claude/agents/` · `.claude/commands/` · managed block in `CLAUDE.md` |
| Cursor | `.cursor/rules/` · `.cursor/commands/` |
| GitHub Copilot | `.github/skills/` · `.github/agents/` · `.github/prompts/` · managed instructions block |
| Gemini CLI | `.agents/skills/` · `.gemini/commands/` · managed block in `GEMINI.md` |
| OpenAI Codex | `.agents/skills/` · managed block in `AGENTS.md` |
| CommandCode | `.commandcode/skills/` · `.commandcode/commands/` · managed block in `AGENTS.md` |
| Antigravity | `.agent/skills/` · `.agent/rules/` · `.agent/workflows/` |
| Antigravity CLI | `.agent/skills/` · `.agent/rules/` · `.agent/workflows/` · managed block in `AGENTS.md` |
| Generic | `.agents/skills/` · managed block in `AGENTS.md` |

> Managed blocks are clearly delimited sections inside shared files like `CLAUDE.md` and `AGENTS.md`. Content outside the managed block is never touched. Uninstall removes only the managed block.

---

## 🚀 First-Time Setup

### Existing project

```bash
# 1. Install (terminal)
npx engineering-intelligence install . --ide claude-code --yes

# 2. Open your AI IDE, then run:
/initialize-engineering-intelligence

# 3. Optionally map your architecture:
/map-architecture
```

`/initialize-engineering-intelligence` reads your codebase and creates:

```
knowledge-base/                              ← architecture and domain knowledge
.engineering-intelligence/graph/             ← dependency, service, and architecture graphs
.engineering-intelligence/aidlc/             ← AI-DLC lifecycle state
.engineering-intelligence/memory/            ← session memory
```

### New (greenfield) project

```bash
# 1. Create the project directory
mkdir my-project && cd my-project

# 2. Install the toolkit
npx engineering-intelligence install . --ide claude-code --yes

# 3. Inside your AI IDE, scaffold the project:
/create-project Build a TypeScript REST API with PostgreSQL and Stripe
```

---

## 💬 Workflow Commands

All commands are invoked inside your AI IDE. For IDEs with native slash commands (Claude Code, Cursor, Gemini CLI, CommandCode, Antigravity), use `/command-name`. For chat-based IDEs (GitHub Copilot, Codex, generic), type the workflow name in chat.

### Core implementation workflow

```
/engineering-intelligence <your request>
```

Examples:

```
/engineering-intelligence Add rate limiting to the public authentication endpoints
/engineering-intelligence Fix the intermittent timeout on the checkout service
/engineering-intelligence Refactor the user service to extract a billing domain
/engineering-intelligence Add webhook signature validation for Stripe events
```

The orchestrator runs the full AI-DLC pipeline internally: freshness check → impact analysis → Agile planning → implementation → safety gates → tests → knowledge sync → change history.

### Delivery modes

Append a delivery mode to the request for specialized workflows:

```
/engineering-intelligence Harden checkout APIs using adversarial delivery mode
/engineering-intelligence Add invoice state machine using TDD delivery mode
/engineering-intelligence Migrate orders to PostgreSQL using design-first delivery mode
/engineering-intelligence Debug checkout latency spikes using hypothesis debugging mode
```

| Mode | When to use |
|------|------------|
| (default) | Standard Agile delivery — most features and bugfixes |
| adversarial | Security-sensitive or high-stakes changes |
| TDD | When tests must drive the design |
| design-first | Large architectural changes that need an ADR before code |
| hypothesis debugging | Intermittent bugs or production mysteries |

### Requirement scoping

Use this before implementing to get acceptance criteria, edge cases, and a clear spec:

```
/scope-requirement Add SSO login for enterprise customers
/scope-requirement Replace in-memory cache with Redis
```

### Architecture and impact

```
/map-architecture                                       ← generate architecture graphs
/analyze-impact Introduce a checkout service boundary   ← impact report, no code changes
/review-engineering-change Review the working-tree diff ← engineering review of your changes
/sync-engineering-intelligence Review the working-tree diff ← sync knowledge after manual edits
```

### Autonomous Epic → Feature → Ticket backlog

For large initiatives, decompose first, then deliver feature by feature behind a human approval gate:

```
# Step 1 — decompose the epic into tickets (no code written)
/decompose-backlog Build a self-serve billing portal with invoices, payment methods, and dunning

# Step 2 — deliver: selects the next ready feature, asks for approval, then implements
/deliver-backlog

# Step 3 — deliver a specific feature by ID
/deliver-backlog FEAT-002
```

`/decompose-backlog` creates epics, features, and tickets with stable IDs (`EPIC-XXX`, `FEAT-XXX`, `TKT-XXX`) under `.engineering-intelligence/aidlc/agile/backlog/`. Every feature starts with `Approval: pending` — the agent waits for your sign-off before writing any product code.

### Direct skill invocations

For focused, targeted work without going through the full orchestration pipeline:

```
/type-safety-engine
/api-backward-compatibility-engine
/api-snapshot-testing-engine
/database-migration-safety-engine
/environment-variable-auditor
/adr-compliance-checker
/dead-code-detector
/llm-prompt-injection-guard
/context-budget-optimizer
/security-audit-engine
/refactoring-planner
/debugging-engine
```

---

## 🔧 Lifecycle Commands

Run these in the terminal (not inside the IDE):

```bash
# Check installation health — reports missing files, hash mismatches, legacy folders
npx engineering-intelligence doctor .

# Check health and output JSON (for CI scripts)
npx engineering-intelligence doctor . --json

# Preview an update without writing anything
npx engineering-intelligence update . --dry-run

# Apply updates (files you've locally edited are protected — reported as conflicts)
npx engineering-intelligence update .

# Force overwrite even locally-edited managed files
npx engineering-intelligence update . --force

# Generate an interactive HTML dashboard of all installed skills, agents, and workflows
npx engineering-intelligence visualize .

# Generate and open the dashboard in the browser
npx engineering-intelligence visualize . --open

# Preview uninstall without removing anything
npx engineering-intelligence uninstall . --dry-run

# Uninstall (removes only managed content; your files and generated artifacts are untouched)
npx engineering-intelligence uninstall .
```

### Upgrade from V1

If you installed an earlier version, upgrade in place:

```bash
npx engineering-intelligence update .
```

The update adds graph/impact skills and workflows, updates untouched managed blocks, and leaves any locally-edited managed files unchanged (reported as conflicts).

---

## 🛡 Safety Gates

The `/engineering-intelligence` workflow applies these gates automatically when relevant:

| Gate | Triggered by |
|------|-------------|
| Freshness / drift | Every implementation request |
| Impact analysis | Every implementation request |
| Acceptance criteria | Product behavior changes |
| Type safety | Typed projects |
| API compatibility | API, SDK, event, webhook, or schema contracts |
| API snapshots | Replayable API response behavior |
| Database migration | Migrations, schemas, ORM models, indexes |
| Dependency security | New or upgraded packages |
| Environment variable audit | Env vars, config schemas, CI/deploy secrets |
| ADR compliance | Architecture-governed areas |
| LLM prompt injection guard | User input reaches LLMs, RAG, or durable memory |
| Rollback planning | Medium, high, or critical risk changes |
| Observability | New endpoints, jobs, services, or production paths |

---

## 📦 Toolkit Contents

**45 skills** across six domains:

- **Knowledge & architecture:** codebase discovery, graph engine, knowledge extraction, architecture review, change detection, staleness detection, context sync, memory sync, knowledge sync, incremental sync, change history
- **Planning & delivery:** AI-DLC lifecycle, backlog decomposition, issue tracker sync, requirement scoping, impact analysis, refactoring planner, greenfield architect
- **Quality & safety:** testing intelligence, type safety, API compatibility, API snapshots, database migration safety, environment variable auditor, ADR compliance, LLM prompt injection guard, MCP security governor, dead code detector, engineering change review, NFR/ADR governor
- **Operations:** performance analysis, operations readiness, environmental backpressure, context budget optimizer, debugging engine, PR intelligence, convention detector
- **Security & compliance:** security audit, contract test generator, API backward compatibility
- **Engineering workflow:** engineering intelligence orchestration, initialize intelligence, ongoing learning

**15 specialist agents:** engineering orchestrator, change agent, quality agent, knowledge agent, system architect, product analyst, security officer, compliance auditor, test engineer, database administrator, performance analyst, documentation writer, release engineer, site reliability engineer, adversary

**11 workflows:** `engineering-intelligence`, `initialize-engineering-intelligence`, `create-project`, `scope-requirement`, `map-architecture`, `analyze-impact`, `review-engineering-change`, `sync-engineering-intelligence`, `discover-codebase`, `decompose-backlog`, `deliver-backlog`

---

## 📁 Generated Artifacts

After regular use, a healthy project contains:

```
knowledge-base/                                    ← architecture, domain, and API knowledge
.engineering-intelligence/
  aidlc/
    aidlc-state.md                                 ← current AI-DLC lifecycle state
    execution-plan.md                              ← current sprint plan
    agile/backlog/                                 ← epics, features, tickets, dependency graph
    discovery/ inception/ construction/ operations/
  graph/
    dependency-graph.json
    service-graph.json
    runtime-graph.json
    business-flow-graph.json
    architecture-map.md                            ← Mermaid architecture diagram
  reports/
    IMP-XXX-*.md                                   ← impact reports
    REV-XXX-*.md                                   ← engineering review reports
  memory/                                          ← session memory
  context/
    context-manifest.md                            ← ranked context for the current session
  snapshots/                                       ← API response snapshots
.changes/
  CHG-XXX-*.md                                     ← change history
```

The installer manages only `.engineering-intelligence/install-manifest.json`. Everything else is written by the agent.

---

## 🔨 Development

```bash
npm install
npm test       # build + run all tests
npm run build  # TypeScript compile only
```

**Source layout:**

```
src/adapters/      IDE renderers — one per adapter
src/cli/           CLI entry point
src/installer/     install, update, uninstall, conflict handling
src/manifest/      managed-content tracking (hashes)
src/validation/    doctor and template validation
src/visualizer/    interactive HTML dashboard
src/token-optimizer.ts  path aliasing, SmartCrush, tiered skills, KV-cache ordering
templates/canonical/    host-neutral skill, workflow, agent, and rule templates
test/              adapter, installer, template, and token-reduction tests
```

**Adding a new IDE adapter:**

1. Add a renderer in `src/adapters/index.ts` targeting the IDE's native file locations.
2. Reuse canonical skills and workflow templates — don't duplicate logic.
3. Extend adapter and lifecycle tests for generated paths, multi-adapter deduplication, and update/uninstall behavior.
4. Document the IDE's invocation method in the supported IDE table.

**Improving workflow behavior:**

Edit canonical templates under `templates/canonical/` — all adapters pull from the same source, so one change propagates everywhere.

---

## Contributing

New IDE adapters, workflow improvements, and skills are all welcome. Run `npm test` before opening a PR. The test suite covers generated paths, multi-adapter compatibility, and update/uninstall behavior.

---

## License

[MIT](LICENSE) — free for personal and commercial use.

---

<p align="center">
  Built to make AI coding agents accountable.<br>
  <strong>⭐ <a href="https://github.com/vinideep/engineering-intelligence">Star the repo</a></strong> if it helped you ship faster.
</p>
