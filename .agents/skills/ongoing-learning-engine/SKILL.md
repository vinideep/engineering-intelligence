> **Path aliases:** `$AIDLC`=`.engineering-intelligence/aidlc/`, `$EI`=`.engineering-intelligence/`. Expand before writing any file paths.

---
name: ongoing-learning-engine
description: Handles post-initialization continuous learning by detecting uncertainty, logging learning events, triggering targeted re-discovery, updating memory with newly learned patterns, tracking knowledge freshness scores, and enforcing staleness detection rules.
---

# Ongoing Learning Engine

Continuously maintain and improve the AI's understanding of a codebase after initial discovery. This engine activates whenever the AI encounters areas it does not understand, when code changes invalidate existing knowledge, or when knowledge freshness degrades below acceptable thresholds.

This capability does not modify product code.

## Inputs

- Current task context (what the AI is trying to do when uncertainty is encountered)
- Repository root path
- Existing knowledge base, memory, and context documents
- Optional: specific module or area to re-learn
- Optional: trigger event (uncertainty, staleness, explicit request)

## Trigger Conditions

The ongoing learning engine activates under these conditions:

| Trigger | Condition | Action |
|---|---|---|
| **Uncertainty encountered** | AI cannot confidently answer a question about the codebase | Log uncertainty event, initiate targeted re-discovery |
| **Staleness threshold** | Knowledge freshness score drops below 60 for a module | Trigger incremental re-scan of the stale module |
| **Code change detected** | Files in a module changed since last knowledge update | Queue module for freshness re-evaluation |
| **Explicit request** | User asks to re-learn or refresh understanding of an area | Full re-discovery of specified scope |
| **Convention drift** | Detected patterns deviate from documented conventions | Log drift event, update conventions |
| **New dependency** | A new package/dependency is added to the project | Scan and document the new dependency |

## Procedure

1. **Detect uncertainty** — Monitor for these uncertainty signals during any task:
   - Unable to locate a file or module referenced in knowledge base
   - Code structure does not match documented architecture
   - An import path or API endpoint has changed
   - A function signature or behavior differs from documentation
   - A convention violation is found in new code (drift vs intentional change)
   - Business logic encountered that has no corresponding documentation

2. **Log uncertainty event** — Write to `$EIevents/uncertainty-log.md`:

   ```markdown
   ## <timestamp> — Uncertainty Event

   - **Trigger**: <what the AI was doing>
   - **Area**: <module/file/concept>
   - **Type**: missing | outdated | contradictory | ambiguous
   - **Severity**: low | medium | high | critical
   - **Description**: <what is uncertain and why>
   - **Current knowledge**: <what the existing docs say>
   - **Observed reality**: <what the code actually shows>
   - **Resolution**: pending | resolved | deferred
   ```

3. **Classify the uncertainty** — Determine the appropriate response:

   | Type | Description | Response |
   |---|---|---|
   | **Missing** | No documentation exists for this area | Trigger targeted re-discovery |
   | **Outdated** | Documentation exists but is stale | Trigger incremental sync of affected documents |
   | **Contradictory** | Documentation contradicts code evidence | Flag for human review, update with code-as-truth |
   | **Ambiguous** | Multiple interpretations are plausible | Log both interpretations, ask for clarification |

4. **Execute targeted re-discovery** — For the specific area of uncertainty:
   - Re-scan only the affected module/directory (not the full repository)
   - Compare new findings against existing documentation
   - Identify what changed and what is new
   - Use `codebase-discovery-engine` scanning techniques but scoped to the specific area

5. **Update knowledge** — Apply changes to the appropriate knowledge documents:
   - Update knowledge base documents with corrected information
   - Add `Last updated:` timestamp to modified sections
   - Preserve evidence citations — update with new file paths/line numbers
   - Record the update in the uncertainty log as `resolved`

6. **Durability check** — Before writing any new pattern or fact to memory, apply these filters:
   - **Will this still be relevant after 5+ more changes?** If no → do not store in memory
   - **Is this a project-wide pattern or a local implementation detail?** If local → do not store in memory
   - **Does this duplicate existing memory?** If yes → merge rather than add
   - **Is this a transient state or a durable decision?** If transient → log in events, not memory

7. **Track knowledge freshness** — Maintain freshness scores per module:

   ```markdown
   ## Knowledge Freshness Tracker

   | Module | Last Scanned | Last Code Change | Freshness Score | Status |
   |---|---|---|---|---|
   | auth/ | 2024-01-15 | 2024-01-20 | 45 | 🔴 Stale |
   | api/ | 2024-01-18 | 2024-01-18 | 95 | 🟢 Fresh |
   | ... | ... | ... | ... | ... |
   ```

   **Freshness score calculation:**
   - Start at 100 when a module is scanned
   - Subtract 5 points per day since last scan if code has changed
   - Subtract 2 points per day since last scan if code has NOT changed (knowledge can still drift)
   - Subtract 10 points per file changed in module since last scan
   - Floor at 0, cap at 100

8. **Staleness detection** — Apply these rules continuously:

   | Rule | Threshold | Action |
   |---|---|---|
   | Module freshness < 60 | Score drops below 60 | Queue for targeted re-discovery |
   | Module freshness < 30 | Score drops below 30 | Flag as critical, prioritize re-discovery |
   | No scan in 30 days | 30 days elapsed | Flag for freshness check regardless of score |
   | >10 files changed since scan | File change count | Trigger immediate re-scan |
   | Architecture document stale | Any architecture doc with freshness < 50 | Trigger full architecture re-assessment |

9. **Generate learning summary** — Periodically (or on request) produce a learning summary:

   ```markdown
   ## Learning Summary — <date range>

   ### Uncertainty Events
   - Total events: <N>
   - Resolved: <N>
   - Pending: <N>
   - Deferred: <N>

   ### Knowledge Updates
   - Documents updated: <list>
   - Memory entries added: <N>
   - Memory entries revised: <N>
   - Memory entries retired: <N>

   ### Freshness Overview
   - Modules scanned: <N>
   - Average freshness: <score>
   - Stale modules (< 60): <list>
   - Critical modules (< 30): <list>

   ### Patterns Learned
   - <new patterns discovered this period>

   ### Open Questions
   - <questions that need human input>
   ```

## Output Files

| File | Purpose |
|---|---|
| `$EIevents/uncertainty-log.md` | Append-only log of all uncertainty events |
| `$EIreports/FRESHNESS-report.md` | Current freshness scores per module (shared with `staleness-detector`) |
| Updated knowledge base documents | Corrected or expanded knowledge |
| Updated memory documents | New durable patterns and decisions |

## Quality Gates

- [ ] Every uncertainty event is logged before any re-discovery begins
- [ ] Uncertainty events include type, severity, and description
- [ ] Targeted re-discovery scopes to the affected module only (not full repo)
- [ ] Durability check is applied before any memory write
- [ ] Knowledge freshness scores are calculated using the defined formula
- [ ] Staleness thresholds trigger appropriate actions
- [ ] Updated documents preserve evidence citation format
- [ ] Learning summary is accurate and reflects actual events
- [ ] No transient implementation details are stored in memory
- [ ] Contradictory findings are flagged for human review (not silently resolved)

## Cross-References

- Depends on: `codebase-discovery-engine` (for targeted re-discovery techniques)
- Uses: `staleness-detector` (for freshness scoring), `incremental-sync-engine` (for knowledge updates)
- Consumed by: `engineering-intelligence-skill`, `engineering-orchestrator`
- Feeds into: `$EIevents/uncertainty-log.md`, all knowledge base documents
- Related: `convention-detector` (for convention drift detection)

This capability does not modify product code.
