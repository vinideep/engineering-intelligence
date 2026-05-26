---
name: change-history-engine
description: Records validated engineering work, impacted systems, tests, synchronized documentation, and outstanding risks. Use after initialization and completed engineering changes.
---

# Change History

Store change records in `.changes/`.

- Initialization creates `CHG-000-initialization.md`.
- Subsequent changes create the next numbered `CHG-XXX-<summary>.md`.

Include request summary, files or systems affected, related `IMP-*` and `REV-*` reports when present, implementation summary, tests and validation performed, updated graph/intelligence artifacts, and unresolved risk or follow-up.
