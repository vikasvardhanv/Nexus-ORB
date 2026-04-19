import os
from dotenv import load_dotenv
import requests

load_dotenv() # Load keys from .env


import subprocess
import signal
import threading
from typing import Optional, List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path

app = FastAPI(title="Nexus-ORB Bridge API")

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to track the trading process
class ProcessManager:
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.logs: List[str] = []
        self.max_logs = 1000
        self.lock = threading.Lock()
        self.keyId: Optional[str] = None
        self.secret: Optional[str] = None
        self.mode: str = "paper"
        self.broker: str = "alpaca"

    def add_log(self, line: str):
        with self.lock:
            self.logs.append(line)
            if len(self.logs) > self.max_logs:
                self.logs.pop(0)

    def read_output(self):
        if not self.process:
            return
        
        for line in iter(self.process.stdout.readline, ""):
            if line:
                self.add_log(line.strip())
            if self.process.poll() is not None:
                break
        
        self.add_log("[SYSTEM] Process terminated.")

manager = ProcessManager()

class TradeConfig(BaseModel):
    keyId: str
    secret: str
    tickers: str = "SPY,QQQ,AAPL,TSLA"
    quantity: int = 10
    mode: str = "paper"
    risk_pct: float = 0.5
    minutes: int = 30
    broker: str = "alpaca" # alpaca | kraken

@app.get("/status")
def get_status():
    is_running = manager.process is not None and manager.process.poll() is None
    return {
        "status": "running" if is_running else "idle",
        "pid": manager.process.pid if is_running else None
    }

@app.post("/start")
def start_trading(config: TradeConfig, background_tasks: BackgroundTasks):
    if manager.process and manager.process.poll() is None:
        raise HTTPException(status_code=400, detail="Trading process already running")

    manager.logs = ["[SYSTEM] Starting Nexus-ORB Core..."]
    manager.keyId = config.keyId if config.keyId else os.getenv("APCA-API-KEY-ID")
    manager.secret = config.secret if config.secret else os.getenv("APCA-API-SECRET-KEY")
    
    if not manager.keyId or not manager.secret:
         raise HTTPException(status_code=400, detail="Missing API keys in request and .env")

    manager.mode = config.mode

    manager.broker = config.broker
    
    if config.broker == "kraken":
        script_name = "kraken_orb_trading.py"
    else:
        script_name = "orb_30min_trading.py"

    script_path = Path(__file__).parent / "execution" / script_name
    if not script_path.exists():
        raise HTTPException(status_code=500, detail=f"Trading script not found at {script_path}")

    # Prepare command
    if config.broker == "kraken":
        cmd = [
            "python3", str(script_path),
            "--keys", f"{config.keyId}:{config.secret}",
            "--tickers", config.tickers,
            "--minutes", str(config.minutes),
            "--qty_usd", str(config.quantity * 10)
        ]
    else:
        cmd = [
            "python3", str(script_path),
            "--tickers", config.tickers,
            "--quantity", str(config.quantity),
            "--minutes", str(config.minutes),
            "--paper", "true" if config.mode == "paper" else "false",
            "--risk-pct", str(config.risk_pct / 100),
            "--live"
        ]

    # Environment variables
    env = os.environ.copy()
    env["ALPACA_API_KEY"] = config.keyId
    env["ALPACA_SECRET_KEY"] = config.secret

    try:
        manager.process = subprocess.Popen(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        # Start log reading thread
        thread = threading.Thread(target=manager.read_output, daemon=True)
        thread.start()
        
        return {"message": "Trading started", "pid": manager.process.pid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stop")
def stop_trading():
    if not manager.process or manager.process.poll() is not None:
        return {"message": "No process running"}

    try:
        manager.process.terminate()
        manager.process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        manager.process.kill()
    
    manager.process = None
    return {"message": "Trading stopped"}

@app.get("/logs")
def get_logs():
    with manager.lock:
        return {"logs": manager.logs}

@app.post("/validate")
def validate_creds(config: TradeConfig):
    try:
        if config.broker == "alpaca":
            key_id = config.keyId if config.keyId else os.getenv("APCA-API-KEY-ID")
            secret = config.secret if config.secret else os.getenv("APCA-API-SECRET-KEY")
            
            if not key_id or not secret:
                 raise HTTPException(status_code=400, detail="Missing Alpaca keys")

            url = f"{config.tradingUrl}/v2/account"
            headers = {
                "APCA-API-KEY-ID": key_id,
                "APCA-API-SECRET-KEY": secret
            }
            res = requests.get(url, headers=headers)

            if res.status_code == 200:
                return res.json()
            else:
                raise HTTPException(status_code=res.status_code, detail=res.text)
        else:
            # Kraken validation
            import hashlib
            import hmac
            import base64
            import time
            import requests

            def get_kraken_signature(urlpath, data, secret):
                postdata = requests.compat.urlencode(data)
                encoded = (str(data['nonce']) + postdata).encode()
                message = urlpath.encode() + hashlib.sha256(encoded).digest()
                mac = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
                sigdigest = base64.b64encode(mac.digest())
                return sigdigest.decode()

            nonce = str(int(time.time() * 1000))
            data = {"nonce": nonce}
            headers = {
                'API-Key': config.keyId,
                'API-Sign': get_kraken_signature('/0/private/Balance', data, config.secret)
            }
            res = requests.post('https://api.kraken.com/0/private/Balance', headers=headers, data=data)
            resp_json = res.json()
            if resp_json.get("error") and len(resp_json["error"]) > 0:
                raise HTTPException(status_code=401, detail=str(resp_json["error"]))
            return {"status": "success", "result": resp_json.get("result", {})}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/positions")
def get_positions():
    if not manager.keyId or not manager.secret:
        return {"positions": []}
    
    try:
        if manager.broker == "alpaca":
            from alpaca.trading.client import TradingClient
            client = TradingClient(manager.keyId, manager.secret, paper=(manager.mode == "paper"))
            positions = client.get_all_positions()
            return {
                "positions": [
                    {
                        "symbol": p.symbol,
                        "qty": p.qty,
                        "avg_entry_price": p.avg_entry_price,
                        "current_price": p.current_price,
                        "unrealized_pl": p.unrealized_pl,
                        "unrealized_plpc": p.unrealized_plpc,
                        "side": p.side
                    } for p in positions
                ]
            }
        else:
            # Kraken positions
            import hashlib
            import hmac
            import base64
            import time
            import requests

            def get_kraken_signature(urlpath, data, secret):
                postdata = requests.compat.urlencode(data)
                encoded = (str(data['nonce']) + postdata).encode()
                message = urlpath.encode() + hashlib.sha256(encoded).digest()
                mac = hmac.new(base64.b64decode(secret), message, hashlib.sha512)
                sigdigest = base64.b64encode(mac.digest())
                return sigdigest.decode()

            nonce = str(int(time.time() * 1000))
            data = {"nonce": nonce, "docalcs": "true"}
            headers = {
                'API-Key': manager.keyId,
                'API-Sign': get_kraken_signature('/0/private/OpenPositions', data, manager.secret)
            }
            resp = requests.post('https://api.kraken.com/0/private/OpenPositions', headers=headers, data=data).json()
            
            # resp['result'] is a dict with position_id as key
            pos_dict = resp.get("result", {})
            return {
                "positions": [
                    {
                        "symbol": p["pair"],
                        "qty": p["vol"],
                        "avg_entry_price": p["cost"], # this is total cost, need to divide by vol
                        "current_price": 0, # Ticker needed for current price
                        "unrealized_pl": p["net"],
                        "unrealized_plpc": 0,
                        "side": p["type"]
                    } for pid, p in pos_dict.items()
                ]
            }
    except Exception as e:
        return {"positions": [], "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
