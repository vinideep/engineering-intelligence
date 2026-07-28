---
name: environmental-backpressure-engine
description: Drives compiler, linter, type-check, test, security, and architecture feedback loops until objective validation passes or blockers are recorded.
version: 1.0.0
---

# Environmental Backpressure Engine

Use this skill whenever code is generated or modified. The environment, not subjective inspection alone, supplies the feedback loop.

**Run the deterministic verifier:** `npx engineering-intelligence verify .` executes the project's own check commands, records their real exit codes, and writes a **receipt** binding the result to a sha256 of every changed file. Exit 1 means the tree is not verified.

This is what "validated" means here — a receipt this tool produced, not a command that looked test-shaped. When the Stop gate is enabled it accepts nothing else, and a receipt stops counting the moment any covered file changes, so re-verify after every edit. Configure `hooks.verifyCommands` in `.engineering-intelligence/ei.config.json` when detection picks the wrong commands. Use the steps below to decide what to fix when the verifier reports failures.

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

Write `.engineering-intelligence/aidlc/construction/<unit>/build-and-test/build-and-test-summary.md`:

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
