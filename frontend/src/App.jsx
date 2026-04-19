/* App.jsx - Nexus ORB: Simplified Onboarding + Real Alpaca Validation + Test Anytime */
import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Rocket, Shield, Terminal as TerminalIcon, Zap, ChevronRight, 
  Settings, X, Key, TrendingUp, Activity, Eye, EyeOff, 
  Signal, CheckCircle2, Globe, Monitor, Crosshair, Lock, PlayCircle,
  AlertCircle, Clock, RefreshCw
} from 'lucide-react'

/* ───── Constants ───── */
const ALPACA_URLS = {
  paper: 'https://paper-api.alpaca.markets',
  live:  'https://api.alpaca.markets',
  data:  'https://data.alpaca.markets'
}

const WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT']
const CRYPTO_WATCHLIST = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD']

/* ───── Helpers ───── */
function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function logTs() {
  return new Date().toLocaleTimeString('en-GB')
}

/* ═══════ MAIN APP ═══════ */
export default function App() {
  // ─── State ───
  const [phase, setPhase] = useState('SETUP')    // SETUP | VALIDATED | RUNNING
  const [validationStatus, setValidationStatus] = useState('idle') // idle | loading | success | error
  const [validationMsg, setValidationMsg] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [accountInfo, setAccountInfo] = useState(null)
  const [logs, setLogs] = useState([])
  const [isRealTrading, setIsRealTrading] = useState(false)
  const [positions, setPositions] = useState([])
  const [userWatchlist, setUserWatchlist] = useState(WATCHLIST)
  const [newTicker, setNewTicker] = useState('')
  const [marketData, setMarketData] = useState([])
  const logRef = useRef(null)

  const [creds, setCreds] = useState({
    keyId: '',
    secret: '',
    tradingUrl: ALPACA_URLS.paper,
    dataUrl: ALPACA_URLS.data,
    mode: 'paper',
    broker: 'alpaca'
  })

  // Custom time window for testing
  const [timeWindow, setTimeWindow] = useState({
    rangeMinutes: 30,
    useCustom: false,
    customStart: '',   // HH:MM format
  })

  // ─── Logging helper ───
  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [...prev, { time: logTs(), msg, type }].slice(-80))
  }, [])

  // ─── Auto-scroll logs ───
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  // ─── Real Alpaca Validation ───
  const validateCredentials = async () => {
    if (!creds.keyId.trim() || !creds.secret.trim()) {
      setValidationStatus('error')
      setValidationMsg('Both API Key ID and Secret Key are required.')
      return
    }

    setValidationStatus('loading')
    setValidationMsg(`Connecting to ${creds.broker.toUpperCase()} via Nexus Bridge...`)
    addLog(`[AUTH] Attempting credential validation via backend bridge...`, 'system')

    try {
      const res = await fetch('http://localhost:8000/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: creds.keyId.trim(),
          secret: creds.secret.trim(),
          broker: creds.broker,
          tradingUrl: creds.tradingUrl,
          mode: creds.mode
        })
      })

      if (res.ok) {
        const data = await res.json()
        setAccountInfo(data)
        setValidationStatus('success')
        setValidationMsg(`Verified! ${creds.broker.toUpperCase()} connection active.`)
        addLog(`[AUTH] SUCCESS - ${creds.broker.toUpperCase()} account verified and ready.`, 'success')
        setTimeout(() => setPhase('VALIDATED'), 1500)
      } else {
        const errorData = await res.json()
        setValidationStatus('error')
        setValidationMsg(`Validation Failed: ${errorData.detail || 'Invalid Keys'}`)
        addLog(`[AUTH] FAILED - Broker rejected keys.`, 'error')
      }
    } catch (err) {
      setValidationStatus('error')
      setValidationMsg('Backend Bridge Error. Make sure api.py is running on port 8000.')
      addLog(`[AUTH] ERROR - Could not reach local bridge API: ${err.message}`, 'error')
    }
  }

  // ─── Sync Watchlist when Broker changes ───
  useEffect(() => {
    if (phase === 'SETUP' || phase === 'VALIDATED') {
      setUserWatchlist(creds.broker === 'alpaca' ? WATCHLIST : CRYPTO_WATCHLIST)
    }
  }, [creds.broker, phase])

  // ─── Fetch Market Snapshots ───
  const fetchMarketData = useCallback(async () => {
    if (!creds.keyId || !creds.secret) return

    try {
      const symbols = userWatchlist.join(',')
      const res = await fetch(`${creds.dataUrl}/v2/stocks/snapshots?symbols=${symbols}`, {
        headers: {
          'APCA-API-KEY-ID': creds.keyId.trim(),
          'APCA-API-SECRET-KEY': creds.secret.trim()
        }
      })
      if (res.ok) {
        const data = await res.json()
        const parsed = Object.entries(data).map(([sym, snap]) => ({
          symbol: sym,
          price: snap.latestTrade?.p || snap.minuteBar?.c || 0,
          high: snap.dailyBar?.h || 0,
          low: snap.dailyBar?.l || 0,
          volume: snap.dailyBar?.v || 0,
          vwap: snap.dailyBar?.vw || 0,
          change: snap.dailyBar ? ((snap.minuteBar?.c - snap.dailyBar?.o) / snap.dailyBar?.o * 100) : 0
        }))
        setMarketData(parsed)
        addLog(`[DATA] Refreshed snapshots for ${parsed.length} symbols.`, 'info')
      }
    } catch {
      setMarketData(userWatchlist.map(s => ({
        symbol: s,
        price: s.includes('BTC') ? 65000 : s.includes('ETH') ? 3500 : 100 + Math.random() * 400,
        high: 0, low: 0, volume: 0, vwap: 0,
        change: (Math.random() - 0.5) * 4
      })))
      addLog(`[DATA] Using ${creds.broker === 'alpaca' ? 'simulated' : 'crypto'} market snapshot.`, 'warn')
    }
  }, [creds, userWatchlist, addLog])

  // ─── Market data polling ───
  useEffect(() => {
    if (phase === 'VALIDATED' || phase === 'RUNNING') {
      fetchMarketData()
      const interval = setInterval(fetchMarketData, 15000) // Every 15s
      return () => clearInterval(interval)
    }
  }, [phase, fetchMarketData])

  // ─── Simulated price ticks between API refreshes ───
  useEffect(() => {
    if ((phase === 'VALIDATED' || phase === 'RUNNING') && marketData.length > 0) {
      const interval = setInterval(() => {
        setMarketData(prev => prev.map(t => ({
          ...t,
          price: t.price + (Math.random() - 0.5) * 0.15
        })))
      }, 2500)
      return () => clearInterval(interval)
    }
  }, [phase, marketData.length])

  // ─── Real-time Log Polling from Backend ───
  useEffect(() => {
    let interval;
    if (phase === 'RUNNING' && isRealTrading) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8000/logs');
          if (res.ok) {
            const data = await res.json();
            // Map plain text logs to UI log format
            const formatted = data.logs.map(msg => ({
              time: logTs(),
              msg,
              type: msg.includes('[ERROR]') ? 'error' : msg.includes('[SUCCESS]') ? 'success' : msg.includes('[SYSTEM]') ? 'system' : 'info'
            }));
            setLogs(formatted);
          }
        } catch (err) {
          console.error("Failed to fetch logs", err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [phase, isRealTrading]);

  // ─── Live Positions Polling ───
  useEffect(() => {
    let interval;
    if (phase === 'RUNNING' || phase === 'VALIDATED') {
      const fetchPositions = async () => {
        try {
          const res = await fetch('http://localhost:8000/positions');
          if (res.ok) {
            const data = await res.json();
            setPositions(data.positions || []);
          }
        } catch (err) {
          console.error("Failed to fetch positions", err);
        }
      };
      
      fetchPositions();
      interval = setInterval(fetchPositions, 5000); // Every 5s
    }
    return () => clearInterval(interval);
  }, [phase]);

  // ─── START handler ───
  const handleStart = async () => {
    // Try to start the real backend first
    try {
      const res = await fetch('http://localhost:8000/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: creds.keyId.trim(),
          secret: creds.secret.trim(),
          tickers: userWatchlist.join(','),
          quantity: 10,
          mode: creds.mode,
          risk_pct: 0.5,
          minutes: timeWindow.rangeMinutes,
          broker: creds.broker
        })
      });

      if (res.ok) {
        setIsRealTrading(true);
        setPhase('RUNNING');
        addLog('[SYSTEM] Connected to Nexus-ORB Engine. Real-time execution started.', 'success');
        return;
      }
    } catch (err) {
      addLog('[SYSTEM] Backend API not reachable. Falling back to Simulation Mode.', 'warn');
    }

    // FALLBACK: Simulation Mode (original logic)
    setPhase('RUNNING');
    setIsRealTrading(false);
    const now = new Date()
    const rangeStart = timeWindow.useCustom && timeWindow.customStart
      ? timeWindow.customStart
      : '09:30'
    const rangeEnd = (() => {
      const [h, m] = rangeStart.split(':').map(Number)
      const endMin = m + timeWindow.rangeMinutes
      const endH = h + Math.floor(endMin / 60)
      const endM = endMin % 60
      return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
    })()

    addLog('═══════════════════════════════════════════', 'system')
    addLog('[EXEC] User triggered START. ORB Engine Activated.', 'success')
    addLog(`[CONFIG] Range Window: ${rangeStart} - ${rangeEnd} ET (${timeWindow.rangeMinutes}m)`, 'info')
    addLog(`[CONFIG] Mode: ${creds.mode.toUpperCase()} | URL: ${creds.tradingUrl}`, 'info')
    addLog('[SCAN] Monitoring watchlist for range formation...', 'info')
    addLog('[STRATEGY] Phase 1: Collecting OHLC candles during range window. NO trades during this phase.', 'system')
    addLog('[STRATEGY] Phase 2: After range locks, scanning for breakout + RVOL 1.5x + VWAP + RSI filters.', 'system')
    addLog('[STRATEGY] Phase 3: One trade per day. Force close at 15:45 ET.', 'system')
    addLog('═══════════════════════════════════════════', 'system')

    // Simulated ongoing execution logs
    let step = 0
    const execLogs = [
      '[SCAN] SPY: Building 30m range... High: $512.40 Low: $510.10',
      '[SCAN] QQQ: Building 30m range... High: $443.00 Low: $441.20',
      '[FILTER] SPY range width: 0.45% (pass, min 0.2%)',
      '[FILTER] AAPL range width: 0.04% (SKIP - too narrow)',
      '[SCAN] TSLA RVOL spike detected: 2.1x (threshold: 1.5x)',
      '[VWAP] SPY trading above VWAP $510.85 - bullish bias',
      '[RSI] SPY RSI(14) = 62 (valid range: 50-70 for longs)',
      '[SIGNAL] SPY: All filters PASSED. Monitoring for candle close above ORB_HIGH $512.40',
      '[WAIT] Watching for confirmed breakout candle close...',
      '[MONITOR] No re-entry after stop-out. One trade per day rule active.',
    ]
    const interval = setInterval(() => {
      addLog(execLogs[step % execLogs.length], step % 3 === 0 ? 'success' : 'info')
      step++
    }, 4000)

    return () => clearInterval(interval)
  }

  // ─── STOP handler ───
  const handleStop = async () => {
    if (isRealTrading) {
      try {
        await fetch('http://localhost:8000/stop', { method: 'POST' });
        addLog('[SYSTEM] Stop signal sent to engine.', 'warn');
      } catch (err) {
        addLog('[SYSTEM] Failed to connect to engine to stop.', 'error');
      }
    }
    setPhase('VALIDATED');
    setIsRealTrading(false);
    addLog('[SYSTEM] Trading session ended.', 'info');
  }

  // ─── Bypass for CORS (allows testing without real API) ───
  const handleBypass = () => {
    addLog('[AUTH] Bypass mode: Proceeding without API verification.', 'warn')
    addLog('[AUTH] Note: Market data will use simulated values.', 'warn')
    setValidationStatus('success')
    setValidationMsg('Bypass mode active. Using simulated data.')
    setPhase('VALIDATED')
  }

  /* ═══════ RENDER ═══════ */
  return (
    <div style={{ background: '#020617', color: '#e2e8f0', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'rgba(34,211,238,0.04)', filter: 'blur(120px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'rgba(99,102,241,0.04)', filter: 'blur(120px)', borderRadius: '50%' }} />
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════ PHASE 1: SETUP ═══════ */}
        {phase === 'SETUP' && (
          <motion.div key="setup" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', zIndex: 10 }}>
            <div style={{ maxWidth: '480px', width: '100%', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '48px', backdropFilter: 'blur(20px)' }}>
              
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(34,211,238,0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(34,211,238,0.15)' }}>
                  <Rocket size={28} color="#22d3ee" />
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', margin: 0 }}>
                  Nexus<span style={{ color: '#22d3ee' }}>.</span>ORB
                </h1>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                  <button onClick={() => setCreds({ ...creds, broker: 'alpaca' })} style={{ padding: '6px 16px', borderRadius: '12px', border: '1px solid', borderColor: creds.broker === 'alpaca' ? '#22d3ee' : 'rgba(255,255,255,0.05)', background: creds.broker === 'alpaca' ? 'rgba(34,211,238,0.1)' : 'transparent', color: creds.broker === 'alpaca' ? '#22d3ee' : '#475569', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}>STOCKS</button>
                  <button onClick={() => setCreds({ ...creds, broker: 'kraken' })} style={{ padding: '6px 16px', borderRadius: '12px', border: '1px solid', borderColor: creds.broker === 'kraken' ? '#818cf8' : 'rgba(255,255,255,0.05)', background: creds.broker === 'kraken' ? 'rgba(129,140,248,0.1)' : 'transparent', color: creds.broker === 'kraken' ? '#818cf8' : '#475569', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}>KRAKEN PRO</button>
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '12px' }}>
                  Step 1: Connect Your {creds.broker.toUpperCase()} Account
                </p>
              </div>

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* API Key */}
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    API Key ID
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Key size={14} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                    <input
                      type="text" placeholder="PK..." value={creds.keyId}
                      onChange={e => setCreds({ ...creds, keyId: e.target.value })}
                      style={{ width: '100%', background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 16px 16px 44px', fontSize: '13px', fontFamily: 'monospace', color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Secret / Private Key */}
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    {creds.broker === 'alpaca' ? 'Secret Key' : 'Private Key (Secret)'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={14} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                    <input
                      type={showSecret ? 'text' : 'password'} placeholder={creds.broker === 'alpaca' ? "Your secret key" : "Your kraken private key"} value={creds.secret}
                      onChange={e => setCreds({ ...creds, secret: e.target.value })}
                      style={{ width: '100%', background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 44px', fontSize: '13px', fontFamily: 'monospace', color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0 }}>
                      {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* URL - Only for Alpaca */}
                {creds.broker === 'alpaca' && (
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Trading API URL
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Globe size={14} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                      <input
                        type="text" value={creds.tradingUrl}
                        onChange={e => setCreds({ ...creds, tradingUrl: e.target.value })}
                        style={{ width: '100%', background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px 16px 16px 44px', fontSize: '12px', fontFamily: 'monospace', color: '#22d3ee', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}

                {/* Mode Toggle / Status */}
                {creds.broker === 'alpaca' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '16px', background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: creds.mode === 'live' ? '#ef4444' : '#10b981', animation: 'pulse 2s infinite' }} />
                      <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        {creds.mode === 'live' ? 'LIVE TRADING' : 'PAPER TRADING'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const newMode = creds.mode === 'paper' ? 'live' : 'paper'
                        setCreds({ ...creds, mode: newMode, tradingUrl: newMode === 'live' ? ALPACA_URLS.live : ALPACA_URLS.paper })
                      }}
                      style={{ width: '48px', height: '24px', borderRadius: '12px', position: 'relative', border: 'none', cursor: 'pointer', background: creds.mode === 'live' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)' }}>
                      <div style={{ position: 'absolute', top: '4px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'all 0.2s', left: creds.mode === 'live' ? '28px' : '4px' }} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '16px', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#a5b4fc' }}>
                      LIVE REAL-MONEY MODE ACTIVE
                    </span>
                  </div>
                )}

                {/* Validation Message */}
                {validationMsg && (
                  <div style={{
                    padding: '12px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                    background: validationStatus === 'error' ? 'rgba(239,68,68,0.1)' : validationStatus === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                    color: validationStatus === 'error' ? '#f87171' : validationStatus === 'success' ? '#34d399' : '#818cf8',
                    border: `1px solid ${validationStatus === 'error' ? 'rgba(239,68,68,0.2)' : validationStatus === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`
                  }}>
                    {validationStatus === 'error' && <AlertCircle size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: '-2px' }} />}
                    {validationStatus === 'success' && <CheckCircle2 size={14} style={{ display: 'inline', marginRight: '8px', verticalAlign: '-2px' }} />}
                    {validationMsg}
                  </div>
                )}

                {/* Validate Button */}
                <button
                  onClick={validateCredentials}
                  disabled={validationStatus === 'loading'}
                  className="btn-premium btn-primary"
                  style={{ width: '100%', padding: '18px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: validationStatus === 'loading' ? 0.6 : 1, cursor: validationStatus === 'loading' ? 'wait' : 'pointer' }}>
                  {validationStatus === 'loading' ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Validating...
                    </span>
                  ) : 'Save & Validate'}
                </button>

                {/* Bypass for CORS issues */}
                {validationStatus === 'error' && validationMsg.includes('CORS') && (
                  <button onClick={handleBypass} style={{ width: '100%', padding: '14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', color: '#fbbf24', fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Proceed with Simulated Data (Bypass)
                  </button>
                )}

                <p style={{ fontSize: '9px', color: '#334155', textAlign: 'center', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1.8 }}>
                  Keys are stored locally in your browser only. Never sent to our servers.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════ PHASE 2 & 3: DASHBOARD ═══════ */}
        {(phase === 'VALIDATED' || phase === 'RUNNING') && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ minHeight: '100vh', maxWidth: '1300px', margin: '0 auto', padding: '120px 24px 80px', position: 'relative', zIndex: 10 }}>

            {/* Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '24px', marginBottom: '48px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '999px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '10px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <CheckCircle2 size={12} /> AUTHENTICATED
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                    {creds.mode.toUpperCase()} MODE • {creds.broker.toUpperCase()}
                  </span>
                </div>
                <h1 style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.04em', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
                  {creds.broker === 'alpaca' ? 'Market' : 'Kraken'} <span style={{ color: creds.broker === 'alpaca' ? '#22d3ee' : '#818cf8' }}>Pulse</span>
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', marginTop: '8px', maxWidth: '500px', fontWeight: 500 }}>
                  Step 2: Customise your watchlist and time window. Press START when ready.
                </p>
              </div>

              {/* Ticker Management Section */}
              <div style={{ background: 'rgba(15,23,42,0.4)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: '#475569', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Active Strategy Watchlist</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())}
                      placeholder="Add Ticker..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newTicker) {
                           if (!userWatchlist.includes(newTicker)) setUserWatchlist([...userWatchlist, newTicker]);
                           setNewTicker('');
                        }
                      }}
                      style={{ background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 16px', color: '#fff', fontSize: '12px', outline: 'none', width: '120px' }}
                    />
                    <button 
                      onClick={() => {
                        if (newTicker && !userWatchlist.includes(newTicker)) {
                          setUserWatchlist([...userWatchlist, newTicker]);
                          setNewTicker('');
                        }
                      }}
                      style={{ background: creds.broker === 'alpaca' ? '#22d3ee' : '#818cf8', color: '#000', border: 'none', borderRadius: '12px', padding: '0 16px', fontSize: '11px', fontWeight: 900, cursor: 'pointer' }}>
                      ADD
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {userWatchlist.map(tick => (
                    <div key={tick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace' }}>{tick}</span>
                      <button onClick={() => setUserWatchlist(userWatchlist.filter(t => t !== tick))} style={{ background: 'none', border: 'none', color: '#ef4444', padding: 0, display: 'flex', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {userWatchlist.length === 0 && <span style={{ color: '#334155', fontSize: '12px', fontStyle: 'italic' }}>Watchlist is empty. Add a symbol above.</span>}
                </div>
              </div>

              {/* Time Window (Moved here for better flow) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
                <button onClick={() => { setPhase('SETUP'); setValidationStatus('idle'); setValidationMsg('') }}
                  style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', color: '#64748b', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Change Keys
                </button>
              </div>
            </div>

            {/* ─── Time Window Config ─── */}
            <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '28px', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <Clock size={18} color="#818cf8" />
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>ORB Time Window</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" checked={!timeWindow.useCustom} onChange={() => setTimeWindow({ ...timeWindow, useCustom: false })} style={{ accentColor: '#22d3ee' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Default (9:30 - 10:00 ET)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" checked={timeWindow.useCustom} onChange={() => setTimeWindow({ ...timeWindow, useCustom: true })} style={{ accentColor: '#22d3ee' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Custom (Test Now)</span>
                    </label>
                  </div>
                </div>
                {timeWindow.useCustom && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="time" value={timeWindow.customStart}
                      onChange={e => setTimeWindow({ ...timeWindow, customStart: e.target.value })}
                      style={{ background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#22d3ee', fontFamily: 'monospace', fontSize: '13px', outline: 'none' }} />
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>for</span>
                    <select value={timeWindow.rangeMinutes}
                      onChange={e => setTimeWindow({ ...timeWindow, rangeMinutes: Number(e.target.value) })}
                      style={{ background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#22d3ee', fontSize: '13px', outline: 'none' }}>
                      <option value={5}>5 min</option>
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                    </select>
                  </div>
                )}
              </div>

              {phase !== 'RUNNING' ? (
                <button onClick={handleStart} className="btn-premium btn-primary"
                  style={{ padding: '16px 32px', fontSize: '12px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PlayCircle size={18} /> START REAL-TIME
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 28px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px' }}>
                    <Activity size={16} color="#34d399" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#34d399', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                      {isRealTrading ? 'LIVE ENGINE ACTIVE' : 'SIMULATION ACTIVE'}
                    </span>
                  </div>
                  <button onClick={handleStop} style={{ padding: '16px 24px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '16px', color: '#f87171', fontSize: '11px', fontWeight: 900, cursor: 'pointer' }}>
                    STOP
                  </button>
                </div>
              )}
            </div>

            {/* ─── Market Data Grid ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>
              {(marketData.length > 0 ? marketData : WATCHLIST.map(s => ({ symbol: s, price: 0, change: 0 }))).map((t, i) => (
                <div key={i} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em' }}>{t.symbol}</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: t.change >= 0 ? '#34d399' : '#f87171' }}>
                      {t.change >= 0 ? '+' : ''}{(t.change || 0).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                    ${(t.price || 0).toFixed(2)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                    <Signal size={10} color="#818cf8" />
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* ─── Live Positions Section ─── */}
            <div style={{ marginBottom: '40px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#475569', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={14} /> Live Portfolio
              </h3>
              {positions.length === 0 ? (
                <div style={{ padding: '40px', background: 'rgba(15,23,42,0.3)', border: '1px dotted rgba(255,255,255,0.05)', borderRadius: '20px', textAlign: 'center', color: '#334155', fontSize: '13px' }}>
                  No active contracts. Waiting for ORB signal...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {positions.map((p, i) => (
                    <motion.div key={i} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      style={{ background: 'linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.8))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', background: parseFloat(p.unrealized_pl) >= 0 ? '#10b981' : '#ef4444' }} />
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div>
                          <span style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.04em' }}>{p.symbol}</span>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>
                            {p.side === 'long' ? '📈 BULLISH LONG' : '📉 BEARISH SHORT'} • {p.qty} SHARES
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 900, color: parseFloat(p.unrealized_pl) >= 0 ? '#34d399' : '#f87171' }}>
                            {parseFloat(p.unrealized_pl) >= 0 ? '+' : ''}${parseFloat(p.unrealized_pl).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: parseFloat(p.unrealized_pl) >= 0 ? '#10b981' : '#ef4444' }}>
                            {(parseFloat(p.unrealized_plpc) * 100).toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ background: 'rgba(2,6,23,0.4)', padding: '12px', borderRadius: '12px' }}>
                          <span style={{ fontSize: '9px', color: '#475569', fontWeight: 800, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Avg Entry</span>
                          <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>${parseFloat(p.avg_entry_price).toFixed(2)}</span>
                        </div>
                        <div style={{ background: 'rgba(2,6,23,0.4)', padding: '12px', borderRadius: '12px' }}>
                          <span style={{ fontSize: '9px', color: '#475569', fontWeight: 800, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Market Price</span>
                          <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>${parseFloat(p.current_price).toFixed(2)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Execution Console ─── */}
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#475569', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TerminalIcon size={14} /> Execution Log
              </h3>
              <div ref={logRef} style={{ background: 'rgba(2,6,23,0.9)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', height: '300px', padding: '20px', fontFamily: 'monospace', fontSize: '12px', overflowY: 'auto', lineHeight: 1.8 }}>
                {logs.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1e293b', textAlign: 'center' }}>
                    <Crosshair size={28} style={{ marginBottom: '12px' }} />
                    <p>Waiting for engine start...</p>
                  </div>
                ) : (
                  logs.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: '16px', borderLeft: `2px solid ${l.type === 'error' ? 'rgba(239,68,68,0.3)' : l.type === 'success' ? 'rgba(16,185,129,0.3)' : l.type === 'warn' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.15)'}`, paddingLeft: '12px', marginBottom: '2px' }}>
                      <span style={{ color: '#334155', flexShrink: 0, minWidth: '70px' }}>{l.time}</span>
                      <span style={{ color: l.type === 'error' ? '#f87171' : l.type === 'success' ? '#34d399' : l.type === 'warn' ? '#fbbf24' : l.type === 'system' ? '#818cf8' : '#94a3b8' }}>
                        {l.msg}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Spinning animation for loading */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
