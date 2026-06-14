---
name: type-safety-engine
description: Validates generated code against the project type system, traces type-level dependencies, and loops on compiler errors until clean or blocked.
version: 1.0.0
---

# Type Safety Engine

Use this skill for TypeScript, Python, Go, Rust, Java, Kotlin, C#, or any project with a declared type checker. It is a blocking gate for generated code in typed projects.

## Inputs

- Changed files from the impact report or current diff
- Project manifests and type-check configuration
- Existing graph artifacts under `$EIgraph/`

> **Load `SKILL.md` from this directory before executing this skill's procedure.**
