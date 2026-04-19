import os
import argparse
import time
import json
import math
import re
import urllib.request
import csv
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime, timedelta, time as dtime
from zoneinfo import ZoneInfo

import pandas as pd
from dotenv import load_dotenv

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, TakeProfitRequest, StopLossRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame

# --- Auto-load environment variables ---
# Look for .env in the backend directory or the root
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_ENV = BASE_DIR / "backend" / ".env"
ROOT_ENV = BASE_DIR / ".env"

if BACKEND_ENV.exists():
    load_dotenv(BACKEND_ENV)
elif ROOT_ENV.exists():
    load_dotenv(ROOT_ENV)

NY_TZ = ZoneInfo("America/New_York")
REGULAR_OPEN = dtime(9, 30)
REGULAR_CLOSE = dtime(16, 0)
FORCE_CLOSE = dtime(15, 45)

MIN_RANGE_PCT = 0.002
RVOL_THRESH = 1.5
RSI_LONG_MIN = 50
RSI_LONG_MAX = 70
RSI_SHORT_MIN = 30
RSI_SHORT_MAX = 50
RISK_PCT_DEFAULT = 0.005

NEWS_CACHE_PATH = Path(__file__).with_name("news_cache.json")
NEWS_CACHE_TTL_HOURS = 24
BACKTEST_OUT_DIR = Path(__file__).parent

@dataclass
class OrbRange:
    high: float
    low: float
    width: float
    volume: float
    ref_price: float
    date: datetime

@dataclass
class FvgSignal:
    side: str  # "buy" or "sell"
    breakout_time: datetime
    entry_time: datetime
    entry_price: float
    stop_price: float
    target_price: float

# Using Alpaca as the default broker
def get_alpaca_clients(paper_trading=True):
    """
    Initializes and returns the Alpaca REST API client.
    """
    api_key = os.getenv("ALPACA_API_KEY")
    api_secret = os.getenv("ALPACA_SECRET_KEY")

    if not api_key or not api_secret:
        raise ValueError("ALPACA_API_KEY and ALPACA_SECRET_KEY must be set in environment variables.")

    # Base URL is handled internally by alpaca-py based on 'paper' bool
    trading_client = TradingClient(api_key, api_secret, paper=paper_trading)
    data_client = StockHistoricalDataClient(api_key, api_secret)
    return trading_client, data_client

def _normalize_bars_df(bars_df, ticker):
    if bars_df.empty:
        return bars_df
    if hasattr(bars_df.index, "names") and "symbol" in bars_df.index.names:
        bars_df = bars_df.xs(ticker)
    if "symbol" in bars_df.columns:
        bars_df = bars_df[bars_df["symbol"] == ticker]
    if getattr(bars_df.index, "tz", None) is None:
        bars_df.index = bars_df.index.tz_localize("UTC")
    bars_df.index = bars_df.index.tz_convert(NY_TZ)
    return bars_df.sort_index()

def fetch_minute_bars(ticker, data_client, start, end):
    request_params = StockBarsRequest(
        symbol_or_symbols=ticker,
        timeframe=TimeFrame.Minute,
        start=start,
        end=end,
        limit=10000,
        feed='iex'  # EXPLICITLY USE IEX FOR FREE/PAPER ACCOUNTS
    )
    try:
        bars = data_client.get_stock_bars(request_params).df
        return _normalize_bars_df(bars, ticker)
    except Exception as e:
        print(f"Error fetching bars for {ticker}: {e}")
        return None

def get_latest_trading_day(bars_df):
    if bars_df.empty:
        return None
    bars_df = bars_df.between_time(REGULAR_OPEN, REGULAR_CLOSE)
    if bars_df.empty:
        return None
    dates = bars_df.index.normalize().unique()
    if len(dates) == 0:
        return None
    return max(dates)

def fetch_orb_range(ticker, data_client, orb_minutes=30, lookback_days=3):
    now_ny = datetime.now(NY_TZ)
    start = (now_ny - timedelta(days=lookback_days)).astimezone(ZoneInfo("UTC"))
    end = now_ny.astimezone(ZoneInfo("UTC"))

    bars_df = fetch_minute_bars(ticker, data_client, start, end)
    if bars_df is None or bars_df.empty:
        return None

    trading_day = get_latest_trading_day(bars_df)
    if trading_day is None:
        return None

    day_start = datetime.combine(trading_day.date(), REGULAR_OPEN, tzinfo=NY_TZ)
    orb_end = day_start + timedelta(minutes=orb_minutes)

    orb_df = bars_df[(bars_df.index >= day_start) & (bars_df.index < orb_end)]
    if orb_df.empty:
        return None

    high = float(orb_df["high"].max())
    low = float(orb_df["low"].min())
    width = high - low
    volume = float(orb_df["volume"].sum())
    ref_price = float(orb_df["close"].iloc[-1])
    return OrbRange(high=high, low=low, width=width, volume=volume, ref_price=ref_price, date=day_start)

def _is_bullish_fvg(c1, c2, c3):
    return c1["high"] < c3["low"]

def _is_bearish_fvg(c1, c2, c3):
    return c1["low"] > c3["high"]

def _calculate_vwap(candles: pd.DataFrame) -> pd.Series:
    tp = (candles["high"] + candles["low"] + candles["close"]) / 3
    return (tp * candles["volume"]).cumsum() / candles["volume"].cumsum()

def _calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def _calculate_rvol(volume: pd.Series, lookback: int = 20) -> pd.Series:
    avg_vol = volume.rolling(lookback).mean().shift(1)
    return volume / avg_vol

def _calculate_ema(series: pd.Series, span: int = 20) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()

def _fetch_url(url: str, timeout: int = 12) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")

def _parse_ics_events(ics_text: str):
    events = []
    current = {}
    for line in ics_text.splitlines():
        line = line.strip()
        if line == "BEGIN:VEVENT":
            current = {}
        elif line.startswith("SUMMARY:"):
            current["summary"] = line.split("SUMMARY:", 1)[1].strip()
        elif line.startswith("DTSTART"):
            parts = line.split(":", 1)
            if len(parts) == 2:
                current["dtstart"] = parts[1].strip()
        elif line == "END:VEVENT":
            if current:
                events.append(current)
            current = {}
    return events

def _date_from_ics(dtstart: str):
    if not dtstart:
        return None
    token = dtstart.strip()
    if "T" in token:
        token = token.split("T", 1)[0]
    try:
        return datetime.strptime(token[:8], "%Y%m%d").date()
    except ValueError:
        return None

def _fetch_bls_skip_dates():
    ics_url = "https://www.bls.gov/schedule/news_release/bls.ics"
    ics_text = _fetch_url(ics_url)
    events = _parse_ics_events(ics_text)
    skip = set()
    for ev in events:
        summary = (ev.get("summary") or "").lower()
        if "consumer price index" in summary or "employment situation" in summary:
            dt = _date_from_ics(ev.get("dtstart"))
            if dt:
                skip.add(dt)
    return skip

def _fetch_fomc_skip_dates():
    url = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
    html = _fetch_url(url)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\\s+", " ", text)

    month_map = {
        "jan": 1, "january": 1,
        "feb": 2, "february": 2,
        "mar": 3, "march": 3,
        "apr": 4, "april": 4,
        "may": 5,
        "jun": 6, "june": 6,
        "jul": 7, "july": 7,
        "aug": 8, "august": 8,
        "sep": 9, "sept": 9, "september": 9,
        "oct": 10, "october": 10,
        "nov": 11, "november": 11,
        "dec": 12, "december": 12,
    }

    current_year = datetime.now(NY_TZ).year
    years = [current_year, current_year + 1]
    skip = set()

    for year in years:
        marker = f"{year} FOMC Meetings"
        if marker not in text:
            continue
        segment = text.split(marker, 1)[1]
        next_marker = f"{year + 1} FOMC Meetings"
        if next_marker in segment:
            segment = segment.split(next_marker, 1)[0]

        for match in re.finditer(
            r"(Jan\\.?|January|Feb\\.?|February|Mar\\.?|March|Apr\\.?|April|May|Jun\\.?|June|Jul\\.?|July|Aug\\.?|August|Sep\\.?|Sept\\.?|September|Oct\\.?|October|Nov\\.?|November|Dec\\.?|December)\\s+(\\d{1,2})(?:\\s*[-–]\\s*(\\d{1,2}))?",
            segment,
        ):
            month_name = match.group(1).replace(".", "").lower()
            day_start = int(match.group(2))
            day_end = int(match.group(3)) if match.group(3) else day_start
            month = month_map.get(month_name[:3], month_map.get(month_name))
            if not month:
                continue
            for day in range(day_start, day_end + 1):
                try:
                    skip.add(datetime(year, month, day).date())
                except ValueError:
                    continue

    return skip

def load_news_skip_dates():
    now = datetime.now(NY_TZ)
    if NEWS_CACHE_PATH.exists():
        try:
            cached = json.loads(NEWS_CACHE_PATH.read_text())
            fetched_at = datetime.fromisoformat(cached.get("fetched_at"))
            if (now - fetched_at).total_seconds() < (NEWS_CACHE_TTL_HOURS * 3600):
                return {datetime.fromisoformat(d).date() for d in cached.get("dates", [])}
        except Exception:
            pass

    try:
        skip_dates = _fetch_bls_skip_dates().union(_fetch_fomc_skip_dates())
        NEWS_CACHE_PATH.write_text(
            json.dumps(
                {
                    "fetched_at": now.isoformat(),
                    "dates": sorted({d.isoformat() for d in skip_dates}),
                },
                indent=2,
            )
        )
        return skip_dates
    except Exception as e:
        print(f"Error fetching economic calendar: {e}")
        if NEWS_CACHE_PATH.exists():
            try:
                cached = json.loads(NEWS_CACHE_PATH.read_text())
                return {datetime.fromisoformat(d).date() for d in cached.get("dates", [])}
            except Exception:
                return set()
        return set()

def calculate_risk_quantity(signal, risk_pct, trading_client, max_qty):
    try:
        account = trading_client.get_account()
        equity = float(account.equity)
    except Exception as e:
        print(f"Error fetching account equity: {e}")
        return max_qty

    risk_amount = equity * risk_pct
    per_share_risk = abs(signal.entry_price - signal.stop_price)
    if per_share_risk <= 0:
        return 0

    qty = int(math.floor(risk_amount / per_share_risk))
    if max_qty:
        qty = min(qty, max_qty)
    return max(qty, 0)

def get_current_price(ticker, data_client):
    """Fetches the most recent price available (1-min bar close)."""
    now_ny = datetime.now(NY_TZ)
    start = (now_ny - timedelta(minutes=15)).astimezone(ZoneInfo("UTC"))
    end = now_ny.astimezone(ZoneInfo("UTC"))
    
    bars_df = fetch_minute_bars(ticker, data_client, start, end)
    if bars_df is not None and not bars_df.empty:
        return float(bars_df.iloc[-1]["close"])
    return None

def find_fvg_breakout_signal(bars_df, orb_range):
    if bars_df is None or bars_df.empty or orb_range is None:
        return None

    scan_start = orb_range.date + timedelta(minutes=5)
    scan_df = bars_df[(bars_df.index >= scan_start) & (bars_df.index.time <= REGULAR_CLOSE)]
    if len(scan_df) < 4:
        return None

    vwap = _calculate_vwap(scan_df)
    rsi = _calculate_rsi(scan_df["close"])
    rvol = _calculate_rvol(scan_df["volume"])
    ema20 = _calculate_ema(scan_df["close"], span=20)

    rows = list(scan_df.itertuples())
    for i in range(len(rows) - 3):
        c1 = rows[i]._asdict()
        c2 = rows[i + 1]._asdict()
        c3 = rows[i + 2]._asdict()
        c4 = rows[i + 3]._asdict()

        prev_close = c2["close"]
        breakout_time = rows[i + 2].Index
        idx = rows[i + 2].Index

        vwap_val = float(vwap.loc[idx]) if idx in vwap.index else None
        rsi_val = float(rsi.loc[idx]) if idx in rsi.index else None
        rvol_val = float(rvol.loc[idx]) if idx in rvol.index else None
        ema_val = float(ema20.loc[idx]) if idx in ema20.index else None
        ema_prev = float(ema20.iloc[i + 1]) if len(ema20) > (i + 1) else None

        if None in (vwap_val, rsi_val, rvol_val, ema_val, ema_prev):
            continue

        if (
            _is_bullish_fvg(c1, c2, c3)
            and c3["close"] > orb_range.high
            and prev_close <= orb_range.high
            and rvol_val >= RVOL_THRESH
            and c3["close"] > vwap_val
            and RSI_LONG_MIN <= rsi_val <= RSI_LONG_MAX
            and c3["close"] > ema_val
            and ema_val >= ema_prev
        ):
            entry_time = rows[i + 3].Index
            entry_price = float(c4["open"])
            stop_price = float(c3["low"])
            risk = entry_price - stop_price
            if risk <= 0:
                continue
            target_price = entry_price + (2 * risk)
            return FvgSignal(
                side="buy",
                breakout_time=breakout_time,
                entry_time=entry_time,
                entry_price=entry_price,
                stop_price=round(stop_price, 2),
                target_price=round(target_price, 2),
            )

        if (
            _is_bearish_fvg(c1, c2, c3)
            and c3["close"] < orb_range.low
            and prev_close >= orb_range.low
            and rvol_val >= RVOL_THRESH
            and c3["close"] < vwap_val
            and RSI_SHORT_MIN <= rsi_val <= RSI_SHORT_MAX
            and c3["close"] < ema_val
            and ema_val <= ema_prev
        ):
            entry_time = rows[i + 3].Index
            entry_price = float(c4["open"])
            stop_price = float(c3["high"])
            risk = stop_price - entry_price
            if risk <= 0:
                continue
            target_price = entry_price - (2 * risk)
            return FvgSignal(
                side="sell",
                breakout_time=breakout_time,
                entry_time=entry_time,
                entry_price=entry_price,
                stop_price=round(stop_price, 2),
                target_price=round(target_price, 2),
            )

    return None

def execute_trade(ticker, signal, quantity, trading_client):
    """
    Executes a BRACKET ORDER based on the hybrid ORB + FVG strategy.
    Stop is breakout candle extreme; target is fixed 2:1.
    """
    side = OrderSide.BUY if signal.side == "buy" else OrderSide.SELL
    print(f"[{datetime.now()}] EXECUTING {signal.side.upper()} order for {quantity} shares of {ticker}.")
    print(f"Entry~{signal.entry_price:.2f} | Stop={signal.stop_price:.2f} | Target={signal.target_price:.2f}")

    try:
        order_data = MarketOrderRequest(
            symbol=ticker,
            qty=quantity,
            side=side,
            time_in_force=TimeInForce.DAY,
            order_class="bracket",
            take_profit=TakeProfitRequest(limit_price=signal.target_price),
            stop_loss=StopLossRequest(stop_price=signal.stop_price)
        )
        order = trading_client.submit_order(order_data=order_data)
        return {
            "status": "success", 
            "order_id": str(order.id),
            "tp": signal.target_price,
            "sl": signal.stop_price,
            "ratio": "2:1"
        }
    except Exception as e:
        print(f"Error executing bracket trade: {e}")
        return {"status": "failed", "error": str(e)}

def _within_regular_hours(now_ny):
    return REGULAR_OPEN <= now_ny.time() <= REGULAR_CLOSE

def _compute_orb_range_for_day(day_df, day_start, orb_minutes):
    orb_end = day_start + timedelta(minutes=orb_minutes)
    orb_df = day_df[(day_df.index >= day_start) & (day_df.index < orb_end)]
    if orb_df.empty:
        return None
    high = float(orb_df["high"].max())
    low = float(orb_df["low"].min())
    width = high - low
    volume = float(orb_df["volume"].sum())
    ref_price = float(orb_df["close"].iloc[-1])
    return OrbRange(high=high, low=low, width=width, volume=volume, ref_price=ref_price, date=day_start)

def _simulate_trade(day_df, signal):
    exit_price = None
    exit_time = None
    reason = "eod"

    for idx, row in day_df[day_df.index >= signal.entry_time].iterrows():
        high = float(row["high"])
        low = float(row["low"])

        if signal.side == "buy":
            if low <= signal.stop_price:
                exit_price = signal.stop_price
                exit_time = idx
                reason = "stop"
                break
            if high >= signal.target_price:
                exit_price = signal.target_price
                exit_time = idx
                reason = "target"
                break
        else:
            if high >= signal.stop_price:
                exit_price = signal.stop_price
                exit_time = idx
                reason = "stop"
                break
            if low <= signal.target_price:
                exit_price = signal.target_price
                exit_time = idx
                reason = "target"
                break

        if idx.time() >= FORCE_CLOSE:
            exit_price = float(row["close"])
            exit_time = idx
            reason = "force_close"
            break

    if exit_price is None:
        last_row = day_df.iloc[-1]
        exit_price = float(last_row["close"])
        exit_time = day_df.index[-1]

    pnl_per_share = exit_price - signal.entry_price if signal.side == "buy" else signal.entry_price - exit_price
    per_share_risk = abs(signal.entry_price - signal.stop_price)
    r_multiple = pnl_per_share / per_share_risk if per_share_risk > 0 else 0.0

    return {
        "exit_price": exit_price,
        "exit_time": exit_time,
        "reason": reason,
        "pnl_per_share": pnl_per_share,
        "r_multiple": r_multiple,
    }

def backtest_strategy(ticker, data_client, orb_minutes, start_date, end_date, risk_pct, starting_equity, use_news_filter=True):
    start = datetime.combine(start_date, dtime(0, 0), tzinfo=NY_TZ).astimezone(ZoneInfo("UTC"))
    end = datetime.combine(end_date, dtime(23, 59), tzinfo=NY_TZ).astimezone(ZoneInfo("UTC"))

    bars_df = fetch_minute_bars(ticker, data_client, start, end)
    if bars_df is None or bars_df.empty:
        return {"error": "no_data"}

    skip_dates = load_news_skip_dates() if use_news_filter else set()
    equity = starting_equity
    peak = equity
    max_dd = 0.0
    trades = []
    days_skipped = 0
    orb_widths = []

    for day, day_df in bars_df.groupby(bars_df.index.normalize()):
        day_date = day.date()
        if use_news_filter and day_date in skip_dates:
            days_skipped += 1
            continue

        day_start = datetime.combine(day_date, REGULAR_OPEN, tzinfo=NY_TZ)
        day_df = day_df.between_time(REGULAR_OPEN, REGULAR_CLOSE)
        if day_df.empty:
            continue

        orb_range = _compute_orb_range_for_day(day_df, day_start, orb_minutes)
        if orb_range is None:
            continue
        orb_widths.append(orb_range.width)

        if orb_range.width < (MIN_RANGE_PCT * orb_range.ref_price):
            days_skipped += 1
            continue

        signal = find_fvg_breakout_signal(day_df, orb_range)
        if not signal:
            continue

        per_share_risk = abs(signal.entry_price - signal.stop_price)
        if per_share_risk <= 0:
            continue

        risk_amount = equity * risk_pct
        qty = int(math.floor(risk_amount / per_share_risk))
        if qty < 1:
            continue

        outcome = _simulate_trade(day_df, signal)
        pnl = outcome["pnl_per_share"] * qty
        equity += pnl
        peak = max(peak, equity)
        dd = (peak - equity)
        max_dd = max(max_dd, dd)

        trades.append({
            "date": day_date.isoformat(),
            "side": signal.side,
            "entry_time": signal.entry_time.isoformat(),
            "entry_price": signal.entry_price,
            "stop_price": signal.stop_price,
            "target_price": signal.target_price,
            "exit_time": outcome["exit_time"].isoformat(),
            "exit_price": outcome["exit_price"],
            "qty": qty,
            "pnl": pnl,
            "r_multiple": outcome["r_multiple"],
            "reason": outcome["reason"],
            "equity": equity,
        })

    wins = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] < 0]
    total_trades = len(trades)
    win_rate = (len(wins) / total_trades) if total_trades else 0.0
    gross_profit = sum(t["pnl"] for t in wins)
    gross_loss = abs(sum(t["pnl"] for t in losses)) if losses else 0.0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else 0.0
    avg_rr = sum(t["r_multiple"] for t in trades) / total_trades if total_trades else 0.0
    avg_orb_width = sum(orb_widths) / len(orb_widths) if orb_widths else 0.0

    metrics = {
        "ticker": ticker,
        "total_trades": total_trades,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "avg_rr": avg_rr,
        "max_drawdown": max_dd,
        "days_skipped": days_skipped,
        "avg_orb_width": avg_orb_width,
        "starting_equity": starting_equity,
        "ending_equity": equity,
    }

    return {"metrics": metrics, "trades": trades}

def write_backtest_results(ticker, results):
    run_id = datetime.now(NY_TZ).strftime("%Y%m%d_%H%M%S")
    trades_path = BACKTEST_OUT_DIR / f"backtest_trades_{ticker}_{run_id}.csv"
    metrics_path = BACKTEST_OUT_DIR / f"backtest_metrics_{ticker}_{run_id}.json"

    trades = results.get("trades", [])
    if trades:
        with trades_path.open("w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=trades[0].keys())
            writer.writeheader()
            writer.writerows(trades)

    metrics = results.get("metrics", {})
    metrics_path.write_text(json.dumps(metrics, indent=2))
    return str(trades_path), str(metrics_path)

def run_strategy(tickers, max_quantity, orb_minutes, paper_trading, live_mode=False, poll_seconds=60, risk_pct=RISK_PCT_DEFAULT, use_news_filter=True):
    print(f"[{datetime.now()}] Starting HYBRID ORB+FVG ({orb_minutes}-min) Strategy for {tickers}")
    print(f"Environment: {'PAPER' if paper_trading else 'LIVE'}")
    
    trading_client, data_client = get_alpaca_clients(paper_trading)
    skip_dates = load_news_skip_dates() if use_news_filter else set()
    results = []

    for ticker in tickers:
        print(f"\n--- Processing {ticker} ---")
        traded = False
        
        while True:
            now_ny = datetime.now(NY_TZ)
            if not _within_regular_hours(now_ny):
                if live_mode and now_ny.time() < REGULAR_OPEN:
                    sleep_seconds = max(
                        5,
                        int((datetime.combine(now_ny.date(), REGULAR_OPEN, tzinfo=NY_TZ) - now_ny).total_seconds())
                    )
                    print(f"[{datetime.now()}] Waiting for market open... ({sleep_seconds}s)")
                    time.sleep(min(sleep_seconds, poll_seconds))
                    continue
                results.append({"ticker": ticker, "signal": "NO_TRADE", "reason": "outside_regular_hours"})
                break

            orb_range = fetch_orb_range(ticker, data_client, orb_minutes)
            if not orb_range:
                print(f"Unable to fetch opening range for {ticker}.")
                if live_mode:
                    time.sleep(poll_seconds)
                    continue
                results.append({"ticker": ticker, "status": "ERROR", "reason": "missing_orb_data"})
                break

            if use_news_filter and orb_range.date.date() in skip_dates:
                print(f"[{datetime.now()}] News filter: skipping {ticker} on {orb_range.date.date()}.")
                results.append({"ticker": ticker, "signal": "NO_TRADE", "reason": "news_filter"})
                break

            if orb_range.width < (MIN_RANGE_PCT * orb_range.ref_price):
                print(
                    f"[{datetime.now()}] ORB too narrow for {ticker}: width={orb_range.width:.4f} "
                    f"ref={orb_range.ref_price:.2f}. Skipping."
                )
                results.append({"ticker": ticker, "signal": "NO_TRADE", "reason": "orb_too_narrow"})
                break

            print(f"Range High: {orb_range.high} | Range Low: {orb_range.low} | Width: {orb_range.width:.4f}")

            start = (orb_range.date - timedelta(minutes=1)).astimezone(ZoneInfo("UTC"))
            end = now_ny.astimezone(ZoneInfo("UTC"))
            bars_df = fetch_minute_bars(ticker, data_client, start, end)
            signal = find_fvg_breakout_signal(bars_df, orb_range)

            if signal:
                qty = calculate_risk_quantity(signal, risk_pct, trading_client, max_quantity)
                if qty < 1:
                    print(f"[{datetime.now()}] Risk sizing produced qty<1 for {ticker}. Skipping trade.")
                    results.append({"ticker": ticker, "signal": "NO_TRADE", "reason": "size_too_small"})
                    break
                trade_status = execute_trade(ticker, signal, qty, trading_client)
                results.append({
                    "ticker": ticker,
                    "signal": signal.side.upper(),
                    "entry_price": signal.entry_price,
                    "stop_price": signal.stop_price,
                    "target_price": signal.target_price,
                    "quantity": qty,
                    "breakout_time": signal.breakout_time.isoformat(),
                    "entry_time": signal.entry_time.isoformat(),
                    "trade": trade_status
                })
                traded = True
                break

            if not live_mode:
                results.append({"ticker": ticker, "signal": "NO_TRADE", "reason": "no_signal"})
                break

            if now_ny.time() >= FORCE_CLOSE:
                if traded:
                    try:
                        trading_client.close_position(ticker)
                    except Exception as e:
                        print(f"Error force-closing {ticker}: {e}")
                results.append({"ticker": ticker, "signal": "NO_TRADE", "reason": "force_close"})
                break

            if now_ny.time() >= REGULAR_CLOSE:
                results.append({"ticker": ticker, "signal": "NO_TRADE", "reason": "session_ended"})
                break

            print(f"[{datetime.now()}] No signal yet for {ticker}. Polling again in {poll_seconds}s...")
            time.sleep(poll_seconds)

    return json.dumps(results, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nexus One-Candle 'Power' Strategy")
    parser.add_argument("--tickers", type=str, required=True)
    parser.add_argument("--quantity", type=int, default=10)
    parser.add_argument("--minutes", type=int, default=5, help="Opening candle duration (default: 5)")
    parser.add_argument("--paper", type=str, default="True", help="Set to 'False' for live trading (default: True)")
    parser.add_argument("--live", action="store_true", help="Poll every minute for live signal until close")
    parser.add_argument("--poll-seconds", type=int, default=60, help="Polling interval in seconds for live mode")
    parser.add_argument("--risk-pct", type=float, default=RISK_PCT_DEFAULT, help="Risk per trade as percent of equity (default: 0.5%)")
    parser.add_argument("--no-news-filter", action="store_true", help="Disable economic calendar news filter")
    parser.add_argument("--backtest", action="store_true", help="Run backtest instead of live trading")
    parser.add_argument("--backtest-start", type=str, help="Backtest start date (YYYY-MM-DD)")
    parser.add_argument("--backtest-end", type=str, help="Backtest end date (YYYY-MM-DD)")
    parser.add_argument("--backtest-equity", type=float, default=100000.0, help="Starting equity for backtest")

    args = parser.parse_args()
    
    is_paper = args.paper.lower() != "false"
    tickers_list = [t.strip() for t in args.tickers.split(",")]

    if args.backtest:
        if not args.backtest_start or not args.backtest_end:
            raise ValueError("--backtest-start and --backtest-end are required for backtest mode.")
        start_date = datetime.strptime(args.backtest_start, "%Y-%m-%d").date()
        end_date = datetime.strptime(args.backtest_end, "%Y-%m-%d").date()

        _, data_client = get_alpaca_clients(is_paper)
        for ticker in tickers_list:
            results = backtest_strategy(
                ticker=ticker,
                data_client=data_client,
                orb_minutes=args.minutes,
                start_date=start_date,
                end_date=end_date,
                risk_pct=args.risk_pct,
                starting_equity=args.backtest_equity,
                use_news_filter=not args.no_news_filter,
            )
            trades_path, metrics_path = write_backtest_results(ticker, results)
            print(f"\nBacktest complete for {ticker}.")
            print(f"Trades: {trades_path}")
            print(f"Metrics: {metrics_path}")
    else:
        output = run_strategy(
            tickers_list,
            args.quantity,
            args.minutes,
            is_paper,
            args.live,
            args.poll_seconds,
            args.risk_pct,
            not args.no_news_filter,
        )
        print("\n--- JSON OUTPUT ---")
        print(output)
