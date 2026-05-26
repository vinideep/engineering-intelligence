# Upstox API Integration Skill

## Overview
This skill provides detailed guidance for integrating with Upstox API for real-time market data and order execution in the Indian stock market (NSE/BSE).

---

## Authentication Flow

### OAuth2 Flow Steps
1. Generate authorization URL
2. User logs in and approves
3. Extract authorization code from redirect
4. Exchange code for access token
5. Store token securely

### Token Management
```python
import json
import os
from datetime import datetime, timedelta

class TokenManager:
    TOKEN_FILE = 'config/upstox_token.json'
    
    @classmethod
    def save_token(cls, access_token, expires_in=86400):
        token_data = {
            'access_token': access_token,
            'created_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(seconds=expires_in)).isoformat()
        }
        os.makedirs('config', exist_ok=True)
        with open(cls.TOKEN_FILE, 'w') as f:
            json.dump(token_data, f)
    
    @classmethod
    def load_token(cls):
        try:
            with open(cls.TOKEN_FILE, 'r') as f:
                data = json.load(f)
            
            expires_at = datetime.fromisoformat(data['expires_at'])
            if datetime.now() >= expires_at:
                return None  # Token expired
            
            return data['access_token']
        except FileNotFoundError:
            return None
    
    @classmethod
    def is_valid(cls):
        return cls.load_token() is not None
```

---

## Market Data API

### Real-time WebSocket Streaming
```python
import websocket
import json

class UpstoxStreamer:
    WEBSOCKET_URL = "wss://api.upstox.com/v2/feed/market-data-feed"
    
    def __init__(self, access_token, instruments):
        self.token = access_token
        self.instruments = instruments
        self.callbacks = {'tick': [], 'order': []}
    
    def on_message(self, ws, message):
        data = json.loads(message)
        for callback in self.callbacks.get('tick', []):
            callback(data)
    
    def on_error(self, ws, error):
        print(f"WebSocket Error: {error}")
        self.reconnect()
    
    def on_close(self, ws, close_status, close_msg):
        print("WebSocket closed")
    
    def on_open(self, ws):
        # Subscribe to instruments
        subscribe_msg = {
            "guid": "my-subscription",
            "method": "sub",
            "data": {
                "mode": "full",
                "instrumentKeys": self.instruments
            }
        }
        ws.send(json.dumps(subscribe_msg))
    
    def start(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        self.ws = websocket.WebSocketApp(
            self.WEBSOCKET_URL,
            header=headers,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close,
            on_open=self.on_open
        )
        self.ws.run_forever()
```

### Historical Data
```python
def fetch_historical_candles(instrument_key, from_date, to_date, interval='1day'):
    """
    Intervals: 1minute, 30minute, day, week, month
    """
    response = history_api.get_historical_candle_data(
        instrument_key=instrument_key,
        interval=interval,
        to_date=to_date,
        from_date=from_date,
        api_version='2.0'
    )
    return response.data.candles
```

---

## Order Management

### Order Types
| Type | Description | Use Case |
|------|-------------|----------|
| `MARKET` | Execute at current price | Immediate entry/exit |
| `LIMIT` | Execute at specified price | Better price |
| `SL` | Stop-loss order | Risk management |
| `SL-M` | Stop-loss market | Guaranteed exit |

### Product Types
| Product | Description |
|---------|-------------|
| `I` | Intraday (MIS) |
| `D` | Delivery (CNC) |
| `CO` | Cover Order |
| `OCO` | One Cancels Other |

### Place Order
```python
def place_order(
    instrument_key,
    quantity,
    transaction_type,  # BUY or SELL
    order_type='MARKET',
    product='I',
    price=0,
    trigger_price=0
):
    order_params = {
        'quantity': quantity,
        'product': product,
        'validity': 'DAY',
        'price': price,
        'tag': 'algo_trade',
        'instrument_token': instrument_key,
        'order_type': order_type,
        'transaction_type': transaction_type,
        'disclosed_quantity': 0,
        'trigger_price': trigger_price,
        'is_amo': False
    }
    
    return order_api.place_order(
        body=order_params,
        api_version='2.0'
    )
```

### Bracket Order (SL + Target)
```python
def place_bracket_order(
    instrument_key,
    quantity,
    transaction_type,
    entry_price,
    stop_loss,
    target
):
    """
    Bracket order with automatic SL and target
    """
    order_params = {
        'quantity': quantity,
        'product': 'OCO',
        'validity': 'DAY',
        'price': entry_price,
        'instrument_token': instrument_key,
        'order_type': 'LIMIT',
        'transaction_type': transaction_type,
        'stop_loss': abs(entry_price - stop_loss),
        'square_off': abs(target - entry_price),
        'trailing_ticks': 0
    }
    
    return order_api.place_order(body=order_params, api_version='2.0')
```

---

## Instrument Keys

### Format
`EXCHANGE_SEGMENT|ISIN`

### Examples
| Symbol | Instrument Key |
|--------|----------------|
| RELIANCE | NSE_EQ\|INE002A01018 |
| TCS | NSE_EQ\|INE467B01029 |
| NIFTY 50 | NSE_INDEX\|Nifty 50 |
| NIFTY FUT | NSE_FO\|... |

### Download Instrument Master
```python
import requests
import pandas as pd

def download_instruments():
    """Download complete instrument list from Upstox"""
    url = "https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz"
    df = pd.read_csv(url, compression='gzip')
    df.to_csv('data/instruments/master.csv', index=False)
    return df
```

---

## Error Handling

### Common Errors
| Error Code | Description | Action |
|------------|-------------|--------|
| 401 | Unauthorized | Re-authenticate |
| 429 | Rate limited | Wait and retry |
| 500 | Server error | Retry with backoff |
| 40006 | Order rejected | Check margin/price |

### Retry Pattern
```python
import time
from functools import wraps

def retry_on_error(max_retries=3, delay=1, backoff=2):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    wait = delay * (backoff ** attempt)
                    print(f"Retry {attempt+1}/{max_retries} after {wait}s: {e}")
                    time.sleep(wait)
        return wrapper
    return decorator
```

---

## Rate Limits
- **Market Data**: 250 requests/second
- **Order API**: 10 orders/second
- **Historical Data**: 30 requests/minute

---

## Testing
Always test with paper trading or very small quantities first:
```python
# Paper trading mode
PAPER_TRADE = True

def execute_signal(signal, price, quantity):
    if PAPER_TRADE:
        log_paper_trade(signal, price, quantity)
        return {"status": "paper", "price": price}
    else:
        return place_order(...)
```
