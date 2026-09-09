---
name: tdd
description: Implement a feature or bugfix using a strict vertical-slice Red-Green-Refactor test-driven development loop targeting public API surfaces.
---

# TDD Workflow

Use the `vertical-tdd-engine` and `testing-intelligence-engine` capabilities to implement functionality through disciplined Test-Driven Development.

## Pipeline

1. **Define Vertical Slice** — Identify the next incremental behavior and the public interface to test.
2. **RED Phase** — Write a single focused failing test against the public API; run tests to verify expected failure.
3. **GREEN Phase** — Write the minimal code necessary to make the failing test pass; verify test passes.
4. **REFACTOR Phase** — Clean and streamline the implementation while keeping all tests green.
5. **Repeat & Validate** — Repeat until all slice requirements are met, then run the full test suite.

## Completion Report

Finish with:
- Summary of implemented vertical slices and added tests
- Test execution results showing all tests passing
- Any refactorings applied during the cycle
