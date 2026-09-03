# Engineering Intelligence

Engineering Intelligence (EI) gives an AI coding tool a durable, evidence-backed understanding of a codebase.

It installs IDE instructions, builds a dependency graph, records verified claims, and provides safe commands for checking and updating that information.

## The shortest useful explanation

1. `initialize` sets up a project and creates its first intelligence.
2. Your AI IDE uses that intelligence before making changes.
3. `sync` updates the graph and verified facts after code changes.
4. `health` tells you whether the installation and intelligence can be trusted.

EI never treats provider output or model-written prose as authoritative by itself. Repository source, tests, manifests, and Git remain the source of truth.

## Start with an existing project

Run this from the project root:

```bash
npx engineering-intelligence initialize . --providers auto --yes
```

`auto` uses the tested Graphify and CCE providers when they are available. If they cannot be installed or run, EI keeps working with its built-in native graph and retrieval fallback and reports the degraded state.

For a deterministic setup that never installs providers:

```bash
npx engineering-intelligence initialize . --providers native --yes
```

If provider evidence is mandatory for a project, make that explicit:

```bash
npx engineering-intelligence initialize . --providers full --require-providers --yes
```

Without `--ide`, EI detects an existing adapter directory such as `.claude` or `.cursor`. If none is found, it installs the generic adapter. Choose one explicitly when needed:

```bash
npx engineering-intelligence initialize . --ide claude-code --providers auto --yes
```

## Start a new project

Create the project first, then install EI:

```bash
mkdir shiplogic
cd shiplogic
npx engineering-intelligence install . --ide claude-code --yes
```

Open the project in your AI IDE and run:

```text
/create-project Build a configurable shipping orchestration service with carrier adapters
```

After the project has source files, create its intelligence baseline:

```bash
npx engineering-intelligence initialize . --providers native --yes
```

Use `native` for a repeatable local demonstration. Use `auto` when you want the optional provider integrations.

## Updating an EI-enabled project

If the project already uses EI, including version 4.0.0, run this from its
root:

```bash
npx engineering-intelligence@latest update . --yes
npx engineering-intelligence@latest doctor .
npx engineering-intelligence@latest health . --strict
```

The update refreshes EI-managed IDE files and migrates Antigravity agents. It
does not replace project-owned configuration or locally edited managed files.

### Normal AI-assisted change

In an installed AI IDE, use the main workflow:

```text
/engineering-intelligence Add carrier capability routing for international orders
```

The workflow is responsible for impact analysis, implementation, tests, validation, and intelligence synchronization.

### Manual change or fast deterministic refresh

Give EI the files that changed:

```bash
npx engineering-intelligence@latest sync . --files src/routes/route-plan.ts,src/providers/carrier.ts
```

This command updates only deterministic artifacts:

- the EI dependency graph;
- healthy provider indexes, when enabled;
- derived claims and their verification state;
- the compact repository brief.

It does not rewrite canonical knowledge prose. For source edits it prints `requiresModelKnowledgeSync: true` in JSON, or a matching message in human-readable output. When that happens, let the IDE update only the affected knowledge sections:

```text
/sync-engineering-intelligence Review the current working-tree diff and update only affected EI knowledge
```

If you omit `--files`, EI uses the Git working-tree change set. Passing files is
faster and is recommended for large repositories. The native graph merge is
incremental; an enabled provider may still refresh its approved workspace
index, so use `--providers native` when the fastest deterministic local refresh
matters more than provider-backed retrieval.

## Check whether the project is healthy

Run the combined trust check:

```bash
npx engineering-intelligence@latest health . --strict
```

Useful focused checks are:

```bash
npx engineering-intelligence@latest doctor .
npx engineering-intelligence@latest claims verify . --strict
npx engineering-intelligence@latest verify .
npx engineering-intelligence@latest providers status .
```

`verify` runs the project’s own `check`, `ci`, `typecheck`, `lint`, and `test` scripts when they exist and writes a receipt bound to the files it checked. A command that merely looks like a test command is not enough.

## IDE commands

The installer renders the same canonical workflows for the supported IDE adapters:

`claude-code`, `cursor`, `github-copilot`, `gemini-cli`, `commandcode`, `antigravity`, `antigravity-cli`, `codex`, and `generic`.

The most useful commands are:

```text
/initialize-engineering-intelligence   Set up or rebuild the project baseline
/engineering-intelligence <request>   Plan, change, test, validate, and sync
/sync-engineering-intelligence <diff>  Update intelligence after manual edits
/review-engineering-change <request>   Review the current change
```

For Antigravity, installation and updates also create current custom agents at
`.agents/agents/<name>/agent.md`. The existing workflow files remain available
for compatibility, so an existing project can move to agents without losing
its current commands.

The generated routing table selects only the skills needed for the request. The agent should load the compact context pack before opening broad source files.

## What EI stores in the project

Initialization creates `.engineering-intelligence/` with:

- `knowledge-base/` — evidence-backed project documentation;
- `graph/` — the normalized dependency and architecture graphs;
- `claims/` — deterministic facts that can be re-derived from source;
- `context/` — small navigation maps and context-generation evidence;
- `memory/` — durable decisions and conventions;
- `aidlc/` — lifecycle, backlog, acceptance, checkpoint, and test records;
- `reports/` — impact, freshness, and validation reports.

Provider caches are project-local and disposable. EI’s normalized graph, claims, and knowledge remain the durable authority.

## Safe update rules

- Edit project-owned configuration freely; EI preserves it during updates.
- Run `doctor` after installing or upgrading the package.
- Run `update` to refresh managed IDE files:

  ```bash
  npx engineering-intelligence update . --yes
  ```

- Do not copy provider prose into the knowledge base.
- Do not use `claims add` to make an unverified sentence look like a fact. Use `claims derive` for facts the tool can compute.
- Treat `degraded`, `unverifiable`, `contested`, and `unknown` as useful warnings, not as proof of correctness.

## Shiplogic-shaped example

For a shipping project with route planning and carrier adapters:

```bash
cd /path/to/shiplogic
npx engineering-intelligence initialize . --ide claude-code --providers native --yes
npx engineering-intelligence context "change route planning" . --files src/routes/route-plan.ts
npx engineering-intelligence sync . --files src/routes/route-plan.ts,src/providers/carrier.ts
npx engineering-intelligence health . --strict
```

The repository’s `test/shiplogic-integration.test.mjs` runs this journey against a disposable project. It verifies IDE auto-detection, preservation of user settings, graph creation, ContextPackV2 retrieval, strict claims, verification receipts, health, and incremental synchronization.

## Provider choices

| Choice | Meaning |
|---|---|
| `auto` | Try optional providers; use native fallback when unavailable |
| `native` | Disable providers and use only EI’s deterministic implementation |
| `full` | Use provider-backed evidence when available; add `--require-providers` if absence must fail |

Provider tools are local and version-pinned. Raw provider inspection is an expert surface and requires:

```bash
npx engineering-intelligence providers expose . --expert
```

## Troubleshooting

`doctor` reports a package-version mismatch:

```bash
npx engineering-intelligence update . --yes
npx engineering-intelligence doctor .
```

Providers are missing: use `--providers native` for a no-download setup, or use `--providers auto` and follow the remediation printed by `providers status`.

The project’s own checks are not found: add them to `.engineering-intelligence/ei.config.json`:

```json
{
  "hooks": {
    "verifyCommands": ["npm test"]
  }
}
```

## Development in this repository

```bash
npm ci
npm test
npm run test:integration
npm run build
```

The full guide is in [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md). The implementation and architecture notes are in [engineering-intelligence-blueprint.md](engineering-intelligence-blueprint.md).
