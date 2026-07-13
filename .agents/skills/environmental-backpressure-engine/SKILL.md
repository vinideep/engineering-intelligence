> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: environmental-backpressure-engine
description: Drives compiler, linter, type-check, test, security, and architecture feedback loops until objective validation passes or blockers are recorded.
---

# Environmental Backpressure Engine

Use this skill whenever code is generated or modified. The environment, not subjective inspection alone, supplies the feedback loop.

## Procedure

1. Detect available validation commands from package manifests, build files, CI config, and README instructions.
2. Prefer narrow checks first, then broaden:
   - formatter or static syntax check
   - type check or compile
   - targeted tests
   - full test suite
   - linter
   - security or architecture scanner when relevant
3. Run the smallest relevant command that can expose the current risk.
4. Capture raw diagnostics in the active unit's `build-and-test/` artifact.
5. Fix failures and rerun the relevant check.
6. Stop only when checks pass, are unavailable, or a blocker is recorded with evidence.

## Build And Test Summary

Write `$AIDLCconstruction/<unit>/build-and-test/build-and-test-summary.md`:

```markdown
# Build And Test Summary: <unit>

## Commands
- `<command>`: <passed|failed|unavailable|skipped> — <why>

## Failures And Corrections
- <diagnostic summary> -> <fix applied> -> <rerun result>

## Coverage / Performance
- <available metrics or Not detected>

## Residual Risk
- <remaining risks, blockers, or manual verification>
```

## Rules

- Never report validation as passed unless the command actually ran and passed.
- Do not hide failing output. Summarize it and keep enough detail for reproduction.
- Human review begins after local backpressure is exhausted, not before.
