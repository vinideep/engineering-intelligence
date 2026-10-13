# Changelog

## 6.0.0 — Renamed to GraphWard; accuracy fixes

The npm package `engineering-intelligence` is deprecated as "Renamed to
graphward". This release renames the codebase to match. The package is marked
`private` because npm's `graphward` 1.x is published from a separate repository.

### Breaking (with automatic migration)

| Before | Now |
|---|---|
| package / CLI `engineering-intelligence`, `ei-mcp` | `graphward`, `gw`, `gw-mcp` (old names kept as alias bins) |
| `.engineering-intelligence/`, `ei.config.json`, `.eiignore` | `.graphward/`, `gw.config.json`, `.gwignore` |
| `EI_PROVIDER_HOME` and other `EI_*` env vars | `GW_*` (the `EI_*` names are still read) |
| MCP key / managed block id `engineering-intelligence` | `graphward` |
| skill `engineering-intelligence-skill`; workflows `engineering-intelligence`, `initialize-engineering-intelligence`, `sync-engineering-intelligence` | `graphward-skill`; `graphward`, `initialize-graphward`, `sync-graphward` |

Any `graphward` command, hook or MCP server moves the legacy directory and
config into place the first time it runs. `graphward update .` then replaces
the old hook entries, MCP key and managed block, and removes the old-named
skill and workflow files if you never edited them.

Generated hooks, hook messages, skills, MCP registration and CI templates now
pin the CLI (`npx graphward@<version>`), so npm's `latest` can't run a
different release from the one that installed the project.

### Fixed: analysis that gave confidently wrong answers

- **dead-exports** reported live exports as dead whenever a module was an
  `index.ts` consumed through a namespace or dynamic import, because the ids
  didn't match (118 → 32 findings on this repository). Imports of `dist/` now
  count as uses of `src/`.
- **verify / Stop gate.** Trimming `git status --porcelain` output corrupted
  the first changed path, so that file was never checked and the gate could
  pass unverified edits.
- **Monorepos and renames.** Git paths are now mapped to the analysed root
  (`--relative`, `--show-prefix`), and renames report both sides. This fixes
  incremental graph refresh, churn, flight tracking, the api-diff and
  migration-lint gates, and freshness.
- **Call graph.**
  - Receiver method calls such as `set.has(` no longer resolve to a
    same-named user method.
  - A JS/TS caller never resolves a call into a module it doesn't import.
  - Symbols are extracted from masked source, so strings, comments and regexes
    produce no calls.
  - Symbol paths keep their file extension, so `testsToRun` lists real files.
- **Scanner.** Regex literals (for example `/\/*$/`) no longer swallow the
  imports that follow them, and `${}` template interpolations are parsed as
  code.
- **Imports.**
  - `.jsx`, `.mts` and `.cts` are parsed everywhere.
  - A runtime re-export after a type alias is no longer labelled type-only.
  - Python `import x as y` and `from . import z` resolve to real ids.
  - Rust `use crate::` resolves from the crate root.
- **Gates.**
  - api-diff no longer loses every route after a `"/*"` wildcard.
  - migration-lint checks SQL statements, not lines, so multi-line `ALTER` and
    `UPDATE` statements are caught.
  - env-vars handles mixed-case names and destructured `process.env`.
- **Context classification** uses the words in the task plus specific path
  signals, not substrings. `src/index.ts` is no longer a "database change".
- **MCP.** `read_knowledge` and `get_graph` can no longer read files outside
  their directories (path traversal).
- **Claims and freshness.**
  - Claim hashes ignore CRLF line endings.
  - Undated documents use their real last-modified date.
  - Sources with uncommitted edits count as changed now.
- **Rendering.**
  - HTML comments inside code are no longer stripped from skills, which broke
    the freshness-marker instructions.
  - Routing files only mention `SKILL-BRIEF.md` when briefs are installed.

### Agent-facing documentation

- The installed `CLAUDE.md`/`AGENTS.md` block lists all 13 advertised MCP tools
  with their real CLI equivalents, the correct `hooks.*` config keys, and a
  computed skill count. Tests pin all of these to the code.
- The repository's own `CLAUDE.md`/`AGENTS.md` now explain how to develop it.
  `.mcp.json` runs the local build.
- `--help` is reorganised and covers every command.
- `npm test` discovers test files automatically (`scripts/run-tests.mjs`).
- Removed one-off session and marketing files, and the stale install that was
  committed inside the benchmark fixture.

## 4.2.0 – 5.0.0 (summarised from git history)

- Consolidated MCP surface: `get_engineering_context`, `analyze_change_impact`,
  `validate_change`, `sync_engineering_knowledge` and `provider_status`. The
  older tools remain callable by name.
- Managed Graphify and CCE providers with pinned versions and a native fallback.
- AI-DLC clarification gate and state tools.
- Graph-guided experiment tools.
- Cross-platform CI fixes.

## 4.1.0 — Antigravity custom agents

- Antigravity and Antigravity CLI now install native Markdown custom agents at
  `.agents/agents/<name>/agent.md`.
- Existing workflow, skill, rule, and locally edited legacy agent files are
  preserved during updates; workflows remain available as compatibility entry
  points.

## 3.0.0 — Correctness release

This release is mostly about **removing things that were not true**. Several
subsystems reported success they had not earned; each is now either enforced for
real or labelled honestly. Every claim below was reproduced before and after.

### Breaking

| Change | Why | What to do |
|---|---|---|
| Path aliases (`$EI`, `$AIDLC`) removed from all rendered files | The alias preamble sat **above** the YAML fence, so no host could parse `name` / `description` / `argument-hint` — skill auto-invocation was silently dead for every skill and command. Aliases also produced 240 glued tokens like `$EIknowledge-base/`. | Nothing, unless you wrote custom skills using the aliases — replace them with literal `.engineering-intelligence/...` paths. |
| `claims add` requires `--author`, and never yields `verified` | Free text anchored to real code used to report `verified` forever. | Add `--author "you"`. Use `claims derive` for facts you want machine-checked. |
| `claims.json` gains `kind` (`derived` \| `asserted`) | Only re-computable statements may be called facts. | None — claims written before this are read as `asserted`, never promoted. |
| `.claude/settings.json` / `.cursor/hooks.json` are **merged**, not owned | A pre-existing settings file used to conflict, silently skipping the whole enforcement layer. | None. Your `permissions`, `model`, `env` and your own hooks are preserved; `uninstall` removes only our entries. |
| `ei.config.json` is seeded, not managed | Editing it — the documented way to enable enforcement — caused a permanent doctor warning and update conflicts. | None. It is yours after first write. |
| Stop hook requires a verification **receipt** | The old gate matched shell history, so `rm -rf build` satisfied it. | Run `engineering-intelligence verify .` (or let the agent). |
| API: `isValidationCommand` → `looksLikeValidationCommand`; `statusFromFindings(findings, failOn?)` | The old name implied it gated something. | Only affects direct library consumers. |

### Fixed

- **Frontmatter at byte 0** across all 9 adapters, with a render-time guard.
- **`analyzeImpact` returned confident empty answers** — multi-line imports were
  invisible and 5 of 7 languages were dropped. It now returns the real importers.
- **The graph asserted falsehoods**: edges fabricated from comments and string
  literals, 25 of 48 node paths that did not exist on disk, a structurally
  always-empty `unknowns`, and type-only imports double-counted as runtime
  dependencies. All now correct, with `unknown` emitted where resolution fails.
- **Freshness rewarded emptiness** — an uncited doc scored 100/"fresh", beating a
  conscientious one. Uncited docs are now `unverifiable`; a future "last updated"
  date no longer inflates a score above 100.
- **Two of four gates could never fail** (`env-vars`, `dead-exports` emit no
  `error` findings). Added `--fail-on warning` to make them blocking.
- **`api-diff` false positives**: HTTP client calls (`api.get(...)` in an axios
  wrapper) read as route registrations, and comparison was per-file so moving a
  route between files looked breaking. Now framework-anchored and repo-wide.
- **MCP tools were unreachable** — no adapter registered the server and 3 of 69
  templates named a tool. The server is now registered (`.mcp.json`) and all
  tools are named in the installed instructions.
- The dashboard skill catalog was 289 hand-maintained lines and had already
  drifted (one skill missing entirely); it is now derived from the templates.

### Added

- `engineering-intelligence verify` — runs the project's own checks and writes a
  receipt binding the result to a sha256 of every changed file.
- `engineering-intelligence claims derive` — computes module imports, package
  dependencies and HTTP routes from source as **derived** (re-computable) claims.
- `engineering-intelligence gate <name> --fail-on error|warning`.
- `derive_claims` MCP tool; `.mcp.json` / `.cursor/mcp.json` registration.
- `bench/replay.mjs` (`npm run bench`) — a zero-inference replay measuring
  whether the derived-fact layer notices real commits, and how noisy it is.

### Known limits, measured

Running `npm run bench` on this repository's own last 12 commits:

```
detection rate:                   0.417
median churn per detected commit: 3 (max 4)
```

The derived-fact layer sees **imports, package dependencies and HTTP routes**. It
is precise (low churn) but **narrow**: it does not notice changes made *inside*
functions, which is most of them. Treat derived facts as a reliable map of
structure, not as a change detector. This number is published because it is the
honest one, not because it flatters.
