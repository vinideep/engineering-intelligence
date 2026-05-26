# Technical Indicators Library Skill

## Overview
This skill provides guidance for implementing a comprehensive technical indicators library for the algorithmic trading system.

---

## Indicator Categories

### 1. Trend Indicators
Identify the direction and strength of market trends.

### 2. Momentum Indicators
Measure the speed of price movement.

### 3. Volatility Indicators
Measure the rate and magnitude of price changes.

### 4. Volume Indicators
Analyze trading volume to confirm price movements.

---

## Implementation

### Base Structure
```python
# src/indicators/__init__.py
from .trend import SMA, EMA, MACD, ADX
from .momentum import RSI, Stochastic, CCI, WilliamsR
from .volatility import ATR, BollingerBands, KeltnerChannel
from .volume import OBV, VWAP, MFI

__all__ = [
    'SMA', 'EMA', 'MACD', 'ADX',
    'RSI', 'Stochastic', 'CCI', 'WilliamsR',
    'ATR', 'BollingerBands', 'KeltnerChannel',
    'OBV', 'VWAP', 'MFI'
]
```

---

## Trend Indicators

### Simple Moving Average (SMA)
```python
def sma(data, period=20):
    """Simple Moving Average"""
    return data['close'].rolling(window=period).mean()
```

### Exponential Moving Average (EMA)
```python
def ema(data, period=20):
    """Exponential Moving Average"""
    return data['close'].ewm(span=period, adjust=False).mean()
```

### Weighted Moving Average (WMA)
```python
def wma(data, period=20):
    """Weighted Moving Average"""
    weights = np.arange(1, period + 1)
    return data['close'].rolling(period).apply(
        lambda x: np.dot(x, weights) / weights.sum(),
        raw=True
    )
```

### MACD
```python
def macd(data, fast=12, slow=26, signal=9):
    """Moving Average Convergence Divergence"""
    ema_fast = data['close'].ewm(span=fast, adjust=False).mean()
    ema_slow = data['close'].ewm(span=slow, adjust=False).mean()
    
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    
    return pd.DataFrame({
        'macd': macd_line,
        'signal': signal_line,
        'histogram': histogram
    })
```

### ADX (Average Directional Index)
```python
def adx(data, period=14):
    """Average Directional Index - Trend Strength"""
    high = data['high']
    low = data['low']
    close = data['close']
    
    # True Range
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    # +DM and -DM
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm[plus_dm < 0] = 0
    minus_dm[minus_dm < 0] = 0
    
    # Smoothed averages
    atr = tr.ewm(span=period, adjust=False).mean()
    plus_di = 100 * (plus_dm.ewm(span=period, adjust=False).mean() / atr)
    minus_di = 100 * (minus_dm.ewm(span=period, adjust=False).mean() / atr)
    
    # DX and ADX
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
    adx_val = dx.ewm(span=period, adjust=False).mean()
    
    return adx_val
```

---

## Momentum Indicators

### RSI (Relative Strength Index)
```python
def rsi(data, period=14):
    """Relative Strength Index"""
    delta = data['close'].diff()
    
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    
    avg_gain = gain.ewm(span=period, adjust=False).mean()
    avg_loss = loss.ewm(span=period, adjust=False).mean()
    
    rs = avg_gain / avg_loss
    rsi_val = 100 - (100 / (1 + rs))
    
    return rsi_val
```

### Stochastic Oscillator
```python
def stochastic(data, k_period=14, d_period=3):
    """Stochastic Oscillator (%K and %D)"""
    low_min = data['low'].rolling(window=k_period).min()
    high_max = data['high'].rolling(window=k_period).max()
    
    k = 100 * (data['close'] - low_min) / (high_max - low_min)
    d = k.rolling(window=d_period).mean()
    
    return pd.DataFrame({'%K': k, '%D': d})
```

### CCI (Commodity Channel Index)
```python
def cci(data, period=20):
    """Commodity Channel Index"""
    typical_price = (data['high'] + data['low'] + data['close']) / 3
    sma = typical_price.rolling(window=period).mean()
    mad = typical_price.rolling(window=period).apply(
        lambda x: np.abs(x - x.mean()).mean()
    )
    
    cci_val = (typical_price - sma) / (0.015 * mad)
    return cci_val
```

### Williams %R
```python
def williams_r(data, period=14):
    """Williams %R"""
    high_max = data['high'].rolling(window=period).max()
    low_min = data['low'].rolling(window=period).min()
    
    wr = -100 * (high_max - data['close']) / (high_max - low_min)
    return wr
```

---

## Volatility Indicators

### ATR (Average True Range)
```python
def atr(data, period=14):
    """Average True Range"""
    high = data['high']
    low = data['low']
    close = data['close']
    
    tr1 = high - low
    tr2 = abs(high - close.shift(1))
    tr3 = abs(low - close.shift(1))
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr_val = tr.ewm(span=period, adjust=False).mean()
    
    return atr_val
```

### Bollinger Bands
```python
def bollinger_bands(data, period=20, std_dev=2):
    """Bollinger Bands"""
    sma = data['close'].rolling(window=period).mean()
    std = data['close'].rolling(window=period).std()
    
    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)
    
    # %B indicator
    percent_b = (data['close'] - lower) / (upper - lower)
    
    # Bandwidth
    bandwidth = (upper - lower) / sma
    
    return pd.DataFrame({
        'middle': sma,
        'upper': upper,
        'lower': lower,
        'percent_b': percent_b,
        'bandwidth': bandwidth
    })
```

### Keltner Channel
```python
def keltner_channel(data, ema_period=20, atr_period=10, multiplier=2):
    """Keltner Channel"""
    ema_val = data['close'].ewm(span=ema_period, adjust=False).mean()
    atr_val = atr(data, atr_period)
    
    upper = ema_val + (multiplier * atr_val)
    lower = ema_val - (multiplier * atr_val)
    
    return pd.DataFrame({
        'middle': ema_val,
        'upper': upper,
        'lower': lower
    })
```

---

## Volume Indicators

### OBV (On-Balance Volume)
```python
def obv(data):
    """On-Balance Volume"""
    obv_val = pd.Series(index=data.index, dtype=float)
    obv_val.iloc[0] = 0
    
    for i in range(1, len(data)):
        if data['close'].iloc[i] > data['close'].iloc[i-1]:
            obv_val.iloc[i] = obv_val.iloc[i-1] + data['volume'].iloc[i]
        elif data['close'].iloc[i] < data['close'].iloc[i-1]:
            obv_val.iloc[i] = obv_val.iloc[i-1] - data['volume'].iloc[i]
        else:
            obv_val.iloc[i] = obv_val.iloc[i-1]
    
    return obv_val
```

### VWAP (Volume Weighted Average Price)
```python
def vwap(data):
    """Volume Weighted Average Price"""
    typical_price = (data['high'] + data['low'] + data['close']) / 3
    vwap_val = (typical_price * data['volume']).cumsum() / data['volume'].cumsum()
    return vwap_val
```

### MFI (Money Flow Index)
```python
def mfi(data, period=14):
    """Money Flow Index"""
    typical_price = (data['high'] + data['low'] + data['close']) / 3
    money_flow = typical_price * data['volume']
    
    delta = typical_price.diff()
    positive_flow = money_flow.where(delta > 0, 0)
    negative_flow = money_flow.where(delta < 0, 0)
    
    positive_mf = positive_flow.rolling(window=period).sum()
    negative_mf = negative_flow.rolling(window=period).sum()
    
    mfi_val = 100 - (100 / (1 + positive_mf / negative_mf))
    return mfi_val
```

---

## Multi-Indicator Confluence

### Confluence Detection
```python
def detect_confluence(data, indicators):
    """
    Detect when multiple indicators agree on direction
    
    Returns score from -1 (bearish) to 1 (bullish)
    """
    signals = []
    
    # RSI signal
    if 'rsi' in indicators:
        rsi_val = indicators['rsi'].iloc[-1]
        if rsi_val < 30:
            signals.append(1)  # Oversold = bullish
        elif rsi_val > 70:
            signals.append(-1)  # Overbought = bearish
        else:
            signals.append(0)
    
    # MACD signal
    if 'macd' in indicators:
        macd_hist = indicators['macd']['histogram'].iloc[-1]
        if macd_hist > 0:
            signals.append(1)
        elif macd_hist < 0:
            signals.append(-1)
        else:
            signals.append(0)
    
    # MA crossover
    if 'sma_fast' in indicators and 'sma_slow' in indicators:
        if indicators['sma_fast'].iloc[-1] > indicators['sma_slow'].iloc[-1]:
            signals.append(1)
        else:
            signals.append(-1)
    
    # Calculate confluence score
    if signals:
        return sum(signals) / len(signals)
    return 0
```

---

## Using pandas-ta Library

For production use, leverage pandas-ta for optimized calculations:

```python
import pandas_ta as ta

# All indicators in one call
data.ta.strategy("all")

# Specific indicators
data['RSI'] = ta.rsi(data['close'], length=14)
data['MACD'] = ta.macd(data['close'], fast=12, slow=26, signal=9)
data['BB'] = ta.bbands(data['close'], length=20, std=2)
data['ATR'] = ta.atr(data['high'], data['low'], data['close'], length=14)
```

---

## Indicator Interpretation

| Indicator | Bullish Signal | Bearish Signal |
|-----------|---------------|----------------|
| RSI | < 30 (oversold) | > 70 (overbought) |
| MACD | Histogram > 0 | Histogram < 0 |
| Stochastic | %K crosses above %D < 20 | %K crosses below %D > 80 |
| Bollinger | Price touches lower band | Price touches upper band |
| ADX | ADX > 25 (trend) | ADX < 20 (ranging) |
| OBV | Rising with price | Divergence from price |
