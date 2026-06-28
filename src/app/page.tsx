'use client';

import { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, ShieldAlert, Building2, Briefcase, Loader2 } from 'lucide-react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobUrl: url })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze the job posting.");
      }
      
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-12 flex flex-col items-center font-sans selection:bg-zinc-200">
      <div className="max-w-2xl w-full space-y-10 mt-10 md:mt-20">
        
        {/* Header Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-zinc-100 rounded-2xl mb-2">
            <Search className="w-6 h-6 text-zinc-700" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 tracking-tight">Ghost Job Detector</h1>
          <p className="text-lg text-zinc-500 max-w-lg mx-auto">
            Paste a job posting URL to scan its age and company momentum. Stop applying to jobs that don't exist.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="relative flex items-center shadow-sm">
          <input 
            type="url" 
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/..." 
            className="w-full pl-4 pr-36 py-4 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-black outline-none transition-all text-zinc-900"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="absolute right-2 bg-black text-white px-6 py-2.5 rounded-lg font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Scanning' : 'Analyze'}
          </button>
        </form>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Results Card */}
        {result && (
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-zinc-200 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-zinc-400" />
                  {result.jobTitle}
                </h2>
                <p className="text-zinc-500 text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-zinc-400" />
                  {result.company}
                </p>
              </div>
              
              <div className={`flex flex-col items-center justify-center shrink-0 w-20 h-20 rounded-full font-bold text-2xl border-4 ${
                result.score > 50 ? 'border-red-100 bg-red-50 text-red-600' : 'border-green-100 bg-green-50 text-green-600'
              }`}>
                {result.score}
              </div>
            </div>

            <div className={`p-4 rounded-xl mb-8 flex items-center gap-3 border ${
              result.score > 50 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'
            }`}>
              {result.score > 50 ? <ShieldAlert className="w-6 h-6 shrink-0" /> : <CheckCircle className="w-6 h-6 shrink-0" />}
              <span className="font-semibold text-lg">{result.verdict}</span>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Analysis Flags</h3>
              <ul className="space-y-3">
                {result.flags.map((flag: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-zinc-700 bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                    <AlertTriangle className={`w-5 h-5 shrink-0 ${
                      flag.toLowerCase().includes('good') || flag.toLowerCase().includes('recent') || flag.toLowerCase().includes('worth') 
                      ? 'text-green-500' 
                      : 'text-amber-500'
                    }`} />
                    <span className="text-sm leading-tight pt-0.5">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}