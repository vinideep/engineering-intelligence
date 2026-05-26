---
name: change-detection-engine
description: Determines analysis scope from a proposed engineering change, working-tree diff, commit range, or explicit changed files. Use before impact analysis, synchronization, or review.
---

# Change Detection Engine

Accept one of these inputs:

- a proposed change described by the user
- an existing working-tree diff
- a supplied commit or commit range
- explicitly named changed files

Determine mode (`proposal` or `diff`), inspected scope, changed or likely affected paths, and unresolved ambiguity. When the repository is not under git or the target change cannot be identified, ask for the intended change or affected paths instead of assuming.

This capability is analytical only and must not modify product code.
