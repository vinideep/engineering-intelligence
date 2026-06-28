---
name: user-intelligence-engine
description: Resolves developer identity from git config, seeds a personal user-intelligence profile from git history, observes post-interaction signals to refine preferences, and promotes team-wide consensus to team-preferences.md. Multi-user safe: personal profiles are gitignored; team layer is committed.
version: 1.0.0
---

# User Intelligence Engine

Build and maintain a personal developer profile so every workflow response is calibrated to the individual — their test philosophy, implementation depth, communication style, and architecture preferences — without asking onboarding questions.

This capability does not modify product code.

## Inputs

- Repository root path
- Current interaction context (request text, what was accepted / pushed back on)
- Optional: mode — `seed` (first run / refresh from git) | `observe` (post-interaction update) | `promote` (promote consensus to team layer)

## Identity Resolution (zero tokens)

Before any LLM work, run the CLI:

```bash
npx engineering-intelligence user-profile .
```

This resolves identity and seeds the profile from git history without consuming any LLM context:

| Signal | Source | How |
|---|---|---|
| Developer email | `git config user.email` | Profile directory key |
| Developer name | `git config user.name` | Display name |
| GitHub username | `git remote get-url origin` | Parsed from URL |
| CI session | `$CI`, `$GITHUB_ACTIONS`, `$GITLAB_CI`, `$JENKINS_URL` | Skip personal profile if set |
| IDEs in use | Presence of `.claude/`, `.cursor/`, `.gemini/` etc. | Profile metadata |
| Test philosophy | % of commits with `*.test.*` / `*.spec.*` files | `git log --name-only` |
| Primary working areas | Top dirs in `git log --name-only` | File path frequency |
| Primary language | Most frequent extension in commit history | File extension count |
| Commit style | >60% match `feat|fix|chore|...` pattern | `git log --format="%s"` |
| Avg commit size | Mean lines changed per commit | `git log --numstat` |

## Profile Storage (multi-user safe)

```
.engineering-intelligence/
  memory/
    team-preferences.md          ← committed — team consensus layer
    users/                       ← gitignored — never committed
      <git-email-slug>/
        user-intelligence.md     ← personal profile, local only
  .gitignore                     ← contains: memory/users/
```

The `ei user-profile` CLI command creates `.engineering-intelligence/.gitignore` with `memory/users/` on first run. Personal profiles never appear in `git status`.

## CI Guard

If any of `$CI`, `$GITHUB_ACTIONS`, `$GITLAB_CI`, `$JENKINS_URL`, `$TRAVIS`, `$CIRCLECI` are set:
- **Skip personal profile loading entirely**
- Load only `team-preferences.md` and `coding-patterns.md`
- Do not write any signals to any profile

## Profile Document Structure

`.engineering-intelligence/memory/users/<slug>/user-intelligence.md`:

```markdown
# User Intelligence Profile
<!-- generated: <ISO> | sessions: <N> | identity: <email> -->

## Identity
| Field | Value |
|---|---|
| Email | alice@company.com |
| GitHub | alice-gh |
| CI session | no |
| IDEs detected | claude-code, cursor |

## Git-Derived Signals
| Signal | Value | Confidence | Evidence |
|---|---|---|---|
| Test file inclusion | 62% of commits | verified | git log |
| Primary working areas | src/, test/ | verified | git log |
| Primary language | TypeScript | verified | extension freq |
| Commit style | conventional | verified | >60% match |
| Avg commit size | medium (87 lines avg) | verified | git numstat |

## Engineering Preferences
| Dimension | Value | Confidence | Source |
|---|---|---|---|
| Tests | always | git | 62% test commit ratio |
| Implementation depth | standard | git | avg 87 lines/commit |
| Type strictness | strict | observed | pushed back on `any` cast |
| Architecture bias | functional | observed | 3 sessions |

## Communication Style
| Dimension | Value | Confidence |
|---|---|---|
| Request style | imperative | observed |
| Response depth | terse | observed |
| Reasoning preference | show-diff-first | observed |

## Active Predictions
- Test generation: always
- Implementation depth: standard
- Response format: show diff first, explanation after
- Type safety: always strict, no any

## Interaction Signal Log
| Date | Request Pattern | Behavior | Signal Learned |
|---|---|---|---|
| 2026-06-27 | "quick fix for..." | accepted minimal depth | bugfix → minimal |
```

## Procedure

### Mode: seed (first run or `ei user-profile` refresh)

1. Run `npx engineering-intelligence user-profile .` — this handles identity + git seeding.
2. Read the generated profile at `.engineering-intelligence/memory/users/<slug>/user-intelligence.md`.
3. Apply **Active Predictions** to the current session immediately.

### Mode: observe (after each workflow interaction)

Run at the END of every `engineering-intelligence` workflow. Extract 1–3 signals from the interaction:

**Signal extraction rules:**

| Observation | Signal |
|---|---|
| User said "quick", "minimal", "sketch" | `implementationDepth: spike` |
| User said "thorough", "production", "audit" | `implementationDepth: production-hardened` |
| User pushed back on added tests | `tests: on-request` |
| User asked for more tests than generated | `tests: always` |
| User pushed back on `any` type | `typeStrictness: strict` |
| User asked for shorter response | `responseDepth: terse` |
| User asked for more explanation | `responseDepth: detailed` |
| Request used imperative verb ("add", "fix", "remove") | `requestStyle: imperative` |
| Request was exploratory ("what if", "how would", "could we") | `requestStyle: exploratory` |
| User accepted diff-first response | `reasoningPreference: show-diff-first` |

**Confidence escalation:**
- 1 observation → `low` confidence, record in signal log only
- 2 consistent observations → `medium` confidence, update profile preference
- 3+ consistent observations → `high` confidence, mark as confirmed

**Durability filter (apply before any profile write):**
- Is this signal specific to this task or a durable pattern? If task-specific → signal log only, don't update preference.
- Does this contradict a high-confidence existing signal? If yes → flag divergence, don't silently overwrite.

After extracting signals:
1. Append a row to **Interaction Signal Log** (always).
2. Update **Engineering Preferences** or **Communication Style** only when confidence threshold is met.
3. Update **Active Predictions** to reflect any confirmed changes.
4. Increment `sessions` counter in the document comment.

### Mode: promote (team consensus)

When 2 or more developers independently exhibit the same signal for the same dimension:

1. Read all profiles under `.engineering-intelligence/memory/users/*/user-intelligence.md`.
2. Count confirmed signals per dimension across profiles.
3. If ≥ 2 profiles agree with `medium` or `high` confidence → promote to `team-preferences.md`.
4. Record the contributing identities and evidence.

`team-preferences.md` format:
```markdown
# Team Engineering Preferences

| Dimension | Team Value | Confidence | Evidence |
|---|---|---|---|
| Type strictness | strict | high | alice (3 sessions), bob (2 sessions) |
| Tests | always | medium | alice (git history), carol (git history) |
```

## Loading Order (context-budget-optimizer integration)

The context-budget-optimizer loads intelligence in this order:

```
Rank 0 (pinned, ~50t): .engineering-intelligence/memory/users/<slug>/user-intelligence.md — Active Predictions block only
Rank 1 (~100t):        .engineering-intelligence/memory/team-preferences.md
Rank 2 (~150t):        .engineering-intelligence/memory/coding-patterns.md
...
```

Only the **Active Predictions** block (~50t) is loaded at pre-flight. The full profile is lazy-loaded only when a signal update is needed.

## Override Priority

Personal overrides team, which overrides detected conventions:

```
Personal profile  →  highest priority (your session)
team-preferences  →  applies when personal dimension is "unknown"
coding-patterns   →  applies when both above are silent
```

## Edge Cases

| Scenario | Handling |
|---|---|
| No git commits by this user | Profile seeded with defaults; git signals show 0 |
| git config user.email not set | Fall back to `$USER@local` |
| Multiple machines, same user | Separate local profiles (acceptable — profiles build independently) |
| New team member | No personal profile; team-preferences.md provides immediate defaults |
| Signal contradicts team convention | Flag: "Your preference for X differs from team convention Y — intentional?" |
| CI pipeline invokes workflow | Personal profile skipped; only team and detected layers apply |

## Quality Gates

- [ ] `ei user-profile .` was run before loading the profile
- [ ] CI environment check passes before any profile read/write
- [ ] Personal profile stored under `.engineering-intelligence/memory/users/<slug>/`
- [ ] `.engineering-intelligence/.gitignore` contains `memory/users/`
- [ ] Active Predictions block is applied before first response in any workflow
- [ ] Signals extracted from each interaction and logged
- [ ] Confidence threshold enforced before updating preferences
- [ ] Team promotion only fires when ≥ 2 independent confirmations exist
- [ ] No product code modified

## Cross-References

- CLI: `npx engineering-intelligence user-profile .` — seeds profile from git history
- Used by: `context-budget-optimizer` (loads Active Predictions at rank-0), `engineering-intelligence-skill` (pre-flight)
- Feeds into: `.engineering-intelligence/memory/users/<slug>/user-intelligence.md`, `team-preferences.md`
- Related: `memory-sync-engine` (manages team-preferences.md), `ongoing-learning-engine` (uncertainty tracking)

This capability does not modify product code.
