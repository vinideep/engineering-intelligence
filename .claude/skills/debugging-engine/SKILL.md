> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: debugging-engine
description: Performs structured root cause analysis using graph intelligence, log correlation, error propagation tracing, and reproduction step generation. Produces evidence-backed debug reports with fix suggestions and impact analysis.
---

# Debugging Engine

Systematically diagnose issues through evidence-driven root cause analysis, leveraging graph intelligence to trace error propagation and suggest fixes with assessed impact.

## Inputs

- Bug report or error description (symptoms, error messages, stack traces)
- Repository root path
- Graph intelligence from `$EIgraph/` (when available)
- Project intelligence from `knowledge-base/` and `$EI`
- Optional: log output, reproduction steps from reporter, environment details

## Procedure

1. **Classify the Issue** — Determine the bug category and initial scope:

   | Category | Indicators |
   |---|---|
   | Runtime error | Stack trace, exception, crash |
   | Logic error | Wrong output, incorrect behavior, data corruption |
   | Performance | Slowness, timeouts, resource exhaustion |
   | Integration | API failures, service communication errors |
   | Concurrency | Race conditions, deadlocks, data inconsistency |
   | Configuration | Environment-specific failures, missing config |

2. **Root Cause Analysis Workflow** — Follow a structured elimination process:

   a. **Reproduce** — Determine the minimal conditions to trigger the issue:
      - Identify required inputs, state, and environment
      - Distinguish deterministic from intermittent failures
      - Note any timing or ordering dependencies

   b. **Localize** — Narrow the fault location:
      - Start from the error manifestation point (stack trace, log entry)
      - Trace backward through the call chain
      - Use graph intelligence to understand the execution path
      - Identify the boundary between working and failing behavior

   c. **Identify** — Determine the root cause:
      - Distinguish symptom from cause — trace to the origin
      - Check for recent changes in the fault area (correlate with git history)
      - Verify assumptions about inputs, state, and invariants
      - Consider environmental factors (config, dependencies, infrastructure)

3. **Log Analysis and Correlation** — When logs are available:

   | Technique | Application |
   |---|---|
   | Timeline reconstruction | Order events chronologically across log sources |
   | Pattern matching | Identify recurring error patterns and frequencies |
   | Correlation | Link events across services using request IDs or trace IDs |
   | Anomaly detection | Identify unusual log patterns preceding the failure |
   | Context extraction | Extract relevant state from surrounding log entries |

4. **Error Propagation Tracing** — Using graph intelligence:

   - Trace the error path through `runtime-graph.json` (call flows)
   - Identify affected services via `service-graph.json` (communication topology)
   - Map downstream impact via `dependency-graph.json` (module dependencies)
   - Assess business impact via `business-flow-graph.json` (affected flows)

   Build an error propagation chain:

   ```
   Origin → [module/function where fault occurs]
     ↓ propagates via [mechanism: exception, error return, bad state]
   Intermediate → [modules that pass through or transform the error]
     ↓ manifests as [observable symptom]
   Symptom → [where the user or system observes the failure]
   ```

5. **Reproduction Step Generation** — Produce minimal, deterministic reproduction steps:

   ```markdown
   ## Reproduction Steps
   1. Preconditions: <required state, config, data>
   2. Action: <specific steps to trigger the issue>
   3. Expected: <what should happen>
   4. Actual: <what happens instead>
   5. Environment: <runtime, OS, versions, config>
   6. Frequency: deterministic | intermittent (<rate>)
   ```

6. **Fix Suggestion with Impact Analysis** — Propose fixes with assessed risk:

   | Fix Aspect | Description |
   |---|---|
   | Root fix | Address the underlying cause |
   | Symptom mitigation | Temporary workaround if root fix is complex |
   | Defensive hardening | Additional checks to prevent recurrence class |
   | Files to modify | Specific files and functions that need changes |
   | Risk assessment | Blast radius of the proposed fix |
   | Test requirements | Tests to add for regression prevention |

   When applicable, invoke `impact-analysis-engine` on the proposed fix to assess its blast radius.

7. **Generate Debug Report** — Write `$EIreports/DEBUG-XXX-<slug>.md`.

## Output Format

Write `$EIreports/DEBUG-XXX-<slug>.md`:

```markdown
# DEBUG-XXX: <descriptive title>

## Meta
- Generated: <ISO timestamp>
- Category: <runtime | logic | performance | integration | concurrency | configuration>
- Severity: <critical | high | medium | low>
- Status: <diagnosed | investigating | unresolved>

## Symptoms
- <observable manifestation of the issue>
- Error message: `<exact error text>`
- Stack trace: <if available>

## Root Cause Analysis
- **Root cause**: <concise description>
- **Origin**: <file:line where the fault originates>
- **Mechanism**: <how the fault propagates>
- **Contributing factors**: <environmental or contextual factors>

## Error Propagation
| Step | Location | Mechanism | Evidence |
|---|---|---|---|
| Origin | src/auth/validate.ts:42 | Null reference | Missing null check |
| Propagation | src/api/middleware.ts:18 | Unhandled exception | No try/catch |
| Symptom | HTTP 500 response | Error response | Client-reported |

## Reproduction Steps
1. <minimal reproduction steps>

## Fix Suggestion
### Root Fix
- File: <path>
- Change: <description>
- Risk: <level>

### Defensive Hardening
- <additional preventive measures>

### Test Requirements
- [ ] <regression test to add>

## Impact of Fix
- Blast radius: <assessment>
- Affected modules: <list>

## Evidence
- <file path citations>

## Unknowns
- <unresolved questions>

---
*This debug report did not modify product code.*
```

## Rules

- Never guess the root cause — trace with evidence or mark as `investigating`
- Distinguish symptoms from causes explicitly
- Fix suggestions must include impact assessment
- Log analysis must not expose sensitive data (redact credentials, PII)
- This capability is analytical only — it must not modify product code

## Quality Gates

- [ ] Issue is classified by category and severity
- [ ] Root cause is traced with evidence (not assumed)
- [ ] Error propagation path is documented with graph references
- [ ] Reproduction steps are minimal and actionable
- [ ] Fix suggestion includes impact assessment and test requirements
- [ ] Sensitive data is redacted from logs and traces in the report
- [ ] Report ends with the "did not modify product code" statement

## Cross-References

- Depends on: `graph-engine` (error propagation tracing), `impact-analysis-engine` (fix impact assessment)
- Used by: `engineering-intelligence-skill`
- Consumed by: `engineering-change-review` (when fix is implemented as a change)

This capability is analytical only. It must not modify product code.
