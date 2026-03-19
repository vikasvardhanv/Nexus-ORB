/* App.jsx - Nexus ARB Trader Frontend */
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Rocket, 
  Shield, 
  Terminal, 
  Zap, 
  ChevronRight, 
  ArrowUpRight, 
  BarChart3, 
  Cpu, 
  Layers 
} from 'lucide-react'

// --- Mock Terminal Logic ---
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

export default function App() {
  const [logs, setLogs] = useState([])
  const [scrollPos, setScrollPos] = useState(0)

  // Simulation loop for terminal
  useEffect(() => {
    let index = 0
    const interval = setInterval(() => {
      setLogs(prev => [...prev, MOCK_TRADES[index % MOCK_TRADES.length]])
      index++
      // Keep terminal tidy
      if (logs.length > 50) setLogs(prev => prev.slice(1))
    }, 1500)
    return () => clearInterval(interval)
  }, [logs.length])

  // Track scroll for navbar color
  useEffect(() => {
    const handleScroll = () => setScrollPos(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="app-root">
      {/* Dynamic Background */}
      <div className="nebula-bg">
        <div className="nebula-blob blob-1"></div>
        <div className="nebula-blob blob-2"></div>
      </div>

      {/* Navbar */}
      <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(1200px,90%)] transition-all duration-300 ${scrollPos > 50 ? 'top-2' : ''}`}>
        <div className="glass-panel px-8 py-3 flex justify-between items-center bg-opacity-80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center font-bold text-xl drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">N</div>
            <span className="font-bold tracking-tight text-xl hidden sm:inline">NEXUS <span className="text-secondary font-normal text-slate-500">ARB</span></span>
          </div>
          <div className="flex gap-6 items-center text-sm font-medium">
             <a href="#features" className="hover:text-cyan-400 transition-colors">FEATURES</a>
             <a href="#terminal" className="hover:text-cyan-400 transition-colors">TERMINAL</a>
             <button className="btn-premium btn-primary py-2 px-5 text-xs">JOIN WAITLIST</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-48 pb-24 relative">
        <div className="container text-center">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <div className="flex justify-center mb-6">
                    <span className="glass-card px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] border-cyan-500/30 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_cyan]"></div>
                        V3.0 ALPHA NOW DEPLOYED
                    </span>
                </div>
                <h1>Deploying Capital <br/><span className="accent-text">Without Ego.</span></h1>
                <p className="max-w-2xl mx-auto mt-8 text-lg text-slate-400">
                    The ultra-fast, autonomous arbitrage engine powered by Nexus AI Core. <br />
                    Detect market inefficiencies. Execute in milliseconds. Repeat 24/7.
                </p>
                <div className="flex justify-center gap-4 mt-12">
                    <button className="btn-premium btn-primary">
                        <Rocket size={18} /> GET ACCESS
                    </button>
                    <button className="btn-premium btn-outline">
                        DOCUMENTATION <ArrowUpRight size={16} />
                    </button>
                </div>
            </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24">
        <div className="container">
           <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: <Zap className="text-cyan-400" />, title: "Hyper-Speed", desc: "Built on Pyth & low-latency execution brokers. Frontrun trends with confidence." },
                { icon: <Shield className="text-violet-500" />, title: "Self-Healing", desc: "Detects API rate limits or proxy issues and reroutes instantly. 99.9% AI uptime." },
                { icon: <Cpu className="text-emerald-400" />, title: "Quantum Logic", desc: "ORB + FVG logic refined by thousands of simulated historical backtests." }
              ].map((f, i) => (
                <motion.div 
                    key={i}
                    className="glass-panel p-8 glass-card border-none"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                >
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6">
                        {f.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
           </div>
        </div>
      </section>

      {/* Terminal Mockup */}
      <section id="terminal" className="py-24">
        <div className="container">
            <div className="glass-panel p-1 border-white/5">
                <div className="terminal-window">
                    <div className="terminal-header items-center justify-between">
                        <div className="flex gap-2">
                            <div className="dot dot-red"></div>
                            <div className="dot dot-yellow"></div>
                            <div className="dot dot-green"></div>
                        </div>
                        <div className="text-[10px] text-slate-500 tracking-widest font-mono">NEXUS-NODE-01: ROOT</div>
                        <div className="w-12"></div>
                    </div>
                    <div className="terminal-body h-[450px]">
                        <AnimatePresence>
                            {logs.map((log, idx) => (
                                <motion.div 
                                    key={`${idx}-${log}`}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="mb-1.5 font-mono"
                                >
                                    <span className="text-slate-600 mr-3">[{new Date().toLocaleTimeString('en-GB')}]</span>
                                    <span className={
                                        log.includes('[TRADE]') ? 'text-cyan-400' : 
                                        log.includes('[ERROR]') ? 'text-red-400' : 
                                        log.includes('[SYSTEM]') ? 'text-violet-400' : 'text-emerald-400'
                                    }>
                                        {log}
                                    </span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12 px-6">
                {[
                    { label: "TRADES/Session", val: "1,294" },
                    { label: "AVG WIN RATE", val: "68.2%" },
                    { label: "ACTIVE TICKERS", val: "42" },
                    { label: "AI CONFIDENCE", val: "99.4%" }
                ].map((stat, i) => (
                    <div key={i} className="text-center">
                        <div className="text-xs text-slate-500 tracking-widest mb-2">{stat.label}</div>
                        <div className="text-2xl font-bold text-white tabular-nums">{stat.val}</div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32">
        <div className="container text-center">
             <h2 className="text-4xl font-bold mb-8">Ready to Scale?</h2>
             <button className="btn-premium btn-primary mx-auto h-16 px-12 text-lg">
                GET STARTED NOW <ChevronRight size={24} />
             </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="container flex flex-col items-center">
             <div className="bg-gradient-to-tr from-cyan-400 to-purple-500 bg-clip-text text-transparent font-bold text-2xl mb-4">NEXUS</div>
             <p className="text-slate-600 text-xs">© 2026 NEXUS AI CORE. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  )
}
