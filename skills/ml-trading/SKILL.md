# Machine Learning for Trading Skill

## Overview
Guide for implementing ML models in trading strategies.

## ML Approaches

| Approach | Use Case | Complexity |
|----------|----------|------------|
| Classification | Predict up/down | Low |
| Regression | Price targets | Medium |
| LSTM | Time series | High |
| Reinforcement | Trade decisions | High |

## Feature Engineering

```python
def create_features(data):
    """Create ML features from OHLCV data"""
    df = data.copy()
    
    # Price features
    df['returns'] = df['close'].pct_change()
    df['log_returns'] = np.log(df['close']/df['close'].shift(1))
    
    # Technical indicators
    df['rsi'] = ta.rsi(df['close'], 14)
    df['macd'] = ta.macd(df['close'])['MACD_12_26_9']
    df['atr'] = ta.atr(df['high'], df['low'], df['close'], 14)
    
    # Lag features
    for lag in [1, 5, 10, 20]:
        df[f'return_lag_{lag}'] = df['returns'].shift(lag)
    
    # Moving averages
    for period in [5, 10, 20, 50]:
        df[f'sma_{period}'] = df['close'].rolling(period).mean()
        df[f'price_to_sma_{period}'] = df['close'] / df[f'sma_{period}']
    
    # Volatility
    df['vol_20'] = df['returns'].rolling(20).std()
    
    return df.dropna()
```

## Target Creation

```python
def create_target(data, horizon=5, threshold=0.02):
    """Create classification target"""
    future_return = data['close'].shift(-horizon) / data['close'] - 1
    
    target = pd.Series(0, index=data.index)
    target[future_return > threshold] = 1   # Buy
    target[future_return < -threshold] = -1 # Sell
    
    return target
```

## Random Forest Model

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

def train_rf_model(features, target):
    X_train, X_test, y_train, y_test = train_test_split(
        features, target, test_size=0.2, shuffle=False
    )
    
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42
    )
    model.fit(X_train, y_train)
    
    accuracy = model.score(X_test, y_test)
    return model, accuracy
```

## LSTM Model

```python
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

def build_lstm(sequence_length, n_features):
    model = Sequential([
        LSTM(50, return_sequences=True, input_shape=(sequence_length, n_features)),
        Dropout(0.2),
        LSTM(50, return_sequences=False),
        Dropout(0.2),
        Dense(25),
        Dense(1)
    ])
    model.compile(optimizer='adam', loss='mse')
    return model
```

## Model Validation

- Use walk-forward validation (not random split)
- Monitor for overfitting
- Track feature importance
- Compare to buy-and-hold baseline

## Integration with Trading

```python
class MLStrategy(BaseStrategy):
    def __init__(self, data, model):
        super().__init__(data)
        self.model = model
    
    def generate_signals(self):
        features = self.create_features()
        predictions = self.model.predict(features)
        
        self.data['signal'] = 0
        self.data.loc[predictions == 1, 'signal'] = 1
        self.data.loc[predictions == -1, 'signal'] = -1
        
        return self.data['signal']
```

## Best Practices
- Start simple (Random Forest)
- Use financial cross-validation
- Avoid lookahead bias
- Retrain periodically
- Monitor model decay
