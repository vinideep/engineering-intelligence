# Token frugality

Does this actually save tokens versus typing your requirement straight into the
AI chat? Yes — but the savings come from a different place than most "context
compression" tools, so it's worth being precise.

## Where the tokens go without us

When you ask an AI agent to change something, most of its token spend is **not**
your prompt — it's the agent *orienting itself*:

1. It opens 10–15 files to learn the shape of the repo.
2. To answer "what else uses this?", it greps and reads more files, often
   guessing and re-reading.
3. Every tool result it reads (file dumps, search output) lands in the context
   window in full.

That exploration is the expensive part, and it repeats every session because the
understanding is thrown away.

## Where we cut it

We attack the same target Headroom does — *shape what the agent reads* — but as
deterministic code over a computed graph, with no proxy and no ML model.

**1. The Repo Brief replaces the orientation phase.** `get_brief` returns a
~370–500 token digest (languages, entry points, most-depended-on modules,
hotspots, test layout) computed from the graph. One cheap read instead of
opening 10–15 files (~10–40k tokens).

**2. Computed answers instead of exploration.** "What breaks if I change X?" and
"who calls Y?" are graph walks that return a bounded, evidence-cited answer —
not a pile of files for the model to read and reason over.

**3. Shaped tool outputs.** Every MCP response is minified, has empty/volatile
fields pruned, and long lists capped with an explicit `+K more (expand via …)`
marker so nothing is *silently* hidden. Measured on this repo:

| Tool | Before | After | Reduction |
|---|---|---|---|
| `get_graph` (was: full pretty graph) | ~74,600 tokens | ~2,450 tokens | **−97%** |
| `map_dependencies` (was: embedded graph) | ~74,600 tokens | ~60 tokens | **−99.9%** |
| `analyze_impact` | — | ≤ 1,500 tokens | budget-capped |
| `who_calls` / `find_symbol` | — | ≤ 1,500 tokens | budget-capped |
| repo brief | — | ~370 tokens | — |

(Regression-guarded in `test/token-budget.test.mjs`; run `npm test` to see the
live table for any repo.)

**4. Reversible drill-down (CCR-style).** Compact responses carry stable node
ids; the on-disk graph is the lossless original. When the agent needs a specific
node in full, `get_graph pattern=<id>` expands just that — pay for detail only
where you use it.

**5. Cache-aligned outputs.** The graph is written with deterministically sorted
nodes/edges and volatile fields stripped from responses, so identical repo state
produces byte-identical tool output → provider prompt-cache hits across turns.

## Accuracy guarantees — shaping never changes an answer

A fair worry: "if you cap the response, won't the agent get an incomplete — and
therefore wrong — answer?" We designed against exactly this. Three rules, all
regression-tested in `test/accuracy.test.mjs`:

1. **Answer fields are never truncated.** Each tool marks its *answer* fields
   `mustKeep` — `analyze_impact.direct` + `testsToRun` + `riskNotes`,
   `who_calls.callers`, `find_symbol.matches`, the `postflight` verdict. Only
   *exploration* fields (`indirect`, `details`, `unknowns`) can be trimmed. If
   the answer alone exceeds the budget, the budget **soft-expands** and the
   response carries `budgetNote: "budget expanded to preserve complete results"`.
   Completeness wins over frugality, every time.

2. **What we do trim is ranked, marked, and reversible.** Trimmable lists are
   ordered most-relevant-first *before* any cut (impact `details`: direct hops →
   highest churn → id; `who_calls` callers: verified → closest → id), so
   survivors are the items you'd most want. Every cut adds an explicit
   `truncated: {field: "+K more (expand via …)"}` marker — nothing is silently
   dropped — and the omitted items are one `get_graph pattern=<id>` call away.

3. **Denser, not lossier.** Before anything is trimmed, big object arrays are
   packed into `{cols, rows}` — the *same data* with the repeated JSON keys
   removed (~35–45% smaller). This is lossless (round-trip tested); it makes room
   so trimming rarely triggers at all.

Escape hatches: pass `budget: 0` to any tool for an uncapped response, set
per-project caps in `.engineering-intelligence/config.json`
(`{ "tokenBudgets": { "analyze_impact": 3000 } }`), or use `ask --full` on the
CLI. And every tool's `--json` / raw output is always complete.

**Why not neural compression?** A learned summarizer (Headroom-style) that turns
17k tokens into 1.4k is *also* lossy — but you can't prove what it dropped. Our
loss is explicit (a marker), bounded (only exploration), and reversible (fetch
the original). For an *evidence-backed* tool, auditable trimming beats opaque
compression. That's a deliberate design choice, not a limitation.

## Honest framing

- These are **structural** savings (fewer/cheaper reads), measured at the
  tool-output and orientation level — not a guaranteed per-session percentage,
  which depends on your task and model.
- We do **not** compress your model traffic or wrap the provider. If you want
  transport-level compression of *all* messages, a tool like
  [Headroom](https://github.com/headroomlabs-ai/headroom) is complementary: it
  compresses what flows over the wire; we make the source of truth cheap to
  query in the first place. Using both is reasonable.
- The skills/instructions layer has its own separate reduction (routing + tiered
  loading + SmartCrush), measured in `test/token-reduction.test.mjs`.
