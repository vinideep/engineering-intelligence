# Launch posts

Ready-to-paste copy for launching `engineering-intelligence`. This file is **not**
published to npm (the package only ships `dist`, `templates`, `README.md`, `LICENSE`).

The through-line for every post: **your codebase's AI memory shouldn't be trapped in one
tool** — and the proof is a *computed* dependency + call graph and an MCP server, not
LLM-written prose. Lead with portability + the computed core. Do **not** lead with token
savings.

---

## 1. Hacker News — "Show HN"

**Title:**
> Show HN: Engineering Intelligence – a portable, computed codebase graph for AI IDEs

**Body:**

I kept switching between AI coding tools — Cursor, Claude Code, Copilot — and every switch
meant re-explaining my codebase from scratch. Each tool keeps its understanding locked
inside itself, and most "AI project memory" is just markdown an LLM wrote and hopes to
re-read later.

So I built engineering-intelligence around a different idea: codebase intelligence should
be a **repo artifact** (like tests or docs), computed by real code, and queryable by any
AI tool.

Two parts are actual deterministic code, not prompts:

- `engineering-intelligence map .` builds a dependency + **function-level call graph**
  (package/import edges across JS/TS, Python, Go, Rust, Ruby, Java/Kotlin; symbol-level
  `defines`/`calls` edges for JS/TS). Every node/edge has `evidence` (file:line) and a
  `confidence` level, validated against a fixed JSON schema. No LLM involved.
- An **MCP server** exposes `map_dependencies`, `get_graph`, `analyze_impact`, and
  `read_knowledge` as tool calls, so any MCP-compatible agent can ask "what calls this
  function?" or "what breaks if I change this file?" and get a computed answer.

On top of that there's a portability layer: one canonical set of skills/agents/workflows
that renders natively into 9 IDEs, so the same intelligence works whether you're in Claude
Code today and Cursor tomorrow.

Honest about the current state: the graph engine and MCP server are real and tested; the
call graph is heuristic (regex-based, JS/TS only so far) rather than full AST, and the
skills layer is structured instructions whose effectiveness depends on your IDE's model.
I'd love feedback on the graph/impact model specifically.

npm: `npx engineering-intelligence`
Repo: https://github.com/vinideep/engineering-intelligence

---

## 2. LinkedIn

> Every time I switched AI coding tools — Cursor → Claude Code → Copilot — I had to
> re-explain my codebase from scratch. The "memory" each tool builds is locked inside that
> tool, and most of it is just markdown an LLM generated and hopes to re-read.
>
> So I built **Engineering Intelligence**: codebase understanding as a *repo artifact* —
> computed by real code, portable across 9 AI IDEs.
>
> The part I'm most proud of isn't a prompt. It's deterministic:
>
> 🧮 `engineering-intelligence map .` builds a real dependency + **function-level call
> graph** — across JS/TS, Python, Go, Rust, Ruby and Java/Kotlin. Every edge cites
> evidence (file:line) and a confidence level, validated against a schema. No LLM required.
>
> 🎯 Function-level impact analysis: change a file and instantly see which *functions and
> modules* call into it — answered from the graph, not guessed.
>
> 🔌 A built-in MCP server turns all of it into tool calls any AI agent can invoke.
>
> Open source (MIT), one command to try:
> `npx engineering-intelligence`
>
> Repo + docs: https://github.com/vinideep/engineering-intelligence
>
> Would genuinely value feedback from anyone building with MCP or juggling multiple AI
> coding tools. 🙏
>
> #AI #DeveloperTools #MCP #OpenSource #SoftwareEngineering

---

## 3. X / Twitter thread

**1/**
Your codebase's AI memory shouldn't be trapped in one tool.

I built an open-source intelligence layer that lives in your repo and works across 9 AI
IDEs — Claude Code, Cursor, Copilot, Gemini & more.

The core isn't a prompt. It's a computed graph. 🧵

**2/**
`engineering-intelligence map .`

→ a real dependency + **function-level call graph**
→ JS/TS, Python, Go, Rust, Ruby, Java/Kotlin
→ every edge cites evidence (file:line) + confidence
→ schema-validated, deterministic, no LLM

**3/**
"What breaks if I change this?"

Change a file → instantly see which functions and modules call into it. Computed by
reverse-BFS over the call graph, not guessed by a model.

**4/**
There's a built-in MCP server too. 🔌

4 tools any agent can call: map_dependencies, get_graph, analyze_impact, read_knowledge.

Your repo's structure becomes a queryable service — no markdown to install into the IDE.

**5/**
Why it matters: developers switch AI tools constantly now. The understanding shouldn't
reset every time. Make it a repo artifact — like tests or docs.

**6/**
Open source, MIT. One command:

`npx engineering-intelligence`

https://github.com/vinideep/engineering-intelligence

Honest note: call graph is heuristic/JS-TS for now, full AST + more languages next.
Feedback very welcome 🙏 (cc @AnthropicAI @cursor_ai)

---

## 4. r/ClaudeAI — Megathread comment

> **Engineering Intelligence — portable, computed codebase memory for AI IDEs**
>
> **Why I built it:** I bounce between Claude Code and other AI tools, and each one
> re-learns my codebase from zero every session. I wanted the understanding to be a repo
> artifact, not a per-tool cache.
>
> **How it works:** the core is a deterministic graph engine — `engineering-intelligence
> map .` parses manifests + imports (6 languages) and builds a **function-level call
> graph** for JS/TS (symbol nodes, `defines`/`calls` edges, evidence + confidence on
> everything, schema-validated). A built-in MCP server then exposes `map_dependencies`,
> `get_graph`, `analyze_impact`, and `read_knowledge` so Claude Code can query the graph as
> tools — e.g. "what calls this function?" gets a computed answer.
>
> **What I learned:** the hard/interesting part was keeping the call graph *honest* —
> same-file calls are `verified`, cross-file calls only become edges when the name resolves
> unambiguously, otherwise they're dropped rather than hallucinated.
>
> **Status:** graph engine + MCP server are real and tested; call graph is heuristic
> (regex, JS/TS) for now, AST + more languages next. MIT, `npx engineering-intelligence`.
> Repo: https://github.com/vinideep/engineering-intelligence — feedback welcome.

---

## Posting order (suggested)

1. **HN Show HN** first (weekday morning US time) — highest-signal audience, no karma gate.
2. **r/ClaudeAI megathread** comment same day (works around the 50-karma post rule).
3. **LinkedIn** + **X thread** to amplify, linking the repo (and the HN thread if it gets
   traction).
