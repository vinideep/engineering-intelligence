# Profitability Roadmap (Knowledge Base)

## Objective
Grow this personal options app into a disciplined, risk-adjusted profitability engine.
Primary metric is net expectancy after full costs and realistic execution.

## Core Truths
- No strategy can guarantee profit.
- Survival and drawdown control are prerequisites for compounding.
- Backtest alpha that ignores microstructure is usually fake alpha.

## Current Repo Reality (High-Impact Gaps)
- Static lot/market assumptions in:
  - `backend/app/config.py`
- Backtest realism gaps in:
  - `backend/app/core/backtest/engine.py`
  - `backend/app/core/backtest/optimizer.py`
  - `backend/app/core/backtest/walk_forward.py`
- Simplified paper fill/ltp model in:
  - `backend/app/core/paper_trading/engine.py`
  - `backend/app/api/routes/paper_trading.py`
- Lightweight risk gates in:
  - `backend/app/core/risk/manager.py`
- Scheduler and live routines need tighter safety gates:
  - `backend/app/services/scheduler.py`

## Target System Qualities
1. Market-structure aware
2. Execution-realistic simulation
3. Portfolio-level risk governance
4. Regime-aware strategy operation
5. Hard go-live gates and staged capital scaling

## Phased Build Plan

### Phase 0: Market Structure Hardening (Weeks 1-2)
Deliverables:
- Contract master sync (lot size, strike step, expiries)
- Dynamic cost model from broker/exchange assumptions
- Order-policy engine (prefer protected limit logic over naive market orders)

Pass gate:
- 10 consecutive sessions with zero parameter mismatch between fetched contract metadata and internal config.

### Phase 1: Backtest Fidelity Upgrade (Weeks 3-6)
Deliverables:
- Event-driven replay for options legs
- Bid/ask-aware fills, spread crossing, partial fill model
- Latency/slippage model by time-of-day and liquidity regime
- Expiry-day behavior and risk/charge parity with paper engine

Pass gate:
- Backtest vs paper drift for matched sessions < 15% on net PnL.

### Phase 2: Risk Engine V2 (Weeks 7-9)
Deliverables:
- Portfolio Greeks limits (delta/theta/vega)
- Exposure caps by underlying, expiry bucket, and strategy family
- Intraday drawdown throttle + consecutive-loss cooldown + kill switch

Pass gate:
- 100% deterministic rejection/allow behavior under replay tests.

### Phase 3: Strategy Concentration (Weeks 10-12)
Deliverables:
- Focus on 1-2 strategy families first
- Regime-conditioned parameter sets
- Strict out-of-sample validation and walk-forward governance

Pass gate:
- OOS profit factor > 1.2
- Positive expectancy after costs
- Drawdown within policy

### Phase 4: Shadow Live then Micro Live (Weeks 13-14)
Deliverables:
- Shadow execution (signal -> would-place -> reconcile)
- Micro-sized live rollout with strict risk clamps
- Full reconciliation pipeline (signal/order/fill/position/pnl)

Pass gate:
- 20 sessions with no state divergence and no risk policy breaches.

### Phase 5: Controlled Scale (Weeks 15+)
Deliverables:
- Capital ramp policy tied to rolling performance
- Automatic size-down when risk metrics degrade

Pass gate:
- Rolling 30-day metrics remain within predefined limits.

## Non-Negotiable Risk Policy
1. Per-trade risk cap as a fixed fraction of capital-at-risk.
2. Daily and weekly stop limits with auto-halt.
3. Data quality gate before signal publication and execution.
4. No scale-up from backtest-only performance.
5. Capital increase allowed only after live/paper pass gates.

## KPI Board (Track Daily)
- Net expectancy per trade (after all costs)
- Profit factor (net)
- Max drawdown and recovery time
- Slippage vs model
- Fill ratio and rejection ratio
- Strategy contribution and correlation
- Regime-wise PnL decomposition

## Regulatory/Exchange Awareness Notes
These change over time and must be re-verified before live deployment:
- SEBI circulars affecting retail algo participation and margin.
- NSE circulars affecting expiry day mechanics and lot sizes.
- Broker-side order restrictions and API/rate-limit policy.

Do not hardcode assumptions that can drift due to circular updates.

## "Next Steps" Response Template
When user asks "what next", respond with:
1. Current phase
2. Top 3 implementation tasks (path-level)
3. Acceptance criteria per task
4. Blockers/dependencies
5. Explicit "not yet" items
