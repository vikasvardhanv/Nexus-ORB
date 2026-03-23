/* App.jsx - Nexus ARB Trader Frontend */
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Rocket, 
  Shield, 
  Terminal as TerminalIcon, 
  Zap, 
  ChevronRight, 
  ArrowUpRight, 
  BarChart3, 
  Cpu, 
  Layers,
  Settings,
  X,
  Key,
  TrendingUp,
  Activity,
  AlertCircle,
  Eye,
  EyeOff,
  Link,
  Signal,
  Brain,
  Users,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Globe
} from 'lucide-react'

// --- Mock Data ---
const MOCK_TRADES = [
  "[SYSTEM] Kernel: Project Nexus Booting v2.4.1",
  "[SYSTEM] Network: Quantum encrypted tunnel established",
  "[INFO] AI: Autonomous arbitrage engine initialized",
  "[TRADE] BUY SPY @ 511.23 | Size: 180",
  "[SIGNAL] 30m ORB BREAKOUT | Ticker: QQQ | Type: BULLISH",
  "[TRADE] SELL SPY @ 511.45 | Profit: +$39.60",
  "[ERROR] Proxy Timeout for AAPL (Retrying...)",
  "[FIXED] AI SELF-HEAL: Switched to Backup Tier 2 API",
  "[TRADE] BUY NVDA @ 908.45 | Size: 45",
  "[INFO] Scalping: RSI > 70 Detected | TSLA",
  "[TERM] User root connected to Nexus-01-Vortex",
  "[SYSTEM] Uptime: 247:12:33 | ROI: +18.4%"
]

const AGENT_MESSAGES = [
  { agent: "Fundamental", text: "SPY earnings yield looks attractive relative to 10Y yields. Long-term bias is Bullish.", type: "bullish" },
  { agent: "Sentiment", text: "Social volume on $SPY just spiked. Retail sentiment is shifting greed-ward.", type: "neutral" },
  { agent: "Technical", text: "Daily RSI at 62. Resistance at 512.40. Watching for ORB confirmation.", type: "bullish" },
  { agent: "Risk", text: "Volatility expansion detected. Suggesting 0.5% risk cap for the next sequence.", type: "alert" },
  { agent: "Technical", text: "FVG Gap filled at 509.12. Strong liquidity pool found there.", type: "bullish" },
  { agent: "Sentiment", text: "Major tech headlines are positive. Pushing sentiment score to 82/100.", type: "bullish" }
]

export default function App() {
  const [logs, setLogs] = useState([])
  const [agentLogs, setAgentLogs] = useState([])
  const [scrollPos, setScrollPos] = useState(0)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [activeTab, setActiveTab] = useState('ORB') // 'ORB' or 'INTELLIGENCE'
  
  // Trading Config State
  const [config, setConfig] = useState({
    alpacaKey: '',
    alpacaSecret: '',
    isLive: false,
    tickers: 'SPY,QQQ,AAPL,TSLA',
    riskPct: 0.5,
    maxQty: 100,
    backendUrl: 'https://nexus-engine-prod.modal.run'
  })

  const [status, setStatus] = useState('IDLE')
  const [engineStatus, setEngineStatus] = useState('DISCONNECTED')

  // Simulation loops
  useEffect(() => {
    let index = 0
    const interval = setInterval(() => {
      let logPrefix = status === 'ACTIVE' ? `[LIVE] ` : "";
      if (status === 'CONNECTING') {
        setLogs(prev => [...prev.slice(-49), `[SYSTEM] Authenticating with Alpaca Protocol...`]);
        return;
      }
      setLogs(prev => {
        const newLog = MOCK_TRADES[index % MOCK_TRADES.length];
        return [...prev, logPrefix + newLog].slice(-50);
      })
      index++
    }, 2000)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    let index = 0
    const interval = setInterval(() => {
      setAgentLogs(prev => {
        const newMsg = AGENT_MESSAGES[index % AGENT_MESSAGES.length];
        return [...prev, { ...newMsg, time: new Date().toLocaleTimeString('en-GB') }].slice(-10);
      })
      index++
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrollPos(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleStartTrading = () => {
    if (!config.alpacaKey || !config.alpacaSecret) {
      setIsSettingsOpen(true)
      return;
    }
    setStatus('CONNECTING')
    setEngineStatus('CONNECTING')
    setTimeout(() => {
      setStatus('ACTIVE')
      setEngineStatus('CONNECTED')
    }, 2500)
  }

  return (
    <div className="app-root bg-[#020617] text-slate-100 min-h-screen font-sans selection:bg-cyan-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse-slow delay-700"></div>
      </div>

      {/* Settings Side Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0f172a]/95 border-l border-white/10 backdrop-blur-xl z-[101] p-8 shadow-2xl flex flex-col">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center text-cyan-400"><Settings size={20} /></div>
                  <h2 className="text-xl font-bold tracking-tight">Broker <span className="text-cyan-400">Settings</span></h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="hover:rotate-90 transition-transform p-2 text-slate-400 hover:text-white"><X size={24} /></button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 tracking-[0.2em] uppercase">Alpaca Protocol 2.0</label>
                  <div className="space-y-3">
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input type="text" placeholder="API KEY ID" value={config.alpacaKey} onChange={(e) => setConfig({...config, alpacaKey: e.target.value})} className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 outline-none" />
                    </div>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input type={showKey ? "text" : "password"} placeholder="SECRET KEY" value={config.alpacaSecret} onChange={(e) => setConfig({...config, alpacaSecret: e.target.value})} className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 pl-10 pr-12 text-sm focus:border-cyan-500/50 outline-none" />
                      <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400">{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 tracking-[0.2em] uppercase">Compute Engine</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input type="text" placeholder="Backend Engine URL" value={config.backendUrl} onChange={(e) => setConfig({...config, backendUrl: e.target.value})} className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-cyan-500/50 outline-none" />
                  </div>
                </div>

                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold flex items-center gap-2">{config.isLive ? <AlertCircle className="text-red-400" size={14} /> : <Zap className="text-emerald-400" size={14} />}{config.isLive ? "LIVE TRADING" : "PAPER TRADING"}</div>
                    <p className="text-[10px] text-slate-500 mt-1">{config.isLive ? "Risking real capital" : "Virtual currency only"}</p>
                  </div>
                  <button onClick={() => setConfig({...config, isLive: !config.isLive})} className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${config.isLive ? 'bg-red-500/40' : 'bg-emerald-500/40'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${config.isLive ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 tracking-[0.2em] uppercase">Risk Management</label>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-2"><span>Risk per Trade</span><span className="text-cyan-400 font-mono">{config.riskPct}%</span></div>
                      <input type="range" min="0.1" max="2.0" step="0.1" value={config.riskPct} onChange={(e) => setConfig({...config, riskPct: parseFloat(e.target.value)})} className="w-full accent-cyan-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Max Qty</span>
                        <input type="number" value={config.maxQty} onChange={(e) => setConfig({...config, maxQty: parseInt(e.target.value)})} className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 px-3 text-sm focus:border-cyan-500/50 outline-none font-mono" />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Tickers</span>
                        <input type="text" value={config.tickers} onChange={(e) => setConfig({...config, tickers: e.target.value})} className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 px-3 text-sm focus:border-cyan-500/50 outline-none font-mono" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl flex items-start gap-3">
                  <Shield className="text-cyan-400 shrink-0 mt-0.5" size={18} />
                  <p className="text-[10px] text-slate-400 leading-relaxed italic">Your API keys are never stored on our servers. Used locally for Alpaca authentication.</p>
                </div>
              </div>

              <div className="mt-8">
                <button onClick={() => setIsSettingsOpen(false)} className="w-full btn-premium btn-primary py-4 uppercase tracking-[0.2em] font-bold text-xs">Save Configuration</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(1200px,95%)] transition-all duration-500 ${scrollPos > 50 ? 'top-2' : ''}`}>
        <div className="glass-panel px-6 py-2.5 flex justify-between items-center bg-slate-900/40 backdrop-blur-xl border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center font-black text-xl shadow-[0_0_20px_rgba(34,211,238,0.3)]">N</div>
            <div className="flex flex-col -gap-1">
              <span className="font-black tracking-tighter text-lg leading-tight uppercase">Nexus<span className="text-cyan-400">.</span>Int</span>
              <span className="text-[8px] font-bold tracking-[0.3em] text-slate-500 uppercase leading-none">AI Protocol</span>
            </div>
          </div>
          
          {/* Tab Switcher */}
          <div className="hidden md:flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setActiveTab('ORB')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${activeTab === 'ORB' ? 'bg-cyan-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              ORB TERMINAL
            </button>
            <button 
              onClick={() => setActiveTab('INTELLIGENCE')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${activeTab === 'INTELLIGENCE' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              AGENT INTEL
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-slate-300 hover:text-cyan-400"><Settings size={18} /></button>
            <button onClick={handleStartTrading} className="btn-premium btn-primary py-2 px-6 text-[10px] font-black tracking-widest uppercase">Launch AI</button>
          </div>
        </div>
      </nav>

      <main className="pt-24 min-h-screen">
        <AnimatePresence mode="wait">
          {activeTab === 'ORB' ? (
            <motion.div key="orb" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="pt-24 relative overflow-hidden">
               {/* Original ORB Dashboard Parts */}
               <section className="pb-24 text-center container">
                 <div className="flex justify-center mb-6">
                    <span className="glass-card px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] border-cyan-500/30 flex items-center gap-2 bg-slate-900/50">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_cyan] ${status === 'ACTIVE' ? 'bg-emerald-400 shadow-emerald-400' : 'bg-cyan-400 shadow-cyan-400'}`}></div>
                        {status === 'ACTIVE' ? 'SYSTEM LIVE & BROADCASTING' : 'V3.0 ALPHA NOW DEPLOYED'}
                    </span>
                 </div>
                 <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-[1.1]">Deploying Capital <br/><span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent italic">Without Ego.</span></h1>
                 <p className="max-w-2xl mx-auto mt-8 text-lg text-slate-400 font-medium opacity-80">Autonomous arbitrage engine powered by Nexus AI Core. <br />Detect market inefficiencies. Execute in milliseconds. Repeat 24/7.</p>
                 <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12 px-6">
                    <button onClick={handleStartTrading} className="btn-premium btn-primary h-14 px-8 text-sm group"><Rocket size={18} /> {status === 'ACTIVE' ? 'MANAGE SESSION' : 'START TRADING'}</button>
                    <button className="btn-premium border border-white/10 hover:bg-white/5 backdrop-blur-md h-14 px-8 text-sm flex items-center gap-2 font-bold tracking-widest uppercase">DOCS <ArrowUpRight size={16} /></button>
                 </div>
               </section>

               <section className="py-4 border-y border-white/5 bg-slate-900/20 backdrop-blur-md relative z-10 overflow-hidden">
                  <div className="container flex justify-around items-center gap-8 py-2 overflow-x-auto no-scrollbar">
                    {[
                      { label: "NET VOLUME", val: "$4.1M+", color: "cyan" },
                      { label: "TRADES/HR", val: "~142", color: "purple" },
                      { label: "LATENCY", val: "1.2ms", color: "emerald" },
                      { label: "ALPHA SCORE", val: "9.2/10", color: "amber" }
                    ].map((s, i) => {
                      const colorMap = { cyan: 'text-cyan-400', purple: 'text-purple-400', emerald: 'text-emerald-400', amber: 'text-amber-400' };
                      return (
                        <div key={i} className="flex flex-col items-center min-w-[120px]">
                          <span className="text-[9px] font-black text-slate-500 tracking-[0.2em] mb-1 uppercase opacity-60 tracking-[0.3em]">{s.label}</span>
                          <span className={`text-xl font-bold ${colorMap[s.color]}`}>{s.val}</span>
                        </div>
                      )
                    })}
                  </div>
               </section>

               <section id="terminal" className="py-24 container">
                  <div className="flex justify-between items-end mb-8 px-2">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black tracking-tight uppercase">System Console</h2>
                      <p className="text-slate-500 text-[10px] font-bold tracking-[0.4em] uppercase">Nexus-Node-01 // Real-Time Execution Stream</p>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/5 text-[10px] font-bold text-slate-400 flex items-center gap-2">
                       <Signal size={12} className={engineStatus === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-500'} />
                       ENGINE: {engineStatus}
                    </div>
                  </div>
                  <div className="glass-panel p-1.5 border-white/10 bg-slate-900/40 backdrop-blur-3xl shadow-[0_0_100px_rgba(34,211,238,0.1)]">
                    <div className="terminal-window bg-[#020617] rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
                        <div className="terminal-header items-center justify-between px-6 py-4 border-b border-white/5 flex bg-slate-950/80">
                            <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-red-500/50" /><div className="w-3 h-3 rounded-full bg-amber-500/50" /><div className="w-3 h-3 rounded-full bg-emerald-500/50" /></div>
                            <div className="text-[10px] text-slate-500 font-mono font-bold tracking-widest uppercase">TRADER_BOT_ORB</div>
                            <div className="flex items-center gap-3 text-cyan-400/50"><TerminalIcon size={14} /><Activity size={14} /></div>
                        </div>
                        <div className="flex-1 p-6 font-mono text-xs overflow-y-auto no-scrollbar custom-terminal">
                            <AnimatePresence>
                                {logs.map((log, idx) => (
                                    <motion.div key={idx} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="mb-1 flex gap-4 pl-4 border-l border-white/5 hover:border-cyan-500/30 transition-all py-0.5">
                                        <span className="text-slate-600 shrink-0 select-none">{new Date().toLocaleTimeString('en-GB')}</span>
                                        <span className={log.includes('[TRADE]') ? 'text-cyan-400 font-bold' : log.includes('[ERROR]') ? 'text-rose-400' : log.includes('[LIVE]') ? 'text-emerald-400' : 'text-slate-400 opacity-80'}>{log}</span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                  </div>
               </section>
            </motion.div>
          ) : (
            <motion.div key="intel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="container pt-12 pb-24">
               {/* Nexus Intelligence View */}
               <div className="grid lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Analysts & Debate */}
                  <div className="lg:col-span-8 space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="space-y-1">
                           <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-4">
                              Multi-Agent <span className="text-indigo-400">War Room</span>
                              <div className="flex -space-x-3">
                                 {[1,2,3,4].map(i => <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center`}><Users size={12} className="text-slate-500" /></div>)}
                              </div>
                           </h2>
                           <p className="text-slate-500 text-xs font-bold tracking-widest uppercase">Consensus Mechanism v2.0 // Active Analysts: 6</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Live Thread</span>
                           <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                        </div>
                     </div>

                     <div className="glass-panel overflow-hidden border-white/10 bg-slate-900/60 backdrop-blur-2xl">
                        <div className="flex border-b border-white/5">
                           <button className="flex-1 py-4 text-[10px] font-black tracking-[0.2em] border-b-2 border-indigo-500 text-indigo-400 bg-indigo-500/5 uppercase">Global Debate</button>
                           <button className="flex-1 py-4 text-[10px] font-black tracking-[0.2em] text-slate-500 hover:text-slate-300 uppercase">Signal Evidence</button>
                           <button className="flex-1 py-4 text-[10px] font-black tracking-[0.2em] text-slate-500 hover:text-slate-300 uppercase">Backtest Logs</button>
                        </div>
                        <div className="h-[600px] overflow-y-auto p-6 scroll-smooth custom-scrollbar space-y-4">
                           {agentLogs.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-40"><Brain size={48} className="animate-pulse" /><p className="text-[10px] font-black tracking-widest uppercase">Initializing Intelligence Core...</p></div>}
                           <AnimatePresence>
                              {agentLogs.map((msg, i) => (
                                 <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-4 items-start ${msg.type === 'bullish' ? 'border-indigo-500/10' : 'border-white/5'} border-l-2 pl-6 py-4 hover:bg-white/5 transition-colors rounded-r-2xl`}>
                                    <div className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center font-black ${msg.agent === 'Fundamental' ? 'bg-amber-500/20 text-amber-500' : msg.agent === 'Sentiment' ? 'bg-cyan-500/20 text-cyan-500' : msg.agent === 'Technical' ? 'bg-indigo-500/20 text-indigo-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                       {msg.agent[0]}
                                    </div>
                                    <div className="flex-1">
                                       <div className="flex items-center gap-3 mb-1">
                                          <span className="text-xs font-black tracking-tighter uppercase">{msg.agent} <span className="text-slate-600 opacity-60">Analyst</span></span>
                                          <span className="text-[9px] font-bold text-slate-600 font-mono uppercase">{msg.time}</span>
                                          {msg.type === 'bullish' && <span className="text-[8px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase">Evidence +</span>}
                                       </div>
                                       <p className="text-sm text-slate-300 leading-relaxed font-medium opacity-90">{msg.text}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600">
                                       <MessageSquare size={14} className="hover:text-indigo-400 cursor-pointer" />
                                       <Activity size={14} className="hover:text-cyan-400 cursor-pointer" />
                                    </div>
                                 </motion.div>
                              ))}
                           </AnimatePresence>
                        </div>
                        <div className="p-4 bg-slate-950/40 border-t border-white/5 flex gap-4">
                           <input type="text" placeholder="Interrogate Nexus Core..." className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-indigo-500/50 outline-none" />
                           <button className="btn-premium btn-primary py-3 px-6"><Rocket size={18} /></button>
                        </div>
                     </div>
                  </div>

                  {/* Right Column: Signal Pulse & Ratings */}
                  <div className="lg:col-span-4 space-y-8">
                     <div className="glass-panel p-8 bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20">
                        <div className="flex justify-between items-start mb-6">
                           <div className="space-y-1">
                              <h3 className="text-lg font-black tracking-tighter uppercase">Intelligence Consensus</h3>
                              <p className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">Strong Probability Cluster</p>
                           </div>
                           <Activity size={24} className="text-indigo-400" />
                        </div>
                        <div className="flex flex-col items-center py-8">
                           <div className="relative w-48 h-48 flex items-center justify-center">
                              <svg className="w-full h-full transform -rotate-90">
                                 <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
                                 <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={553} strokeDashoffset={553 - (553 * 0.82)} className="text-indigo-500 transition-all duration-1000" />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                 <span className="text-5xl font-black tracking-tighter">82</span>
                                 <span className="text-[10px] font-black text-indigo-400 tracking-[0.3em] uppercase">Bullish</span>
                              </div>
                           </div>
                           <p className="mt-8 text-center text-xs text-slate-400 leading-relaxed font-bold uppercase opacity-60">Calculated across 84 market signals and 14 agents.</p>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase px-2">Analyst Verdicts</h4>
                        {[
                          { name: "Technical Core", status: "BUY", score: 88, color: "emerald" },
                          { name: "Sentiment Pulse", status: "WATCH", score: 65, color: "cyan" },
                          { name: "Fundamental AI", status: "STRONG BUY", score: 94, color: "indigo" },
                          { name: "Risk Manager", status: "PASS", score: 100, color: "emerald" }
                        ].map((v, i) => (
                           <div key={i} className="glass-panel p-4 flex items-center justify-between hover:bg-white/5 transition-all group">
                              <div className="flex items-center gap-3">
                                 <div className={`w-2 h-2 rounded-full bg-${v.color}-500 group-hover:animate-ping`} />
                                 <span className="text-xs font-black tracking-tighter uppercase">{v.name}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-black">
                                 <span className={`text-${v.color}-400 uppercase`}>{v.status}</span>
                                 <span className="text-slate-600 font-mono">{v.score}%</span>
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="glass-panel p-6 bg-slate-900/40 relative overflow-hidden group">
                        <div className="relative z-10">
                           <h4 className="text-[10px] font-black text-indigo-400 tracking-[0.3em] uppercase mb-4">Signal Breakdown</h4>
                           <div className="space-y-3">
                              {[
                                 { label: "RSI Divergence", val: 82 },
                                 { label: "FVG Liquidity", val: 94 },
                                 { label: "ORB Confirmation", val: 12 },
                                 { label: "Institutional Inflow", val: 76 }
                              ].map((s, i) => (
                                 <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold uppercase opacity-60 tracking-widest">
                                       <span>{s.label}</span>
                                       <span>{s.val}%</span>
                                    </div>
                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                       <motion.div initial={{ width: 0 }} animate={{ width: `${s.val}%` }} transition={{ delay: 0.5 + (i * 0.1) }} className="h-full bg-indigo-500" />
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                        <Layers size={80} className="absolute -bottom-4 -right-4 text-white/5 group-hover:rotate-12 transition-transform duration-700" />
                     </div>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-[#020617] relative z-20">
        <div className="container flex flex-col items-center">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center font-black text-2xl">N</div>
            <span className="font-black tracking-tighter text-2xl">NEXUS<span className="text-cyan-400">.</span>INT</span>
          </div>
          <div className="flex gap-8 mb-8 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">
            <a href="#" className="hover:text-cyan-400 transition-colors uppercase">Twitter</a>
            <a href="#" className="hover:text-cyan-400 transition-colors uppercase">GitHub</a>
            <a href="#" className="hover:text-cyan-400 transition-colors uppercase">Discord</a>
          </div>
          <p className="text-slate-600 text-[10px] font-bold tracking-[0.1em]">© 2026 NEXUS AI CORE PROTOCOL. POWERED BY MULTI-AGENT INTELLIGENCE.</p>
        </div>
      </footer>
    </div>
  )
}
