---
name: algo-trading
description: Master skill for this Nifty/BankNifty options app. Use when planning or implementing profitability improvements, execution/risk upgrades, backtesting realism, go-live gating, or prioritized next steps.
---

# Algo Trading Master Skill

## Purpose
Use this skill to keep project decisions aligned with one goal:
improve risk-adjusted net profitability after realistic costs and execution frictions.

## Required References
- For profitability roadmap and implementation gates, read:
  `references/profitability-roadmap.md`

## When This Skill Must Trigger
- User asks for:
  - "next steps", "roadmap", "make it profitable", "scale this app"
  - risk framework upgrades
  - backtesting improvements
  - paper-to-live rollout plan
  - strategy prioritization for better expectancy

## Workflow
1. Read current architecture and status files first:
   - `README.md`
   - `PROJECT_STATUS.md`
   - Relevant modules under `backend/app/core/`
2. Load `references/profitability-roadmap.md`.
3. Map requested outcome to a phase in the roadmap.
4. Propose only the smallest high-impact implementation slice.
5. Include objective pass/fail gates before suggesting scale-up.

## Output Requirements
When the user asks for next steps, return:
1. Current phase (with reason)
2. Top 3 implementation tasks (file-level)
3. Success criteria for each task
4. What not to do yet (to avoid premature live risk)

## Guardrails
- Never promise guaranteed profits.
- Optimize for expectancy after costs, not win-rate vanity.
- Treat regulatory/exchange parameters as dynamic and verify before live changes.
- Do not suggest increasing capital unless live or paper gates are passed.

## Related Skills
- `upstox-integration`
- `backtesting`
- `risk-management`
- `technical-indicators`
- `ml-trading`
