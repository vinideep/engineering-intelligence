---
name: dead-code-detector
description: Detects unused exports, unreachable code paths, zombie dependencies, and stale modules by combining static analysis with git history.
version: 1.0.0
---

# Dead Code Detector

Use this skill during initialization, major refactors, dependency cleanup, and technical-debt reviews.

## Procedure

1. Scan imports/exports, route registrations, job registrations, dependency injection containers, and public entry points.
2. Identify unused exports, unreferenced files, unreachable branches, feature flags that are always on/off, and manifest dependencies with no import/use evidence.
3. Cross-reference `git-intelligence-engine` for stale modules, low ownership, and no recent changes.
4. Avoid false positives for framework-discovered files, reflection, migrations, generated code, and public package exports.
5. Produce candidates, not automatic deletions.

## Output

Write or update `knowledge-base/12-technical-debt.md`:

```markdown
## Dead Code Candidates
| Candidate | Type | Confidence | Evidence | Safe Removal Steps |
|---|---|---|---|---|
```

## Quality Gates

- [ ] Static references were checked
- [ ] Framework dynamic entry points were considered
- [ ] Git staleness was included
- [ ] Findings include confidence and safe-removal steps
