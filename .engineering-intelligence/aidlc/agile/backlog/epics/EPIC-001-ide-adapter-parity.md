# EPIC-001: IDE Adapter Argument Parity

- Status: proposed
- Priority: P0
- Owner: maintainer

## Business Outcome
Every IDE adapter that supports native slash commands correctly forwards user
arguments into request-driven workflows. Currently only `claude-code`,
`gemini-cli`, and `commandcode` do this. Cursor, GitHub Copilot, and the
Antigravity family silently drop the user's request text.

## Success Metrics
- `renderAdapters(["cursor"])` — `engineering-intelligence.md` contains a
  host-native argument placeholder.
- `renderAdapters(["github-copilot"])` — prompt files for input-driven
  workflows contain a placeholder.
- `renderAdapters(["antigravity","antigravity-cli"])` — workflows contain
  a placeholder.
- All existing tests continue to pass; new per-adapter argument tests added.

## Features
- FEAT-001 — Cursor argument wiring
- FEAT-002 — GitHub Copilot argument wiring
- FEAT-003 — Antigravity / Antigravity-CLI argument wiring

## Definition of Success
- [ ] All 9 IDE adapters wire arguments for every input-driven workflow
- [ ] `npm test` green with new per-adapter argument coverage
