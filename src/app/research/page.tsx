'use client';

import React from 'react';
import { Search, Sparkles, AlertCircle } from 'lucide-react';

export default function ResearchPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5 max-w-md mx-auto h-full">
      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
        <Search className="w-7 h-7 animate-pulse" />
      </div>
      
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
          AI Research Engine
          <span className="text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
            OFFLINE
          </span>
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The research synthesis engine aggregates ArXiv, Google Scholar, and course modules to summarize academic literature.
        </p>
      </div>

      <div className="p-3 bg-zinc-900/40 border border-zinc-900 rounded-xl text-[10px] font-mono text-zinc-500 flex items-center gap-2 text-left">
        <AlertCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span>Gemini API connection required to run semantic scholarly crawls. Mode currently running locally.</span>
      </div>
    </div>
  );
}
