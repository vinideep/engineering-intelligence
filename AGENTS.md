# Developing GraphWard

This file has two parts. **This section** is the contributor guide for this repository and is maintained by hand. The block below it, between the `graphward:start` and `graphward:end` markers, is what `graphward install` writes into *user* projects. It is regenerated, so never edit it by hand.

## Facts an agent needs before editing

- **Runtime:** Node.js >= 20.11. ESM (`"type": "module"`), TypeScript with `module: NodeNext`, `strict`.
  - Relative imports **must** use `.js` specifiers (`import { x } from "./x.js"` for `x.ts`).
- **Build:** `npm ci && npm run build` (`tsc` → `dist/`). Tests and the CLI run from `dist/`, so rebuild after every source change.
- **Tests:**
  - `npm test` builds and then runs every `test/*.test.mjs` except the integration set (`scripts/run-tests.mjs`).
  - `npm run test:integration` runs the install, MCP and end-to-end CLI tests.
  - Tests use `node:test` and `node:assert/strict`, import from `../dist/...`, and create fixtures under `os.tmpdir()`.
- **Self-checks** (run after changes):
  - `node dist/cli/index.js gate dead-exports .`
  - `node dist/cli/index.js verify .`
  - `node dist/cli/index.js health .`
- **`.graphward/` and `.claude/` are gitignored.** They exist only after `node dist/cli/index.js install|initialize .` has been run in this checkout. If they are missing, there is no persisted knowledge base. Read the source, and don't assume the instructions in the block below have been followed.
- **MCP server:** `.mcp.json` runs the local build (`node dist/cli/index.js mcp .`), so build first. `install` on this repository rewrites `.mcp.json` to the published `npx graphward@<version>` form. Restore it with `git checkout .mcp.json`.

## Layout

| Path | What it is |
|---|---|
| `src/cli/index.ts` | CLI entry. `COMMANDS` list, argument parsing, `usage()` (keep the help in sync with `COMMANDS`) |
| `src/mcp/index.ts`, `src/mcp/consolidated.ts` | MCP server. `consolidated.ts` holds the advertised tools; `index.ts` holds the legacy tools (callable, not advertised) and `MCP_TOOL_SUMMARY` |
| `src/graph/` | Dependency and call graph. `parsers/scan.ts` masks comments, strings and regexes; `parsers/imports.ts` and `parsers/symbols.ts` do extraction; `source-exts.ts` holds the one extension list |
| `src/gates/` | Deterministic safety gates (`GATE_NAMES` in `gates/index.ts`) |
| `src/verify/`, `src/hooks/` | Verification receipts and IDE lifecycle hooks (the Stop gate) |
| `src/context/` | ContextPackV2 assembly (`orchestrator.ts`) |
| `src/adapters/index.ts` | Per-IDE rendering of skills, agents and workflows, plus the managed instruction block |
| `src/installer/` | Install, update and uninstall. Managed blocks, JSON merge, manifest |
| `src/config/` | `gw.config.json` loading; `legacy.ts` holds the pre-rename (`engineering-intelligence`) migration |
| `src/process/` | Subprocess wrapper. `git-paths.ts` is the **only** place that turns git output into root-relative paths |
| `templates/canonical/{skills,agents,workflows,rules}` | Source of truth for everything installed into user projects |
| `.agents/` | Generated output of the antigravity adapter for this repo. Regenerate it; never edit it by hand |
| `benchmark/complex-backend/` | Benchmark fixture source. The runner installs into a disposable copy |

## Conventions that keep the tool accurate

- **Never parse git paths by hand.** Use `src/process/git-paths.ts`:
  - Porcelain output must not be trimmed.
  - Paths are relative to the repository top level unless you pass `--relative` or map them with `--show-prefix`.
- **Never pattern-match raw JS/TS source.** Run `maskSource()` first, so comments, strings and regex literals can't produce imports, calls or routes.
- **Report what you can't resolve.** Put it in `unknowns` and don't guess. A missing edge is safer than a confident wrong one.
- **Agent-facing text is tested.** `test/agent-docs.test.mjs` pins the installed instructions to the code (tool list, CLI commands, counts, pinned `npx graphward@<version>`). If you add a tool or command, update `MCP_TOOL_SUMMARY` or `usage()`.
- **Every analysis bug fix adds a regression test** that fails on the old code (see `test/accuracy-regressions.test.mjs`).

## Common changes

- **New skill:**
  1. Add `templates/canonical/skills/<name>/SKILL.md` with `name` and `description` frontmatter.
  2. Add the name to `SKILL_NAMES` in `src/templates.ts`.
  3. Route it from a workflow (`WORKFLOW_SKILL_ROUTING` in `src/token-optimizer.ts`) or an agent (`AGENT_METADATA` in `src/adapters/index.ts`). The tests require every skill to be reachable.
- **New gate:** add `src/gates/<name>.ts`, add it to `GATE_NAMES` and the `runGate` switch in `src/gates/index.ts`, add tests in `test/gates.test.mjs`, and add it to `usage()`.
- **New MCP tool:** register it in `src/mcp/consolidated.ts` and add it to `MCP_TOOL_SUMMARY` in `src/mcp/index.ts`. `test/agent-docs.test.mjs` fails until both agree.
- **Regenerate this repo's installed files:**
  1. `npm run build && node dist/cli/index.js install . --ide antigravity --ide claude-code --yes`
  2. `git checkout .mcp.json`

## Releases

- `package.json` is `"private": true`. npm's `graphward` 1.x comes from a different repository, and publishing this as `graphward` would replace it. Removing the flag is a deliberate maintainer decision.
- The versions pinned in `templates/github-action/graphward-impact.yml` and `templates/canonical/ci/gw-drift-check.yml` must match `package.json`. A test enforces this.

<!-- graphward:start -->
# GraphWard

This repository uses installed GraphWard workflows.

- When the .agents/agents/ directory is available, start non-trivial work with the engineering-orchestrator custom agent. It routes the request to the right specialist and keeps the workflow evidence-based.
- For initial understanding and documentation, invoke `initialize-graphward` or ask the agent to initialize GraphWard.
- For implementation work, invoke `graphward` with the request or ask the agent to apply the GraphWard workflow. This workflow embeds AI-DLC and Agile delivery modes internally.
- For epic-sized initiatives, invoke `decompose-backlog` to autonomously create an Epic → Feature → Ticket backlog under `.graphward/aidlc/agile/backlog/`, then `deliver-backlog` to implement it feature by feature. Each feature requires human approval before implementation; the local backlog is the source of truth and can optionally be mirrored to GitHub Issues.
- For architecture mapping, impact analysis, synchronization, or review, invoke `map-architecture`, `analyze-impact`, `sync-graphward`, or `review-engineering-change`; these workflows do not modify product code.
- Canonical generated outputs live in `.graphward/knowledge-base/`, `.graphward/aidlc/`, `.graphward/memory/`, `.graphward/context/`, `.graphward/events/`, `.graphward/graph/`, `.graphward/reports/`, `.graphward/flight/`, and `.graphward/changes/`.
- Before non-trivial edits, write an impact report; after edits, validate and incrementally synchronize only affected intelligence and graph artifacts.
- AI-DLC work must preserve durable state in `.graphward/aidlc/aidlc-state.md`, maintain Agile artifacts, use environmental backpressure, and end with an `AI-DLC: <phase> -> <stage> -> <status>` breadcrumb.
- Base documentation claims on repository evidence and identify unknowns explicitly.
- **Prefer persisted intelligence over re-exploration.** Before reading source files to understand the codebase, read the persisted knowledge base in `.graphward/knowledge-base/`, context maps in `.graphward/context/`, and architecture graphs in `.graphward/graph/`. Re-read source only for the specific files a task touches. Run `sync-graphward` to refresh these artifacts incrementally rather than re-deriving from scratch each session.
- **Route before loading skills.** Consult the installed `WORKFLOW-ROUTING.md` and `SKILLS-INDEX.md` in your IDE's skills directory before opening any individual `SKILL.md`. Load only the 1-3 skills relevant to the current request.

## Tools (prefer these over reasoning by hand)

These run deterministically. Use them instead of inferring the answer from source — they are the difference between a computed fact and a guess. MCP server `graphward` advertises 13 tools:

- `get_engineering_context` — build ContextPackV2 from verified GraphWard knowledge, canonical structure, and current scoped code (CLI: `npx graphward@6.0.0 context "<task>" [--files a,b] [--budget N]`)
- `analyze_change_impact` — compute direct and indirect impact, affected tests, risks, and unknowns (CLI: `npx graphward@6.0.0 impact <file...>`)
- `validate_change` — run impact, safety gates, claims, knowledge, and citation validation
- `sync_engineering_knowledge` — refresh affected graph, provider indexes, claims, and knowledge health after edits (CLI: `npx graphward@6.0.0 sync [--files a,b]`)
- `provider_status` — report pinned provider health, versions, fallbacks, and remediation (CLI: `npx graphward@6.0.0 providers status`)
- `assess_prompt_clarity` — score a request's clarity and list the questions to ask before building
- `check_aidlc_gate` — check whether the repository meets the criteria to leave the current AI-DLC phase
- `freeze_clarified_requirements` — write the chosen clarification answers to `.graphward/aidlc/inception/requirements.md` before construction
- `get_aidlc_state` — read the durable AI-DLC position and breadcrumb
- `update_aidlc_state` — update the durable AI-DLC position and breadcrumb
- `generate_experiment_candidates` — rank optimization candidates from graph and git signals (CLI: `npx graphward@6.0.0 experiment candidates`)
- `evaluate_experiment_step` — verify one experiment change and KEEP or REVERT it
- `get_experiment_history` — list past experiments and their verdicts

Other CLI checks: `gate <env-vars|dead-exports|api-diff|migration-lint> .`, `verify .`, `claims verify .`, `freshness .`, `health .`. `gate` and `verify` exit non-zero on failure, so they work in CI too. The `.graphward/` directory exists only after `install`/`initialize`; if it is missing, the knowledge base has not been generated yet — say so instead of assuming its contents.
<!-- graphward:end -->
