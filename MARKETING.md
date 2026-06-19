# Marketing Kit — Engineering Intelligence OS

Everything needed to launch and grow `engineering-intelligence` across channels. Copy-paste ready; adjust links/numbers before posting.

**Core hook to lead with everywhere:** 28–37% fewer tokens per invocation via a measured, regression-guarded optimization pipeline — path aliasing, skills index, workflow routing table, tiered SKILL-BRIEF.md/SKILL.md loading, SmartCrush structural compression, and KV-cache-friendly file ordering. Now applies across **all 9 supported IDEs**, not just Claude Code. Numbers are computed and regression-guarded by a test harness on every build (`test/token-reduction.test.mjs`) — the claim won't silently drift.

---

## Pre-Launch Checklist

- [ ] Publish v1.6.0 to npm (`npm publish`) — currently npm is stuck on v1.5.0 while the repo is at v1.6.0; marketing traffic should never hit a stale package.
- [ ] Merge `claude/code-review-claude-integration-a5vz54` into `main`.
- [ ] Add GitHub repo topics: `ai-agents`, `claude-code`, `cursor`, `github-copilot`, `agentic-workflows`, `ai-dlc`, `token-optimization`, `developer-tools`.
- [ ] Record a short terminal demo GIF (`npx engineering-intelligence` install + one workflow invocation) and embed it near the top of the README.
- [ ] Verify `package.json` `repository`/`homepage`/`bugs` fields point at the live GitHub repo (done — see commit history).
- [ ] Confirm README hero badges render (npm version, npm downloads, GitHub stars, license, node engine).

---

## LinkedIn Post

> Post the text below in the body. Put the GitHub link in the **first comment**, not the post body — LinkedIn's algorithm suppresses reach for posts with outbound links.

```
I open-sourced the engineering discipline I wish every AI coding agent had.

Most AI IDE setups have the same problem: the agent forgets your architecture between sessions, skips impact analysis, drifts from your conventions, and burns enormous context re-reading the same files every single session.

So I built engineering-intelligence — a graph-backed Agile + AI-DLC toolkit you install into any repo:

→ 45 skills, 15 specialist agents, 11 workflows
→ Works with 9 AI IDEs (Claude Code, Cursor, Copilot, Gemini, Codex, Antigravity, and more)
→ Autonomous Epic → Feature → Ticket backlog, with human approval gates per feature
→ Evidence-based knowledge base + architecture graphs that persist across sessions
→ A tiered skill-loading system that cuts token usage per invocation by ~28–37%, losslessly

The last point matters more than it sounds. AI coding agents reload skill instructions on every invocation. Most tools either eat that cost or skip the instructions entirely. This toolkit uses dictionary path-aliasing, a compact routing index, tiered skill briefs, and a structural "SmartCrusher" pass to compress without losing a single instruction.

It's free, MIT-licensed, and on npm:
npx engineering-intelligence install

Link in the comments. Would love feedback from anyone running multi-agent or long-lived AI coding workflows.

#AI #DeveloperTools #OpenSource #ClaudeCode #AgenticAI
```

---

## Show HN Post

**Title:** `Show HN: Engineering Intelligence – an AI-DLC toolkit that cuts agent token cost ~28–37%`

**Body:**
```
Hi HN — I built engineering-intelligence, an installable toolkit that gives AI coding agents (Claude Code, Cursor, Copilot, Gemini, Codex, and others) the discipline of a senior engineering team: persistent architecture knowledge, mandatory impact analysis before changes, an autonomous Epic → Feature → Ticket backlog with human approval gates, and incremental sync of its own knowledge base after every change.

The part I think is most interesting technically: AI coding agents re-read their own skill/instruction files on every invocation, and that cost compounds fast across a session. I implemented a tiered, lossless loading system —

1. Path aliasing — dictionary substitution for the highest-frequency repeated path strings
2. A compact skills index (~1 line per skill) instead of loading all skill files up front
3. A pre-computed workflow → skill routing table, so "which skills apply" is a lookup, not an inference
4. Tiered skill docs: a ~150-token SKILL-BRIEF.md is read first to confirm relevance; the full SKILL.md (~1,200 tokens) is only loaded immediately before executing that skill's procedure
5. A structural compression pass ("SmartCrusher") that strips installer-only metadata, comments, and trailing whitespace with zero semantic risk
6. KV-cache-friendly ordering — routing artifacts are emitted first so they form a stable, cacheable prefix across invocations

Combined, this cuts token usage per invocation by 28–37% without dropping any instruction content — it's pure compression and smarter retrieval ordering, not summarization.

It installs via npx (`npx engineering-intelligence install`), targets 9 AI IDEs, and ships 45 skills / 15 agents / 11 workflows. MIT licensed.

GitHub: https://github.com/vinideep/engineering-intelligence
npm: https://www.npmjs.com/package/engineering-intelligence

Happy to answer questions about the AI-DLC workflow design, the token optimization implementation, or the adapter system for supporting multiple IDEs from one template set.
```

**Timing note:** post weekday morning US Eastern (8–10am ET), and stay active replying to every comment in the first 2 hours — Show HN ranking rewards early engagement velocity.

---

## dev.to / Hashnode Article

**Title:** `How I Cut AI Coding Agent Token Usage by 28–37% Without Losing a Single Instruction`

```markdown
# How I Cut AI Coding Agent Token Usage by 28–37% Without Losing a Single Instruction

If you've used Claude Code, Cursor, or any agentic coding tool with custom skills/instructions, you've felt this: every invocation re-reads the same instruction files, and as your skill library grows, so does your token bill — even before the agent does any real work.

I ran into this building [engineering-intelligence](https://github.com/vinideep/engineering-intelligence), an installable Agile + AI-DLC toolkit (45 skills, 15 agents, 11 workflows) for AI coding IDEs. With that many skills, naive "load everything relevant" quickly became the single biggest cost in every session. Here's how I got token usage down ~28–37% per invocation, losslessly.

## The problem

A typical agentic workflow does this on every invocation:
1. Load a routing/instruction file to figure out which skills apply
2. Load the full content of each relevant skill
3. Execute

Step 2 is the expensive one. Full skill files average ~1,200 tokens; loading 3-4 of them per invocation adds up fast, and most of that content isn't needed until the agent actually executes the skill — only a fraction is needed to confirm relevance.

## The fix: six techniques, applied in order

**1. Path aliasing.** Long repeated path strings (`.engineering-intelligence/aidlc/`, `.engineering-intelligence/`) get replaced with two short aliases (`$AIDLC`, `$EI`) wherever they appear across skill and command files, with a one-line expansion key prepended. ~3,200 tokens saved across a full install, zero information lost.

**2. Skills index.** Instead of loading all skill files to decide which ones are relevant, generate a single compact table — one line per skill, frontmatter description truncated to ~110 chars. ~1,500 tokens total vs ~62,700 to read all 44 full skill files in full.

**3. Workflow → skill routing table.** Pre-compute, per workflow command, which skills are `primary` (always load) vs `optional` (load only if the request needs that capability). This replaces LLM inference of "which skills apply?" with a deterministic lookup — same result, no reasoning tokens spent rediscovering it every time.

**4. Tiered skill docs (the big one).** Split each skill into:
   - `SKILL-BRIEF.md` (~150 tokens): frontmatter + title + first paragraph + first 6 lines of the Inputs section. Enough to confirm the skill is relevant and understand its shape.
   - `SKILL.md` (~1,200 tokens): the full procedure, loaded only immediately before execution.

   The agent reads the brief for every primary skill identified by the routing table, and only pays the full cost for the skill(s) it actually executes.

**5. SmartCrusher — structural compression.** A zero-semantic-risk pass applied to every rendered file: strip the `version:` field from frontmatter (installer metadata, irrelevant to the agent), remove HTML/markdown comments, strip trailing whitespace, collapse 3+ blank lines to 2. Small per-file, but it adds up across a full install and costs nothing in fidelity.

**6. KV-cache-friendly ordering.** Routing artifacts (the workflow routing table, the skills index) are emitted first, before any skill content. Because they're identical across invocations, they form a stable prefix that providers' KV-caching can reuse — invocation N+1 doesn't re-pay the prefill cost for content that hasn't changed.

## Does it lose accuracy?

No — every technique here is either a lossless transform (aliasing, whitespace/comment stripping) or a deferred-loading strategy where the full content is still loaded before it's needed (briefs → full skill at execution time). Nothing is summarized away or guessed at. The reduction comes from *not reading content the agent doesn't need yet*, not from compressing content the agent does need.

## Try it

```
npx engineering-intelligence install
```

Works with Claude Code, Cursor, Copilot, Gemini, Codex, Antigravity, and more. MIT licensed.

GitHub: https://github.com/vinideep/engineering-intelligence
```

---

## Reddit Post (r/ClaudeAI, r/cursor, r/LocalLLaMA, r/programming — adapt per sub)

> Value-first; link in the first comment, not the post body.

```
Title: Built a token-optimization system for AI coding agent skills — cut per-invocation usage ~28–37% with zero information loss

Body:
If you're running a lot of custom skills/instructions with Claude Code, Cursor, or similar, you've probably noticed token usage creeping up as your skill library grows — every invocation re-reads instruction files whether or not it ends up using them.

I worked through this on an open-source AI-DLC toolkit I maintain and landed on a few techniques that, combined, cut token usage ~28–37% per invocation without dropping any instructions:

- Dictionary aliasing for repeated long path strings
- A compact one-line-per-skill routing index instead of loading full skill files to decide relevance
- A pre-computed workflow→skill map (deterministic lookup instead of re-inferring "which skills apply" every time)
- Tiered skill docs — a ~150-token brief read first, full skill content (~1,200 tokens) only loaded right before execution
- A structural compression pass that strips installer metadata/comments/whitespace
- Ordering routing artifacts first so they form a stable, KV-cacheable prefix across invocations

Wrote up the full breakdown here: [dev.to link]
Code's open source (MIT) if anyone wants to see the implementation: [GitHub link]

Curious if others have hit the same token-growth problem with large skill libraries and what you've done about it.
```

---

## X / Twitter Thread

```
1/
Most AI coding agents re-read the same instruction files on every single invocation. As your skill library grows, that cost compounds — before the agent does any real work.

I cut this by ~28–37% per invocation. Lossless. Here's how. 🧵

2/
The fix isn't summarization — summarization risks dropping instructions. It's deferred loading + structural compression. Six techniques, applied in order:

3/
1. Path aliasing — repeated long path strings become 2-char aliases with a one-line expansion key. Saves ~3,200 tokens across a full install.

4/
2. A compact skills index — one line per skill instead of loading every full skill file to figure out relevance. ~1,500 tokens vs ~62,700.

5/
3. A pre-computed workflow→skill routing table. "Which skills apply" becomes a lookup, not something the model has to re-derive every time.

6/
4. Tiered skill docs — this is the big one. A ~150-token brief confirms relevance; the full ~1,200-token skill only loads right before execution.

7/
5. Structural compression ("SmartCrusher") — strips installer-only metadata, comments, trailing whitespace. Zero semantic risk.

8/
6. KV-cache-friendly ordering — routing artifacts go first, forming a stable prefix that caches across invocations.

9/
Built this into engineering-intelligence, an open-source Agile + AI-DLC toolkit for AI coding IDEs (Claude Code, Cursor, Copilot, Gemini, Codex, +more). 45 skills, 15 agents, 11 workflows.

npx engineering-intelligence install

MIT licensed: https://github.com/vinideep/engineering-intelligence
```

---

## Product Hunt Listing

**Tagline:** `Give every AI coding agent the discipline of a senior engineering team`

**Description:**
```
Engineering Intelligence OS installs a graph-backed Agile + AI-DLC toolkit into any repo, for any of 9 AI coding IDEs (Claude Code, Cursor, Copilot, Gemini, Codex, Antigravity, and more).

What it adds to your AI agent:
• Persistent architecture knowledge and evidence-based docs that survive across sessions
• Mandatory impact analysis before non-trivial changes
• An autonomous Epic → Feature → Ticket backlog with human approval gates per feature
• Incremental sync of its own knowledge base after every change
• A tiered skill-loading system that cuts token usage ~28–37% per invocation, losslessly

45 skills, 15 specialist agents, 11 workflows — installed with a single `npx engineering-intelligence install`. Free and MIT licensed.
```

**First comment (maker comment):**
```
Hey Product Hunt — built this because I was tired of AI coding agents forgetting everything between sessions and burning huge amounts of context re-reading the same instructions. Would love feedback, especially from anyone running multi-agent or long-lived AI coding workflows. AMA on the AI-DLC design or the token optimization implementation.
```

---

## Awesome-List PR Description

> Use when submitting to lists like `awesome-claude-code`, `awesome-cursor-rules`, `awesome-ai-agents`, etc.

```
Adds engineering-intelligence: an installable, graph-backed Agile + AI-DLC engineering-orchestration toolkit for AI coding IDEs (Claude Code, Cursor, Copilot, Gemini, Codex, Antigravity, and more). Ships 45 skills, 15 specialist agents, and 11 workflows covering architecture mapping, impact analysis, autonomous Epic→Feature→Ticket backlog delivery, and incremental knowledge-base sync. Includes a lossless tiered skill-loading system that reduces per-invocation token usage by ~28–37%. MIT licensed.

- GitHub: https://github.com/vinideep/engineering-intelligence
- npm: https://www.npmjs.com/package/engineering-intelligence
```

---

## Platform Strategy (Effort vs. ROI)

| Platform | Effort | Expected ROI | Notes |
| --- | --- | --- | --- |
| Reddit (r/ClaudeAI, r/cursor, r/programming, r/LocalLLaMA) | Low | High | Value-first post, link in comments, not the body. |
| Hacker News (Show HN) | Low | High (if it lands) | Post weekday morning ET; reply to every comment in the first 2 hours. |
| dev.to / Hashnode | Medium | High, durable | SEO compounds over time; cross-post both. |
| X / Twitter | Low | Medium | Thread format; tag relevant tool accounts (@AnthropicAI, @cursor_ai) only if genuinely relevant, not spammy. |
| LinkedIn | Low | Medium | Link in first comment, not post body, to avoid algorithmic suppression. |
| Product Hunt | Medium | Medium | Needs a maker account with some history; schedule launch day, be present all day in comments. |
| Awesome-list PRs | Low | Low-Medium, compounding | Passive backlink + discovery; submit to 3-5 relevant lists. |
| Discord communities (Anthropic, Cursor, indie hacker servers) | Low | Medium | Share in #showcase channels, not general chat; follow each server's self-promo rules. |

---

## Metrics to Track Post-Launch

- GitHub stars (daily delta, not just total)
- npm weekly downloads (`npm view engineering-intelligence`)
- Referral traffic sources (GitHub Insights → Traffic tab)
- Issues/PRs opened by new contributors (signal of real engagement, not just stars)
