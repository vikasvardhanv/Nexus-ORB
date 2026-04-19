import os
import time
import argparse
import json
import base64
import hashlib
import hmac
import requests
from datetime import datetime, timedelta

# --- Kraken API Helpers ---
def get_kraken_signature(urlpath, data, secret):
    postdata = requests.compat.urlencode(data)
    encoded = (str(data['nonce']) + postdata).encode()
    message = urlpath.encode() + hashlib.sha256(encoded).digest()
    mac = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
    sigdigest = base64.b64encode(mac.digest())
    return sigdigest.decode()

def kraken_request(uri, data, api_key, api_secret):
    headers = {
        'API-Key': api_key,
        'API-Sign': get_kraken_signature(uri, data, api_secret)
    }
    url = f"https://api.kraken.com{uri}"
    resp = requests.post(url, headers=headers, data=data)
    return resp.json()

# --- Strategy Config ---
# Crypto trades at much tighter spreads than stocks.
# 0.04% is the minimum viable range for crypto (stocks use 0.2%)
MIN_RANGE_PCT = 0.0004
SCAN_INTERVAL_S = 30  # Re-scan every 30s when all ranges are tight

def fetch_kraken_orb(symbol, minutes=30):
    print(f"[SCAN] Building {minutes}m range for {symbol} on Kraken...")
    url = f"https://api.kraken.com/0/public/OHLC?pair={symbol}&interval=1"
    resp = requests.get(url).json()

    if resp.get('error'):
        print(f"[ERROR] {resp['error']}")
        return None

    pair_data = list(resp['result'].values())[0]
    recent = pair_data[-minutes:]

    highs = [float(k[2]) for k in recent]
    lows  = [float(k[3]) for k in recent]

    orb_high  = max(highs)
    orb_low   = min(lows)
    orb_width = orb_high - orb_low
    ref_price = float(recent[-1][4])
    range_pct = (orb_width / ref_price) * 100

    return {
        "high": orb_high,
        "low": orb_low,
        "width": orb_width,
        "ref_price": ref_price,
        "range_pct": range_pct
    }

def place_kraken_order(symbol, side, qty, price, stop, target, api_key, api_secret):
    print(f"[EXEC] Placing {side.upper()} order on Kraken for {qty} {symbol}")

    data = {
        "nonce": str(int(time.time() * 1000)),
        "pair": symbol,
        "type": side,
        "ordertype": "market",
        "volume": str(qty),
        "oflags": "fciq"
    }

    resp = kraken_request('/0/private/AddOrder', data, api_key, api_secret)
    if resp.get('error'):
        print(f"[ERROR] Entry Order failed: {resp['error']}")
        return None

    print(f"[SUCCESS] {side.upper()} order placed. ID: {resp['result']['txid']}")

    # Place Stop Loss
    sl_data = {
        "nonce": str(int(time.time() * 1000) + 1),
        "pair": symbol,
        "type": "sell" if side == "buy" else "buy",
        "ordertype": "stop-loss",
        "price": str(round(stop, 6)),
        "volume": str(qty)
    }
    kraken_request('/0/private/AddOrder', sl_data, api_key, api_secret)
    print(f"[SL] Stop-loss set at {stop:.6f}")

    # Place Take Profit
    tp_data = {
        "nonce": str(int(time.time() * 1000) + 2),
        "pair": symbol,
        "type": "sell" if side == "buy" else "buy",
        "ordertype": "take-profit",
        "price": str(round(target, 6)),
        "volume": str(qty)
    }
    kraken_request('/0/private/AddOrder', tp_data, api_key, api_secret)
    print(f"[TP] Take-profit set at {target:.6f}")

    return resp

def monitor_for_breakout(ticker, orb, qty_usd, api_key, api_secret):
    """Watch a ticker tick-by-tick for a breakout above/below ORB."""
    print(f"[WATCH] {ticker} | ORB High: {orb['high']:.6f} | ORB Low: {orb['low']:.6f} | Range: {orb['range_pct']:.4f}%")
    while True:
        try:
            ticker_url = f"https://api.kraken.com/0/public/Ticker?pair={ticker}"
            tp_resp = requests.get(ticker_url).json()
            price = float(list(tp_resp['result'].values())[0]['c'][0])

            if price > orb['high']:
                print(f"[SIGNAL] {ticker} BREAKOUT LONG @ {price:.6f} (above ORB high {orb['high']:.6f})")
                qty    = round(qty_usd / price, 6)
                stop   = round(orb['high'] - orb['width'], 6)
                target = round(price + (orb['width'] * 2), 6)
                place_kraken_order(ticker, "buy", qty, price, stop, target, api_key, api_secret)
                return  # Done with this ticker

            elif price < orb['low']:
                print(f"[SIGNAL] {ticker} BREAKDOWN SHORT @ {price:.6f} (below ORB low {orb['low']:.6f})")
                qty    = round(qty_usd / price, 6)
                stop   = round(orb['low'] + orb['width'], 6)
                target = round(price - (orb['width'] * 2), 6)
                place_kraken_order(ticker, "sell", qty, price, stop, target, api_key, api_secret)
                return  # Done with this ticker

            else:
                print(f"[WAIT] {ticker} @ {price:.6f} | Inside ORB [{orb['low']:.6f} – {orb['high']:.6f}]")
                time.sleep(5)

        except Exception as e:
            print(f"[ERROR] Monitoring {ticker}: {e}")
            time.sleep(10)

def run_strategy(api_key, api_secret, tickers, minutes, qty_usd):
    print(f"[CONFIG] Scanning {len(tickers)} pairs | ORB window: {minutes}m | Position: ${qty_usd} USD each")
    print(f"[CONFIG] Min range filter: {MIN_RANGE_PCT*100:.3f}% (crypto-tuned, was 0.2% for stocks)")

    while True:
        valid_orbs = []

        for ticker in tickers:
            orb = fetch_kraken_orb(ticker, minutes)
            if not orb:
                continue

            print(f"[SCAN] {ticker} ORB: High {orb['high']:.6f} | Low {orb['low']:.6f} | Range: {orb['range_pct']:.4f}%")

            if orb['width'] < (MIN_RANGE_PCT * orb['ref_price']):
                print(f"[WAIT] {ticker} range {orb['range_pct']:.4f}% is tight — will re-check in {SCAN_INTERVAL_S}s.")
            else:
                print(f"[READY] {ticker} qualifies ({orb['range_pct']:.4f}%). Entering breakout watch mode.")
                valid_orbs.append((ticker, orb))

        if valid_orbs:
            for ticker, orb in valid_orbs:
                monitor_for_breakout(ticker, orb, qty_usd, api_key, api_secret)
        else:
            print(f"[STANDBY] All {len(tickers)} pairs have tight ranges. Re-scanning in {SCAN_INTERVAL_S}s...")
            time.sleep(SCAN_INTERVAL_S)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--keys", type=str)
    parser.add_argument("--tickers", type=str)
    parser.add_argument("--minutes", type=int, default=30)
    parser.add_argument("--qty_usd", type=float, default=100.0)

    args = parser.parse_args()
    api_key, api_secret = args.keys.split(":")
    tickers_list = args.tickers.split(",")

    run_strategy(api_key, api_secret, tickers_list, args.minutes, args.qty_usd)
