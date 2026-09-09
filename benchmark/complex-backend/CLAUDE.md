<!-- engineering-intelligence:start -->
# Engineering Intelligence OS

This repository uses installed engineering intelligence workflows.

- For initial understanding and documentation, invoke `initialize-engineering-intelligence` or ask the agent to initialize engineering intelligence.
- For implementation work, invoke `engineering-intelligence` with the request or ask the agent to apply the engineering intelligence workflow. This workflow embeds AI-DLC and Agile delivery modes internally.
- For epic-sized initiatives, invoke `decompose-backlog` to autonomously create an Epic → Feature → Ticket backlog under `.engineering-intelligence/aidlc/agile/backlog/`, then `deliver-backlog` to implement it feature by feature. Each feature requires human approval before implementation; the local backlog is the source of truth and can optionally be mirrored to GitHub Issues.
- For architecture mapping, impact analysis, synchronization, or review, invoke `map-architecture`, `analyze-impact`, `sync-engineering-intelligence`, or `review-engineering-change`; these workflows do not modify product code.
- Canonical generated outputs live in `.engineering-intelligence/knowledge-base/`, `.engineering-intelligence/aidlc/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, `.engineering-intelligence/events/`, `.engineering-intelligence/graph/`, `.engineering-intelligence/reports/`, and `.engineering-intelligence/changes/`.
- Before non-trivial edits, write an impact report; after edits, validate and incrementally synchronize only affected intelligence and graph artifacts.
- AI-DLC work must preserve durable state in `.engineering-intelligence/aidlc/aidlc-state.md`, maintain Agile artifacts, use environmental backpressure, and end with an `AI-DLC: <phase> -> <stage> -> <status>` breadcrumb.
- Base documentation claims on repository evidence and identify unknowns explicitly.
- **Prefer persisted intelligence over re-exploration.** Before reading source files to understand the codebase, read the persisted knowledge base in `.engineering-intelligence/knowledge-base/`, context maps in `.engineering-intelligence/context/`, and architecture graphs in `.engineering-intelligence/graph/`. Re-read source only for the specific files a task touches. Run `sync-engineering-intelligence` to refresh these artifacts incrementally rather than re-deriving from scratch each session.
- **Route before loading skills.** Consult the installed `WORKFLOW-ROUTING.md` and `SKILLS-INDEX.md` in your IDE's skills directory before opening any individual `SKILL.md`. Load only the 1-3 skills relevant to the current request.

## Tools (prefer these over reasoning by hand)

These run deterministically. Use them instead of inferring the answer from source — they are the difference between a computed fact and a guess. Available over MCP (server `engineering-intelligence`) and as CLI commands:

- `map_dependencies` — build/refresh the computed dependency graph from source imports
- `get_graph` — read an existing graph as JSON
- `analyze_impact` — given changed files, list the modules that import them (direct + indirect)
- `run_gate` — run a deterministic safety gate: env-vars, dead-exports, api-diff, migration-lint
- `get_context` — assemble a token-budgeted context pack for a task
- `verify_claims` — check claims: derived facts are re-computed; asserted prose is never called verified
- `derive_claims` — recompute the derived-fact baseline (imports, dependencies, routes) from source
- `read_knowledge` — list or read knowledge-base documents

CLI equivalents: `npx engineering-intelligence map|gate <name>|verify|freshness|context|claims verify|git-analysis .`. `gate` and `verify` exit non-zero on failure, so they work in CI too.

## Token-Efficient Skill Loading (Claude Code)

**Three-tier loading protocol** — follow this order on every invocation:

**Tier 1 — Routing (load once, always pinned)**
1. `.claude/WORKFLOW-ROUTING.md` — primary/optional skill map per command (~400t)
2. `.claude/skills/SKILLS-INDEX.md` — one-line description of all 46 skills (~1,500t)

**Tier 2 — Brief (load per identified skill, ~150t each)**
Load `.claude/skills/<name>/SKILL-BRIEF.md` for each primary skill identified in the routing table.
The brief confirms relevance and summarises inputs — do not execute the skill from the brief alone.

**Tier 3 — Full skill (load at execution time only)**
Load `.claude/skills/<name>/SKILL.md` immediately before executing that skill's procedure.
Never skip this step — the brief does not contain the complete procedure.

Load **optional** skills only when the request explicitly requires that capability.

## Enforcement Hooks (Claude Code)

`.claude/settings.json` wires four lifecycle hooks to `engineering-intelligence hook <event>`:
- **SessionStart** injects the current intelligence freshness/drift summary.
- **PreToolUse** warns before editing source while documentation is stale.
- **PostToolUse** records changed source files and validation commands for the session.
- **Stop** can require that a validation command actually ran before finishing.

Tune behaviour in `.engineering-intelligence/ei.config.json` (`blockStaleEdits`, `requireValidationOnStop`, `freshnessThreshold`). Hooks are fail-safe: with no intelligence installed they do nothing.
<!-- engineering-intelligence:end -->
