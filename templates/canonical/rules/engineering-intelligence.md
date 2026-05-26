# Engineering Intelligence Rules

## Pre-Edit Requirements

When `knowledge-base/` exists, consult the relevant documents, `.engineering-intelligence/context/`, and `.engineering-intelligence/graph/` before non-trivial project edits.

## Engineering Change Protocol

For every engineering change, follow this sequence:

| Step | Action | Output |
|---|---|---|
| 1 | Write impact report before editing | `.engineering-intelligence/reports/IMP-XXX-*.md` |
| 2 | Implement code changes and tests | Modified source and test files |
| 3 | Validate honestly — report unrun checks | Test results, lint results |
| 4 | Incrementally update affected intelligence and graph artifacts | Updated knowledge/memory/context/graph |
| 5 | Record completed work | `.changes/CHG-XXX-*.md` |

## Read-Only Workflows

These workflows analyze and report but do **not** modify product code:

| Workflow | Purpose | Output |
|---|---|---|
| `map-architecture` | Build evidence-backed graphs | Graph JSON, architecture-map.md, context updates |
| `analyze-impact` | Write impact report for a proposal or diff | `.engineering-intelligence/reports/IMP-XXX-*.md` |
| `sync-engineering-intelligence` | Synchronize intelligence for a change | Updated knowledge/memory/context/graph |
| `review-engineering-change` | Write review findings | `.engineering-intelligence/reports/REV-XXX-*.md` |

Only the `engineering-intelligence` implementation workflow is intended to modify product code.

## Canonical Paths

Use these as the canonical project-intelligence paths — never invent alternatives:

| Path | Purpose |
|---|---|
| `knowledge-base/` | Evidence-based project documentation |
| `.engineering-intelligence/memory/` | Durable decisions, rules, patterns |
| `.engineering-intelligence/context/` | Compact AI navigation maps |
| `.engineering-intelligence/events/` | Change-event guidance |
| `.engineering-intelligence/graph/` | Architecture graph JSON + Mermaid maps |
| `.engineering-intelligence/reports/` | Impact (IMP) and review (REV) reports |
| `.changes/` | Sequential change history records |

## Evidence Rules

- Never invent undocumented implementation facts
- Back every material claim with a file path reference
- Mark uncertainty explicitly — silence is worse than "unknown"
- Use `**Not detected**` for absent features, not omission
