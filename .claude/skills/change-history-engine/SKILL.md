> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: change-history-engine
description: Records validated engineering work, impacted systems, tests, synchronized documentation, and outstanding risks. Use after initialization and completed engineering changes.
version: 3.0.0
---

# Change History Engine

Create structured, traceable change records that document what was done, why, what was tested, and what remains.

## Inputs

- Completed implementation details
- Impact report reference
- Test results
- List of synchronized intelligence artifacts
- Unresolved risks or follow-ups

## Change Record Format

Store change records in `.changes/`:

- Initialization creates `CHG-000-initialization.md`
- Subsequent changes create the next numbered `CHG-XXX-<summary>.md`

### Numbering Convention

- `CHG-000` — Reserved for initialization
- `CHG-001` through `CHG-999` — Sequential, zero-padded
- Find the highest existing CHG number and increment by 1

### Record Template

```markdown
# CHG-XXX: <concise summary>

## Meta
- Date: <ISO timestamp>
- Type: feature | bugfix | update | refactor | architecture | infrastructure | security
- Risk: low | medium | high | critical
- Author: <who requested the change>

## Request
<Original user request, verbatim or paraphrased>

## Implementation Summary
<What was changed, in 2-5 sentences>

## Files Changed
| File | Action | Description |
|---|---|---|
| src/auth/middleware.ts | Modified | Added rate limiting check |
| src/auth/rate-limiter.ts | Created | New rate limiting service |
| test/auth/rate-limiter.test.ts | Created | Rate limiter unit tests |

## Related Reports
- Impact: IMP-XXX-<slug>.md
- Review: REV-XXX-<slug>.md (if applicable)

## Tests & Validation
| Test | Command | Result |
|---|---|---|
| Unit tests | npm test | 42 passed, 0 failed |
| Type check | npx tsc --noEmit | Clean |
| Lint | npm run lint | Clean |

## Synchronized Artifacts
| Artifact | Change |
|---|---|
| knowledge-base/04-api-documentation.md | Updated rate limiting section |
| $EIgraph/runtime-graph.json | Added rate-limiter node |
| $EIcontext/module-map.md | Added rate-limiter entry |

## Unresolved Risks
- <any remaining concerns, follow-ups, or known limitations>

## Rollback
- <how to revert this change if needed>
```

### Initialization Record (`CHG-000-initialization.md`)

```markdown
# CHG-000: Project Intelligence Initialization

## Meta
- Date: <ISO timestamp>
- Type: initialization

## Summary
Initial engineering intelligence generated for <project name>.

## Generated Artifacts
| Category | Count | Path |
|---|---|---|
| Knowledge Base | 16 documents | knowledge-base/ |
| Memory | 5 documents | $EImemory/ |
| Context | 6 maps | $EIcontext/ |
| Events | 5 guides | $EIevents/ |
| Graphs | 4 JSON + 1 map | $EIgraph/ |

## Confidence Assessment
- High confidence areas: <list>
- Low confidence areas: <list>
- Needs human review: <list>

## Next Steps
- Review and verify knowledge-base accuracy
- Confirm architecture decisions in memory
- Validate graph completeness
```

## Rules

- Every completed engineering change must have a change record
- Records are append-only — never delete or modify past records
- Reference related impact and review reports by their IMP/REV identifiers
- Be honest about test results — record failures and skipped tests
- Include rollback guidance for medium+ risk changes

## Quality Gates

- [ ] Record number is sequential (no gaps, no duplicates)
- [ ] All sections are filled (use "N/A" rather than omitting)
- [ ] Related reports are correctly referenced
- [ ] Test results reflect actual execution (not assumed)
- [ ] Files changed list is complete

## Cross-References

- Used by: `engineering-intelligence-skill` (step 7), `initialize-intelligence-skill` (step 9)
- Depends on: `impact-analysis-engine` (for report references)
- Related: `engineering-change-review` (may trigger a review report)
