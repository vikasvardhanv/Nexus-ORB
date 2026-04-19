import os
import time
import argparse
import json
from datetime import datetime, timedelta
from pybit.unified_trading import HTTP

# --- Logic Constants ---
RVOL_THRESH = 1.5
MIN_RANGE_PCT = 0.002

def get_bybit_client(api_key, api_secret, testnet=True):
    return HTTP(
        testnet=testnet,
        api_key=api_key,
        api_secret=api_secret,
    )

def fetch_orb_range(client, symbol, minutes=30):
    print(f"[SCAN] Building {minutes}m range for {symbol}...")
    
    # Get Klines (category="linear" for USDT Perpetual)
    # We want the 'minutes' duration starting from the current session
    now = int(time.time() * 1000)
    start_time = now - (minutes * 60 * 1000)
    
    try:
        resp = client.get_kline(
            category="linear",
            symbol=symbol,
            interval="1",
            start=start_time,
            limit=minutes
        )
        klines = resp.get("result", {}).get("list", [])
        if not klines:
            return None
            
        # klines: [startTime, open, high, low, close, volume, turnover]
        highs = [float(k[2]) for k in klines]
        lows = [float(k[3]) for k in klines]
        
        orb_high = max(highs)
        orb_low = min(lows)
        orb_width = orb_high - orb_low
        ref_price = float(klines[0][4]) # Close of latest candle
        
        return {
            "high": orb_high,
            "low": orb_low,
            "width": orb_width,
            "ref_price": ref_price
        }
    except Exception as e:
        print(f"[ERROR] Failed to fetch klines: {e}")
        return None

def place_bracket_order(client, symbol, side, qty, entry, stop, target):
    print(f"[EXEC] Placing {side.upper()} order for {qty} {symbol}")
    print(f"Entry: ~{entry} | SL: {stop} | TP: {target}")
    
    try:
        # On Bybit Unified, we can set TP/SL during order placement
        resp = client.place_order(
            category="linear",
            symbol=symbol,
            side=side.capitalize(), # "Buy" or "Sell"
            orderType="Market",
            qty=str(qty),
            takeProfit=str(target),
            stopLoss=str(stop),
            tpTriggerBy="MarkPrice",
            slTriggerBy="MarkPrice",
            tpslMode="Full",
            timeInForce="GTC"
        )
        return resp
    except Exception as e:
        print(f"[ERROR] Order failed: {e}")
        return None

def run_strategy(api_key, api_secret, tickers, minutes, testnet, qty_usd):
    client = get_bybit_client(api_key, api_secret, testnet)
    
    for ticker in tickers:
        orb = fetch_orb_range(client, ticker, minutes)
        if not orb:
            continue
            
        print(f"[SCAN] {ticker} ORB Locked: High {orb['high']} | Low {orb['low']}")
        
        if orb['width'] < (MIN_RANGE_PCT * orb['ref_price']):
            print(f"[SKIP] {ticker} range too tight.")
            continue
            
        # Monitoring loop
        print(f"[WAIT] Monitoring {ticker} for breakout...")
        while True:
            try:
                # get latest price
                ticker_resp = client.get_tickers(category="linear", symbol=ticker)
                price = float(ticker_resp['result']['list'][0]['lastPrice'])
                
                # Bullish Breakout
                if price > orb['high']:
                    # Calculate qty (qty_usd / price)
                    qty = round(qty_usd / price, 3) 
                    stop = round(orb['high'] - (orb['width'] / 2), 4) # Midpoint SL
                    target = round(price + (orb['width'] * 1.5), 4) # 1.5x R target
                    
                    place_bracket_order(client, ticker, "buy", qty, price, stop, target)
                    break
                    
                # Bearish Breakout
                elif price < orb['low']:
                    qty = round(qty_usd / price, 3)
                    stop = round(orb['low'] + (orb['width'] / 2), 4)
                    target = round(price - (orb['width'] * 1.5), 4)
                    
                    place_bracket_order(client, ticker, "sell", qty, price, stop, target)
                    break
                    
                time.sleep(2) # Poll every 2 seconds
            except Exception as e:
                print(f"[ERROR] Loop error: {e}")
                time.sleep(10)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--keys", type=str) # key:secret
    parser.add_argument("--tickers", type=str)
    parser.add_argument("--minutes", type=int, default=30)
    parser.add_argument("--testnet", type=str, default="true")
    parser.add_argument("--qty_usd", type=float, default=100.0)
    
    args = parser.parse_args()
    
    api_key, api_secret = args.keys.split(":")
    tickers_list = args.tickers.split(",")
    is_testnet = args.testnet.lower() == "true"
    
    run_strategy(api_key, api_secret, tickers_list, args.minutes, is_testnet, args.qty_usd)
