# Engineering Intelligence OS — Slide Content
*(Source document for slide generation. Each "## Slide N" block = one slide. Title = slide title, bullets = on-slide content, "Speaker note" = talk track, not for the slide itself.)*

---

## Slide 1: Title
**Engineering Intelligence OS**
Turn any AI coding IDE into a disciplined engineering team

Subtitle: One install. 46 skills. 15 agents. 9 IDEs.

Speaker note: Open with the amnesia story — AI agents re-learning your codebase every session.

---

## Slide 2: The Problem
**AI coding agents forget everything**

- Re-learns your codebase from scratch every session
- Jumps straight to code — skips impact analysis
- No continuity between one prompt and the next
- Loads full instruction files every time — wasted tokens
- Locked into one tool — rebuild prompts if you switch IDEs
- Every developer treated identically

Speaker note: Pick 2-3 to riff on as war stories, don't read the whole list.

---

## Slide 3: The One-Sentence Pitch
**What it is**

An installable pack of skills, agents, and workflows that teaches your AI IDE to:
1. Plan before it codes
2. Remember what it learned
3. Pick up exactly where it left off

Across 9 AI IDEs, from one shared source.

Speaker note: No runtime model calls at install. It's instruction files, not magic.

---

## Slide 4: What It Is / Isn't
**Setting expectations honestly**

✅ What it is:
- A persistence layer — evidence-based knowledge base + architecture graphs
- A discipline layer — impact analysis + safety gates before changes
- Conflict-aware — tracks edits, never clobbers your changes

❌ What it isn't:
- Not a runtime enforcement engine (guides, doesn't block)
- Not a replacement for code review
- Token savings measured at file-render level, not per live session

Speaker note: This slide builds trust — say it plainly, don't rush past it.

---

## Slide 5: Quick Start
**Three steps, that's it**

```
# 1. Install
npx engineering-intelligence install . --ide claude-code --yes

# 2. Initialize (inside your AI IDE)
/initialize-engineering-intelligence

# 3. Build
/engineering-intelligence Add rate limiting to auth endpoints
```

Speaker note: Live demo starts here — switch to terminal.

---

## Slide 6: 9 Supported IDEs
**One canonical source, rendered everywhere**

Claude Code · Cursor · GitHub Copilot · Gemini CLI · OpenAI Codex CLI · CommandCode · Antigravity · Antigravity CLI · Generic (any AI IDE)

Speaker note: Nobody on the team has to switch tools to get this.

---

## Slide 7: What Gets Installed
**Per-IDE, native file locations**

- Claude Code → `.claude/skills/` `.claude/agents/` `.claude/commands/`
- Cursor → `.cursor/rules/` `.cursor/commands/`
- Copilot → `.github/skills/` `.github/agents/` `.github/prompts/`
- Others → adapter-specific native paths

Managed blocks only — your own files are never touched.

Speaker note: Show `ls .claude/skills`, `ls .claude/agents` live.

---

## Slide 8: Initialize — Building Persistent Memory
**`/initialize-engineering-intelligence`**

Reads the actual codebase and generates:
- `knowledge-base/` — architecture, domain, API knowledge
- `graph/` — dependency, service, runtime, business-flow graphs
- `aidlc/` — lifecycle state
- `memory/` — session memory

Evidence-based. Every claim traces to a real file. Persists across sessions.

Speaker note: Show the generated architecture-map.md Mermaid diagram live.

---

## Slide 9: The Core Workflow
**`/engineering-intelligence <your request>`**

One command runs the full pipeline internally:

1. Freshness check
2. Impact analysis
3. Agile planning
4. Implementation
5. Safety gates (only the relevant ones)
6. Tests
7. Knowledge sync
8. Change history

Speaker note: "You asked for rate limiting. It brought the discipline."

---

## Slide 10: Delivery Modes
**Same command, different mindset**

```
/engineering-intelligence Harden checkout APIs using adversarial delivery mode
```

| Mode | When to use |
|---|---|
| (default) | Standard Agile delivery |
| Adversarial | Security-sensitive changes |
| TDD | Tests drive the design |
| Design-first | Large architecture changes, needs an ADR |
| Hypothesis debugging | Intermittent bugs, production mysteries |

Speaker note: Most slept-on feature — one phrase changes the agent's whole approach.

---

## Slide 11: Safety Gates
**Applied automatically when relevant**

Freshness/drift · Impact analysis · Acceptance criteria · Type safety · API compatibility · API snapshots · Database migration safety · Dependency security · Env variable audit · ADR compliance · LLM prompt injection guard · Rollback planning · Observability

Speaker note: Not every gate fires every time — only the ones the change actually triggers.

---

## Slide 12: Epic-Scale Work — The Backlog Flow
**For initiatives bigger than one feature**

```
# Step 1 — decompose (no code written)
/decompose-backlog Build a self-serve billing portal

# Step 2 — deliver, one feature at a time
/deliver-backlog
```

- Creates Epics → Features → Tickets with stable IDs
- Every feature starts `Approval: pending`
- Agent stops and asks before writing any code

Speaker note: You stay the gatekeeper — this isn't autonomous-agent-runs-wild.

---

## Slide 13: Token Efficiency
**Tiered loading, measured savings**

Routing table → one-paragraph brief → full skill (only when it runs)

**28–37% fewer tokens per invocation** — enforced by a regression-guarded test (`test/token-reduction.test.mjs`)

Speaker note: Not a marketing number — there's an actual test file for it.

---

## Slide 14: Per-Developer Intelligence
**Calibrated to you, not a generic default**

```
npx engineering-intelligence user-profile .
```

- Zero LLM tokens — seeded from `git config` + commit history
- Personal profile: test philosophy, change size, primary language
- Gitignored automatically — never leaks to a teammate's checkout
- Committed `team-preferences.md` — shared consensus, applies in CI

Speaker note: My favorite feature — surprises people every time.

---

## Slide 15: Lifecycle Commands
**Terminal, not IDE**

```
npx engineering-intelligence doctor .        # health check
npx engineering-intelligence update .        # apply updates
npx engineering-intelligence visualize .     # HTML dashboard
npx engineering-intelligence uninstall .     # removes only managed content
```

Speaker note: Doctor reports missing files and hash mismatches — good for CI.

---

## Slide 16: Toolkit Contents
**By the numbers**

- **46 skills** — knowledge/architecture, planning/delivery, quality/safety, operations, security/compliance
- **15 specialist agents** — orchestrator, change agent, quality agent, security officer, test engineer, and more
- **11 workflows** — engineering-intelligence, initialize, create-project, decompose-backlog, deliver-backlog, and more

Speaker note: Don't read all 46 skills — point at the categories.

---

## Slide 17: Try It Yourself
**Hands-on — open a terminal now**

```
npx engineering-intelligence install . --ide claude-code --yes
npx engineering-intelligence doctor .

/initialize-engineering-intelligence
/engineering-intelligence <one small real thing from your repo>
```

Speaker note: Hand off the room here. Circulate for questions.

---

## Slide 18: Closing
**It doesn't make your AI smarter — it makes it accountable**

- Persistent memory across sessions
- Discipline before code
- A paper trail you can audit

```
npx engineering-intelligence
```

MIT licensed · github.com/vinideep/engineering-intelligence

Speaker note: "Star it if it saves you the rate-limiting conversation for the fifth time this month."

---

## Slide 19 (Optional/backup): Quick Reference Card
**Commands cheat sheet**

```
npx engineering-intelligence install . --ide claude-code --yes
npx engineering-intelligence doctor .
npx engineering-intelligence update . --dry-run
npx engineering-intelligence visualize . --open
npx engineering-intelligence user-profile .
```
```
/initialize-engineering-intelligence
/engineering-intelligence <request>
/engineering-intelligence <request> using adversarial delivery mode
/scope-requirement <requirement>
/analyze-impact <proposed change>
/decompose-backlog <epic-sized initiative>
/deliver-backlog
/review-engineering-change Review the working-tree diff
```

Speaker note: Share this slide as a leave-behind after the talk.
