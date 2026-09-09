---
name: design-an-interface
description: Explore and compare alternative interface contracts and TypeScript type definitions across multiple design perspectives before writing implementation code.
---

# Design an Interface

Use the `interface-design-explorer` capability to generate and evaluate competing interface proposals before committing to an API design.

## Pipeline

1. **Analyze Requirements** — Extract functional needs, input/output schemas, and domain boundaries.
2. **Draft Contrasting Proposals** — Propose 3 distinct interface options:
   - *Minimalist / Ergonomic*
   - *Type-Safe / Extensible*
   - *Performance / Resource-Optimized*
3. **Compare Trade-Offs & Call-Sites** — Provide call-site usage examples and benchmark ergonomics, type safety, and complexity.
4. **Finalize Signature** — Gain alignment on the chosen design and output the canonical type signatures ready for implementation.

## Completion Report

Finish with:
- Summary of proposed interface designs and evaluation matrix
- Chosen interface contract and type definitions
- Next implementation command (e.g. `/tdd` or `/engineering-intelligence`)

**Contract**: This workflow does not modify product code.
