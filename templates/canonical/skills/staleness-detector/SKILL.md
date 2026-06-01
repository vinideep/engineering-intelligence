---
name: staleness-detector
description: Compares knowledge-base document timestamps against related source file modification times, scores each document 0-100 for freshness, triggers incremental sync when freshness drops below threshold, and adds freshness metadata to document headers.
version: 3.0.0
---

# Staleness Detector

Monitor the freshness of all engineering intelligence documents by comparing their last-updated timestamps against the modification times of the source files they describe. Produce a freshness report and trigger incremental sync for stale documents.

This capability does not modify product code.

## Inputs

- Repository root path
- Knowledge base directory (`knowledge-base/`)
- Memory directory (`.engineering-intelligence/memory/`)
- Context directory (`.engineering-intelligence/context/`)
- Optional: specific document or module to check
- Optional: custom freshness threshold (default: 60)

## Procedure

1. **Inventory knowledge documents** — Enumerate all documents in:
   - `knowledge-base/*.md` (00 through 16)
   - `.engineering-intelligence/memory/*.md`
   - `.engineering-intelligence/context/*.md`
   - `.engineering-intelligence/graph/*.json`

   For each document, extract:
   - Document path
   - Last modified timestamp (from filesystem or frontmatter `last_updated` field)
   - Evidence citations within the document (file paths referenced)

2. **Extract evidence dependencies** — For each knowledge document, parse all evidence citations to build a dependency map:

   ```markdown
   ## Document Dependencies

   | Document | Depends On (Source Files) |
   |---|---|
   | `02-architecture.md` | `src/app/`, `src/server/`, `next.config.mjs` |
   | `05-database.md` | `prisma/schema.prisma`, `src/db/`, `migrations/` |
   | `06-authentication.md` | `src/auth/`, `auth.config.ts`, `middleware.ts` |
   ```

3. **Check source file modification times** — For each source file referenced by a knowledge document:
   - Get the file's last modification time via `git log -1 --format=%cI -- <path>` (preferred) or filesystem mtime
   - Compare against the knowledge document's last-updated timestamp
   - Track files that no longer exist (deleted or moved)

4. **Calculate freshness score** — Score each document 0–100 using this formula:

   ```
   base_score = 100

   For each referenced source file:
     days_since_doc_update = (now - document_last_updated).days
     days_since_file_change = (now - file_last_modified).days

     if file was modified AFTER document was last updated:
       staleness_penalty = min(30, (file_modified - doc_updated).days * 3)
       base_score -= staleness_penalty

     if file no longer exists:
       base_score -= 25  (major structural change)

     if file was renamed/moved (detected via git):
       base_score -= 15  (references are broken)

   age_penalty = min(20, days_since_doc_update * 0.5)
   base_score -= age_penalty

   freshness_score = max(0, base_score)
   ```

   **Score interpretation:**

   | Score | Status | Meaning |
   |---|---|---|
   | 80–100 | 🟢 Fresh | Document is current and reliable |
   | 60–79 | 🟡 Aging | Document may have minor inaccuracies |
   | 40–59 | 🟠 Stale | Document likely has outdated information |
   | 20–39 | 🔴 Very Stale | Document is unreliable, needs re-generation |
   | 0–19 | ⛔ Obsolete | Document may be misleading, urgent refresh needed |

5. **Add freshness metadata** — Inject or update a frontmatter block at the top of each knowledge document:

   ```markdown
   <!-- freshness: score=75, status=aging, last_checked=2024-01-20T14:30:00Z -->
   <!-- stale_sources: src/auth/middleware.ts (modified 5 days after doc update) -->
   ```

   Rules for metadata injection:
   - If a `<!-- freshness: -->` comment already exists, update it in place
   - If no freshness comment exists, add it after the document title (first `#` heading)
   - Never modify document content — only metadata comments

6. **Determine sync actions** — Based on freshness scores, determine required actions:

   | Condition | Action |
   |---|---|
   | Score < threshold (default 60) | Queue for incremental sync via `incremental-sync-engine` |
   | Score < 30 | Flag as critical in report, recommend full re-generation |
   | Referenced file deleted | Flag structural change, recommend manual review |
   | Referenced file moved | Update evidence citations, re-verify claims |
   | Multiple documents stale for same module | Recommend module-level re-discovery |

7. **Generate FRESHNESS-report.md** — Write to `.engineering-intelligence/reports/FRESHNESS-report.md`:

   ```markdown
   # Freshness Report

   Generated: <timestamp>
   Threshold: <score>
   Documents scanned: <N>

   ## Summary

   | Status | Count | Percentage |
   |---|---|---|
   | 🟢 Fresh (80-100) | <N> | <N%> |
   | 🟡 Aging (60-79) | <N> | <N%> |
   | 🟠 Stale (40-59) | <N> | <N%> |
   | 🔴 Very Stale (20-39) | <N> | <N%> |
   | ⛔ Obsolete (0-19) | <N> | <N%> |

   ## Document Scores

   | Document | Score | Status | Stale Sources | Last Updated | Action Needed |
   |---|---|---|---|---|---|
   | `02-architecture.md` | 45 | 🟠 Stale | `src/app/layout.tsx` (+3d) | 2024-01-10 | Incremental sync |
   | `05-database.md` | 90 | 🟢 Fresh | — | 2024-01-18 | None |
   | ... | ... | ... | ... | ... | ... |

   ## Structural Changes

   | Type | File | Affected Documents |
   |---|---|---|
   | Deleted | `src/old-auth/handler.ts` | `06-authentication.md` |
   | Moved | `src/utils.ts` → `src/lib/utils.ts` | `01-repository-structure.md` |

   ## Recommended Actions

   1. **Critical** — Re-generate: <list of documents with score < 30>
   2. **High** — Incremental sync: <list of documents with score < 60>
   3. **Medium** — Review: <list of documents with score 60-79>
   4. **Structural** — Manual review needed: <list of deleted/moved file impacts>

   ## Module-Level Freshness

   | Module | Avg Document Score | Documents Below Threshold |
   |---|---|---|
   | auth | 42 | `06-authentication.md`, `context/critical-paths.md` |
   | api | 88 | — |
   | ... | ... | ... |
   ```

8. **Trigger incremental sync** — For documents below the threshold, invoke `incremental-sync-engine` with:
   - The specific document to update
   - The list of changed source files
   - The staleness reason (file modified, file deleted, file moved, age)

## Quality Gates

- [ ] All knowledge base, memory, and context documents are inventoried
- [ ] Evidence citations are parsed from every document
- [ ] Source file modification times are checked against document timestamps
- [ ] Freshness scores follow the defined calculation formula
- [ ] Score interpretation matches the defined status table
- [ ] Freshness metadata is injected without modifying document content
- [ ] FRESHNESS-report.md exists at `.engineering-intelligence/reports/FRESHNESS-report.md`
- [ ] Structural changes (deleted/moved files) are detected and reported
- [ ] Documents below threshold are queued for incremental sync
- [ ] Module-level aggregation is included in the report

## Cross-References

- Used by: `ongoing-learning-engine` (for freshness monitoring)
- Uses: `incremental-sync-engine` (to refresh stale documents)
- Consumed by: `engineering-intelligence-skill`, `engineering-orchestrator`
- Feeds into: `.engineering-intelligence/reports/FRESHNESS-report.md`
- Related: `knowledge-base-validator` (validates content accuracy; staleness-detector validates currency)

This capability does not modify product code.
