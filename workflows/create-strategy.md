---
description: Create a new trading strategy
---

# Create New Strategy Workflow

This workflow helps you create a new trading strategy.

## Steps

### 1. Choose Strategy Type
Select the type of strategy:
- **Trend Following**: MA Crossover, MACD, ADX
- **Mean Reversion**: RSI, Bollinger Bands
- **Momentum**: Stochastic, CCI
- **Volume-Based**: OBV, VWAP

### 2. Create Strategy File
Create a new file in `src/strategies/` following this template:

```python
# src/strategies/your_strategy.py

import pandas as pd
import pandas_ta as ta
from .base import BaseStrategy

class YourStrategy(BaseStrategy):
    """
    Strategy Description
    
    Buy Signal: When condition is met
    Sell Signal: When condition is met
    """
    
    def __init__(self, data, **params):
        super().__init__(data)
        self.params = params
    
    def calculate_indicators(self):
        """Calculate required indicators"""
        # Add your indicators here
        pass
    
    def generate_signals(self):
        """Generate buy/sell signals"""
        self.data['signal'] = 0
        
        # Buy condition
        # self.data.loc[buy_condition, 'signal'] = 1
        
        # Sell condition
        # self.data.loc[sell_condition, 'signal'] = -1
        
        return self.data['signal']
```

### 3. Add Risk Parameters
Define stop loss and take profit levels:
```python
def get_risk_params(self):
    return {
        'stop_loss_pct': 0.02,
        'take_profit_pct': 0.04,
        'max_position_size': 0.1
    }
```

### 4. Write Tests
Create tests in `tests/test_your_strategy.py`:
```python
def test_strategy_generates_signals():
    # Test that strategy generates valid signals
    pass

def test_strategy_backtest():
    # Test backtesting
    pass
```

### 5. Backtest the Strategy
Run `/backtest` workflow with the new strategy

### 6. Optimize Parameters
Use walk-forward optimization to find optimal parameters

## Strategy Checklist
- [ ] Clear entry/exit rules
- [ ] Risk management integrated
- [ ] Backtested on 2+ years data
- [ ] Walk-forward validated
- [ ] Sharpe ratio > 1.0
- [ ] Max drawdown < 15%
