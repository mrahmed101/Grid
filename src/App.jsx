import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, LayoutGrid, BrainCircuit, Wallet, Settings, Search, Plus, Trash2, AlertTriangle, Zap, RefreshCw, CheckCircle2, Power, Calendar, Wifi } from 'lucide-react';
import { createChart, CrosshairMode } from 'lightweight-charts';

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

const getTodayDateKey = () => {
  const d = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${dayName} ${day}/${month}`;
};

// =====================================================================
// UI COMPONENTS
// =====================================================================

// --- TRADINGVIEW LIGHTWEIGHT CHART COMPONENT ---
const TradingViewChart = ({ data }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // Initialize the Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
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

    // Use ResizeObserver to ensure charts fit perfectly into flex containers
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
           width: chartContainerRef.current.clientWidth,
           height: chartContainerRef.current.clientHeight
        });
      }
    };
    
    handleResize(); // Initial sizing

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
         chartRef.current.remove();
      }
    };
  }, []);

  // Safely inject data into the chart on update
  useEffect(() => {
    if (seriesRef.current && data) {
      try {
         seriesRef.current.setData(data.length > 0 ? data : []);
      } catch (e) {
         console.error("TradingView Chart Data Error:", e);
      }
    }
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full min-h-[200px]" />;
};

// --- TERMINAL VIEW ---
const TerminalView = ({ activeTicker, marketData, settings }) => {
  const data = marketData[activeTicker] || { price: 0, candles1m: [], candles5m: [] };
  const entryPrice = data.price || 0; 
  
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
          <h2 className="text-xl font-mono text-white font-bold">{activeTicker || '---'} <span className="text-zinc-500 text-sm">CALCULATOR</span></h2>
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
          <div className="flex-1 flex flex-col min-h-[200px]"><TradingViewChart data={data.candles1m} /></div>
        </div>
        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4 flex-1 flex flex-col relative">
          <h3 className="text-xs font-mono text-zinc-500 mb-2">5-MINUTE TIMEFRAME</h3>
          {data.candles5m.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-zinc-700 font-mono text-sm z-10 pointer-events-none">AWAITING REAL DATA...</div>}
          <div className="flex-1 flex flex-col min-h-[200px]"><TradingViewChart data={data.candles5m} /></div>
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
        content: `TARGET: ${activeTicker}\nCATALYST: Data Scan\nSENTIMENT: NEUTRAL\n\nIMPACT:\n- Google AI Studio is not connected yet.\n- Will be live in next phase.`
      });
    }, 1000);
  };

  const handleGoLong = () => {
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      setAiResponse({
        type: 'setup',
        content: `ANALYSIS FOR ${activeTicker} @ $${formatPrice(marketData[activeTicker]?.price)}\n\n1. Google AI Studio is not connected yet.\n2. Awaiting Gemini integration.`
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
                <span>1. NEWS SCANNER</span><span className="text-xs bg-zinc-900 px-2 py-1 rounded text-white">{activeTicker || '---'}</span>
              </h3>
              <textarea value={newsInput} onChange={(e) => setNewsInput(e.target.value)} placeholder="Paste raw news wire snippet here..." className="w-full h-32 bg-[#111] border border-zinc-800 rounded p-3 text-sm text-zinc-300 font-mono focus:border-blue-500 outline-none resize-none mb-4" />
              <button onClick={handleNewsScan} disabled={isScanning || !newsInput || !activeTicker} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 py-3 rounded font-mono text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} EXECUTE NEWS SCAN
              </button>
            </div>
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-5">
              <h3 className="text-sm font-mono text-zinc-400 mb-4 flex justify-between items-center">
                <span>2. QUANT SETUP ANALYSIS</span><span className="text-xs bg-zinc-900 px-2 py-1 rounded text-white">{activeTicker || '---'}</span>
              </h3>
              <button onClick={handleGoLong} disabled={isThinking || !activeTicker} className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 py-4 rounded font-mono text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-10">
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
          <label className="text-xs text-zinc-500 font-mono mb-1 block">ALPACA API KEY ID (PRICE ACTION)</label>
          <input type="password" value={settings.alpacaKey} onChange={(e) => setSettings({...settings, alpacaKey: e.target.value})} className="w-full bg-[#111] border border-zinc-800 rounded p-2 text-white font-mono focus:border-emerald-500 outline-none" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 font-mono mb-1 block">ALPACA SECRET KEY (REQUIRED)</label>
          <input type="password" value={settings.alpacaSecret} onChange={(e) => setSettings({...settings, alpacaSecret: e.target.value})} className="w-full bg-[#111] border border-zinc-800 rounded p-2 text-white font-mono focus:border-emerald-500 outline-none" />
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
  const todayKey = getTodayDateKey();

  const [activeTab, setActiveTab] = useState('terminal'); 
  const [newTickerInput, setNewTickerInput] = useState('');
  
  // Watchlist State Map (Date string -> Array of Tickers)
  const [watchlists, setWatchlists] = useState(() => {
    const saved = localStorage.getItem('grid_watchlists');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure today's list always exists
      if (!parsed[todayKey]) {
        parsed[todayKey] = [];
      }
      return parsed;
    }
    // Default initial state
    return { [todayKey]: ['SPY', 'QQQ', 'NVDA'] };
  });

  const [viewingListDate, setViewingListDate] = useState(todayKey);
  const activeListTickers = watchlists[viewingListDate] || [];
  const [activeTicker, setActiveTicker] = useState(activeListTickers[0] || '');

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('grid_settings');
    return saved ? JSON.parse(saved) : { 
      alpacaKey: '', 
      alpacaSecret: '', 
      polygonKey: '', 
      geminiKey: '', 
      defaultRisk: 50, 
      defaultSlPct: 2.0,
      includePreMarket: false 
    };
  });

  const [marketData, setMarketData] = useState({});
  const [marketStatus, setMarketStatus] = useState('OFFLINE'); // 'OFFLINE', 'LIVE (IEX)', 'ERROR'
  const [isFetching, setIsFetching] = useState(false);

  // Automatically save settings and watchlists
  useEffect(() => {
    localStorage.setItem('grid_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('grid_watchlists', JSON.stringify(watchlists));
  }, [watchlists]);

  // The actual live data fetch engine
  const fetchMarketData = useCallback(async () => {
    const { alpacaKey, alpacaSecret } = settings;
    
    // Safety checks
    if (!alpacaKey || !alpacaSecret) {
      setMarketStatus('OFFLINE');
      return;
    }
    if (activeListTickers.length === 0) return;

    setIsFetching(true);

    try {
      const symbols = activeListTickers.join(',');
      const headers = {
        'APCA-API-KEY-ID': alpacaKey,
        'APCA-API-SECRET-KEY': alpacaSecret,
        'Accept': 'application/json'
      };

      // Pull historical 1m and 5m bars from Alpaca
      const [res1m, res5m, resTrades] = await Promise.all([
        fetch(`https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols}&timeframe=1Min&limit=500&feed=iex`, { headers }),
        fetch(`https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols}&timeframe=5Min&limit=200&feed=iex`, { headers }),
        fetch(`https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${symbols}&feed=iex`, { headers })
      ]);

      if (!res1m.ok) {
         setMarketStatus('INVALID KEYS');
         setIsFetching(false);
         return;
      }

      const [data1m, data5m, dataTrades] = await Promise.all([
        res1m.json(),
        res5m.json(),
        resTrades.json()
      ]);

      setMarketData(prev => {
        const newData = { ...prev };
        
        activeListTickers.forEach(ticker => {
          const raw1m = data1m.bars?.[ticker] || [];
          const raw5m = data5m.bars?.[ticker] || [];
          const latestTrade = dataTrades.trades?.[ticker];

          // SAFEGUARD FORMATTER: Drops Duplicate Timestamps that Crash TradingView
          const formatBars = (bars) => {
            if (!bars || !Array.isArray(bars)) return [];
            const unique = [];
            let lastTime = 0;
            
            // Ensure strict chronological sort first
            const sorted = [...bars].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
            
            sorted.forEach(b => {
              const t = Math.floor(new Date(b.t).getTime() / 1000);
              if (t > lastTime) {
                unique.push({ time: t, open: b.o, high: b.h, low: b.l, close: b.c });
                lastTime = t;
              } else if (t === lastTime && unique.length > 0) {
                // If Alpaca glitch pushes two bars for same exact minute, override with newest
                unique[unique.length - 1] = { time: t, open: b.o, high: b.h, low: b.l, close: b.c };
              }
            });
            return unique;
          };

          const formatted1m = formatBars(raw1m);
          const formatted5m = formatBars(raw5m);

          let price = prev[ticker]?.price || 0;
          if (latestTrade && latestTrade.p) {
             price = latestTrade.p;
          } else if (formatted1m.length > 0) {
             price = formatted1m[formatted1m.length - 1].close;
          }

          newData[ticker] = {
            price,
            candles1m: formatted1m,
            candles5m: formatted5m
          };
        });
        return newData;
      });

      setMarketStatus('LIVE (IEX)');
    } catch (error) {
      console.error('Alpaca Fetch Error:', error);
      setMarketStatus('ERROR');
    } finally {
      setIsFetching(false);
    }
  }, [activeListTickers, settings]);

  // Initial load and 15-second Auto-Refresh Loop
  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 15000); 
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Ensure currently viewed list's tickers exist in marketData locally if empty
  useEffect(() => {
    const newData = { ...marketData };
    let changed = false;
    activeListTickers.forEach(t => {
      if (!newData[t]) {
        newData[t] = { price: 0, candles1m: [], candles5m: [] };
        changed = true;
      }
    });
    if (changed) setMarketData(newData);
    
    // If active ticker is blank but list has items, select the first
    if (!activeTicker && activeListTickers.length > 0) {
      setActiveTicker(activeListTickers[0]);
    }
  }, [activeListTickers, activeTicker]);

  const handleAddTicker = (e) => {
    e.preventDefault();
    const t = newTickerInput.toUpperCase();
    if (t && !activeListTickers.includes(t)) {
      setWatchlists(prev => ({
        ...prev,
        [viewingListDate]: [...(prev[viewingListDate] || []), t]
      }));
      setActiveTicker(t);
    }
    setNewTickerInput('');
  };

  const removeTicker = (dateKey, t) => {
    setWatchlists(prev => {
      const updatedList = prev[dateKey].filter(ticker => ticker !== t);
      return { ...prev, [dateKey]: updatedList };
    });
    if (activeTicker === t && viewingListDate === dateKey) {
       setActiveTicker('');
    }
  };

  const copyToToday = (t) => {
    setWatchlists(prev => {
      const todayList = prev[todayKey] || [];
      if (!todayList.includes(t)) {
        return { ...prev, [todayKey]: [...todayList, t] };
      }
      return prev;
    });
  };

  const deleteEntireList = (dateKey) => {
    if (dateKey === todayKey) return; 
    if (window.confirm(`Delete the watchlist for ${dateKey}?`)) {
      setWatchlists(prev => {
        const newState = { ...prev };
        delete newState[dateKey];
        return newState;
      });
      if (viewingListDate === dateKey) {
        setViewingListDate(todayKey);
        setActiveTicker(watchlists[todayKey]?.[0] || '');
      }
    }
  };

  const handleManualRefresh = () => {
    fetchMarketData();
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

        <div className="flex-1 overflow-y-auto flex flex-col">
          
          {/* WATCHLIST SELECTOR */}
          <div className="p-4 border-b border-[#1A1A1A] bg-[#0A0A0A] sticky top-0 z-10">
             <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-mono font-bold text-zinc-600 tracking-wider flex items-center gap-2"><Calendar className="w-3 h-3"/> WATCHLISTS</h3>
                {viewingListDate !== todayKey && (
                   <button onClick={() => deleteEntireList(viewingListDate)} className="text-zinc-600 hover:text-red-500 transition-colors" title="Delete entire list">
                      <Trash2 className="w-3 h-3" />
                   </button>
                )}
             </div>
             <select 
               value={viewingListDate} 
               onChange={(e) => setViewingListDate(e.target.value)}
               className="w-full bg-[#111] border border-zinc-800 rounded p-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-emerald-500 cursor-pointer"
             >
               {Object.keys(watchlists).sort((a,b) => b.localeCompare(a)).map(dateStr => (
                 <option key={dateStr} value={dateStr}>
                    {dateStr} {dateStr === todayKey ? '(TODAY)' : ''}
                 </option>
               ))}
             </select>
          </div>

          <div className="p-4 space-y-1 flex-1 overflow-y-auto">
            {activeListTickers.length === 0 && (
               <div className="text-xs font-mono text-zinc-600 text-center mt-4 border border-dashed border-zinc-800 rounded p-4">LIST IS EMPTY</div>
            )}
            {activeListTickers.map(ticker => (
              <div key={ticker} onClick={() => { setActiveTicker(ticker); setActiveTab('terminal'); }} className={`group flex items-center justify-between p-2 rounded cursor-pointer border ${activeTicker === ticker ? 'bg-zinc-900 border-zinc-700' : 'border-transparent hover:bg-zinc-900/50'}`}>
                <div className="flex flex-col">
                  <span className={`font-mono text-sm font-bold ${activeTicker === ticker ? 'text-emerald-400' : 'text-zinc-300'}`}>{ticker}</span>
                  <span className="font-mono text-xs text-zinc-500">${formatPrice(marketData[ticker]?.price)}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {/* Show + button to copy to today's list IF viewing an old list */}
                  {viewingListDate !== todayKey && !(watchlists[todayKey] || []).includes(ticker) && (
                     <button onClick={(e) => { e.stopPropagation(); copyToToday(ticker); }} className="text-zinc-500 hover:text-emerald-400 p-1" title="Add to Today's List">
                       <Plus className="w-3 h-3" />
                     </button>
                  )}
                  {/* Remove from current list button */}
                  <button onClick={(e) => { e.stopPropagation(); removeTicker(viewingListDate, ticker); }} className="text-zinc-600 hover:text-red-500 p-1" title="Remove from list">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddTicker} className="p-4 border-t border-[#1A1A1A]">
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
              <h1 className="text-4xl font-mono font-black text-white tracking-tight">{activeTicker || '---'}</h1>
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
               <button onClick={handleManualRefresh} disabled={isFetching} className={`p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-all ${isFetching ? 'opacity-50' : ''}`} title="Manual Refresh">
                 <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
               </button>

               <div className="text-right flex flex-col items-end">
                  <span className="text-xs font-mono text-zinc-500">MARKET STATUS</span>
                  {marketStatus === 'LIVE (IEX)' ? (
                    <span className="text-sm font-mono text-emerald-500 flex items-center gap-1"><Wifi className="w-3 h-3" /> LIVE (IEX)</span>
                  ) : (
                    <span className="text-sm font-mono text-red-500 flex items-center gap-1"><Power className="w-3 h-3" /> {marketStatus}</span>
                  )}
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
                {activeListTickers.map(t => (
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