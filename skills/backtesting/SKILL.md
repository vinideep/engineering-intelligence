# Backtesting Engine Skill

## Overview
This skill provides guidance for building a production-grade backtesting engine for validating trading strategies.

---

## Backtesting Approaches

### 1. Vectorized Backtesting
- **Pros**: Fast, efficient for simple strategies
- **Cons**: Limited order types, no real-time simulation
- **Use**: Initial strategy validation

### 2. Event-Driven Backtesting
- **Pros**: Realistic simulation, complex order types
- **Cons**: Slower execution
- **Use**: Production validation

---

## Vectorized Backtest Engine

```python
# src/backtesting/engine.py

import pandas as pd
import numpy as np
from typing import Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class BacktestConfig:
    initial_capital: float = 100000
    commission: float = 0.001  # 0.1%
    slippage: float = 0.0005  # 0.05%
    position_size: float = 1.0  # 100% capital per trade
    allow_short: bool = False

class VectorizedBacktester:
    def __init__(self, config: BacktestConfig = None):
        self.config = config or BacktestConfig()
        self.results = None
        
    def run(self, data: pd.DataFrame, signals: pd.Series) -> Dict[str, Any]:
        """
        Run backtest on data with given signals
        
        Parameters:
        - data: DataFrame with OHLCV data
        - signals: Series with 1 (buy), -1 (sell), 0 (hold)
        """
        df = data.copy()
        df['signal'] = signals
        
        # Calculate returns
        df['returns'] = df['close'].pct_change()
        
        # Apply slippage to entry/exit
        trades = df['signal'].diff().abs()
        slippage_cost = trades * self.config.slippage
        
        # Position tracking (1 = long, 0 = flat, -1 = short if allowed)
        df['position'] = df['signal'].replace(-1, 0 if not self.config.allow_short else -1)
        df['position'] = df['position'].ffill().fillna(0)
        
        # Strategy returns
        df['strategy_returns'] = df['position'].shift(1) * df['returns']
        
        # Apply costs
        df['strategy_returns'] -= trades * self.config.commission
        df['strategy_returns'] -= slippage_cost
        
        # Cumulative returns
        df['cumulative_returns'] = (1 + df['strategy_returns']).cumprod()
        df['cumulative_market'] = (1 + df['returns']).cumprod()
        
        # Equity curves
        df['equity'] = self.config.initial_capital * df['cumulative_returns']
        df['market_equity'] = self.config.initial_capital * df['cumulative_market']
        
        self.results = df
        return self.calculate_metrics()
    
    def calculate_metrics(self) -> Dict[str, Any]:
        """Calculate comprehensive performance metrics"""
        df = self.results
        returns = df['strategy_returns'].dropna()
        
        # Basic returns
        total_return = (df['equity'].iloc[-1] / self.config.initial_capital - 1) * 100
        market_return = (df['market_equity'].iloc[-1] / self.config.initial_capital - 1) * 100
        
        # Risk-adjusted returns
        sharpe = self._sharpe_ratio(returns)
        sortino = self._sortino_ratio(returns)
        
        # Drawdown analysis
        max_dd, dd_duration = self._max_drawdown(df['cumulative_returns'])
        
        # Trade analysis
        trades = self._analyze_trades(df)
        
        # Calmar ratio
        annual_return = total_return * (252 / len(df))
        calmar = annual_return / abs(max_dd) if max_dd != 0 else 0
        
        return {
            'initial_capital': self.config.initial_capital,
            'final_equity': df['equity'].iloc[-1],
            'total_return': total_return,
            'market_return': market_return,
            'outperformance': total_return - market_return,
            'sharpe_ratio': sharpe,
            'sortino_ratio': sortino,
            'calmar_ratio': calmar,
            'max_drawdown': max_dd,
            'max_dd_duration': dd_duration,
            'total_trades': trades['total'],
            'winning_trades': trades['winning'],
            'losing_trades': trades['losing'],
            'win_rate': trades['win_rate'],
            'profit_factor': trades['profit_factor'],
            'avg_win': trades['avg_win'],
            'avg_loss': trades['avg_loss'],
            'best_trade': trades['best'],
            'worst_trade': trades['worst']
        }
    
    def _sharpe_ratio(self, returns: pd.Series, risk_free: float = 0.05) -> float:
        """Annualized Sharpe Ratio"""
        if returns.std() == 0:
            return 0
        excess_returns = returns - (risk_free / 252)
        return (excess_returns.mean() / returns.std()) * np.sqrt(252)
    
    def _sortino_ratio(self, returns: pd.Series, risk_free: float = 0.05) -> float:
        """Annualized Sortino Ratio (downside deviation)"""
        excess_returns = returns - (risk_free / 252)
        downside = returns[returns < 0]
        if len(downside) == 0 or downside.std() == 0:
            return 0
        return (excess_returns.mean() / downside.std()) * np.sqrt(252)
    
    def _max_drawdown(self, cumulative: pd.Series) -> tuple:
        """Calculate maximum drawdown and duration"""
        running_max = cumulative.cummax()
        drawdown = (cumulative - running_max) / running_max
        max_dd = drawdown.min() * 100
        
        # Duration
        is_drawdown = drawdown < 0
        dd_groups = (~is_drawdown).cumsum()
        dd_lengths = is_drawdown.groupby(dd_groups).sum()
        max_duration = dd_lengths.max() if len(dd_lengths) > 0 else 0
        
        return max_dd, max_duration
    
    def _analyze_trades(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze individual trades"""
        signals = df[df['signal'] != 0].copy()
        
        if len(signals) == 0:
            return {
                'total': 0, 'winning': 0, 'losing': 0,
                'win_rate': 0, 'profit_factor': 0,
                'avg_win': 0, 'avg_loss': 0,
                'best': 0, 'worst': 0
            }
        
        trade_returns = []
        entry_price = None
        entry_idx = None
        
        for idx, row in signals.iterrows():
            if row['signal'] == 1 and entry_price is None:
                entry_price = row['close']
                entry_idx = idx
            elif row['signal'] == -1 and entry_price is not None:
                exit_price = row['close']
                pnl = (exit_price - entry_price) / entry_price
                trade_returns.append(pnl)
                entry_price = None
        
        if not trade_returns:
            return {
                'total': 0, 'winning': 0, 'losing': 0,
                'win_rate': 0, 'profit_factor': 0,
                'avg_win': 0, 'avg_loss': 0,
                'best': 0, 'worst': 0
            }
        
        winners = [r for r in trade_returns if r > 0]
        losers = [r for r in trade_returns if r < 0]
        
        gross_profit = sum(winners) if winners else 0
        gross_loss = abs(sum(losers)) if losers else 0
        
        return {
            'total': len(trade_returns),
            'winning': len(winners),
            'losing': len(losers),
            'win_rate': (len(winners) / len(trade_returns)) * 100,
            'profit_factor': gross_profit / gross_loss if gross_loss > 0 else float('inf'),
            'avg_win': np.mean(winners) * 100 if winners else 0,
            'avg_loss': np.mean(losers) * 100 if losers else 0,
            'best': max(trade_returns) * 100,
            'worst': min(trade_returns) * 100
        }
```

---

## Performance Visualization

```python
# src/backtesting/visualization.py

import matplotlib.pyplot as plt
import matplotlib.dates as mdates

def plot_backtest_results(results: pd.DataFrame, metrics: dict, save_path: str = None):
    """Generate comprehensive backtest visualization"""
    fig, axes = plt.subplots(4, 1, figsize=(14, 16))
    
    # 1. Price with signals
    ax1 = axes[0]
    ax1.plot(results.index, results['close'], label='Price', linewidth=1)
    
    buys = results[results['signal'] == 1]
    sells = results[results['signal'] == -1]
    
    ax1.scatter(buys.index, buys['close'], marker='^', 
                color='green', s=100, label='Buy', zorder=5)
    ax1.scatter(sells.index, sells['close'], marker='v',
                color='red', s=100, label='Sell', zorder=5)
    
    ax1.set_title('Price Chart with Trading Signals', fontweight='bold')
    ax1.set_ylabel('Price (₹)')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # 2. Equity curves
    ax2 = axes[1]
    ax2.plot(results.index, results['equity'], label='Strategy', 
             linewidth=2, color='blue')
    ax2.plot(results.index, results['market_equity'], label='Buy & Hold',
             linewidth=2, color='gray', alpha=0.7)
    
    ax2.fill_between(results.index, results['equity'], 
                     results['market_equity'], alpha=0.3,
                     where=results['equity'] > results['market_equity'],
                     color='green', label='Outperformance')
    ax2.fill_between(results.index, results['equity'],
                     results['market_equity'], alpha=0.3,
                     where=results['equity'] <= results['market_equity'],
                     color='red', label='Underperformance')
    
    ax2.set_title('Equity Curve Comparison', fontweight='bold')
    ax2.set_ylabel('Portfolio Value (₹)')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    # 3. Drawdown
    ax3 = axes[2]
    cumulative = results['cumulative_returns']
    running_max = cumulative.cummax()
    drawdown = ((cumulative - running_max) / running_max) * 100
    
    ax3.fill_between(results.index, drawdown, 0, color='red', alpha=0.3)
    ax3.plot(results.index, drawdown, color='red', linewidth=1)
    ax3.axhline(y=metrics['max_drawdown'], color='darkred', 
                linestyle='--', label=f"Max DD: {metrics['max_drawdown']:.2f}%")
    
    ax3.set_title('Strategy Drawdown', fontweight='bold')
    ax3.set_ylabel('Drawdown (%)')
    ax3.legend()
    ax3.grid(True, alpha=0.3)
    
    # 4. Monthly returns heatmap
    ax4 = axes[3]
    results['month'] = results.index.to_period('M')
    monthly_returns = results.groupby('month')['strategy_returns'].sum() * 100
    
    ax4.bar(range(len(monthly_returns)), monthly_returns.values,
            color=['green' if x > 0 else 'red' for x in monthly_returns.values])
    ax4.set_title('Monthly Returns', fontweight='bold')
    ax4.set_ylabel('Return (%)')
    ax4.set_xticks(range(0, len(monthly_returns), 3))
    ax4.set_xticklabels(monthly_returns.index[::3].astype(str), rotation=45)
    ax4.axhline(y=0, color='black', linewidth=0.5)
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
    
    plt.show()
```

---

## Walk-Forward Optimization

```python
def walk_forward_optimization(
    data: pd.DataFrame,
    strategy_class,
    param_grid: dict,
    train_size: int = 252,  # 1 year
    test_size: int = 63,    # 3 months
    metric: str = 'sharpe_ratio'
):
    """
    Walk-forward optimization to prevent overfitting
    """
    results = []
    
    for i in range(0, len(data) - train_size - test_size, test_size):
        train_start = i
        train_end = i + train_size
        test_end = train_end + test_size
        
        train_data = data.iloc[train_start:train_end]
        test_data = data.iloc[train_end:test_end]
        
        # Optimize on training set
        best_params = None
        best_metric = -float('inf')
        
        for params in ParameterGrid(param_grid):
            strategy = strategy_class(train_data, **params)
            strategy.calculate_indicators()
            signals = strategy.generate_signals()
            
            backtest = VectorizedBacktester()
            metrics = backtest.run(train_data, signals)
            
            if metrics[metric] > best_metric:
                best_metric = metrics[metric]
                best_params = params
        
        # Test on out-of-sample data
        strategy = strategy_class(test_data, **best_params)
        strategy.calculate_indicators()
        signals = strategy.generate_signals()
        
        backtest = VectorizedBacktester()
        test_metrics = backtest.run(test_data, signals)
        
        results.append({
            'train_period': f"{train_data.index[0]} to {train_data.index[-1]}",
            'test_period': f"{test_data.index[0]} to {test_data.index[-1]}",
            'best_params': best_params,
            'train_sharpe': best_metric,
            'test_sharpe': test_metrics['sharpe_ratio'],
            'test_return': test_metrics['total_return']
        })
    
    return pd.DataFrame(results)
```

---

## Monte Carlo Simulation

```python
def monte_carlo_analysis(
    trade_returns: list,
    num_simulations: int = 1000,
    num_trades: int = 100,
    initial_capital: float = 100000
):
    """
    Monte Carlo simulation for risk analysis
    """
    final_equities = []
    max_drawdowns = []
    
    for _ in range(num_simulations):
        # Random sample of trades
        sampled_returns = np.random.choice(trade_returns, size=num_trades, replace=True)
        
        # Calculate equity curve
        equity = [initial_capital]
        for ret in sampled_returns:
            equity.append(equity[-1] * (1 + ret))
        
        equity = np.array(equity)
        final_equities.append(equity[-1])
        
        # Calculate max drawdown
        running_max = np.maximum.accumulate(equity)
        drawdown = (equity - running_max) / running_max
        max_drawdowns.append(drawdown.min() * 100)
    
    return {
        'median_equity': np.median(final_equities),
        'equity_5th_percentile': np.percentile(final_equities, 5),
        'equity_95th_percentile': np.percentile(final_equities, 95),
        'median_max_dd': np.median(max_drawdowns),
        'worst_max_dd': np.percentile(max_drawdowns, 5),
        'probability_of_loss': sum(1 for e in final_equities if e < initial_capital) / num_simulations
    }
```

---

## Common Pitfalls to Avoid

| Pitfall | Description | Solution |
|---------|-------------|----------|
| **Look-ahead bias** | Using future data | Use `.shift(1)` for signals |
| **Survivorship bias** | Only testing winners | Include delisted stocks |
| **Overfitting** | Too many parameters | Walk-forward optimization |
| **No costs** | Ignoring fees | Include commission + slippage |
| **Perfect fills** | Assuming instant execution | Add realistic slippage |
| **Data snooping** | Multiple testing | Out-of-sample validation |
