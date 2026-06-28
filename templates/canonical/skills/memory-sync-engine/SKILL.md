---
name: memory-sync-engine
description: Maintains durable engineering memory after architecture, business rule, constraint, convention, or technology decisions change. Use only for long-lived knowledge.
version: 3.0.0
---

# Memory Synchronization

Maintain durable, long-lived engineering memory. Memory is for decisions and patterns that persist across many changes — never for transient implementation details.

## Inputs

- Impact report and actual change evidence
- Current `.engineering-intelligence/memory/` documents

## Memory Categories

| Document | Content | Update Trigger |
|---|---|---|
| `architecture-decisions.md` | ADRs, layer definitions, boundary rules, communication patterns | Architecture changes, new service boundaries, pattern adoptions |
| `business-rules.md` | Domain invariants, validation rules, business logic constraints | Business logic changes, regulatory updates |
| `coding-patterns.md` | Recurring conventions, idioms, naming rules, file organization | Refactors that establish new patterns, convention changes |
| `project-constraints.md` | Performance budgets, compatibility requirements, SLA targets, regulatory | Infrastructure changes, new compliance requirements |
| `technology-decisions.md` | Stack choices, framework versions, deprecation timelines, migration plans | Dependency updates, technology migrations |
| `regression-patterns.md` | Recurring bug categories and proven regression test templates | Bugfixes that reveal reusable failure patterns |
| `team-preferences.md` | Team-wide engineering preferences promoted from ≥2 developer profiles | When `user-intelligence-engine` detects consensus across developers |
| `users/<slug>/user-intelligence.md` | Personal developer profile (gitignored, never committed) | After each workflow session via `user-intelligence-engine`; CLI-seeded via `ei user-profile` |

## Regression Pattern Ownership

Testing Intelligence Engine owns detection and proposal of regression patterns during bugfix validation. Memory Sync owns durable persistence to `.engineering-intelligence/memory/regression-patterns.md` after confirming the pattern is reusable and evidence-backed. Testing Intelligence must not directly persist durable memory unless it is explicitly running through Memory Sync.

## Staleness Detection Rules

A memory entry may be stale if:

1. **Referenced code no longer exists** — The decision references files/modules that were deleted or renamed
2. **Contradicted by current code** — The pattern described is no longer followed in the codebase
3. **Superseded by new decision** — A newer decision overrides the documented one
4. **Evidence outdated** — The evidence citations point to significantly changed code

## Procedure

1. **Check Trigger** — Review the impact report. Does the change affect a durable decision, rule, constraint, pattern, or technology choice? If not, **stop — leave memory unchanged**.

2. **Identify Affected Entries** — Match the change against memory categories above. Only proceed for matching categories.

3. **Update Entry** — For each affected entry:
   ```markdown
   ## <Decision/Pattern Title>

   **Status**: Active | Superseded | Deprecated
   **Decided**: <date or CHG reference>
   **Last verified**: <date>

   <Description of the decision/pattern>

   **Rationale**: <why this was chosen>
   **Source**: (evidence: path/to/file)
   **Alternatives considered**: <if applicable>
   ```

4. **Verify Durability** — Before adding a new memory entry, confirm it's truly durable:
   - Will this still be relevant after 5+ more changes?
   - Is this a decision or just an implementation detail?
   - Is this captured better elsewhere (knowledge-base, context)?

5. **Memory Pruning Audit** — During initialization, major refactors, or explicit sync:
   - Flag entries where referenced code no longer exists
   - Flag entries superseded for more than six months
   - Flag patterns contradicted by current `convention-detector` output
   - Flag decisions that conflict with accepted ADRs
   - Propose retirement with evidence; do not delete historical decisions silently

6. **Regression Pattern Update** — For bugfixes:
   - Classify the bug category (pagination boundary, null/empty collection, race condition, permission bypass, retry/idempotency, schema drift, API contract mismatch, etc.)
   - Match against `.engineering-intelligence/memory/regression-patterns.md`
   - Add or update a reusable regression test template when the pattern is durable

## Rules

- **Durable only**: Do not store transient implementation notes or unverified assumptions
- **Evidence required**: Every entry must cite source evidence
- **Leave unchanged when appropriate**: Most changes do NOT affect durable memory — it's correct to update nothing
- **Status tracking**: Mark superseded decisions as `Superseded` rather than deleting them — history matters
- **Pruning with evidence**: Retire or deprecate stale memory only with evidence and status updates
- **No product code**: Memory synchronization never modifies product code

## Quality Gates

- [ ] Change was verified to affect durable knowledge before updating
- [ ] Only affected entries were modified
- [ ] New entries are truly durable (not transient implementation details)
- [ ] All entries have evidence citations
- [ ] Superseded entries are marked, not deleted
- [ ] Memory pruning audit was run for initialization and major refactors
- [ ] Regression patterns were checked for bugfixes

## Cross-References

- Used by: `incremental-sync-engine`, `engineering-intelligence-skill`
- Consumed by: `engineering-orchestrator` (for routing decisions), `change-agent` (for pattern compliance)
