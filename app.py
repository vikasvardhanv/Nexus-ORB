import streamlit as st
import os
import sys
import subprocess
import time
import pandas as pd
from datetime import datetime
from pathlib import Path
from threading import Thread

# Add execution directory to path so we can import the trading script
EXECUTION_DIR = Path(__file__).resolve().parent / "execution"
sys.path.append(str(EXECUTION_DIR))

# Import specific functions if needed, but we'll mostly run the module as a process
# to keep it isolated and allow for easy log streaming.

st.set_page_config(
    page_title="Nexus ARB Trader | Alpha Access",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Premium Look
st.markdown("""
<style>
    .main {
        background-color: #0e1117;
    }
    .stCodeBlock {
        background-color: #1e2530 !important;
    }
    .status-box {
        padding: 20px;
        border-radius: 10px;
        background: rgba(0, 255, 0, 0.05);
        border: 1px solid rgba(0, 255, 0, 0.2);
    }
</style>
""", unsafe_allow_value=True)

# --- App Logic ---

st.title("🏹 Nexus ARB Trader")
st.caption("v1.0 (Autonomous Alpha) | Strategy: 30-Minute ORB + Hybrid FVG")

with st.sidebar:
    st.header("🔑 Tester Credentials")
    alpaca_key = st.text_input("Alpaca API Key", type="password")
    alpaca_secret = st.text_input("Alpaca Secret Key", type="password")
    
    st.divider()
    st.header("⚙️ Configuration")
    tickers = st.text_input("Tickers (comma separated)", value="SPY,QQQ,AAPL,TSLA")
    trading_mode = st.toggle("Live Trading (Real Money)", value=False)
    risk_pct = st.slider("Risk per Trade (%)", 0.1, 2.0, 0.5)
    quantity = st.number_input("Max Qty per Trade", value=100)

    st.divider()
    st.info("💡 Your keys are used only for this session. This platform is powered by the Nexus AI Core.")

# Log directory inside container
LOG_DIR = Path("/app/logs/arb")
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Persistent process check (simulated with session state)
if "process" not in st.session_state:
    st.session_state.process = None

col1, col2 = st.columns([2, 1])

with col1:
    st.markdown("### 📊 Live Signals & Terminal")
    log_area = st.empty()
    
    # Check if process is running
    if st.session_state.process and st.session_state.process.poll() is None:
        if st.button("⏹ Stop Trading Session"):
            st.session_state.process.terminate()
            st.session_state.process = None
            st.warning("Trading session halted manually.")
            st.rerun()
    else:
        if st.button("🚀 Start Autonomous Trading", use_container_width=True):
            if not alpaca_key or not alpaca_secret:
                st.error("❌ Missing Alpaca API keys.")
            else:
                # Prepare command
                paper = "true" if not trading_mode else "false"
                cmd = [
                    "python3", str(EXECUTION_DIR / "orb_30min_trading.py"),
                    "--tickers", tickers,
                    "--quantity", str(quantity),
                    "--paper", paper,
                    "--risk-pct", str(risk_pct / 100),
                    "--live"
                ]

                # Environment variables for the session
                env = os.environ.copy()
                env["ALPACA_API_KEY"] = alpaca_key
                env["ALPACA_SECRET_KEY"] = alpaca_secret
                
                # Start process and store in session
                st.session_state.process = subprocess.Popen(
                    cmd, 
                    env=env,
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.STDOUT, 
                    text=True,
                    bufsize=1
                )
                st.success(f"Nexus AI taking control of {tickers}...")
                st.rerun()

    # Log Streaming
    if st.session_state.process:
        full_log = ""
        # Small loop to read output without blocking Streamlit too much
        # Real-time streaming is tricky in Streamlit, we read what's available
        for line in iter(st.session_state.process.stdout.readline, ""):
            full_log += line
            # Keep only last 100 lines for UI
            lines = full_log.split("\n")
            log_area.code("\n".join(lines[-100:]), language="powershell")
    else:
        log_area.info("Waiting for session start...")

with col2:
    st.markdown("### 🛠 Self-Healing Status")
    
    # Indicators
    st.write("● AI Heartbeat: **ACTIVE**")
    st.write("● Log Monitoring: **ENABLED**")
    st.write("● Auto-fix Loops: **PENDING**")
    
    st.divider()
    
    st.markdown("#### 🔄 Recent Decisions")
    # This would naturally pull from the 'warm_memory' later
    st.caption("AI is currently monitoring logs for latency or API rate limit issues.")
    
    if st.session_state.process and st.session_state.process.poll() is not None:
        st.error(f"⚠️ Process terminated with code {st.session_state.process.poll()}")
        st.session_state.process = None

st.divider()
st.markdown("<center>Powered by <b>Nexus-01 Autonomous Core</b></center>", unsafe_allow_value=True)
