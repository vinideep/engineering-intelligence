# From prompt library to verifiable, enforceable engineering intelligence

> Historical note: this document records the v2.3.0 change set. It is not the current release-status source; use `package.json` and the current EI validation report for present state.

Repositions the toolkit from "prose the model is asked to follow" into a layer with **code-enforced** guarantees, **verifiable** knowledge, and **honest**, measurable claims — across IDEs and in CI. Seven commits, each independently shippable, all tests green.

## What changed, by phase

**Phase 0 — credibility & dogfooding.** CI (Node 20/22), derive the skill count from the actual payload (was a stale hardcoded "44"), sync a lockfile that would have broken CI. Dogfooded on this repo.

**Phase 1 — code-enforced hooks.** A host-neutral hook engine turns the two most important prose promises into enforced gates: *SessionStart* injects freshness state, *PreToolUse* warns/denies edits over stale docs, *Stop* blocks "done" when code changed but nothing verified it. Fail-safe by design; hard gates opt-in.

**Phase 2 — safety gates as code.** `gate env-vars | dead-exports | api-diff | migration-lint` — deterministic, structured findings, exit 1 on hard failure, exposed via CLI and MCP. The matching skills now call the gate first.

**Phase 3 — verifiable claims + get_context + real telemetry.** Claims bind a fact to evidence spans pinned by content hash, so `claims verify` proves (no LLM) whether each still holds. `get_context` assembles a token-budgeted pack (graph neighborhood + *verified* claims + conventions) so small models retrieve trustworthy facts instead of re-reading source. Telemetry records *real* session tokens from the transcript, replacing the synthetic estimate.

**Phase 4 + consolidation — fewer, sharper skills.** Merged the four overlapping sync engines into one, and the two API-safety skills into one (46 → 42), each rewritten tool-backed. Did **not** chase an arbitrary "~15" target — the rest are distinct capabilities, not redundancy, and the tiered loader already means only 1–3 load per task.

**Cross-IDE enforcement (v2.3.0).** Made the hook engine host-neutral and added **Cursor** as a second host. Crucially, the docs now tell the truth: **CI + MCP are the universal, unskippable enforcement spine (any IDE)**; automatic local lifecycle hooks are scoped to **Claude Code + Cursor**. Local auto-blocking is no longer implied to be universal.

## Honesty fixes (called out explicitly)
- Dropped the "fewer tokens than raw prompting" claim — reframed to what's true (reuse persisted intelligence; saving vs loading the whole toolkit).
- Corrected "not a runtime enforcement engine" (Phases 1–2 made that false) and the "hooks everywhere" implication.

## Verification
- **86 unit + 9 integration tests green.** New suites: gates, claims, context, telemetry, hooks (incl. Cursor), plus adapter/template guards.
- Install/doctor dogfooded after every structural change; generated ROUTING/INDEX carry no dangling references.

## Notes for the reviewer
- At the time of this historical change set, `npm publish` had **not** been run and the branch version was 2.3.0.
- The Cursor integration is validated against Cursor's documented agent-hooks schema + unit tests (rendering, input normalization, output contract), the same way Claude's was — not against a live Cursor session; a couple of per-tool field mappings are best-effort and fail safe.
