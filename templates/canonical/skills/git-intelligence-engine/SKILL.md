---
name: git-intelligence-engine
description: Extracts structural intelligence from git history — hotspot analysis, ownership mapping, change coupling, velocity tracking, and drift detection. Feeds graph intelligence and impact analysis with git-derived edges.
version: 3.0.0
---

# Git Intelligence Engine

Extract actionable intelligence from git history to reveal hidden dependencies, ownership patterns, and codebase evolution trends.

## Inputs

- Repository root path
- Mode: `full` (analyze complete history) or `incremental` (analyze since last run)
- Optional: time window (e.g., last 90 days, last 6 months)
- Optional: branch filter (specific branches to analyze)

## Procedure

1. **Collect History** — Extract commit log with file-level diffs, authors, timestamps, and branch metadata. For `incremental` mode, scope to commits since the last recorded analysis timestamp.

2. **Hotspot Analysis** — Identify the most frequently changed files and directories:

   | Metric | Description |
   |---|---|
   | Change frequency | Number of commits touching each file |
   | Churn rate | Lines added + deleted per file over the time window |
   | Complexity trend | Whether hotspot files are growing in size/complexity |
   | Bug correlation | Commits linked to bugfix keywords touching each file |

   Rank files by composite hotspot score (frequency × churn × bug correlation).

3. **Ownership Mapping** — Determine contributor ownership per module:

   | Field | Description |
   |---|---|
   | Primary owner | Contributor with most commits to the module |
   | Secondary owners | Other significant contributors (>10% of commits) |
   | Bus factor | Number of contributors with meaningful knowledge |
   | Last active | Most recent commit date per contributor per module |
   | Orphaned modules | Modules where all significant contributors are inactive (>90 days) |

4. **Change Coupling Analysis** — Identify files that always change together:

   | Metric | Description |
   |---|---|
   | Co-change frequency | Number of commits where both files are modified |
   | Coupling strength | Co-change frequency / total changes of either file |
   | Confidence | `verified` if coupling > 0.7, `inferred` if 0.4–0.7, `unknown` below |

   Flag high-coupling pairs that span module boundaries — these indicate hidden dependencies not visible in import graphs.

5. **Velocity Tracking** — Measure change rate per module per time period:

   | Metric | Description |
   |---|---|
   | Commits per week | Average commit frequency per module |
   | Active contributors | Unique contributors per module per period |
   | Acceleration | Whether velocity is increasing, stable, or declining |
   | Staleness | Modules with zero commits in the analysis window |

6. **Drift Detection** — Identify branches that have diverged significantly:

   | Metric | Description |
   |---|---|
   | Divergence score | Number of commits ahead/behind between branch pairs |
   | Conflict potential | Files modified in both branches |
   | Merge complexity | Estimated effort to reconcile (based on overlapping changes) |
   | Stale branches | Branches with no commits in >30 days |

7. **Feed Graph Intelligence** — Write git-derived edges to `.engineering-intelligence/graph/`:
   - Add `co-changes-with` edges to `dependency-graph.json` for verified change-coupled pairs
   - Add `owned-by` metadata to graph nodes based on ownership mapping
   - Mark edge confidence based on analysis evidence

8. **Generate Report** — Write `.engineering-intelligence/reports/GIT-intelligence.md` with all findings, ranked by actionability.

## Output Format

Write `.engineering-intelligence/reports/GIT-intelligence.md`:

```markdown
# Git Intelligence Report

## Meta
- Generated: <ISO timestamp>
- Mode: full | incremental
- Time window: <start> to <end>
- Commits analyzed: <count>

## Hotspots
| Rank | File | Change Freq | Churn | Bug Correlation | Score |
|---|---|---|---|---|---|
| 1 | path/to/file.ts | 47 | 1,240 | 8 | 95.2 |

## Ownership Map
| Module | Primary Owner | Bus Factor | Orphaned |
|---|---|---|---|
| src/auth/ | alice | 3 | No |

## Change Coupling
| File A | File B | Co-changes | Strength | Cross-module |
|---|---|---|---|---|
| src/api/users.ts | src/db/user-repo.ts | 23 | 0.82 | Yes |

## Velocity
| Module | Commits/Week | Trend | Staleness |
|---|---|---|---|
| src/core/ | 12.3 | Accelerating | — |

## Drift
| Branch | Divergence | Conflict Files | Stale |
|---|---|---|---|
| feature/payments | +47 / -12 | 3 | No |

## Graph Updates
- Edges added: <count>
- Nodes annotated: <count>

## Evidence
- <file path citations>
```

## Rules

- Never fabricate git history — all metrics must derive from actual commit data
- Ownership mapping must not assume contributor activity from naming conventions alone
- Change coupling edges added to graphs must include evidence paths
- This capability is analytical only — it must not modify product code

## Quality Gates

- [ ] All metrics cite commit SHAs or date ranges as evidence
- [ ] Hotspot ranking uses composite scoring (not single-metric)
- [ ] Ownership includes bus factor and orphaned module flags
- [ ] Change coupling distinguishes intra-module from cross-module pairs
- [ ] Graph edges added carry `confidence` and `evidence` fields
- [ ] Report ends with graph update summary

## Cross-References

- Depends on: `graph-engine` (for writing git-derived edges)
- Used by: `impact-analysis-engine`, `graph-engine`
- Consumed by: `pr-intelligence-engine`

This capability is analytical only. It must not modify product code.
