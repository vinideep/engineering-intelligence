---
name: architecture-review-engine
description: Reviews architecture decisions, dependency health, structural quality, and identifies architectural smells. Use during refactoring planning or periodic architecture assessment.
version: 3.0.0
---

# Architecture Review Engine

Systematically assess architectural quality using evidence from code, graphs, and intelligence artifacts.

## Inputs

- `.engineering-intelligence/graph/` (dependency, service, runtime graphs)
- `knowledge-base/02-architecture.md`
- `.engineering-intelligence/memory/architecture-decisions.md`
- Specific scope or concern (optional)

## Review Checklist

### 1. Dependency Health

| Check | What to Look For | Severity |
|---|---|---|
| Circular dependencies | Module A → B → C → A cycles in dependency-graph | 🔴 High |
| God modules | Modules with 10+ dependents | 🟡 Medium |
| Orphan modules | Modules with zero dependents (dead code?) | 🟢 Low |
| Unstable dependencies | Frequently-changing modules with many dependents | 🔴 High |
| External risk | External deps with known CVEs or maintenance issues | 🟡 Medium |

### 2. Boundary Integrity

| Check | What to Look For | Severity |
|---|---|---|
| Layer violations | Data layer importing from presentation layer | 🔴 High |
| Cross-boundary coupling | Direct imports bypassing service interfaces | 🟡 Medium |
| Shared mutable state | Global state accessed across boundaries | 🔴 High |
| Missing abstractions | Concrete dependencies where interfaces should exist | 🟡 Medium |

### 3. Service Architecture

| Check | What to Look For | Severity |
|---|---|---|
| Single points of failure | Services with no redundancy or fallback | 🔴 High |
| Chatty interfaces | Services making many small calls instead of batch | 🟡 Medium |
| Missing health checks | Services without health/readiness endpoints | 🟡 Medium |
| Cascade risk | Failure in service A causes failure in B, C, D | 🔴 High |

### 4. Architectural Smell Catalog

| Smell | Description | Impact |
|---|---|---|
| **Big Ball of Mud** | No clear boundaries, everything depends on everything | Unmaintainable |
| **Distributed Monolith** | Microservices that must deploy together | Worst of both worlds |
| **Leaky Abstraction** | Implementation details exposed across boundaries | Fragile coupling |
| **Feature Envy** | Module heavily using another module's internals | Misplaced responsibility |
| **Shotgun Surgery** | Single change requires edits in many modules | High change cost |
| **God Class/Module** | Single module with too many responsibilities | Testing nightmare |

## Procedure

1. **Read Graphs** — Load dependency-graph, service-graph, and runtime-graph. If absent, note as a finding.
2. **Run Checklist** — Evaluate each check in the review checklist above.
3. **Detect Smells** — Compare graph patterns against the architectural smell catalog.
4. **Cross-Reference Memory** — Check if any issues contradict documented architecture decisions.
5. **Score Findings** — Assign severity: 🔴 High, 🟡 Medium, 🟢 Low.
6. **Write Report** — Generate findings report.

## Output Format

Write `knowledge-base/16-architecture-review.md`:

```markdown
# Architecture Review

Generated: <ISO timestamp>
Scope: <what was reviewed>

## Summary
- Total findings: X
- 🔴 High: Y | 🟡 Medium: Z | 🟢 Low: W

## Findings

### 🔴 [Finding Title]
- **Category**: Dependency Health / Boundary Integrity / Service Architecture
- **Location**: <module, path, or graph reference>
- **Description**: <what was found>
- **Evidence**: <file paths, graph node IDs>
- **Recommendation**: <how to address>

## Architectural Smells Detected
- <smell name>: <where and why>

## Strengths
- <positive architectural qualities observed>

## Recommended Actions
1. <prioritized list of improvements>
```

## Rules

- Base findings on code evidence and graph data, not assumptions
- Include strengths alongside weaknesses — balanced assessment
- Prioritize findings by severity and blast radius
- This review does not modify product code

## Quality Gates

- [ ] All checklist categories were evaluated
- [ ] Findings have evidence citations
- [ ] Severity ratings are justified
- [ ] Recommendations are actionable

## Cross-References

- Depends on: `graph-engine` (provides structural data)
- Used by: `refactoring-planner` (for input on what to refactor)
- Related: `engineering-change-review` (per-change review vs architectural review)
