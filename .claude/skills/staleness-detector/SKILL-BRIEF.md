---
name: staleness-detector
description: Compares knowledge-base document timestamps against related source file modification times, scores each document 0-100 for freshness, triggers incremental sync when freshness drops below threshold, and adds freshness metadata to document headers.
version: 3.0.0
---

# Staleness Detector

Monitor the freshness of all engineering intelligence documents by comparing their last-updated timestamps against the modification times of the source files they describe. Produce a freshness report and trigger incremental sync for stale documents.

## Inputs

- Repository root path
- Knowledge base directory (`knowledge-base/`)
- Memory directory (`$EImemory/`)
- Context directory (`$EIcontext/`)
- Optional: specific document or module to check
- Optional: custom freshness threshold (default: 60)

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
