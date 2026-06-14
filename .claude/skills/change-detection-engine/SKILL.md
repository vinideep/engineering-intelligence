> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: change-detection-engine
description: Determines analysis scope from a proposed engineering change, working-tree diff, commit range, or explicit changed files. Use before impact analysis, synchronization, or review.
---

# Change Detection Engine

Resolve the scope of a change into a structured representation that downstream skills (impact analysis, synchronization, review) can consume.

## Inputs

Accept exactly one of these input modes:

| Mode | Input | Example |
|---|---|---|
| `proposal` | User-described change request | "Add rate limiting to auth endpoints" |
| `working-diff` | Unstaged/staged working-tree diff | `git diff` or `git diff --cached` output |
| `commit` | Single commit hash | `abc1234` |
| `commit-range` | Commit range | `abc1234..def5678` |
| `explicit-files` | Explicitly named file paths | `src/auth/middleware.ts, src/routes/api.ts` |

## Procedure

1. **Detect Mode** — Determine which input mode applies:
   - If the user describes a change in natural language → `proposal`
   - If there are unstaged/staged changes in the working tree → `working-diff`
   - If a commit hash or range is provided → `commit` or `commit-range`
   - If specific files are named → `explicit-files`

2. **Resolve Scope** — For each mode:

   **`proposal`**: Parse the request to identify likely affected modules, files, and systems. Mark scope as `estimated` confidence.

   **`working-diff`**: Parse the diff output to extract:
   - Added/modified/deleted files
   - Changed function/class names (when parseable)
   - Changed lines counts per file

   **`commit` / `commit-range`**: Use `git show` or `git diff` to extract the same information as `working-diff`.

   **`explicit-files`**: Verify each file exists and categorize by module/directory.

3. **Handle Edge Cases**:
   - **No git repository**: Ask the user for affected files instead of failing silently
   - **Binary files in diff**: Note them but don't attempt to parse
   - **Ambiguous scope**: Ask the user for clarification instead of assuming
   - **Empty diff**: Report that no changes were detected

## Output Structure

Produce a structured scope object for downstream consumers:

```markdown
## Change Scope

- **Mode**: proposal | working-diff | commit | commit-range | explicit-files
- **Confidence**: verified | estimated
- **Inspected**: <what was examined>

### Changed Paths
| File | Status | Module |
|---|---|---|
| src/auth/middleware.ts | modified | auth |
| src/auth/rate-limiter.ts | added | auth |

### Affected Modules
- `auth` — authentication and rate limiting
- `api` — API route handlers

### Ambiguities
- <anything unclear about the scope>
```

## Rules

- Never guess when the scope is unclear — ask
- Always report the detection mode and confidence level
- When the repository is not under git and no files are named, request explicit input
- This capability is analytical only — it must not modify product code

## Quality Gates

- [ ] Mode is explicitly stated
- [ ] Changed paths are enumerated (or reason for absence is stated)
- [ ] Confidence level is assigned
- [ ] Ambiguities are flagged rather than silently resolved

## Cross-References

- Used by: `impact-analysis-engine`, `incremental-sync-engine`, `engineering-change-review`
- Feeds into: `analyze-impact`, `sync-engineering-intelligence`, `review-engineering-change` workflows
