'use client';

import React from 'react';
import { 
  TrendingUp, 
  Flame, 
  Award, 
  Target,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { mockUserStats } from '@/data/mockData';

export default function ProgressPage() {
  const statsList = [
    { label: 'Current level', value: mockUserStats.level, sub: mockUserStats.levelTitle, color: 'text-indigo-400', icon: Award },
    { label: 'Study streak', value: `${mockUserStats.streakDays} Days`, sub: 'Active Streak', color: 'text-amber-500', icon: Flame },
    { label: 'XP accumulated', value: `${mockUserStats.xp} XP`, sub: `Next tier: ${mockUserStats.xpNextLevel} XP`, color: 'text-cyan-400', icon: TrendingUp }
  ];

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center gap-2.5 text-zinc-400 mb-1">
          <Target className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">Analytics Dashboard</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Your Progress Profile</h2>
        <p className="text-xs text-zinc-400 mt-1">Review your current standing, badges, and learning analytics.</p>
      </div>

      {/* Grid of basic stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {statsList.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="p-6 rounded-2xl glass-panel border border-zinc-900 flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white font-mono">{stat.value}</span>
                <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mock Skill Trees / Gamification plugins info */}
      <div className="p-6 rounded-2xl glass-panel border border-zinc-800/80 space-y-4 bg-gradient-to-br from-indigo-950/5 to-cyan-950/5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Unlock Gamified Achievements</h4>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Earn badge multipliers by maintaining your 5-day streak. Reaching Level 5 unlocks customized AI quiz formats, including interactive flashcards and coding challenges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
