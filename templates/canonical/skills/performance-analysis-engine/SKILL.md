---
name: performance-analysis-engine
description: Identifies performance issues through static analysis of database query patterns, frontend bundle size, render performance, API response patterns, and caching opportunities. Use during initialization, before releases, or when performance-sensitive changes are detected.
version: 3.0.0
---

# Performance Analysis Engine

Identify performance risks and optimization opportunities through evidence-based static analysis of code patterns, queries, bundles, and caching strategies.

## Inputs

- Repository root path
- Mode: `full` (comprehensive analysis) or `targeted` (specific area or post-change)
- Optional: scope constraints (specific modules, change diff)
- Optional: previous assessment (`.engineering-intelligence/knowledge-base/21-performance-assessment.md`) for delta comparison

## Procedure

1. **Database Query Pattern Analysis** — Scan data access layers for:

   | Pattern | Risk | Detection Method |
   |---|---|---|
   | N+1 queries | High | Loop containing query calls, ORM eager/lazy loading misuse |
   | Missing indexes | Medium | Queries filtering/sorting on non-indexed columns |
   | Unbounded queries | High | SELECT without LIMIT, missing pagination |
   | Full table scans | Medium | Queries without WHERE clauses on large tables |
   | Unnecessary joins | Low | Joins fetching unused columns |
   | Missing connection pooling | Medium | New connection per request pattern |

   Cross-reference with schema definitions and ORM configuration.

2. **Bundle Size Analysis** (frontend projects) — Assess:

   | Check | Description |
   |---|---|
   | Bundle composition | Identify largest dependencies by size contribution |
   | Tree-shaking gaps | Imports that prevent effective tree-shaking |
   | Code splitting | Missing dynamic imports for route-level splitting |
   | Duplicate dependencies | Same library bundled at multiple versions |
   | Dead code | Exported modules never imported elsewhere |
   | Asset optimization | Uncompressed images, unminified resources |

   Read build configuration (webpack, vite, esbuild, etc.) to understand current optimization setup.

3. **Render Performance Patterns** (frontend projects) — Identify:

   | Pattern | Risk | Detection Method |
   |---|---|---|
   | Unnecessary re-renders | High | Components without memoization receiving stable props |
   | Missing `useMemo`/`useCallback` | Medium | Expensive computations in render path |
   | Large component trees | Medium | Deeply nested components without virtualization |
   | Layout thrashing | High | DOM reads interleaved with writes |
   | Missing virtualization | High | Lists rendering >100 items without windowing |
   | Unoptimized images | Medium | Missing lazy loading, no responsive sizes |

4. **API Response Time Patterns** — Analyze:

   | Check | Description |
   |---|---|
   | Waterfall requests | Sequential API calls that could be parallelized |
   | Over-fetching | Endpoints returning significantly more data than consumed |
   | Under-fetching | Multiple requests needed where one could suffice |
   | Missing pagination | List endpoints without page size limits |
   | Synchronous heavy operations | Long-running tasks blocking request handlers |
   | Missing timeouts | External API calls without timeout configuration |

5. **Caching Opportunities** — Identify:

   | Opportunity | Evidence |
   |---|---|
   | Repeated identical queries | Same query executed multiple times per request |
   | Static data fetched dynamically | Configuration or reference data loaded on every request |
   | Missing HTTP cache headers | Responses for stable resources without Cache-Control |
   | Computation-heavy endpoints | Endpoints with expensive but deterministic calculations |
   | Missing CDN utilization | Static assets served from application server |
   | Session/user-level caching | Per-user data re-fetched on every request |

   Review existing caching infrastructure (Redis, Memcached, in-memory, HTTP) and identify gaps.

6. **Generate Assessment** — Write findings to `.engineering-intelligence/knowledge-base/21-performance-assessment.md`.

## Output Format

Write `.engineering-intelligence/knowledge-base/21-performance-assessment.md`:

```markdown
# Performance Assessment

## Meta
- Generated: <ISO timestamp>
- Mode: full | targeted
- Scope: <what was examined>
- Overall risk: low | medium | high | critical

## Database Query Patterns
| Issue | Location | Risk | Recommendation |
|---|---|---|---|
| N+1 query | src/users/service.ts:45 | High | Add eager loading for user.posts |

## Bundle Analysis
| Metric | Value | Status |
|---|---|---|
| Total bundle size | 1.2 MB | concern |
| Largest dependency | moment.js (320 KB) | Replace with date-fns |

## Render Performance
| Issue | Component | Risk | Recommendation |
|---|---|---|---|
| Missing memoization | UserList | Medium | Wrap with React.memo |

## API Patterns
| Issue | Endpoint | Risk | Recommendation |
|---|---|---|---|
| Waterfall requests | /dashboard | High | Parallelize data fetching |

## Caching Opportunities
| Opportunity | Location | Impact |
|---|---|---|
| Static config fetched per request | src/config/loader.ts | High |

## Recommendations
1. <prioritized optimization actions with estimated impact>

## Evidence
- <file path citations for all findings>

---
*This performance assessment did not modify product code.*
```

## Rules

- Every finding must cite a specific file path and line number or code pattern
- Risk assessment must consider actual usage patterns, not theoretical worst cases
- Bundle analysis findings must reference build configuration evidence
- Do not recommend premature optimization — prioritize by measured or evidenced impact
- This capability is analytical only — it must not modify product code

## Quality Gates

- [ ] All findings cite specific file paths or code patterns
- [ ] Database query issues distinguish between ORM-generated and raw queries
- [ ] Bundle analysis references build configuration
- [ ] Render performance findings are framework-aware (React, Vue, Angular, etc.)
- [ ] Caching recommendations consider existing infrastructure
- [ ] Recommendations are prioritized by estimated impact
- [ ] Report ends with the "did not modify product code" statement

## Cross-References

- Depends on: `deep-project-knowledge-extractor` (project structure and technology understanding)
- Used by: `engineering-intelligence-skill`, `impact-analysis-engine` (performance risk scoring)
- Updates: `.engineering-intelligence/knowledge-base/21-performance-assessment.md`

This capability is analytical only. It must not modify product code.
