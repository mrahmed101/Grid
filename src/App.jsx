import React, { useState, useEffect, useRef } from 'react';
import { Activity, LayoutGrid, BrainCircuit, Wallet, Settings, Search, Plus, Trash2, ArrowUpRight, AlertTriangle, Zap, RefreshCw, CheckCircle2, Power } from 'lucide-react';

// =====================================================================
// HELPER FUNCTIONS & MATH ENGINE
// =====================================================================
const formatPrice = (price) => {
  if (price === undefined || price === null || isNaN(price)) return '0.00';
  const num = Number(price);
  return num < 1.00 ? num.toFixed(4) : num.toFixed(2);
};

const calculateCommissions = (shares, price) => {
  if (shares < 200 && price < 1.00 && price > 0) return 0.005 * shares; 
  return 0; 
};

// --- DYNAMIC SCRIPT LOADER FOR TRADINGVIEW CHARTS ---
// This safely bypasses bundler resolution errors by loading the library directly into the browser.
let scriptPromise = null;
const loadLightweightCharts = () => {
  if (window.LightweightCharts) return Promise.resolve(window.LightweightCharts);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';
      script.async = true;
      script.onload = () => resolve(window.LightweightCharts);
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

// =====================================================================
// UI COMPONENTS
// =====================================================================

// --- TRADINGVIEW LIGHTWEIGHT CHART COMPONENT ---
const TradingViewChart = ({ data, height = 150 }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    let chart;
    let isMounted = true;
    let handleResize;

    loadLightweightCharts().then((LightweightCharts) => {
      if (!isMounted || !chartContainerRef.current) return;
      const { createChart, CrosshairMode } = LightweightCharts;

      chart = createChart(chartContainerRef.current, {
        height: height,
        layout: { 
          background: { type: 'solid', color: 'transparent' }, 
          textColor: '#71717a' 
        },
        grid: { 
          vertLines: { color: '#1A1A1A' }, 
          horzLines: { color: '#1A1A1A' } 
        },
        crosshair: { 
          mode: CrosshairMode.Normal 
        },
        timeScale: { 
          borderColor: '#1A1A1A', 
          timeVisible: true,
          secondsVisible: false
        },
        rightPriceScale: { 
          borderColor: '#1A1A1A' 
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981', 
        downColor: '#f43f5e',
        borderVisible: false,
        wickUpColor: '#10b981', 
        wickDownColor: '#f43f5e',
      });

      chartRef.current = chart;
      seriesRef.current = candleSeries;

      if (data && data.length > 0) {
        candleSeries.setData(data);
      }

      handleResize = () => {
        if (chartContainerRef.current && chart) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
    });

    return () => {
      isMounted = false;
      if (handleResize) window.removeEventListener('resize', handleResize);
      if (chart) chart.remove();
    };
  }, [height]); // Run once on mount or height change

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && data) {
      if (data.length > 0) {
        seriesRef.current.setData(data);
      } else {
        seriesRef.current.setData([]);
      }
    }
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};

// --- TERMINAL VIEW ---
const TerminalView = ({ activeTicker, marketData, settings }) => {
  const data = marketData[activeTicker] || { price: 0, candles1m: [], candles5m: [] };
  const entryPrice = data.price || 0; // Default to 0 since simulation is removed
  
  const [riskUsd, setRiskUsd] = useState(settings.defaultRisk || 50);
  const [slType, setSlType] = useState('pct'); 
  const [slValue, setSlValue] = useState(settings.defaultSlPct || 2.0);
  const [tpUsd, setTpUsd] = useState('');

  const slPrice = slType === 'pct' ? entryPrice * (1 - (slValue / 100)) : slValue;
  const riskPerShare = Math.abs(entryPrice - slPrice);
  const shares = riskPerShare > 0 ? Math.floor(riskUsd / riskPerShare) : 0;
  
  let finalTp = tpUsd ? parseFloat(tpUsd) : entryPrice + (riskPerShare * 2);
  const spread = finalTp - slPrice;
  const isSpreadValid = spread >= 0.008 && entryPrice > 0;
  const commission = calculateCommissions(shares, entryPrice);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      <div className="xl:col-span-1 bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6 flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-[#1A1A1A] pb-4">
          <h2 className="text-xl font-mono text-white font-bold">{activeTicker} <span className="text-zinc-500 text-sm">CALCULATOR</span></h2>
          <div className="text-2xl font-mono text-emerald-400 font-bold">${formatPrice(entryPrice)}</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 font-mono mb-1 block">RISK ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-500 font-mono">$</span>
              <input type="number" value={riskUsd} onChange={(e) => setRiskUsd(e.target.value)} className="w-full bg-[#111] border border-zinc-800 rounded p-2 pl-8 text-white font-mono focus:border-emerald-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 font-mono mb-1 block">SL TYPE</label>
              <div className="flex bg-[#111] border border-zinc-800 rounded p-1">
                <button onClick={() => setSlType('pct')} className={`flex-1 text-xs font-mono py-1.5 rounded ${slType === 'pct' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>% PCT</button>
                <button onClick={() => setSlType('usd')} className={`flex-1 text-xs font-mono py-1.5 rounded ${slType === 'usd' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>$ USD</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-mono mb-1 block">STOP LOSS</label>
              <input type="number" step="0.0001" value={slValue} onChange={(e) => setSlValue(e.target.value)} className="w-full bg-[#111] border border-zinc-800 rounded p-2 text-white font-mono focus:border-red-500 outline-none" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs text-zinc-500 font-mono flex items-center gap-2">
                TAKE PROFIT ($) 
                <span className="text-zinc-700 font-normal">Blank = 1:2 Auto</span>
              </label>
            </div>
            <div className="relative flex items-center">
               <input type="number" step="0.0001" placeholder={formatPrice(finalTp)} value={tpUsd} onChange={(e) => setTpUsd(e.target.value)} className={`w-full bg-[#111] border ${isSpreadValid ? 'border-zinc-800 focus:border-emerald-500' : 'border-red-900/50 focus:border-red-500'} rounded p-2 text-white font-mono outline-none placeholder:text-zinc-700 pr-10`} />
               {/* SPREAD INDICATOR LIGHT */}
               <div className="absolute right-4 flex items-center justify-center">
                  <div className={`w-3 h-3 rounded-full shadow-[0_0_8px] ${isSpreadValid ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`}></div>
               </div>
            </div>
            {!isSpreadValid && entryPrice > 0 && (
               <span className="text-[10px] text-red-500 font-mono mt-1 block">Spread {formatPrice(spread)} is below 0.008 minimum</span>
            )}
          </div>
        </div>

        <div className="mt-auto bg-zinc-950 border border-[#1A1A1A] rounded p-4 space-y-4">
          <div className="flex justify-between items-end">
            <span className="text-sm font-mono text-zinc-400">POSITION SIZE</span>
            <span className="text-3xl font-mono text-white font-bold">{shares} <span className="text-sm text-zinc-500">SHRS</span></span>
          </div>
          
          <div className="flex justify-between text-xs font-mono">
            <span className="text-zinc-500">ENTRY</span>
            <span className="text-zinc-300">${formatPrice(entryPrice)}</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-zinc-500">STOP LOSS</span>
            <span className="text-red-400">${formatPrice(slPrice)}</span>
          </div>
          
          {commission > 0 ? (
            <div className="bg-amber-950/30 border border-amber-900/50 rounded p-2 flex items-center justify-between">
              <span className="text-xs font-mono text-amber-500 flex items-center gap-2"><Wallet className="w-3 h-3" /> TRADEZERO FEE</span>
              <span className="text-xs font-mono text-amber-400">~${formatPrice(commission)}</span>
            </div>
          ) : (
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded p-2 flex items-center justify-center">
               <span className="text-xs font-mono text-emerald-500 flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> COMMISSION FREE</span>
            </div>
          )}
        </div>
      </div>

      <div className="xl:col-span-2 flex flex-col gap-6">
        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4 flex-1 flex flex-col relative">
          <h3 className="text-xs font-mono text-zinc-500 mb-2">1-MINUTE TIMEFRAME</h3>
          {data.candles1m.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-zinc-700 font-mono text-sm z-10 pointer-events-none">AWAITING REAL DATA...</div>}
          <div className="flex-1 min-h-[200px]"><TradingViewChart data={data.candles1m} /></div>
        </div>
        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4 flex-1 flex flex-col relative">
          <h3 className="text-xs font-mono text-zinc-500 mb-2">5-MINUTE TIMEFRAME</h3>
          {data.candles5m.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-zinc-700 font-mono text-sm z-10 pointer-events-none">AWAITING REAL DATA...</div>}
          <div className="flex-1 min-h-[200px]"><TradingViewChart data={data.candles5m} /></div>
        </div>
      </div>
    </div>
  );
};

// --- AI DESK VIEW ---
const AIDeskView = ({ activeTicker, marketData }) => {
  const [newsInput, setNewsInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  const handleNewsScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setAiResponse({
        type: 'news',
        content: `TARGET: ${activeTicker}\nCATALYST: Data Scan\nSENTIMENT: NEUTRAL\n\nIMPACT:\n- API is not connected yet.\n- Will be live in next phase.`
      });
    }, 1000);
  };

  const handleGoLong = () => {
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      setAiResponse({
        type: 'setup',
        content: `ANALYSIS FOR ${activeTicker} @ $${formatPrice(marketData[activeTicker]?.price)}\n\n1. No live Alpaca data connected yet.\n2. Awaiting API integration.`
      });
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full">
       <h2 className="text-xl font-mono text-white font-bold mb-6 border-b border-[#1A1A1A] pb-4 flex items-center gap-2">
          <BrainCircuit className="text-emerald-500 w-6 h-6" /> AI SENTIMENT ENGINE
       </h2>
       <div className="grid grid-cols-2 gap-6 flex-1">
          <div className="space-y-6">
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-5">
              <h3 className="text-sm font-mono text-zinc-400 mb-4 flex justify-between items-center">
                <span>1. NEWS SCANNER</span><span className="text-xs bg-zinc-900 px-2 py-1 rounded text-white">{activeTicker}</span>
              </h3>
              <textarea value={newsInput} onChange={(e) => setNewsInput(e.target.value)} placeholder="Paste Alpaca raw news wire snippet here..." className="w-full h-32 bg-[#111] border border-zinc-800 rounded p-3 text-sm text-zinc-300 font-mono focus:border-blue-500 outline-none resize-none mb-4" />
              <button onClick={handleNewsScan} disabled={isScanning || !newsInput} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 py-3 rounded font-mono text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} EXECUTE NEWS SCAN
              </button>
            </div>
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-5">
              <h3 className="text-sm font-mono text-zinc-400 mb-4 flex justify-between items-center">
                <span>2. QUANT SETUP ANALYSIS</span><span className="text-xs bg-zinc-900 px-2 py-1 rounded text-white">{activeTicker}</span>
              </h3>
              <button onClick={handleGoLong} disabled={isThinking} className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 py-4 rounded font-mono text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-10">
                {isThinking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-emerald-500" />} GO LONG? (ASK ORACLE)
              </button>
            </div>
          </div>
          <div className="bg-[#050505] border border-zinc-800 rounded-xl p-5 flex flex-col font-mono">
            <h3 className="text-xs text-zinc-500 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> GEMINI TERMINAL OUTPUT</h3>
            <div className="flex-1 bg-[#0A0A0A] border border-[#1A1A1A] rounded p-4 overflow-y-auto whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed">
              {aiResponse ? (
                <div><span className={aiResponse.type === 'news' ? 'text-blue-400' : 'text-emerald-400'}>{aiResponse.content}</span></div>
              ) : ( <span className="text-zinc-700">Awaiting input...</span> )}
            </div>
          </div>
       </div>
    </div>
  );
};

// --- SETTINGS VIEW ---
const SettingsView = ({ settings, setSettings }) => (
  <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
    <h2 className="text-xl font-mono text-white font-bold mb-6 border-b border-[#1A1A1A] pb-4 flex items-center gap-2">
      <Settings className="text-zinc-400 w-6 h-6" /> SYSTEM VAULT
    </h2>
    <div className="space-y-6">
      <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-mono text-white font-bold border-b border-zinc-800 pb-2 mb-4">API CREDENTIALS</h3>
        <div>
          <label className="text-xs text-zinc-500 font-mono mb-1 block">ALPACA API KEY (PRICE ACTION)</label>
          <input type="password" value={settings.alpacaKey} onChange={(e) => setSettings({...settings, alpacaKey: e.target.value})} className="w-full bg-[#111] border border-zinc-800 rounded p-2 text-white font-mono focus:border-emerald-500 outline-none" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 font-mono mb-1 block">POLYGON API KEY (SIP VOLUME)</label>
          <input type="password" value={settings.polygonKey} onChange={(e) => setSettings({...settings, polygonKey: e.target.value})} className="w-full bg-[#111] border border-zinc-800 rounded p-2 text-white font-mono focus:border-purple-500 outline-none" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 font-mono mb-1 block">GOOGLE AI STUDIO KEY (GEMINI)</label>
          <input type="password" value={settings.geminiKey} onChange={(e) => setSettings({...settings, geminiKey: e.target.value})} className="w-full bg-[#111] border border-zinc-800 rounded p-2 text-white font-mono focus:border-blue-500 outline-none" />
        </div>
      </div>
      <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-mono text-white font-bold border-b border-zinc-800 pb-2 mb-4">DEFAULT VARIABLES</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 font-mono mb-1 block">DEFAULT RISK ($)</label>
            <input type="number" value={settings.defaultRisk} onChange={(e) => setSettings({...settings, defaultRisk: Number(e.target.value)})} className="w-full bg-[#111] border border-zinc-800 rounded p-2 text-white font-mono focus:border-zinc-500 outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-mono mb-1 block">DEFAULT SL (%)</label>
            <input type="number" step="0.1" value={settings.defaultSlPct} onChange={(e) => setSettings({...settings, defaultSlPct: Number(e.target.value)})} className="w-full bg-[#111] border border-zinc-800 rounded p-2 text-white font-mono focus:border-zinc-500 outline-none" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// =====================================================================
// MAIN APP COMPONENT
// =====================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('terminal'); 
  const [tickers, setTickers] = useState(['SPY', 'QQQ', 'NVDA', 'HOLO']);
  const [activeTicker, setActiveTicker] = useState('HOLO');
  const [newTickerInput, setNewTickerInput] = useState('');
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('grid_settings');
    return saved ? JSON.parse(saved) : { 
      alpacaKey: '', 
      polygonKey: '', 
      geminiKey: '', 
      defaultRisk: 50, 
      defaultSlPct: 2.0,
      includePreMarket: false // New Setting Added
    };
  });

  const [marketData, setMarketData] = useState({});

  // Initialize empty data sets since we removed the fake simulator
  useEffect(() => {
    const newData = { ...marketData };
    tickers.forEach(t => {
      if (!newData[t]) {
        newData[t] = {
          price: 0,
          candles1m: [],
          candles5m: []
        };
      }
    });
    setMarketData(newData);
  }, [tickers]);

  useEffect(() => {
    localStorage.setItem('grid_settings', JSON.stringify(settings));
  }, [settings]);

  const handleAddTicker = (e) => {
    e.preventDefault();
    if (newTickerInput && !tickers.includes(newTickerInput.toUpperCase())) {
      setTickers([...tickers, newTickerInput.toUpperCase()]);
      setActiveTicker(newTickerInput.toUpperCase());
    }
    setNewTickerInput('');
  };

  const removeTicker = (t) => {
    setTickers(tickers.filter(ticker => ticker !== t));
    if (activeTicker === t) setActiveTicker(tickers[0] || '');
  };

  const handleManualRefresh = () => {
    // Placeholder function for when we connect the API
    console.log("Manual refresh triggered for: ", activeTicker);
  };

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-300 font-sans overflow-hidden selection:bg-emerald-500/30">
      
      {/* SIDEBAR */}
      <div className="w-64 bg-[#0A0A0A] border-r border-[#1A1A1A] flex flex-col z-20">
        <div className="h-20 flex items-center px-6 border-b border-[#1A1A1A]">
          <div className="font-mono text-3xl font-black tracking-[0.2em] text-white">GRID<span className="text-emerald-500">.</span></div>
        </div>

        <div className="p-4 space-y-1 border-b border-[#1A1A1A]">
          <button onClick={() => setActiveTab('terminal')} className={`w-full flex items-center gap-3 px-3 py-2 rounded font-mono text-sm transition-colors ${activeTab === 'terminal' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Activity className="w-4 h-4" /> TERMINAL
          </button>
          <button onClick={() => setActiveTab('charts')} className={`w-full flex items-center gap-3 px-3 py-2 rounded font-mono text-sm transition-colors ${activeTab === 'charts' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <LayoutGrid className="w-4 h-4" /> WALL OF CHARTS
          </button>
          <button onClick={() => setActiveTab('ai')} className={`w-full flex items-center gap-3 px-3 py-2 rounded font-mono text-sm transition-colors ${activeTab === 'ai' ? 'bg-zinc-900 text-emerald-400' : 'text-zinc-500 hover:text-emerald-500'}`}>
            <BrainCircuit className="w-4 h-4" /> AI DESK
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2 rounded font-mono text-sm transition-colors ${activeTab === 'settings' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Settings className="w-4 h-4" /> VAULT
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          <h3 className="text-xs font-mono font-bold text-zinc-600 mb-4 tracking-wider">ACTIVE WATCHLIST</h3>
          <div className="space-y-1 flex-1">
            {tickers.map(ticker => (
              <div key={ticker} onClick={() => { setActiveTicker(ticker); setActiveTab('terminal'); }} className={`group flex items-center justify-between p-2 rounded cursor-pointer border ${activeTicker === ticker ? 'bg-zinc-900 border-zinc-700' : 'border-transparent hover:bg-zinc-900/50'}`}>
                <div className="flex flex-col">
                  <span className={`font-mono text-sm font-bold ${activeTicker === ticker ? 'text-emerald-400' : 'text-zinc-300'}`}>{ticker}</span>
                  <span className="font-mono text-xs text-zinc-500">${formatPrice(marketData[ticker]?.price)}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeTicker(ticker); }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-all p-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddTicker} className="mt-4 pt-4 border-t border-[#1A1A1A]">
            <div className="relative">
              <Plus className="absolute left-2 top-2 w-4 h-4 text-zinc-500" />
              <input type="text" value={newTickerInput} onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())} placeholder="ADD TICKER..." className="w-full bg-[#111] border border-zinc-800 rounded p-1.5 pl-8 text-xs font-mono text-white focus:border-zinc-500 outline-none uppercase placeholder:text-zinc-700" />
            </div>
          </form>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {activeTab === 'terminal' && (
          <div className="h-20 border-b border-[#1A1A1A] flex items-center px-8 bg-[#050505]/90 backdrop-blur z-10 justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-mono font-black text-white tracking-tight">{activeTicker}</h1>
              <div className="flex flex-col">
                <span className="text-2xl font-mono font-bold text-emerald-400 leading-none">${formatPrice(marketData[activeTicker]?.price)}</span>
                <span className="text-xs font-mono text-zinc-500 flex items-center gap-1 mt-1">REAL-TIME FEED</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
               {/* INCLUDE PRE MARKET TOGGLE */}
               <label className="flex items-center gap-2 cursor-pointer group">
                  <span className="text-xs font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">EXTENDED HOURS</span>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.includePreMarket ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                     <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${settings.includePreMarket ? 'left-4.5' : 'left-0.5'}`} style={{ left: settings.includePreMarket ? '18px' : '2px' }}></div>
                  </div>
                  <input type="checkbox" className="hidden" checked={settings.includePreMarket} onChange={() => setSettings({...settings, includePreMarket: !settings.includePreMarket})} />
               </label>

               <div className="h-6 w-px bg-[#1A1A1A]"></div>

               {/* REFRESH BUTTON */}
               <button onClick={handleManualRefresh} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-all" title="Manual Refresh">
                 <RefreshCw className="w-4 h-4" />
               </button>

               <div className="text-right flex flex-col items-end">
                  <span className="text-xs font-mono text-zinc-500">MARKET STATUS</span>
                  <span className="text-sm font-mono text-red-500 flex items-center gap-1"><Power className="w-3 h-3" /> OFFLINE</span>
               </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'terminal' && <TerminalView activeTicker={activeTicker} marketData={marketData} settings={settings} />}
          {activeTab === 'charts' && (
            <div className="h-full flex flex-col">
              <h2 className="text-xl font-mono text-white font-bold mb-6 border-b border-[#1A1A1A] pb-4">WALL OF CHARTS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 overflow-y-auto pr-2 pb-20">
                {tickers.map(t => (
                  <div key={t} onClick={() => { setActiveTicker(t); setActiveTab('terminal'); }} className="bg-[#0A0A0A] border border-[#1A1A1A] hover:border-zinc-700 transition-colors cursor-pointer rounded-xl p-4 h-64 flex flex-col group">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-mono font-bold text-white group-hover:text-emerald-400">{t}</span>
                      <span className="font-mono text-sm text-zinc-400">${formatPrice(marketData[t]?.price)}</span>
                    </div>
                    <div className="flex-1 cursor-crosshair relative">
                       {(!marketData[t]?.candles1m || marketData[t].candles1m.length === 0) && <div className="absolute inset-0 flex items-center justify-center text-zinc-700 font-mono text-sm z-10 pointer-events-none">AWAITING REAL DATA...</div>}
                       <TradingViewChart data={marketData[t]?.candles1m} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'ai' && <AIDeskView activeTicker={activeTicker} marketData={marketData} />}
          {activeTab === 'settings' && <SettingsView settings={settings} setSettings={setSettings} />}
        </div>
      </div>
    </div>
  );
}