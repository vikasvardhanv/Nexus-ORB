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

# --- Strategy Logic ---
MIN_RANGE_PCT = 0.002

def fetch_kraken_orb(symbol, minutes=30):
    print(f"[SCAN] Building {minutes}m range for {symbol} on Kraken...")
    url = f"https://api.kraken.com/0/public/OHLC?pair={symbol}&interval=1"
    resp = requests.get(url).json()
    
    if resp.get('error'):
        print(f"[ERROR] {resp['error']}")
        return None
        
    # Get the data for the specific pair
    pair_data = list(resp['result'].values())[0]
    # pair_data: [time, open, high, low, close, vwap, volume, count]
    # Last elements are the most recent. We want the last 'minutes' elements.
    recent = pair_data[-minutes:]
    
    highs = [float(k[2]) for k in recent]
    lows = [float(k[3]) for k in recent]
    
    orb_high = max(highs)
    orb_low = min(lows)
    orb_width = orb_high - orb_low
    ref_price = float(recent[-1][4])
    
    return {
        "high": orb_high,
        "low": orb_low,
        "width": orb_width,
        "ref_price": ref_price
    }

def place_kraken_order(symbol, side, qty, price, stop, target, api_key, api_secret):
    print(f"[EXEC] Placing {side.upper()} order on Kraken for {qty} {symbol}")
    
    # Simple market order for entry
    # Note: Kraken bracket orders are handled via separate 'stop-loss' and 'take-profit' orders 
    # linked together or managed by the bot. 
    data = {
        "nonce": str(int(time.time() * 1000)),
        "pair": symbol,
        "type": side,
        "ordertype": "market",
        "volume": str(qty),
        "oflags": "fciq" # forward cost in quote
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
        "price": str(stop),
        "volume": str(qty)
    }
    kraken_request('/0/private/AddOrder', sl_data, api_key, api_secret)
    
    # Place Take Profit
    tp_data = {
        "nonce": str(int(time.time() * 1000) + 2),
        "pair": symbol,
        "type": "sell" if side == "buy" else "buy",
        "ordertype": "take-profit",
        "price": str(target),
        "volume": str(qty)
    }
    kraken_request('/0/private/AddOrder', tp_data, api_key, api_secret)
    
    return resp

def run_strategy(api_key, api_secret, tickers, minutes, qty_usd):
    for ticker in tickers:
        # Kraken pairs often look like XXBTZUSD, but for API 'XBTUSD' or 'BTCUSD' works
        orb = fetch_kraken_orb(ticker, minutes)
        if not orb: continue
        
        print(f"[SCAN] {ticker} ORB: High {orb['high']} | Low {orb['low']}")
        
        if orb['width'] < (MIN_RANGE_PCT * orb['ref_price']):
            print(f"[SKIP] {ticker} range too tight.")
            continue

        print(f"[WAIT] Monitoring {ticker} for breakout...")
        while True:
            # Fetch latest price
            ticker_url = f"https://api.kraken.com/0/public/Ticker?pair={ticker}"
            tp_resp = requests.get(ticker_url).json()
            # c = [price, whole lot volume]
            price = float(list(tp_resp['result'].values())[0]['c'][0])
            
            if price > orb['high']:
                qty = round(qty_usd / price, 6)
                stop = round(orb['high'] - (orb['width'] / 2), 2)
                target = round(price + (orb['width'] * 1.5), 2)
                place_kraken_order(ticker, "buy", qty, price, stop, target, api_key, api_secret)
                break
            elif price < orb['low']:
                qty = round(qty_usd / price, 6)
                stop = round(orb['low'] + (orb['width'] / 2), 2)
                target = round(price - (orb['width'] * 1.5), 2)
                place_kraken_order(ticker, "sell", qty, price, stop, target, api_key, api_secret)
                break
            
            time.sleep(5)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--keys", type=str) # key:secret
    parser.add_argument("--tickers", type=str)
    parser.add_argument("--minutes", type=int, default=30)
    parser.add_argument("--qty_usd", type=float, default=100.0)
    
    args = parser.parse_args()
    api_key, api_secret = args.keys.split(":")
    tickers_list = args.tickers.split(",")
    
    run_strategy(api_key, api_secret, tickers_list, args.minutes, args.qty_usd)
