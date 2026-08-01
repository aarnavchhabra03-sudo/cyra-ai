'use client';

import React from 'react';
import { Settings, Shield, Sliders, Database, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const configs = [
    { title: 'Default LLM Model', val: 'Gemini 1.5 Flash (Synthesizer Engine)', icon: Sliders },
    { title: 'Data Cache Storage', val: 'IndexedDB (Local Mock Data)', icon: Database },
    { title: 'Security Tier', val: 'Secure HTTPS Pipeline', icon: Shield }
  ];

  return (
    <div className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-6">
      <div>
        <div className="flex items-center gap-2.5 text-zinc-400 mb-1">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">User Control Console</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">System Configuration</h2>
        <p className="text-xs text-zinc-400 mt-1">Adjust preferences, interface styling variables, and integration keys.</p>
      </div>

      <div className="p-6 rounded-2xl glass-panel border border-zinc-900 space-y-4">
        {configs.map((config, idx) => {
          const Icon = config.icon;
          return (
            <div key={idx} className="flex justify-between items-center py-3 border-b border-zinc-900 last:border-b-0">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <Icon className="w-4 h-4 text-zinc-500" />
                <span>{config.title}</span>
              </div>
              <span className="text-xs font-mono text-cyan-400">{config.val}</span>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-zinc-900/30 border border-zinc-900 rounded-xl text-[10px] font-mono text-zinc-500 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>Supabase Integration settings (Auth keys and DB links) will be set up in subsequent project steps.</span>
      </div>
    </div>
  );
}
