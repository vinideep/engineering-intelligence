# GraphWard

GraphWard gives AI coding agents a computed map of your codebase: a real dependency and call graph, impact analysis, safety gates and an evidence-checked knowledge base. Agents use it to check facts before they change code instead of guessing.

> **Renamed from `engineering-intelligence`.** The npm package `engineering-intelligence` is deprecated in favour of `graphward`. This repository is version **6.0.0** and is marked `private`. It is **not** the `graphward` currently published on npm (1.x), which is built from a separate repository. Run it from source as shown below. Existing installs migrate automatically: see [Migrating from engineering-intelligence](#migrating-from-engineering-intelligence).

---

## What it does

1. **Maps your project.** It builds `.graphward/graph/dependency-graph.json`:
   - module imports for TypeScript/JavaScript (`.ts .tsx .mts .cts .js .jsx .mjs .cjs`), Python, Go, Rust, Ruby, Java and Kotlin;
   - function and method calls for TypeScript/JavaScript and Python.
2. **Answers impact questions.** `impact <file>` and `who-calls <symbol>` report direct and indirect dependents, the tests to run, and high-churn risk, each with `file:line` evidence.
3. **Runs safety gates.** These are `env-vars`, `dead-exports`, `api-diff` and `migration-lint`. They are deterministic and exit non-zero in CI.
4. **Verifies before "done".** `verify` runs your project's own checks and binds the result to the exact bytes it checked. The Stop hook can require that receipt.
5. **Clarifies before building.** The clarification gate and the AI-DLC state tools record the decisions you made before construction starts.
6. **Ships agent workflows.** It installs skills, agents and workflows for 9 AI editors, plus an MCP server that exposes the tools above.

GraphWard reports what it can't resolve (`unknowns`) rather than guessing. Results are only as good as the source it can parse and the tests you have.

---

## Install (from source)

Requirements: Node.js **20.11+** and git. The optional Graphify and CCE providers also need `uv` and Python 3.11+.

```bash
git clone https://github.com/vinideep/engineering-intelligence.git graphward
cd graphward
npm ci
npm run build
npm link            # puts `graphward` and `gw` on your PATH (optional)
```

Without `npm link`, run `node /absolute/path/to/graphward/dist/cli/index.js <command>`.

## Quick start

```bash
cd /path/to/your/project
graphward initialize . --yes          # detects your editors, installs workflows, builds the graph
```

This creates `.graphward/`, holding the graph, knowledge base, memory, AI-DLC state and reports, and installs the editor files. Then open the project in your editor and start non-trivial work with the **`engineering-orchestrator`** agent, or run the `graphward` workflow with your request.

### Supported editors

| `--ide` id | Editor |
|---|---|
| `claude-code` | Claude Code |
| `cursor` | Cursor |
| `codex` | OpenAI Codex |
| `github-copilot` | GitHub Copilot |
| `gemini-cli` | Gemini CLI |
| `antigravity`, `antigravity-cli` | Google Antigravity |
| `commandcode` | CommandCode |
| `generic` | Any agent that reads `AGENTS.md` and `.agents/skills/` |

## Command reference

```bash
graphward --help            # common commands
graphward --help --all      # every command

graphward context "add rate limiting to login" --files src/auth/login.ts
graphward impact src/payments/gateway.ts
graphward who-calls chargeCard
graphward gate api-diff . --base origin/main
graphward verify .
graphward health . --strict
graphward sync . --files src/index.ts
```

Initialization modes:

| Command | Use it for |
|---|---|
| `graphward initialize . --yes` | The default: managed providers are used when available, with the native parser as fallback |
| `graphward initialize . --providers native --yes` | Offline and deterministic: built-in parser only, no downloads |
| `graphward initialize . --ide cursor --yes` | Targeting one editor explicitly |

### MCP server

Editors that read `.mcp.json` or `.cursor/mcp.json` start the server themselves after `install`. The generated registration pins the version, as `npx -y graphward@<version> mcp`. That resolves only once this version is published. Until then, point it at your build:

```json
{ "mcpServers": { "graphward": { "command": "node", "args": ["/absolute/path/to/graphward/dist/cli/index.js", "mcp", "."] } } }
```

It advertises 13 tools:

- **Context and impact:** `get_engineering_context`, `analyze_change_impact`
- **Validation and sync:** `validate_change`, `sync_engineering_knowledge`, `provider_status`
- **Clarification and AI-DLC:** `assess_prompt_clarity`, `check_aidlc_gate`, `freeze_clarified_requirements`, `get_aidlc_state`, `update_aidlc_state`
- **Experiments:** `generate_experiment_candidates`, `evaluate_experiment_step`, `get_experiment_history`

### What GraphWard stores in your repository

Everything lives under `.graphward/`:

- `graph/`: `dependency-graph.json` (modules, symbols, imports, calls).
- `knowledge-base/`: evidence-cited documentation.
- `claims/`: machine-checked facts (`claims derive`) and attributed assertions (`claims add`).
- `aidlc/`: lifecycle state, requirements, questions and backlog.
- `memory/`: conventions, decisions and negative constraints.
- `reports/`, `changes/`, `flight/`: impact reports, change history and tracked-change records.
- `gw.config.json`: your configuration. It is written once and is yours to edit. Hook behaviour lives under its `hooks` key.

Files under `.graphward/` are excluded from analysis. To exclude other paths, add them to `.gwignore`, which uses `.gitignore` syntax.

## Migrating from engineering-intelligence

This happens automatically the first time any `graphward` command, hook or MCP server runs in a project:

- `.engineering-intelligence/` is moved to `.graphward/`, and `ei.config.json` is renamed to `gw.config.json`. If both directories already exist, nothing is merged. The old one is left for you to remove.
- `graphward update .` then replaces the old hook entries, the `mcpServers.engineering-intelligence` key and the old `CLAUDE.md`/`AGENTS.md` block in place. Old-named skills and workflows that you never edited are removed:
  - `engineering-intelligence-skill`
  - `initialize-engineering-intelligence`
  - `sync-engineering-intelligence`
- The old names still work. `EI_*` environment variables are read when the matching `GW_*` variable is unset, `.eiignore` is honoured when there is no `.gwignore`, and the `engineering-intelligence` and `ei-mcp` binaries remain as aliases.

The GitHub repository is still named `engineering-intelligence`. Renaming it is up to the maintainer.

## Development

```bash
npm ci
npm run build              # tsc → dist/
npm test                   # build + every unit test file in test/ (scripts/run-tests.mjs)
npm run test:integration   # install, MCP and end-to-end CLI tests
npm run test:benchmark     # deterministic benchmark on a disposable fixture copy
```

Contributor and agent guidance (layout, conventions, how to add a skill, gate or MCP tool) is in [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md). Workflow details are in [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md). [docs/blueprint.md](docs/blueprint.md) is the original design document; it is kept for history and does not describe the current architecture.
