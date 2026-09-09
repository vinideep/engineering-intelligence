# Changelog

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
