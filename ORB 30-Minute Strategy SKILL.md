---
name: orb-trading-strategy
description: >
  Automated ORB (Opening Range Breakout) trading strategy agent. Use this skill whenever the user
  wants to build, code, automate, or understand the ORB or Opening Range Breakout strategy —
  especially the 30-minute variant. Triggers on requests like "build an ORB bot", "automate my
  ORB strategy", "write a trading script for ORB", "create an ORB agent", or when the user
  discusses entry/exit rules for breakout trading at market open. Always use this skill when the
  user mentions ORB, opening range, breakout trading, 9:30 AM range, or intraday momentum strategies,
  even if they don't explicitly say "skill" or "script".
---

# ORB (Opening Range Breakout) — 30-Minute Strategy

A complete reference for building an automated ORB trading agent. Covers strategy logic, signal
rules, risk management, filters, and code scaffolding for a Python-based trading bot.

---

## 1. Strategy Overview

The **Opening Range Breakout (ORB)** strategy captures the first directional momentum of the
trading day. The core idea:

- **Define the opening range**: The high and low of the first N minutes after market open.
- **Wait for breakout**: Price closes above the high (bullish) or below the low (bearish).
- **Enter in breakout direction** with defined stop-loss and take-profit.

The **30-minute ORB** uses the range from **9:30 AM – 10:00 AM ET** for US equities/futures.
It is more conservative than 5/15-min variants, filtering early noise while still capturing
the day's primary momentum move.

---

## 2. Core Rules

### 2.1 Opening Range Definition

| Parameter       | Value                              |
|-----------------|------------------------------------|
| Session open    | 9:30 AM ET (US equities/futures)   |
| Range window    | 9:30 AM – 10:00 AM ET (30 min)     |
| ORB_HIGH        | Highest high in the 30-min window  |
| ORB_LOW         | Lowest low in the 30-min window    |
| ORB_WIDTH       | ORB_HIGH − ORB_LOW                 |
| Min range width | ≥ 0.2% of the asset's price        |

### 2.2 Entry Signals

**Bullish Entry (LONG)**
- A candle **closes above ORB_HIGH** after 10:00 AM
- Confirmed by volume spike (RVOL ≥ 1.5×)
- Price is **above VWAP**
- RSI is between **50–70** (momentum, not exhaustion)

**Bearish Entry (SHORT)**
- A candle **closes below ORB_LOW** after 10:00 AM
- Confirmed by volume spike (RVOL ≥ 1.5×)
- Price is **below VWAP**
- RSI is between **30–50**

> ⚠️ Wicks breaking the range do NOT count. Only confirmed candle closes trigger entry.

### 2.3 Stop Loss Options

| Method          | Stop Location              | Risk:Reward |
|-----------------|----------------------------|-------------|
| Conservative    | Opposite edge of the range | 1:2         |
| Moderate        | Midpoint (50%) of range    | 1:1.5       |
| Aggressive      | Just inside breakout level | 1:1         |

Recommended default: **midpoint stop with 1:2 R:R**.

### 2.4 Take Profit

- **Target 1**: 1.5× stop distance (partial exit / trail stop)
- **Target 2**: 2× stop distance (full exit)
- Alternative: Trail with 9-EMA or 20-EMA after Target 1 hit

### 2.5 Trade Frequency

- **One trade per day** — whichever breakout (long or short) triggers first
- No re-entries after a stop-out on the same day
- All positions closed by **3:45 PM ET** (before close)

---

## 3. Confirmation Filters

Apply ALL of the following before entering:

### 3.1 Minimum Range Width
```
ORB_WIDTH >= 0.002 × price
```
If the range is too tight, skip the day — false breakouts dominate.

### 3.2 Volume Confirmation
```
breakout_candle_volume >= 1.5 × avg_volume_20_periods
```
Strong volume validates real institutional participation.

### 3.3 VWAP Alignment
- **LONG**: Entry candle must close above VWAP
- **SHORT**: Entry candle must close below VWAP

### 3.4 EMA Trend Filter (Optional but Recommended)
- **LONG**: 20-EMA sloping up, price above 20-EMA
- **SHORT**: 20-EMA sloping down, price below 20-EMA

### 3.5 RSI Filter
- **LONG**: RSI between 50–70 (avoid overbought >70)
- **SHORT**: RSI between 30–50 (avoid oversold <30)

### 3.6 News/Event Filter
- Avoid trading on **FOMC days**, **CPI**, **NFP**, or major earnings unless explicitly tuned
- Flag these dates in your agent's calendar

---

## 4. Best Assets for ORB

| Asset        | Notes                                          |
|--------------|------------------------------------------------|
| SPY / SPX    | Clean, liquid, consistent — best for beginners |
| QQQ / NQ     | More volatile, bigger moves                    |
| ES (E-mini)  | Futures, same 9:30 timing                      |
| AAPL, TSLA   | High-volume single stocks, good ORB setups     |
| Crude Oil CL | Sharp early moves, news-sensitive              |
| Forex        | Use London open (3:00–4:00 AM ET) as anchor    |

---

## 5. Agent Execution Logic (Pseudocode)

```
DAILY AGENT WORKFLOW:

[PRE-MARKET]
1. Check economic calendar → flag high-impact events
2. Scan for gap stocks / pre-market movers (optional)
3. Set target asset(s) for the day

[9:30 AM ET — SESSION OPEN]
4. Start tracking OHLC on 1-min or 5-min candles
5. Do NOT trade during this window

[10:00 AM ET — RANGE LOCK]
6. ORB_HIGH = max(high) of all candles from 9:30–10:00
7. ORB_LOW  = min(low)  of all candles from 9:30–10:00
8. ORB_WIDTH = ORB_HIGH - ORB_LOW
9. IF ORB_WIDTH < 0.002 × price → SKIP TODAY, log reason

[10:00 AM ONWARD — MONITOR]
10. FOR each new 1-min or 5-min candle:
    a. Calculate VWAP, RSI(14), RVOL, EMA(20)
    b. Check BULLISH conditions:
       - candle.close > ORB_HIGH
       - RVOL >= 1.5
       - candle.close > VWAP
       - 50 <= RSI <= 70
       → IF ALL TRUE: ENTER LONG, set SL and TP
    c. Check BEARISH conditions:
       - candle.close < ORB_LOW
       - RVOL >= 1.5
       - candle.close < VWAP
       - 30 <= RSI <= 50
       → IF ALL TRUE: ENTER SHORT, set SL and TP
    d. If already in a trade → monitor SL/TP/trail

[3:45 PM ET]
11. Force-close any open positions
12. Log: entry price, exit price, direction, PnL, reason

[END OF DAY]
13. Save daily log to database/CSV for backtesting analysis
```

---

## 6. Python Agent Scaffold

```python
# orb_agent.py — ORB 30-Minute Strategy Agent Skeleton
# Plug in your broker API (Alpaca, IBKR, Zerodha, etc.)

import datetime
import pandas as pd

# --- Config ---
SYMBOL        = "SPY"
ORB_MINUTES   = 30
MIN_WIDTH_PCT = 0.002   # 0.2% minimum range
RVOL_THRESH   = 1.5
RSI_LONG_MIN  = 50
RSI_LONG_MAX  = 70
RSI_SHORT_MIN = 30
RSI_SHORT_MAX = 50
RISK_REWARD   = 2.0
STOP_METHOD   = "midpoint"  # "midpoint" | "opposite_edge"
SESSION_OPEN  = datetime.time(9, 30)
RANGE_LOCK    = datetime.time(10, 0)
FORCE_CLOSE   = datetime.time(15, 45)

# --- Helpers ---

def calculate_orb(candles: pd.DataFrame) -> dict:
    """Extract ORB high/low from 9:30–10:00 candles."""
    opening = candles.between_time("09:30", "09:59")
    return {
        "high":  opening["high"].max(),
        "low":   opening["low"].min(),
        "width": opening["high"].max() - opening["low"].min()
    }

def calculate_vwap(candles: pd.DataFrame) -> pd.Series:
    tp = (candles["high"] + candles["low"] + candles["close"]) / 3
    return (tp * candles["volume"]).cumsum() / candles["volume"].cumsum()

def calculate_rsi(series: pd.Series, period=14) -> float:
    delta = series.diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    rs    = gain / loss
    return float(100 - (100 / (1 + rs.iloc[-1])))

def calculate_rvol(candles: pd.DataFrame, lookback=20) -> float:
    avg_vol = candles["volume"].iloc[-lookback-1:-1].mean()
    return float(candles["volume"].iloc[-1] / avg_vol)

def get_stop_and_target(direction: str, entry: float, orb: dict) -> tuple:
    width = orb["width"]
    if STOP_METHOD == "midpoint":
        sl_dist = width / 2
    else:
        sl_dist = width

    if direction == "LONG":
        stop   = entry - sl_dist
        target = entry + sl_dist * RISK_REWARD
    else:
        stop   = entry + sl_dist
        target = entry - sl_dist * RISK_REWARD
    return stop, target

# --- Main Loop ---

def run_agent(get_candles_fn, place_order_fn, close_position_fn):
    """
    get_candles_fn  → returns pd.DataFrame with OHLCV + datetime index
    place_order_fn  → places market/limit order
    close_position_fn → closes open position
    """
    in_trade   = False
    trade_dir  = None
    stop_price = None
    tp_price   = None
    orb        = None

    while True:
        now     = datetime.datetime.now().time()
        candles = get_candles_fn(SYMBOL, interval="1min")

        # Lock the opening range at 10:00 AM
        if now >= RANGE_LOCK and orb is None:
            orb = calculate_orb(candles)
            if orb["width"] < MIN_WIDTH_PCT * candles["close"].iloc[-1]:
                print("ORB too narrow — skipping today")
                break
            print(f"ORB locked → HIGH: {orb['high']:.2f} | LOW: {orb['low']:.2f}")

        # Force close at 3:45 PM
        if now >= FORCE_CLOSE:
            if in_trade:
                close_position_fn(SYMBOL)
                print("Force-closed position at end of day")
            break

        # Monitor for signals after range is locked
        if orb and not in_trade and now > RANGE_LOCK:
            price  = candles["close"].iloc[-1]
            vwap   = calculate_vwap(candles).iloc[-1]
            rsi    = calculate_rsi(candles["close"])
            rvol   = calculate_rvol(candles)

            # Bullish breakout
            if (price > orb["high"] and
                rvol >= RVOL_THRESH and
                price > vwap and
                RSI_LONG_MIN <= rsi <= RSI_LONG_MAX):
                entry = price
                stop_price, tp_price = get_stop_and_target("LONG", entry, orb)
                place_order_fn(SYMBOL, "BUY", entry, stop_price, tp_price)
                in_trade, trade_dir = True, "LONG"
                print(f"LONG entry @ {entry:.2f} | SL: {stop_price:.2f} | TP: {tp_price:.2f}")

            # Bearish breakout
            elif (price < orb["low"] and
                  rvol >= RVOL_THRESH and
                  price < vwap and
                  RSI_SHORT_MIN <= rsi <= RSI_SHORT_MAX):
                entry = price
                stop_price, tp_price = get_stop_and_target("SHORT", entry, orb)
                place_order_fn(SYMBOL, "SELL", entry, stop_price, tp_price)
                in_trade, trade_dir = True, "SHORT"
                print(f"SHORT entry @ {entry:.2f} | SL: {stop_price:.2f} | TP: {tp_price:.2f}")

        # Monitor active trade for SL/TP
        if in_trade:
            price = candles["close"].iloc[-1]
            if trade_dir == "LONG" and (price <= stop_price or price >= tp_price):
                close_position_fn(SYMBOL)
                in_trade = False
                print(f"Position closed @ {price:.2f}")
            elif trade_dir == "SHORT" and (price >= stop_price or price <= tp_price):
                close_position_fn(SYMBOL)
                in_trade = False
                print(f"Position closed @ {price:.2f}")

        import time; time.sleep(60)  # Wait 1 minute before next check
```

---

## 7. Broker API Integration

| Broker           | Python Library         | Notes                            |
|------------------|------------------------|----------------------------------|
| Alpaca           | `alpaca-trade-api`     | US stocks/ETFs, paper trading    |
| Interactive Brokers | `ib_insync`         | Futures, options, global markets |
| Zerodha (India)  | `kiteconnect`          | NSE/BSE, great for Indian ORB    |
| TD Ameritrade    | `tda-api`              | US stocks and options            |
| Binance          | `python-binance`       | Crypto ORB (define session open) |

---

## 8. Backtesting Checklist

Before running live:

- [ ] Define backtest window: minimum 6 months of data
- [ ] Test across different market conditions (bull, bear, sideways)
- [ ] Calculate: Win Rate, Profit Factor, Max Drawdown, Sharpe Ratio
- [ ] Validate minimum range width filter reduces false breakouts
- [ ] Compare 5-min vs 15-min vs 30-min range windows on your asset
- [ ] Check performance on high-impact news days (consider excluding)
- [ ] Paper trade for at least 2 weeks before going live

---

## 9. Common Pitfalls

| Pitfall                     | Fix                                                      |
|-----------------------------|----------------------------------------------------------|
| False breakouts (wicks)     | Only enter on full candle CLOSE outside range            |
| Over-trading                | Strict 1 trade/day rule                                  |
| Too-tight ranges            | 0.2% min width filter                                    |
| News day blowups            | Calendar filter for high-impact events                   |
| Chasing breakouts           | Use stop-limit orders, not market orders on breakout     |
| Holding overnight           | Hard EOD close at 3:45 PM — no exceptions               |

---

## 10. Performance Metrics to Track

```python
metrics = {
    "total_trades":    int,
    "win_rate":        float,   # wins / total
    "profit_factor":  float,   # gross_profit / gross_loss
    "avg_rr":         float,   # average realized R:R
    "max_drawdown":   float,   # largest peak-to-trough loss
    "sharpe_ratio":   float,   # risk-adjusted returns
    "days_skipped":   int,     # due to narrow range filter
    "avg_orb_width":  float    # average daily range width
}
```

---

## References

- For multi-asset ORB (forex, futures, crypto), adapt `SESSION_OPEN` and `RANGE_LOCK` times
  to match the relevant session (e.g., London open for forex pairs).
- For **0DTE options ORB**, the entry is the same but position type changes — use
  debit spreads or short credit spreads at the breakout level.
- For **Indian markets (NSE)**: session opens 9:15 AM IST; use 9:15–9:45 AM as the 30-min window.
