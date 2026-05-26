---
description: Start paper trading to test strategies in real market conditions
---

# Paper Trading Workflow

This workflow sets up and runs paper trading for strategy validation.

## Prerequisites
- Upstox API credentials configured
- Strategy backtested and validated
- At least 50 days of profitable backtesting

## Steps

### 1. Authenticate with Upstox
```bash
python src/execution/upstox_auth.py
```
Follow the prompts to authorize and save your access token.

### 2. Create Paper Trading Config
Create `config/paper_trading.json`:
```json
{
    "mode": "paper",
    "initial_capital": 100000,
    "strategy": "ma_crossover",
    "symbols": ["NSE_EQ|INE002A01018"],
    "risk_per_trade": 0.02,
    "max_positions": 5,
    "market_open": "09:15",
    "market_close": "15:30"
}
```

### 3. Start Paper Trading Bot
```bash
python paper_trader.py --config config/paper_trading.json
```

### 4. Monitor Performance
- Check logs in `logs/paper_trading.log`
- Review daily P&L reports
- Track metrics vs backtest results

## Paper Trading Duration
- **Minimum**: 1 month
- **Recommended**: 3 months
- **Before live**: Verify consistency with backtest

## Success Criteria
Before going live, ensure:
- [ ] Executed 50+ trades
- [ ] Win rate within 10% of backtest
- [ ] Max drawdown within limits
- [ ] No system errors
- [ ] Alerts working properly

## Next Steps
- If successful, run `/go-live` workflow
- If issues found, refine strategy and repeat
