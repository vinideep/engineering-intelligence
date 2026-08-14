---
name: interface-design-explorer
description: Explores and compares alternative interface contracts and TypeScript type definitions across multiple design philosophies before implementation.
version: 3.0.0
---

# Interface Design Explorer

Explore, draft, and benchmark alternative interface designs and type contracts using distinct architectural perspectives before writing implementation code.

## Inputs

- Problem statement or API specification
- Domain boundaries and schema constraints
- Target language idioms and typing rules
- Downstream consumer needs from `.engineering-intelligence/graph/`

## Procedure

1. **Synthesize Three Contrasting Perspectives**:
   Generate 3 distinct interface proposals for the target capability:
   - **Option A: Minimalist / Ergonomic**: Prioritizes simplicity, minimal cognitive load, and few parameters. Best for fast consumption and common-case defaults.
   - **Option B: Type-Safe / Extensible**: Prioritizes strict compile-time safety, discriminated unions, generic type constraints, and plugin or middleware hooks.
   - **Option C: Performance / Resource-Optimized**: Prioritizes zero-allocation, streaming, batching, and cache-friendly data structures.

2. **Benchmark Trade-Offs**:
   Compare the proposals across a structured evaluation rubric:
   - **Developer Ergonomics**: Call-site readability and ease of use.
   - **Backward Compatibility & Evolution**: Ease of extending without breaking consumers.
   - **Compile-Time Safety**: Ability of the type system to catch invalid states.
   - **Runtime Complexity**: Memory overhead, GC pressure, and dependency footprint.

3. **Present Call-Site Examples**:
   - Provide concrete, before-and-after call-site code snippets demonstrating real usage of each proposal.

4. **Select & Finalize Contract**:
   - Align with the user on the chosen design option.
   - Codify the approved type definitions in the target module or `.engineering-intelligence/context/` before starting implementation.
