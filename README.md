<h1 align="center">Engineering Intelligence OS</h1>

<p align="center">
  <strong>Turn any AI coding IDE into a disciplined engineering team.</strong><br>
  One install drops 42 skills, 15 specialist agents, and 11 workflows into your repo —<br>
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

AI coding agents forget everything between sessions. They re-read your architecture from scratch, skip impact analysis, drift from your conventions, and have no idea what they changed yesterday. `engineering-intelligence` fixes that — it gives the agent a persistent memory of your project, a discipline to plan before touching code, and the ability to pick up exactly where it left off.

| The problem | What this installs |
|---|---|
| Agent re-learns your codebase from scratch every session | Evidence-based knowledge base + architecture graphs that persist across sessions |
| Jumps straight to code, skips planning | Mandatory impact analysis + Agile planning before any non-trivial change |
| Ad-hoc one-shot prompts, no continuity | Autonomous Epic → Feature → Ticket backlog with a human approval gate per feature |
| Skill and instruction files burn context on every call | Tiered loading: routing table → brief → full skill — loads only the **1–3 skills a task needs, not all 42** |
| Tied to one AI tool | One canonical toolkit, rendered natively into **9 AI IDEs** — Claude Code, Cursor, Copilot, Gemini, Codex, Antigravity, CommandCode, and more |
| Treats every developer the same | **Per-developer intelligence** — a personal, gitignored profile seeded from your git history calibrates responses to your test philosophy and depth; a committed team layer captures shared consensus |

> The installer does **not** inspect your source, call an AI model, or generate docs itself. It ships the skills, agents, and workflows — the real work happens inside your IDE when you invoke them.

### What it is — and what it isn't

Being precise about this up front, so you can decide if it fits:

**What it is**
- An installable library of structured **instructions** (skills, agents, workflows) plus the machinery to render them natively into 9 different AI IDEs from one canonical source.
- A **persistence layer**: it directs the agent to build and reuse an evidence-based knowledge base and architecture graphs across sessions, instead of re-deriving them every time.
- A **discipline layer**: it asks the agent to run impact analysis and safety gates before non-trivial changes, and to keep its own project knowledge in sync afterward.
- **Conflict-aware tooling**: install/update tracks content hashes, preserves your own edits, and removes only what it added on uninstall.

**What it isn't**
- The *skills* are guidance, not interception — their effect depends on the model following them (strong models more, smaller ones less). But the toolkit is **no longer pure prose**: deterministic `gate` commands and MCP tools run in **every IDE and in CI** (env-vars, dead-exports, api-diff, migration-lint, claim verification), and automatic local lifecycle hooks (freshness inject, validation-on-stop) are wired for **Claude Code and Cursor**. See [Enforcement Across IDEs](#-enforcement-across-ides) and [Safety Gates](#-safety-gates). Local auto-blocking is Claude/Cursor-only today; CI is the universal enforcement layer.
- It is **not** a replacement for review. It makes the agent more thorough and consistent; you still own the final call.
- **It does not claim to use fewer tokens than raw prompting.** The tiered loading saves tokens *relative to loading the whole toolkit* — routing + brief + one skill instead of all 42 skill files (measured at the rendered-file level by `test/token-reduction.test.mjs`). For a small one-off change, a raw prompt is cheaper. The real saving is not re-deriving your architecture every session: the agent reuses the persisted knowledge base and graphs instead of re-reading your codebase from scratch.

If you want a low-friction start, install it and use just `/initialize-engineering-intelligence` + `/engineering-intelligence` first; adopt the deeper AI-DLC backlog and safety-gate workflows once you've seen the basics fit your team.

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
.engineering-intelligence/knowledge-base/    ← architecture and domain knowledge
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

# Score knowledge-base docs for staleness against related source files (writes a freshness report)
npx engineering-intelligence freshness . --threshold 60
npx engineering-intelligence freshness . --json

# Verify the working tree and write a receipt (exit 1 if checks fail)
npx engineering-intelligence verify .
npx engineering-intelligence verify . --json

# Extract git intelligence — hotspots, change coupling, ownership (last 90 days by default)
npx engineering-intelligence git-analysis . --window 90
npx engineering-intelligence git-analysis . --json

# Run a deterministic safety gate (exits 1 on a hard failure — usable in CI)
npx engineering-intelligence gate env-vars .            # env refs vs .env.example
npx engineering-intelligence gate dead-exports .        # JS/TS exports never imported

# env-vars and dead-exports emit only warnings, so by default they report but never
# fail. Promote them to blocking checks with --fail-on:
npx engineering-intelligence gate dead-exports . --fail-on warning
npx engineering-intelligence gate api-diff . --base origin/main   # removed/changed endpoints
npx engineering-intelligence gate migration-lint . --json         # destructive/locking migrations

# Assemble a token-budgeted context pack for a task (graph neighborhood + verified claims)
npx engineering-intelligence context "add rate limiting" --files src/auth.ts --budget 2000

# Record and verify hash-pinned claims about the code
npx engineering-intelligence claims derive .            # compute derived facts from source
npx engineering-intelligence claims add --statement "auth uses JWT" --evidence "src/auth.ts:12-40" --author "you"
npx engineering-intelligence claims verify --strict     # exits 1 if any claim is refuted/stale/missing

# Report observed token usage from real sessions (populated by the Stop hook)
npx engineering-intelligence telemetry --json

# Seed/refresh your personal developer profile from git history (zero LLM tokens; gitignored)
npx engineering-intelligence user-profile .
npx engineering-intelligence user-profile . --json

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

## 👤 Per-Developer Intelligence

The `user-intelligence-engine` skill calibrates every workflow response to the individual developer — their test philosophy, implementation depth, communication style, and architecture preferences — **without an onboarding questionnaire**.

- **Zero-token seeding.** Identity is resolved from `git config` and the profile is seeded from your git history (commit patterns, test ratio, primary language, typical change size) by the `user-profile` CLI command — no LLM context consumed.
- **Multi-user safe.** Each developer's `user-intelligence.md` lives under `.engineering-intelligence/memory/users/<slug>/` and is **gitignored automatically** — your profile never lands in someone else's checkout.
- **Team consensus layer.** Preferences shared across the team are promoted to a committed `.engineering-intelligence/memory/team-preferences.md`, which still applies in CI and to teammates without a personal profile.
- **CI-aware.** In CI environments the personal profile is skipped; only the committed team layer applies.

```bash
# Seed or refresh your personal profile (run after a few commits for best signal)
npx engineering-intelligence user-profile .
```

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

The gates above are applied by the workflow prose. The hooks below make the two
most important guarantees — *fresh intelligence* and *validated changes* —
**enforced by code**, not left to the model's diligence.

---

## 🛂 Enforcement Across IDEs

Enforcement is **not** one mechanism — it's a tiering, because a "hook" only exists
if the host IDE exposes a lifecycle-hook API. The value (fresh intelligence,
validated changes) reaches every IDE through host-independent layers; automatic
*local* blocking is added per-host where the host supports it.

| Layer | Works in | Strength |
|-------|----------|----------|
| **CI** — `gate` commands + the [drift-check Action](templates/canonical/ci/ei-drift-check.yml) | **Any repo, any IDE** | **Strongest — blocks the merge, unskippable** |
| **MCP tools** — `get_context`, `run_gate`, `verify_claims`, `analyze_impact` | Any MCP-capable IDE (Cursor, Copilot, Windsurf, Gemini…) | Agent can call them everywhere |
| **CLI** — the same commands by hand or in scripts | Everywhere | Manual |
| **Local lifecycle hooks** — SessionStart inject / PreToolUse warn-or-deny / Stop validation gate | **Claude Code + Cursor** | Automatic (skippable per-dev) |

The honest takeaway: **CI is the universal, unskippable enforcement spine** (a local
hook stops *you*; a CI gate stops the *merge*). Local hooks are a per-host
enhancement on top.

### Local lifecycle hooks — Claude Code & Cursor

Installing for `claude-code` writes `.claude/settings.json`; installing for
`cursor` writes `.cursor/hooks.json`. **If you already have one, it is merged,
not replaced** — your `permissions`, `model`, `env` and your own hooks are left
untouched, our entries are added alongside, re-installing never duplicates them,
and `uninstall` takes back only what we added. The install also registers the
MCP server (`.mcp.json` / `.cursor/mcp.json`) so the tools below are reachable
without any manual setup, and seeds `.engineering-intelligence/ei.config.json`
once — after that it is yours to edit, and editing it never causes a conflict. Both wire the **same** deterministic engine
(`engineering-intelligence hook <event>`), just translated to each host's hook
contract:

| Moment | What it does |
|--------|-------------|
| Session start | Injects the current freshness / drift summary so the session starts from real intelligence state. |
| Before an edit | Warns (or, opt-in, **denies**) when the documentation covering that source is stale. |
| After edits / shell | Silently records changed source files for messaging. |
| Stop | Opt-in: **blocks "done"** unless a passing **verification receipt** covers the current bytes of every changed source file. |

### Verification receipts

`npx engineering-intelligence verify .` runs the project's own check commands,
records their **real exit codes**, and writes a receipt binding the outcome to a
`sha256` of every changed file (change set taken from `git status -uall`, so
edits made via `sed`, `patch` or a subagent are covered too).

That receipt is the only thing the Stop gate accepts. Consequences:

- A command that merely *looks* like a test (`rm -rf build`, `echo check`,
  `git commit -m "add tests"`) cannot satisfy it — the earlier word-matching
  gate was defeated by exactly these.
- A **failing** command produces a `fail` verdict, never a pass.
- Editing a file after verifying it **invalidates** the receipt automatically,
  because the hash no longer matches. Re-verify after every edit.
- Outside a git repo the receipt records `gitAvailable: false` and coverage
  degrades to an mtime comparison — weaker, and labelled as such rather than
  pretending to a guarantee it cannot make.

This turns the *environmental backpressure* principle ("never report validation
as passed unless the command actually ran") from a request into an enforced gate.
The other IDEs don't get this local auto-blocking — they rely on the CI + MCP
layers above. Adding another host is a small adapter: the engine is host-neutral.

Behaviour is tuned in `.engineering-intelligence/ei.config.json` (shared by both hosts):

```json
{
  "hooks": {
    "freshnessThreshold": 60,
    "blockStaleEdits": false,
    "requireValidationOnStop": false
  }
}
```

Hooks are **fail-safe**: with no intelligence installed, or on any error, they
allow the action and never break the session. The hard gates (`blockStaleEdits`,
`requireValidationOnStop`) are opt-in — flip them on when your team is ready.

**CI counterpart:** copy [`templates/canonical/ci/ei-drift-check.yml`](templates/canonical/ci/ei-drift-check.yml)
to `.github/workflows/` to fail pull requests whose committed intelligence has
drifted below the freshness threshold.

---

## 🧠 Queryable Context & Verifiable Claims

The knowledge base is only useful if a model can trust it and reach it cheaply.
Two computed capabilities make that real — and are what let **small models** work
from retrieved facts instead of re-reading source.

**Verifiable claims — and the honest limit of the word "verified".**

An anchor proves a symbol still *exists*. It does **not** prove the sentence bound
to it is *true*: a claim like "the auth endpoint is rate-limited", pinned to a
handler with no rate limiting, would resolve, hash cleanly, and report `verified`
forever. That is an expensive mtime wearing a green checkmark — worse than no
claim, because it gets trusted. So claims come in two kinds and only one can be
called a fact:

| Kind | Statement comes from | Verification | Best status |
|---|---|---|---|
| **derived** | rendered from a machine-extracted descriptor | the fact is **re-computed from source**, so the sentence itself is checked | `verified` — or `refuted` when it stops being true |
| **asserted** | free text from a human or model | evidence hash only; nothing checks the sentence | `unverified` — never `verified` |

```bash
# Compute the derived baseline: module imports, package dependencies, HTTP routes
npx engineering-intelligence claims derive .      # 102 facts on this repo, zero prompting

# Record an unchecked note — requires an author, and can never become a "fact"
npx engineering-intelligence claims add --statement "auth uses JWT" \
  --evidence "src/auth/mw.ts:12-40" --author "you"

npx engineering-intelligence claims verify --strict   # exits 1 on refuted/stale/missing
```

Because derived facts are re-derived rather than re-hashed, deleting a route is
caught even though its file still exists and still hashes identically. `get_context`
serves derived facts under **Verified facts**, and asserted claims under a separate
**Unverified assertions** heading that says not to treat them as fact.

**`get_context` — one query instead of ten file reads.** Ask for what a task
needs and get a token-budgeted pack back: the graph neighborhood of the touched
files (what they depend on, what depends on them), the **verified** claims about
that code (stale ones excluded), plus conventions and dangerous areas.

```bash
npx engineering-intelligence context "add refunds to charge()" --files src/pay.ts --budget 2000
```

Also exposed as the `get_context` and `verify_claims` MCP tools, so the agent
retrieves trustworthy facts rather than inferring them from raw code.

**Honest, measured token numbers.** The Stop hook reads the session transcript
and records *real* billed input/output tokens — including whether the session
used `get_context` — to a local log. `npx engineering-intelligence telemetry`
reports observed averages and a with-vs-without-context comparison. This replaces
the old synthetic estimate with data you can actually cite.

---

## 📦 Toolkit Contents

**42 skills** across six domains:

- **Knowledge & architecture:** codebase discovery, graph engine, knowledge extraction, architecture review, change detection, staleness detection, incremental sync (unified knowledge/memory/context/graph/claims sync), change history
- **Planning & delivery:** AI-DLC lifecycle, backlog decomposition, issue tracker sync, requirement scoping, impact analysis, refactoring planner, greenfield architect, user intelligence engine
- **Quality & safety:** testing intelligence, type safety, API compatibility & snapshots, database migration safety, environment variable auditor, ADR compliance, LLM prompt injection guard, MCP security governor, dead code detector, engineering change review, NFR/ADR governor
- **Operations:** performance analysis, operations readiness, environmental backpressure, context budget optimizer, debugging engine, PR intelligence, convention detector
- **Security & compliance:** security audit, contract test generator, API backward compatibility
- **Engineering workflow:** engineering intelligence orchestration, initialize intelligence, ongoing learning

**15 specialist agents:** engineering orchestrator, change agent, quality agent, knowledge agent, system architect, product analyst, security officer, compliance auditor, test engineer, database administrator, performance analyst, documentation writer, release engineer, site reliability engineer, adversary

**11 workflows:** `engineering-intelligence`, `initialize-engineering-intelligence`, `create-project`, `scope-requirement`, `map-architecture`, `analyze-impact`, `review-engineering-change`, `sync-engineering-intelligence`, `discover-codebase`, `decompose-backlog`, `deliver-backlog`

---

## 📁 Generated Artifacts

After regular use, a healthy project contains:

```
.engineering-intelligence/
  knowledge-base/                                  ← architecture, domain, and API knowledge
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
    freshness-report.md                            ← doc staleness scores (freshness CLI)
    git-analysis.md                                ← hotspots, coupling, ownership (git-analysis CLI)
  memory/
    team-preferences.md                            ← committed team consensus layer
    users/<slug>/user-intelligence.md              ← personal developer profile (gitignored)
  context/
    context-manifest.md                            ← ranked context for the current session
  snapshots/                                       ← API response snapshots
  changes/
    CHG-XXX-*.md                                   ← change history
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
