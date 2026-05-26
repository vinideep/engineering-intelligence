# Risk Management Skill

## Overview
Comprehensive risk management for algorithmic trading.

## Core Principles
1. Never risk more than 2% per trade
2. Maximum drawdown under 15%
3. Use ATR-based position sizing
4. Implement circuit breakers

## Position Sizing

### Fixed Fractional Method
```python
class PositionSizer:
    def __init__(self, capital, risk_per_trade=0.02):
        self.capital = capital
        self.risk_per_trade = risk_per_trade
    
    def calculate_size(self, entry, stop_loss):
        risk_amount = self.capital * self.risk_per_trade
        risk_per_share = abs(entry - stop_loss)
        return int(risk_amount / risk_per_share) if risk_per_share else 0
```

### ATR-Based Sizing
```python
def atr_position_size(capital, entry, atr, risk=0.02, multiplier=2):
    risk_amount = capital * risk
    return int(risk_amount / (atr * multiplier))
```

## Stop Loss Types

### Fixed Percentage
```python
def fixed_stop(entry, pct=0.02): return entry * (1 - pct)
```

### ATR-Based
```python
def atr_stop(entry, atr, mult=2): return entry - (atr * mult)
```

### Trailing Stop
```python
class TrailingStop:
    def __init__(self, initial, trail_pct=0.02):
        self.stop = initial
        self.trail = trail_pct
        self.high = None
    
    def update(self, price):
        if self.high is None or price > self.high:
            self.high = price
            self.stop = max(self.stop, price * (1 - self.trail))
        return self.stop
```

## Portfolio Risk

### Position Limits
- Max 5-10 open positions
- Max 30% sector exposure
- Daily loss limit: 3-5%

### Circuit Breakers
```python
class CircuitBreaker:
    def __init__(self, max_dd=0.15, max_daily=0.03):
        self.max_dd = max_dd
        self.max_daily = max_daily
    
    def check(self, current_dd, daily_pnl):
        return current_dd < self.max_dd and daily_pnl > -self.max_daily
```

## Risk Metrics
- VaR (95%): Maximum expected loss
- Sharpe Ratio: Risk-adjusted return
- Max Drawdown: Largest peak-to-trough decline
- Ulcer Index: Drawdown severity measure
