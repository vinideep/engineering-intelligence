> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: issue-tracker-sync-engine
description: Mirrors the local Epic to Feature to Ticket backlog to an external issue tracker such as GitHub Issues, keeping the local markdown backlog as the source of truth and recording a stable ID mapping. Use to publish or refresh tracker issues from the backlog.
---

# Issue Tracker Sync Engine

Synchronize the local backlog under `$AIDLCagile/backlog/` to an external issue tracker. The **local markdown backlog is always the source of truth**; the tracker is a mirror. This skill does not modify product code.

## When To Run

- The user asks to publish, sync, or push the backlog to GitHub Issues (or another tracker).
- A new feature or ticket was created or its status changed and the backlog is configured to sync.
- Sync is optional: skip silently when no tracker is configured or detected.

## Tracker Detection

1. Prefer an explicit tracker named by the user or recorded in `sync/tracker-sync-map.md`.
2. Otherwise detect a GitHub remote (e.g. `git remote -v` shows a `github.com` origin) and treat GitHub Issues as the target.
3. If no tracker is available, record `tracker: none` in `sync/tracker-sync-map.md` and stop without error.

## Mapping Model

Map the local hierarchy onto tracker primitives:

| Local | GitHub Issues | Generic Tracker |
|---|---|---|
| Epic | Issue labeled `epic` (parent / tracking issue) | Epic / initiative |
| Feature | Issue labeled `feature`, linked to epic (sub-issue when supported) | Story / feature |
| Ticket | Issue labeled `ticket`/`task`, linked to feature | Task / sub-task |

Record every link in `sync/tracker-sync-map.md`:

```markdown
# Tracker Sync Map

- tracker: github
- repo: <owner/name>
- last-synced: <ISO timestamp>

| Local ID | Tracker ID | URL | Last Status | Direction |
|---|---|---|---|---|
| EPIC-001 | #42 | <url> | open | local->tracker |
| FEAT-001 | #43 | <url> | open | local->tracker |
| TKT-001 | #44 | <url> | open | local->tracker |
```

## Procedure

1. **Resolve Tracker** — Detect or read the configured tracker. Stop cleanly if none.
2. **Diff** — Compare `backlog-index.md` against `sync/tracker-sync-map.md`. Classify each node as new, changed, unchanged, or closed-locally.
3. **Create** — For new nodes, create issues bottom-consistent: epic first, then its features, then their tickets, linking children to parents. Apply `epic`/`feature`/`ticket` labels and copy the title plus a body summarizing the local artifact with a link back to its local path.
4. **Update** — For changed nodes, update the tracker issue title, body, labels, and open/closed state to match local status (`done` local status closes the tracker issue).
5. **Record Mapping** — Write the local-to-tracker ID, URL, and direction into `sync/tracker-sync-map.md`. Never overwrite the local backlog from the tracker unless the user explicitly requests a pull.
6. **Audit** — Append a sync summary (counts created/updated/closed, tracker, timestamp) to `aidlc/audit.md`.

## Host Tooling

- In hosts with native GitHub tools (e.g. an MCP GitHub server), use them to create, update, link, and close issues.
- In hosts without tracker tooling, emit a ready-to-run command list (e.g. `gh issue create ...`) into `sync/tracker-sync-map.md` for the user to execute, and mark direction as `pending`.

## Rules

- The local backlog is authoritative; never silently mutate local files from tracker state.
- Sync is idempotent: re-running with no local changes must create no duplicate issues.
- Preserve stable local IDs in issue titles or bodies so mapping survives renames.
- Treat tracker write failures as logged blockers, not silent successes.

## Quality Gates

- [ ] Tracker resolved or `tracker: none` recorded without error
- [ ] Every synced node has a row in `sync/tracker-sync-map.md`
- [ ] Re-running with no changes creates no duplicates (idempotent)
- [ ] Local `done` status closes the corresponding tracker issue
- [ ] Sync summary appended to `aidlc/audit.md`
- [ ] No product code modified
