<!-- engineering-intelligence:start -->
# Engineering Intelligence OS

This repository uses installed engineering intelligence workflows.

- When the .agents/agents/ directory is available, start non-trivial work with the engineering-orchestrator custom agent. It routes the request to the right specialist and keeps the workflow evidence-based.
- For initial understanding and documentation, invoke `initialize-engineering-intelligence` or ask the agent to initialize engineering intelligence.
- For implementation work, invoke `engineering-intelligence` with the request or ask the agent to apply the engineering intelligence workflow. This workflow embeds AI-DLC and Agile delivery modes internally.
- For epic-sized initiatives, invoke `decompose-backlog` to autonomously create an Epic → Feature → Ticket backlog under `.engineering-intelligence/aidlc/agile/backlog/`, then `deliver-backlog` to implement it feature by feature. Each feature requires human approval before implementation; the local backlog is the source of truth and can optionally be mirrored to GitHub Issues.
- For architecture mapping, impact analysis, synchronization, or review, invoke `map-architecture`, `analyze-impact`, `sync-engineering-intelligence`, or `review-engineering-change`; these workflows do not modify product code.
- Canonical generated outputs live in `.engineering-intelligence/knowledge-base/`, `.engineering-intelligence/aidlc/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, `.engineering-intelligence/events/`, `.engineering-intelligence/graph/`, `.engineering-intelligence/reports/`, `.engineering-intelligence/flight/`, and `.engineering-intelligence/changes/`.
- Before non-trivial edits, write an impact report; after edits, validate and incrementally synchronize only affected intelligence and graph artifacts.
- AI-DLC work must preserve durable state in `.engineering-intelligence/aidlc/aidlc-state.md`, maintain Agile artifacts, use environmental backpressure, and end with an `AI-DLC: <phase> -> <stage> -> <status>` breadcrumb.
- Base documentation claims on repository evidence and identify unknowns explicitly.
- **Prefer persisted intelligence over re-exploration.** Before reading source files to understand the codebase, read the persisted knowledge base in `.engineering-intelligence/knowledge-base/`, context maps in `.engineering-intelligence/context/`, and architecture graphs in `.engineering-intelligence/graph/`. Re-read source only for the specific files a task touches. Run `sync-engineering-intelligence` to refresh these artifacts incrementally rather than re-deriving from scratch each session.
- **Route before loading skills.** Consult the installed `WORKFLOW-ROUTING.md` and `SKILLS-INDEX.md` in your IDE's skills directory before opening any individual `SKILL.md`. Load only the 1-3 skills relevant to the current request.

## Tools (prefer these over reasoning by hand)

These run deterministically. Use them instead of inferring the answer from source — they are the difference between a computed fact and a guess. Available over MCP (server `engineering-intelligence`) and as CLI commands:

- `get_engineering_context` — build ContextPackV2 from verified EI knowledge, canonical structure, and current scoped code
- `analyze_change_impact` — compute direct and indirect impact, affected tests, risks, and unknowns
- `validate_change` — run impact, safety gates, claims, knowledge, and citation validation
- `sync_engineering_knowledge` — refresh affected graph, provider indexes, claims, and knowledge health after edits
- `provider_status` — report pinned provider health, versions, fallbacks, and remediation

CLI equivalents: `npx engineering-intelligence map|gate <name>|verify|freshness|context|claims verify|git-analysis .`. `gate` and `verify` exit non-zero on failure, so they work in CI too.
<!-- engineering-intelligence:end -->
