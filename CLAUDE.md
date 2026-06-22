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

## Token-Efficient Skill Loading (Claude Code)

**Three-tier loading protocol** — follow this order on every invocation:

**Tier 1 — Routing (load once, always pinned)**
1. `.claude/WORKFLOW-ROUTING.md` — primary/optional skill map per command (~400t)
2. `.claude/skills/SKILLS-INDEX.md` — one-line description of all 44 skills (~1,500t)

**Tier 2 — Brief (load per identified skill, ~150t each)**
Load `.claude/skills/<name>/SKILL-BRIEF.md` for each primary skill identified in the routing table.
The brief confirms relevance and summarises inputs — do not execute the skill from the brief alone.

**Tier 3 — Full skill (load at execution time only)**
Load `.claude/skills/<name>/SKILL.md` immediately before executing that skill's procedure.
Never skip this step — the brief does not contain the complete procedure.

Load **optional** skills only when the request explicitly requires that capability.

Path aliases used in skill and command files (expand before writing file paths):
- `$AIDLC` = `.engineering-intelligence/aidlc/`
- `$EI` = `.engineering-intelligence/`
<!-- engineering-intelligence:end -->
