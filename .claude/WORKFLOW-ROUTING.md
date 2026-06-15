# Workflow Routing Table

> **Read this before loading any skill files.**
> For each primary skill: load `SKILL-BRIEF.md` to understand it (~150t), then `SKILL.md` to execute.
> Load **optional** skills only when the request explicitly requires that capability.
> Skill files are in `.claude/skills/<name>/` (SKILL-BRIEF.md and SKILL.md).

| Command | Primary Skills — load first | Optional Skills — load if needed |
|---|---|---|
| `engineering-intelligence` | `engineering-intelligence-skill`, `aidlc-lifecycle-engine`, `impact-analysis-engine`, `context-budget-optimizer` | `change-detection-engine`, `incremental-sync-engine`, `change-history-engine`, `environmental-backpressure-engine`, `testing-intelligence-engine`, `question-file-engine` |
| `initialize-engineering-intelligence` | `initialize-intelligence-skill` | `deep-project-knowledge-extractor`, `knowledge-base-validator`, `graph-engine`, `change-history-engine` |
| `decompose-backlog` | `backlog-decomposition-engine`, `context-budget-optimizer` | `issue-tracker-sync-engine`, `aidlc-lifecycle-engine`, `question-file-engine` |
| `deliver-backlog` | `aidlc-lifecycle-engine`, `engineering-intelligence-skill` | `backlog-decomposition-engine`, `issue-tracker-sync-engine`, `incremental-sync-engine` |
| `map-architecture` | `graph-engine` | `codebase-discovery-engine`, `git-intelligence-engine` |
| `analyze-impact` | `change-detection-engine`, `impact-analysis-engine` | `graph-engine` |
| `sync-engineering-intelligence` | `change-detection-engine`, `incremental-sync-engine` | `knowledge-sync-engine`, `memory-sync-engine`, `context-sync-engine` |
| `review-engineering-change` | `change-detection-engine`, `engineering-change-review` | `impact-analysis-engine` |
| `scope-requirement` | `requirement-scoper` | `context-budget-optimizer`, `aidlc-lifecycle-engine`, `question-file-engine` |
| `discover-codebase` | `codebase-discovery-engine`, `convention-detector`, `graph-engine` | — |
| `create-project` | `greenfield-architect`, `initialize-intelligence-skill` | — |
