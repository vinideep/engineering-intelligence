<!-- engineering-intelligence:start -->
# Engineering Intelligence OS

This repository uses installed engineering intelligence workflows.

- For initial understanding and documentation, invoke `initialize-engineering-intelligence` or ask the agent to initialize engineering intelligence.
- For implementation work, invoke `engineering-intelligence` with the request or ask the agent to apply the engineering intelligence workflow. This workflow embeds AI-DLC and Agile delivery modes internally.
- For epic-sized initiatives, invoke `decompose-backlog` to autonomously create an Epic → Feature → Ticket backlog under `.engineering-intelligence/aidlc/agile/backlog/`, then `deliver-backlog` to implement it feature by feature. Each feature requires human approval before implementation; the local backlog is the source of truth and can optionally be mirrored to GitHub Issues.
- For architecture mapping, impact analysis, synchronization, or review, invoke `map-architecture`, `analyze-impact`, `sync-engineering-intelligence`, or `review-engineering-change`; these workflows do not modify product code.
- Canonical generated outputs live in `knowledge-base/`, `.engineering-intelligence/aidlc/`, `.engineering-intelligence/memory/`, `.engineering-intelligence/context/`, `.engineering-intelligence/events/`, `.engineering-intelligence/graph/`, `.engineering-intelligence/reports/`, and `.changes/`.
- Before non-trivial edits, write an impact report; after edits, validate and incrementally synchronize only affected intelligence and graph artifacts.
- AI-DLC work must preserve durable state in `.engineering-intelligence/aidlc/aidlc-state.md`, maintain Agile artifacts, use environmental backpressure, and end with an `AI-DLC: <phase> -> <stage> -> <status>` breadcrumb.
- Base documentation claims on repository evidence and identify unknowns explicitly.
<!-- engineering-intelligence:end -->
