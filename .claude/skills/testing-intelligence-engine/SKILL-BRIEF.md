---
name: testing-intelligence-engine
description: Determines risk-based testing needs for engineering changes and identifies coverage gaps in critical runtime flows. Use during implementation and validation.
version: 3.0.0
---

# Testing Intelligence Engine

Determine the minimum sufficient test coverage for a change based on risk assessment and existing test patterns.

## Inputs

- Impact report (`$EIreports/IMP-XXX-*.md`)
- Existing test patterns in the repository
- Change classification (feature, bugfix, refactor, etc.)
- Coverage reports when available (`coverage-final.json`, `coverage.xml`, `lcov.info`, `go test -cover`, pytest coverage output)
- Agile acceptance criteria from `$AIDLCagile/acceptance-criteria.md`

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
