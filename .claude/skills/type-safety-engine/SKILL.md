> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

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

## Procedure

1. **Detect Type System**
   - TypeScript: `tsconfig.json`, `package.json`, `tsc`
   - Python: `mypy.ini`, `pyproject.toml`, `pyrightconfig.json`, annotations
   - Go: `go.mod`
   - Rust: `Cargo.toml`
   - Java/Kotlin/C#: project build files

2. **Trace Type Dependencies**
   - TypeScript: run or recommend `tsc --listFilesOnly` and use the TypeScript compiler API when available to identify interface, type alias, enum, generic, declaration, and ambient type dependencies.
   - Python: run or recommend `mypy --show-column-numbers` or `pyright` and trace annotation/import relationships.
   - Add high-confidence `imports-type` edges to `$EIgraph/dependency-graph.json` for type-only dependencies, with evidence paths.

3. **Run Type Check**
   - Use the project’s existing command first (`npm run typecheck`, `pnpm typecheck`, `mypy`, `pyright`, `go test`, `cargo check`, etc.).
   - If no command exists, use the safest detected command and record that it was inferred.

4. **Map Errors**
   Write a Type Error Map in the active unit build/test summary:

   ```markdown
   ## Type Error Map
   | File | Line | Column | Symbol | Error | Proposed Fix | Status |
   |---|---:|---:|---|---|---|---|
   ```

5. **Fix Loop**
   - Fix targeted type errors only.
   - Rerun the relevant type check.
   - Continue until clean or a blocker is recorded.

## Output

Write or update `$AIDLCconstruction/<unit>/build-and-test/type-safety-summary.md`:

```markdown
# Type Safety Summary: <unit>

## Commands
- `<command>`: <passed|failed|unavailable>

## Type Dependency Edges
- `imports-type`: <from> -> <to> (evidence: <path>)

## Type Error Map
<table>

## Result
<clean|blocked|not applicable>
```

## Rules

- Never mark typed code complete while type errors remain unaddressed.
- If a type checker is unavailable, record `not applicable` with evidence rather than silently skipping.
- Type-only dependencies must be included in impact analysis for typed languages.

## Quality Gates

- [ ] Type checker command was detected or explicitly unavailable
- [ ] Type-level dependencies were traced for shared types/interfaces
- [ ] `imports-type` graph edges were added or confirmed unnecessary
- [ ] Type Error Map exists for failures
- [ ] Final type status is clean, blocked with evidence, or not applicable
