---
description: Set up the algorithmic trading project environment
---

# Bootstrap Algo Trading Project

This workflow sets up the complete algorithmic trading project structure.

## Steps

### 1. Create Project Structure
// turbo
```bash
mkdir -p src/{data,indicators,strategies,risk,backtesting,execution,monitoring,ml}
mkdir -p config data/{historical,instruments} logs tests
```

### 2. Create __init__.py Files
// turbo
```bash
touch src/__init__.py
touch src/data/__init__.py
touch src/indicators/__init__.py
touch src/strategies/__init__.py
touch src/risk/__init__.py
touch src/backtesting/__init__.py
touch src/execution/__init__.py
touch src/monitoring/__init__.py
touch src/ml/__init__.py
```

### 3. Copy Starter Files
Move the files from `files (1)/` to the appropriate locations:
- `data_fetcher.py` → `src/data/fetcher.py`
- `upstox_auth.py` → `src/execution/upstox_auth.py`
- `simple_ma_strategy.py` → `src/strategies/ma_crossover.py`

### 4. Install Dependencies
// turbo
```bash
pip install -r requirements.txt
```

### 5. Create .env File
Create a `.env` file with:
```
UPSTOX_API_KEY=your_api_key
UPSTOX_API_SECRET=your_api_secret
UPSTOX_REDIRECT_URI=http://localhost:8000/callback
```

### 6. Create .gitignore
// turbo
```bash
echo "config/upstox_token.json
.env
*.pyc
__pycache__/
data/historical/
logs/
*.csv
*.db" > .gitignore
```

### 7. Verify Installation
// turbo
```bash
python -c "import pandas; import numpy; import yfinance; print('Core packages OK')"
```

## Next Steps
1. Run `/authenticate-upstox` to set up API access
2. Run `/fetch-data` to download historical data
3. Run `/backtest` to test the sample strategy
