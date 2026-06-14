---
name: issue-tracker-sync-engine
description: Mirrors the local Epic to Feature to Ticket backlog to an external issue tracker such as GitHub Issues, keeping the local markdown backlog as the source of truth and recording a stable ID mapping. Use to publish or refresh tracker issues from the backlog.
version: 1.0.0
---

# Issue Tracker Sync Engine

Synchronize the local backlog under `$AIDLCagile/backlog/` to an external issue tracker. The **local markdown backlog is always the source of truth**; the tracker is a mirror. This skill does not modify product code.

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
