'use client';

import React from 'react';
import { User, Award, ShieldCheck, Mail } from 'lucide-react';
import { mockUserStats } from '@/data/mockData';

export default function ProfilePage() {
  return (
    <div className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-6">
      <div>
        <div className="flex items-center gap-2.5 text-zinc-400 mb-1">
          <User className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">User Credentials</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Your Profile</h2>
        <p className="text-xs text-zinc-400 mt-1">Review credentials, learning levels, and sync statuses.</p>
      </div>

      <div className="p-6 rounded-2xl glass-panel border border-zinc-900 flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold font-mono flex-shrink-0 shadow-lg shadow-cyan-500/10">
          {mockUserStats.name[0]}
        </div>
        <div className="space-y-1.5 text-center md:text-left">
          <h3 className="text-lg font-bold text-white leading-none">{mockUserStats.name}</h3>
          <p className="text-xs text-zinc-400">{mockUserStats.levelTitle} • Level {mockUserStats.level}</p>
          <div className="flex flex-wrap gap-2 pt-1 justify-center md:justify-start">
            <span className="text-[9px] font-mono bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
              <Mail className="w-3 h-3" /> aarna@example.com
            </span>
            <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" /> Sync Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
