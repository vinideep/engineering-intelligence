<h1 align="center">Engineering Intelligence OS</h1>

<p align="center">
  <strong>Turn any AI coding IDE into a disciplined engineering team.</strong><br>
  One install drops a graph-backed Agile + AI-DLC toolkit — 45 skills, 15 specialist agents, and 11 workflows — into your repo, and teaches the agent to plan, implement, validate, and keep its own project knowledge in sync.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/engineering-intelligence"><img src="https://img.shields.io/npm/v/engineering-intelligence?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/engineering-intelligence"><img src="https://img.shields.io/npm/dm/engineering-intelligence?color=cb3837&logo=npm" alt="npm downloads"></a>
  <a href="https://github.com/vinideep/engineering-intelligence/stargazers"><img src="https://img.shields.io/github/stars/vinideep/engineering-intelligence?style=flat&logo=github&color=yellow" alt="GitHub stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/engineering-intelligence?color=blue" alt="MIT license"></a>
  <img src="https://img.shields.io/node/v/engineering-intelligence?color=brightgreen&logo=node.js" alt="node version">
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#why-this-exists">Why</a> ·
  <a href="#use-in-a-target-repository">Workflows</a> ·
  <a href="#autonomous-epic--feature--ticket-backlog">Autonomous backlog</a> ·
  <a href="WORKFLOW_GUIDE.md">Full guide</a>
</p>

---

## Why This Exists

AI coding agents are powerful but undisciplined: they forget architecture between sessions, skip impact analysis, drift from your conventions, and burn context re-reading the same files. `engineering-intelligence` installs the missing scaffolding so the agent works like a senior team instead of an eager intern.

| Most AI IDE setups | With Engineering Intelligence |
| --- | --- |
| Agent re-learns the codebase every session | Evidence-based knowledge base + architecture graphs persist across sessions |
| Jumps straight to code | Writes an impact report and plans Agile/AI-DLC work first |
| Ad-hoc, one prompt at a time | Autonomous Epic → Feature → Ticket backlog with per-feature human approval gates |
| Locked to one tool | One toolkit, **9 AI IDEs** (Claude Code, Cursor, Copilot, Gemini, Codex, Antigravity, and more) |
| Bloated context, high token cost | **~54% fewer tokens per invocation** via a lossless tiered skill-loading system |

The installer does **not** inspect your source, call an AI model, or generate docs itself. It ships the skills, agents, and workflows; the real work happens inside your IDE when you invoke them.

> ⭐ **If this saves you time, [star the repo](https://github.com/vinideep/engineering-intelligence)** — it's the fastest way to help others discover it.

## Supported IDEs

| IDE adapter | Installed integration | Invocation |
| --- | --- | --- |
| Antigravity | `.agent/skills`, `.agent/rules`, `.agent/workflows` | Native slash workflows |
| Antigravity CLI | `.agent/skills`, `.agent/rules`, `.agent/workflows`, managed `AGENTS.md` | Native slash workflows |
| Codex | `.agents/skills`, managed `AGENTS.md` guidance | Mention the installed `$skill-name` in chat |
| Claude Code | `.claude/skills`, `.claude/agents`, `.claude/commands`, managed `CLAUDE.md` | Native slash workflows |
| Cursor | `.cursor/rules`, `.cursor/commands` | Native slash workflows |
| GitHub Copilot | `.github/skills`, `.github/agents`, `.github/prompts`, managed instructions | Use supported skills/prompts or ask for the workflow in chat |
| Gemini CLI | `.agents/skills`, `.gemini/commands`, managed `GEMINI.md` | Native slash workflows |
| CommandCode | `.commandcode/skills`, `.commandcode/commands`, managed `AGENTS.md` | Use `/skills` or native slash commands in CommandCode terminal |
| Generic | `.agents/skills`, managed `AGENTS.md` | Ask the agent to invoke the named workflow |

## Install

From the repository that should receive the toolkit:

```bash
npx engineering-intelligence
```

For repeatable or multi-IDE setup:

```bash
npx engineering-intelligence install . --ide antigravity --ide codex --ide cursor --yes
npx engineering-intelligence install . --ide commandcode --yes
npx engineering-intelligence install ./my-project --ide claude-code,gemini-cli --dry-run
```

With no `--ide` in an interactive terminal, the CLI prompts for one or more adapters. In noninteractive use, `--yes` without an adapter installs the `generic` adapter.

## Use In A Target Repository

Initialize project understanding through the selected AI IDE:

```text
/initialize-engineering-intelligence
```

Then use the engineering workflow for implementation requests:

```text
/engineering-intelligence Add rate limiting to public authentication endpoints
```

The standard workflows embed AI-DLC and Agile delivery internally:

```text
/scope-requirement Define rate limiting for public authentication endpoints
/engineering-intelligence Add rate limiting to public authentication endpoints
/engineering-intelligence Harden public checkout APIs using adversarial delivery mode
/engineering-intelligence Implement invoice status transition rules using TDD delivery mode
/engineering-intelligence Migrate orders from MongoDB to PostgreSQL using design-first delivery mode
/engineering-intelligence Investigate intermittent checkout latency spikes using hypothesis debugging mode
```

Use the existing `/engineering-intelligence` workflow for implementation. The orchestrator selects standard Agile delivery, adversarial delivery, TDD delivery, design-first delivery, or hypothesis debugging based on risk and task shape.

V2 also includes read-only-with-respect-to-product-code workflows:

```text
/map-architecture
/analyze-impact Introduce a checkout service boundary
/sync-engineering-intelligence Review the current working-tree diff
/review-engineering-change Review the current working-tree diff
```

`/map-architecture` writes graph intelligence, `/analyze-impact` writes impact reports, `/sync-engineering-intelligence` updates intelligence artifacts, and `/review-engineering-change` writes findings. `/engineering-intelligence` and `/deliver-backlog` are the workflows intended to implement product-code changes.

### Autonomous Epic → Feature → Ticket Backlog

For epic-sized initiatives, the toolkit can autonomously decompose work into a durable, hierarchical backlog and then deliver it feature by feature behind a human approval gate:

```text
/decompose-backlog Build a self-serve billing portal with invoices, payment methods, and dunning
/deliver-backlog
/deliver-backlog FEAT-002
```

`/decompose-backlog` runs the `backlog-decomposition-engine` to create epics, features, and tickets with stable IDs (`EPIC-XXX`, `FEAT-XXX`, `TKT-XXX`), a dependency graph, and an execution order under `.engineering-intelligence/aidlc/agile/backlog/`. It plans only and does not modify product code. Every feature is created with `Approval: pending`.

`/deliver-backlog` selects the next ready feature, **requires a human to approve it**, then implements its tickets one at a time through the engineering-intelligence pipeline, rolling up ticket → feature → epic status. Each subsequent feature re-enters the approval gate.

The local markdown backlog is the source of truth. When the target repo has a GitHub remote, `issue-tracker-sync-engine` can mirror the backlog to GitHub Issues (epics, features, and tickets as linked issues), keeping local artifacts authoritative.

Where a host does not expose native custom slash commands, mention the installed skill name or request the same workflow in chat.

For CommandCode terminal projects, install with `--ide commandcode`. The installer writes project-level skills to `.commandcode/skills/` and workflow commands to `.commandcode/commands/`. CommandCode also discovers `.agents/skills/`, but the native `.commandcode/skills/` location has priority, so this adapter uses the native project-level path.

For a step-by-step guide covering new projects, existing projects, CommandCode, daily workflows, safety gates, and maintenance, see [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md).

The IDE agent, not this installer, creates and maintains:

```text
knowledge-base/
.engineering-intelligence/memory/
.engineering-intelligence/aidlc/
.engineering-intelligence/context/
.engineering-intelligence/events/
.engineering-intelligence/graph/
.engineering-intelligence/reports/
.engineering-intelligence/snapshots/
.changes/
```

Graph intelligence includes `dependency-graph.json`, `service-graph.json`, `runtime-graph.json`, `business-flow-graph.json`, and a Mermaid-backed `architecture-map.md`. Impact and review results are stored as `IMP-XXX-*.md` and `REV-XXX-*.md` reports.

Agile + AI-DLC lifecycle state is stored under `.engineering-intelligence/aidlc/`, including `aidlc-state.md`, `audit.md`, `open-questions.md`, `execution-plan.md`, `discovery/`, `agile/`, `inception/`, `construction/`, and `operations/`. The hierarchical backlog lives under `.engineering-intelligence/aidlc/agile/backlog/` as `backlog-index.md`, `epics/`, `features/`, `tickets/`, `dependency-graph.md`, and an optional `sync/tracker-sync-map.md`.

The installer reserves only `.engineering-intelligence/install-manifest.json` for safe lifecycle management.

## Lifecycle Commands

```bash
npx engineering-intelligence update . --dry-run
npx engineering-intelligence update .
npx engineering-intelligence doctor .
npx engineering-intelligence doctor . --json
npx engineering-intelligence visualize . --open
npx engineering-intelligence visualize .
npx engineering-intelligence uninstall . --dry-run
npx engineering-intelligence uninstall .
```

Installation and update track managed content hashes. Files created by the package are updated only when they still match their installed version. Shared instruction documents such as `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` receive a marked managed block; content outside that block remains user-owned. Locally modified managed content is reported as a conflict and preserved unless `--force` is explicitly provided.

`doctor` validates installed files, manifest drift, template paths, and obsolete legacy `.agent` folders.

`visualize` generates an interactive HTML dashboard (`.engineering-intelligence/dashboard.html`) to display the relationship between installed skills, workflows, agents, and artifacts. The `--open` option automatically launches it in the default browser.

Repositories installed with V1 can adopt V2 safely:

```bash
npx engineering-intelligence update .
```

The update adds graph/impact skills and workflows and updates untouched managed instruction blocks; locally edited managed files remain protected by conflict reporting.

## Toolkit Contents

The default package installs only engineering-intelligence capabilities:

- initialization, knowledge extraction, and validation
- adaptive AI-DLC Discovery, Inception, Construction, and Operations lifecycle artifacts embedded into the existing workflows
- Agile backlog, user stories, acceptance criteria, Definition of Ready, Definition of Done, sprint plan, and retrospective artifacts
- autonomous Epic → Feature → Ticket backlog decomposition with stable IDs, dependency graph, per-feature approval gates, and optional GitHub Issues sync
- delivery modes inside `/engineering-intelligence`: standard Agile, adversarial, TDD, design-first, and hypothesis debugging
- safety gates for type checking, API compatibility, API snapshots, database migrations, dependencies, environment variables, ADR compliance, LLM prompt injection, rollback, and observability
- context-budget optimization through ranked context manifests, section-level loading, graph slices, and lazy-loaded safety-gate evidence
- specialist hats for product analysis, architecture, security, data, testing, adversarial validation, performance, compliance, release, SRE, and documentation
- NFR and ADR governance, MCP security review, operations readiness, and environmental backpressure loops
- impact and testing intelligence
- evidence-backed JSON architecture graphs and Mermaid architecture mapping
- standalone impact, synchronization, and read-only engineering review workflows
- incremental knowledge, memory, and context synchronization
- change history, architecture review, and refactoring planning
- engineering orchestrator, change, quality, and knowledge roles

Earlier experimental trading, PDF, and unrelated workflow assets in this development repository are not exported in the package and are never installed into a target project.

## Development

```bash
npm install
npm test
npm pack
```

The source repository is organized as:

```text
src/adapters/      native IDE renderers
src/installer/     install, update, conflict, and uninstall behavior
src/manifest/      managed-content tracking
src/validation/    doctor and content checks
templates/canonical/ host-neutral engineering toolkit source
test/              adapter and installer lifecycle tests
```

To add an IDE adapter:

1. Add a renderer in `src/adapters/index.ts` using documented native locations and formats.
2. Reuse canonical skills and workflow meaning rather than duplicating host-specific logic.
3. Extend adapter and lifecycle tests to cover generated paths, multi-adapter compatibility, and update/uninstall behavior.
4. Document the host’s actual invocation support in the supported IDE table.

To improve workflow behavior, edit canonical templates under `templates/canonical/` and keep generated runtime paths host-neutral.

## Contributing

Contributions are welcome — new IDE adapters, workflow improvements, and skills are all great first issues. Run `npm test` before opening a PR; the adapter and lifecycle suites cover generated paths, multi-adapter compatibility, and update/uninstall behavior. See the [workflow guide](WORKFLOW_GUIDE.md) for the bigger picture.

## License

[MIT](LICENSE) — free for personal and commercial use.

---

<p align="center">
  Built to make AI coding agents accountable.<br>
  <strong>⭐ <a href="https://github.com/vinideep/engineering-intelligence">Star the repo</a></strong> if it helped, and share what you build.
</p>
