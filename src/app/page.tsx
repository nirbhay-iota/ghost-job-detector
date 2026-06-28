'use client';

import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, ShieldAlert, Building2, Briefcase, Loader2, Edit3, ArrowRight, Activity, Terminal } from 'lucide-react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const resetAll = () => {
    setResult(null);
    setError(null);
    setUrl('');
    setManualCompany('');
    setManualTitle('');
    setShowManualForm(false);
  };

  const handleAnalyze = async (e: React.FormEvent, isManualSubmit = false) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const payload = isManualSubmit ? { manualCompany, manualTitle } : { jobUrl: url };
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'AUTH_BLOCK') {
          setShowManualForm(true);
          throw new Error(data.message);
        }
        throw new Error(data.error || 'Analysis failed.');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-orange-500 selection:text-black relative flex flex-col items-center p-6 md:p-12">
      
      {/* Architectural Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:40px_40px] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-4xl z-10 space-y-12 mt-10 md:mt-20">
        
        {/* Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-zinc-700 bg-black text-xs font-mono uppercase tracking-widest text-zinc-400">
            <Terminal className="w-3 h-3 text-orange-500" />
            <span>SYS_READY // GHOST_JOB_DETECTOR</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white">
            Market Signals.<br />
            <span className="text-zinc-500">Zero Noise.</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl font-medium">
            Verify active hiring momentum before allocating application effort. Powered by real-time corporate footprint analysis.
          </p>
        </div>

        {/* Input Section */}
        <div>
          {!result && !showManualForm && (
            <form onSubmit={(e) => handleAnalyze(e, false)} className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-zinc-600" />
                </div>
                <input 
                  type="url" 
                  required 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste LinkedIn or ATS Job URL..."
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-none py-4 pl-12 pr-4 text-white font-mono text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors shadow-[4px_4px_0px_0px_rgba(249,115,22,0.2)] focus:shadow-[4px_4px_0px_0px_rgba(249,115,22,1)]"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-white text-black px-8 py-4 rounded-none font-bold uppercase tracking-widest border-2 border-white hover:bg-orange-500 hover:border-orange-500 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(113,113,122,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Execute'}
              </button>
            </form>
          )}

          {/* Error Banner */}
          {error && (
            <div className={`mt-6 p-4 border-2 flex items-start gap-3 bg-black ${
              showManualForm ? 'border-orange-500 text-orange-500 shadow-[4px_4px_0px_0px_#f97316]' : 'border-red-500 text-red-500 shadow-[4px_4px_0px_0px_#ef4444]'
            }`}>
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-mono font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* Manual Input Form */}
          {showManualForm && !result && (
            <form onSubmit={(e) => handleAnalyze(e, true)} className="mt-8 bg-zinc-950 border-2 border-zinc-700 p-8 shadow-[6px_6px_0px_0px_#f97316] space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b-2 border-zinc-800">
                <Edit3 className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-mono font-bold text-white uppercase tracking-widest">Manual Override Required</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">Target Company</label>
                  <input 
                    type="text" required value={manualCompany} onChange={(e) => setManualCompany(e.target.value)}
                    placeholder="e.g. Stripe"
                    className="w-full bg-black border-2 border-zinc-800 rounded-none px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">Requisition Title</label>
                  <input 
                    type="text" required value={manualTitle} onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    className="w-full bg-black border-2 border-zinc-800 rounded-none px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" disabled={loading} className="flex-1 bg-orange-500 text-black py-4 border-2 border-orange-500 font-bold uppercase tracking-widest hover:bg-white hover:border-white transition-all shadow-[4px_4px_0px_0px_#fff] active:translate-x-1 active:translate-y-1 active:shadow-none flex justify-center items-center">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Run Analysis'}
                </button>
                <button type="button" onClick={resetAll} className="px-8 py-4 border-2 border-zinc-700 text-zinc-400 font-bold uppercase tracking-widest hover:text-white hover:border-white transition-colors">
                  Abort
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Results Data Matrix */}
        {result && (
          <div className="bg-black border-2 border-white shadow-[8px_8px_0px_0px_#f97316] animate-in fade-in slide-in-from-bottom-8">
            
            {/* Header Section */}
            <div className="p-8 border-b-2 border-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">{result.jobTitle}</h2>
                <div className="flex items-center gap-2 text-zinc-400 font-mono text-sm uppercase">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  {result.company}
                </div>
              </div>
              
              <div className={`flex flex-col items-center justify-center shrink-0 w-24 h-24 border-4 ${
                result.score > 50 ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-green-500 bg-green-500/10 text-green-500'
              }`}>
                <span className="text-3xl font-bold">{result.score}</span>
                <span className="text-[10px] font-mono uppercase font-bold tracking-widest">Risk</span>
              </div>
            </div>

            {/* Verdict Bar */}
            <div className={`p-6 border-b-2 border-white flex items-center gap-4 ${
              result.score > 50 ? 'bg-red-500 text-black' : 'bg-green-500 text-black'
            }`}>
              {result.score > 50 ? <ShieldAlert className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
              <span className="text-xl font-bold uppercase tracking-widest">
                {result.verdict}
              </span>
            </div>

            {/* Logs Section */}
            <div className="p-8 bg-zinc-950">
              <h3 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest mb-6">System Logs // Heuristics</h3>
              <div className="space-y-0 border-2 border-zinc-800">
                {result.flags.map((flag: string, idx: number) => {
                  const isPositive = flag.toLowerCase().includes('clear') || flag.toLowerCase().includes('recent') || flag.toLowerCase().includes('worthy');
                  return (
                    <div key={idx} className="flex items-start gap-4 p-4 border-b-2 border-zinc-800 last:border-0 bg-black">
                      <div className="mt-0.5">
                        {isPositive ? (
                          <Activity className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                        )}
                      </div>
                      <span className="text-sm font-mono text-zinc-300 leading-relaxed">{flag}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={resetAll} 
                  className="font-mono text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white flex items-center gap-2 transition-colors group"
                >
                  [ Initialize New Scan ]
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}