---
name: vertical-tdd-engine
description: Enforces a strict vertical-slice Red-Green-Refactor loop targeting public API surfaces. Tests first, minimal implementation second, refactor third.
---

# Vertical TDD Engine

Drive implementation through strict, incremental Test-Driven Development (TDD) using vertical slices that target public interface boundaries rather than implementation details.

## Inputs

- Acceptance criteria from `.engineering-intelligence/aidlc/agile/acceptance-criteria.md` or ticket specification
- Target function, module, or component signature
- Existing test patterns and runner in the repository
- Type definitions and interface contracts

## Procedure

1. **Slice the Feature Vertically**:
   - Break the requirement down into the smallest testable behavioral increments (vertical slices).
   - Order slices from simple happy path to complex edge cases and error handling.

2. **Phase 1: RED (Write One Failing Test)**:
   - Write a single unit or integration test against the *public interface* of the unit.
   - Run the test suite using `environmental-backpressure-engine` to verify that the test fails for the expected reason (and not a compilation/syntax error).

3. **Phase 2: GREEN (Write Minimal Code)**:
   - Implement the absolute minimum code required to make the failing test pass.
   - Resist adding extra features, premature abstractions, or handling un-tested cases.
   - Run the test suite and confirm it passes.

4. **Phase 3: REFACTOR (Clean Code Under Green Tests)**:
   - Refactor the implementation for readability, performance, and adherence to repository conventions.
   - Ensure the public interface remains unchanged and all tests remain green.

5. **Repeat for Subsequent Slices**:
   - Iterate slice-by-slice until all acceptance criteria are completely satisfied.
