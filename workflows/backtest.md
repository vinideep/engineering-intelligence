---
description: Run a backtest on a trading strategy
---

# Run Backtest Workflow

This workflow runs a backtest on a specified trading strategy.

## Steps

### 1. Verify Data Availability
// turbo
```bash
ls -la data/historical/
```

### 2. Fetch Data if Needed
If no data exists, run:
```bash
python -c "
from src.data.fetcher import DataFetcher
fetcher = DataFetcher()
data = fetcher.fetch_yahoo_historical('RELIANCE.NS', period='2y')
data.to_csv('data/historical/RELIANCE.csv')
print('Data saved!')
"
```

### 3. Run Backtest
```bash
python -c "
import pandas as pd
from src.strategies.ma_crossover import MovingAverageCrossover
from src.backtesting.engine import VectorizedBacktester

# Load data
data = pd.read_csv('data/historical/RELIANCE.csv', index_col=0, parse_dates=True)

# Initialize strategy
strategy = MovingAverageCrossover(data, fast_period=20, slow_period=50)
strategy.calculate_indicators()
signals = strategy.generate_signals()

# Run backtest
backtester = VectorizedBacktester()
metrics = backtester.run(data, signals['signal'])

# Print results
print('='*60)
print('BACKTEST RESULTS')
print('='*60)
for k, v in metrics.items():
    print(f'{k}: {v}')
"
```

### 4. Generate Charts
```bash
python -c "
# Generate performance visualization
from src.backtesting.visualization import plot_backtest_results
plot_backtest_results(results, metrics, save_path='backtest_chart.png')
print('Chart saved to backtest_chart.png')
"
```

## Parameters
- **Symbol**: Stock symbol (default: RELIANCE.NS)
- **Period**: Data period (default: 2y)
- **Fast MA**: Fast moving average period (default: 20)
- **Slow MA**: Slow moving average period (default: 50)
- **Initial Capital**: Starting capital (default: 100000)
