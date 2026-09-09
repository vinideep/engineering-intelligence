# Session Script — "Turn Your AI IDE Into a Disciplined Engineering Team"

**Audience:** Fellow engineers (already using Claude Code / Cursor / Copilot etc.)
**Length:** 30–45 minutes (aim for ~25 min talking + 10–15 min hands-on + Q&A)
**Format:** Live terminal + IDE demo. Have a throwaway repo (or this one) open before you start.

> Presenter note: lines in *italics* are stage directions for you, not things to say out loud.
> Bold **[DEMO]** markers = switch to your terminal/IDE.

---

## 0. Before you start (prep, not part of the talk)

- Have a small sample repo cloned and ready (or use `engineering-intelligence-OS` itself).
- Pre-run `npm install` so nothing stalls live.
- Have two terminal tabs: one clean, one already `cd`'d into the demo repo.
- Have your AI IDE (Claude Code) open in a second window, ready to switch to.
- *Optional:* pre-open the README.md in a browser tab in case live demo hiccups and you need a fallback screenshot.

---

## 1. Open with a story, not a slide (2 min)

> *Say this conversationally, like you're annoyed at something relatable — this is your hook.*

"Quick show of hands — who here has used an AI coding assistant and had it confidently break something it 'fixed' yesterday? Or re-explain your own architecture back to you like it's never seen the codebase before?"

*(pause for reactions/nods)*

"That's not a model problem. That's a **memory** problem. Every session, your AI assistant wakes up with amnesia. It re-reads your code from scratch, has no idea what changed last week, skips the boring-but-critical stuff like impact analysis, and drifts further from your team's conventions every single day.

So I built something to fix that. It's called **Engineering Intelligence OS** — and today I'm going to show you, live, how it turns any AI coding IDE from a smart-but-forgetful intern into something closer to a disciplined engineering team member."

---

## 2. The one-sentence pitch (1 min)

"In one sentence: it's an installable pack of **skills, agents, and workflows** that teaches your AI IDE to *plan before it codes*, *remember what it learned*, and *pick up exactly where it left off* — across 9 different AI IDEs, from one shared source."

*Beat. Let that land. Then immediately ground it:*

"It doesn't call any AI model itself. It doesn't touch your source code on install. It just drops instruction files into your repo — think of it as an onboarding packet and a set of standard operating procedures for your AI agent. The actual thinking still happens inside your IDE, using your existing subscription."

---

## 3. The problem, framed as a table people recognize (3 min)

> *Speak through this like war stories, not bullet points. Pick 2-3, don't read all 6 verbatim.*

"Here's what actually happens without this:

- Your agent **re-learns your codebase from zero** every session — burns time and tokens.
- It **jumps straight to code**, skips thinking about blast radius.
- Work is **ad-hoc** — no continuity between one prompt and the next big initiative.
- Every skill/instruction file you *do* give it gets loaded in full, every time — that's wasted context, wasted money.
- You're **locked into one tool** — switch from Cursor to Claude Code and you rebuild all your custom prompts.
- Every developer on the team gets treated identically, even though you and your teammate have completely different testing philosophies.

Six real problems. Let's see the fixes."

---

## 4. Live demo — Install (5 min) **[DEMO]**

> *Switch to terminal. Type slowly enough that people can read along.*

"Let's install it into a real project. One command, run once, from the project root:"

```bash
npx engineering-intelligence install . --ide claude-code --yes
```

*While it installs, narrate:*

"This just wrote skills, agents, and command files into `.claude/` — nothing in your actual source code touched. It's smart about it too — if you install for multiple IDEs, or run it again later, it tracks content hashes so it never clobbers edits you've made."

*(Optional flex, if time allows)* — show installing for two IDEs at once:

```bash
npx engineering-intelligence install . --ide claude-code,cursor --yes
```

"One canonical source, rendered natively into whatever tool each of your teammates prefers. Nobody has to switch IDEs to get this."

**[DEMO] Show the installed files:**

```bash
ls .claude/skills | head -10
ls .claude/agents
ls .claude/commands
```

"46 skills, 15 specialist agents, 15 workflows — installed in seconds."

---

## 5. Live demo — Initialize (5 min) **[DEMO]**

> *Switch to your AI IDE window.*

"Now we open the IDE and run one command — this is the only step where the AI actually does anything:"

```
/initialize-engineering-intelligence
```

*While it runs (this can take a minute — have this pre-run in a scratch repo as backup if live is slow):*

"What's happening right now: the agent is reading the actual codebase — not guessing, not hallucinating — and building an **evidence-based knowledge base**. Architecture, domain concepts, API surface, risk areas. It's also building **dependency graphs** — real graphs of what imports what, what calls what.

Here's the key part: **this persists.** Next session, next week, next month — the agent doesn't start over. It reads what it already learned."

**[DEMO] Show what got generated:**

```bash
ls .engineering-intelligence/knowledge-base/
ls .engineering-intelligence/graph/
cat .engineering-intelligence/graph/architecture-map.md | head -30
```

"That Mermaid diagram? Generated from evidence, not vibes. Every claim in the knowledge base traces back to an actual file."

---

## 6. Live demo — The core workflow (7 min) **[DEMO]**

> *This is the centerpiece. Slow down here.*

"Now the fun part — actually building something. One command:"

```
/engineering-intelligence Add rate limiting to the authentication endpoints
```

"Watch what happens — and this is the whole pitch in one command. Internally it runs a full pipeline:

1. **Freshness check** — is my knowledge of this codebase stale? Did something change underneath me?
2. **Impact analysis** — what will this touch? What could it break?
3. **Agile planning** — quick plan, not a novel, just enough structure
4. **Implementation**
5. **Safety gates** — type safety, API compatibility, migration safety, security — *only the ones relevant to this change*
6. **Tests**
7. **Knowledge sync** — updates its own notes so next time it already knows
8. **Change history** — a record of what happened and why

You didn't ask for any of that structure. You asked for rate limiting. It brought the discipline."

*(Pause here for effect)*

"And here's the part I actually think is the most slept-on feature —"

**[DEMO] Show a delivery mode:**

```
/engineering-intelligence Harden checkout APIs using adversarial delivery mode
```

"Same command, one phrase added, and now it's actively trying to break its own implementation before you ship it — thinking like an attacker. There's also TDD mode, design-first mode for big architectural changes, and hypothesis-debugging mode for the 2am 'why is this randomly failing' bugs."

---

## 7. The backlog superpower (3 min) — talk, light/no demo

> *This is a good "and one more thing" moment — don't demo live unless you have a pre-run example, decomposition takes a while.*

"For anything bigger than a single feature — say, an entire self-serve billing portal — there's a two-step flow:"

```
/decompose-backlog Build a self-serve billing portal with invoices, payment methods, and dunning
```

"That autonomously breaks it into Epics → Features → Tickets, with a real backlog file, stable IDs, dependency ordering. **No code is written.** Then:"

```
/deliver-backlog
```

"It picks the next ready feature and — this is important — **stops and asks for your approval before writing a single line.** Every feature starts as `Approval: pending`. This isn't autonomous-agent-runs-wild. You stay the gatekeeper; it just does the tedious planning and sequencing for you."

---

## 8. The two features people don't expect (3 min)

"Two more things worth 90 seconds each, because they surprise people:

**Token efficiency.** Every skill file is loaded in tiers — a lightweight routing table first, then a one-paragraph brief, then the full procedure only when it's actually going to run. Measured, tested, regression-guarded: **28–37% fewer tokens per invocation.** That's not marketing copy — there's an actual test file enforcing it (`test/token-reduction.test.mjs`).

**Per-developer intelligence.** This one I'm proud of. Run:"

```bash
npx engineering-intelligence user-profile .
```

"Zero LLM tokens spent — it reads your `git config` and your commit history and builds *your* personal profile: your test philosophy, your typical change size, your primary language. It's gitignored, so it never leaks into a teammate's checkout. And there's a **team-preferences.md** layer that's committed — shared consensus that still applies in CI even when there's no personal profile around."

---

## 9. What it isn't — build trust by being honest (2 min)

> *This section matters. Don't skip it — it's what makes the pitch credible instead of salesy.*

"I want to be straight with you about limits, because I'd rather you trust this than be impressed by it for five minutes:

- It is **not** a runtime enforcement engine. These are instructions, not guardrails — a weaker model will follow them worse than a strong one.
- It is **not** a replacement for code review. It makes the agent more thorough; you still own the final call.
- That token reduction number is measured at the rendered-file level by a test harness — it's a strong directional number, not a per-session guarantee.

If any of this feels like too much up front, my actual recommendation: install it, just use `/initialize-engineering-intelligence` and `/engineering-intelligence` for a week. Adopt the backlog and heavier safety gates once you've seen the basics earn their keep."

---

## 10. Hands-on segment (10–15 min)

> *This is where you hand the room the keyboard — literally or via a shared repo. Engagement peaks here.*

"Okay — your turn. Everyone open a terminal."

**Give them this exact sequence** (put it on screen or in chat, not just spoken):

```bash
# 1. Install
npx engineering-intelligence install . --ide claude-code --yes

# 2. Check what got installed
npx engineering-intelligence doctor .

# 3. In your AI IDE:
/initialize-engineering-intelligence

# 4. Try a small real change on YOUR repo:
/engineering-intelligence <describe one small thing you'd actually want fixed>
```

"Pick something small and real from your own codebase — a bug, a missing validation, anything. Watch what it does before it touches code. I'll walk around / stay on this call for questions."

*Circulate. Common questions to expect and pre-canned answers:*

- **"Does this send my code anywhere?"** → No. It's local files + your existing AI IDE's model calls. The installer itself makes zero network/model calls.
- **"What if I don't like a generated file?"** → Everything's just markdown/JSON in `.engineering-intelligence/` — edit or delete freely. `uninstall` removes only what it added.
- **"Can I use this with [tool X]?"** → Check the 9 supported IDEs; if not listed, the `generic` adapter covers any AI IDE via `AGENTS.md`.

---

## 11. Close (1 min)

"To wrap: this doesn't make your AI smarter. It makes it **accountable** — gives it a memory, a discipline, and a paper trail, so the tenth session with your codebase is better than the first, not a repeat of it.

Repo's on GitHub, MIT licensed, `npx engineering-intelligence` — that's the whole install. Star it if it saves you the rate-limiting-endpoint conversation with your AI for the fifth time this month. Questions?"

---

## Appendix — Quick-reference command sheet (share after the talk)

```bash
# Install
npx engineering-intelligence install . --ide claude-code --yes

# Health check / preview updates
npx engineering-intelligence doctor .
npx engineering-intelligence update . --dry-run

# Dashboard
npx engineering-intelligence visualize . --open

# Personal profile
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

## Appendix — Timing cheat sheet

| Section | Minutes | Cumulative |
|---|---|---|
| Hook + pitch | 3 | 3 |
| Problem framing | 3 | 6 |
| Demo: install | 5 | 11 |
| Demo: initialize | 5 | 16 |
| Demo: core workflow + modes | 7 | 23 |
| Backlog superpower | 3 | 26 |
| Token/per-dev features | 3 | 29 |
| Honesty section | 2 | 31 |
| Hands-on | 10-15 | 41-46 |
| Close | 1 | 42-47 |

*If running short on time, cut section 7 (backlog) to just the talking points, no live typing — it's the safest thing to compress.*
