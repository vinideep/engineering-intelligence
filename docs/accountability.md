# Accountability layer (v2.3)

As AI agents take on more autonomous editing, the hard question shifts from
"can it write the code?" to **"can I trust what it just did?"** This layer
answers that mechanically — computed from the dependency + call graph, never an
LLM grading an LLM.

## The Agent Flight Recorder

A pre-flight / post-flight audit around every change.

### Pre-flight — declare intent, get the blast radius

```bash
engineering-intelligence preflight --intent "add retry to charge()" src/pay.js
```

This:
1. Records the declared **intent** and **target files**.
2. Computes the **predicted radius** — the dependent modules/functions that may
   legitimately need to change too (from `analyze_impact` on the declared files).
3. Snapshots the working tree (baseline commit + already-dirty files) so only
   *new* changes are attributed to this flight.
4. Writes an open flight record under `.engineering-intelligence/flight/<id>.json`.

### Post-flight — audit actual vs. predicted

```bash
engineering-intelligence postflight --id <flight> --strict
```

This diffs what **actually** changed against the declaration and classifies each
changed file:

- **in-bounds** — it was declared, or in the predicted radius.
- **out-of-bounds** — neither. These get flagged.

Verdict is `clean` (nothing out of bounds) or `flagged`. With `--strict`,
`flagged` exits non-zero — drop it into CI as a merge gate:

```yaml
- run: engineering-intelligence postflight --strict
```

Omit `--id` to close the most recent open flight.

### As MCP tools

`preflight` and `postflight` are also MCP tools, so an agent can run the whole
loop itself: declare intent → edit → self-audit, and report the verdict back to
you.

## Memory with receipts (self-invalidating knowledge)

Prose-based AI memory rots silently. Here, every `file:line` citation in the
knowledge base is hashed against the line it points at.

```bash
engineering-intelligence evidence-record         # snapshot the cited lines' hashes
# …code changes over time…
engineering-intelligence evidence-check --strict  # flag citations whose code moved
```

`evidence-check` reports each citation as `ok`, `stale` (the cited line's content
changed), `missing-line`, or `missing-file`. `--strict` fails CI when anything is
stale — so the knowledge base tells you when it's out of date instead of quietly
lying.

## Why this is different

Everyone else helps AI *write* code faster. This layer makes AI-written code
*accountable* — a deterministic seatbelt that's enforceable in CI. It reuses the
same computed graph, evidence, and confidence model as the rest of the project;
there's no LLM in the trust path.
