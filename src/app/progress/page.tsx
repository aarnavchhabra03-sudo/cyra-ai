'use client';

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Flame, 
  Award, 
  Target,
  Sparkles,
  BookOpen,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { mockUserStats } from '@/data/mockData';
import { createClient } from '@/lib/supabase/client';

export interface ConceptMasteryRow {
  id: string;
  concept: string;
  mastery_score: number;
  questions_attempted: number;
  questions_correct: number;
  last_result: 'weak' | 'developing' | 'proficient' | 'mastered';
  last_practiced_at: string;
}

export default function ProgressPage() {
  const [masteryRecords, setMasteryRecords] = useState<ConceptMasteryRow[]>([]);
  const [loadingMastery, setLoadingMastery] = useState<boolean>(true);

  useEffect(() => {
    async function fetchMastery() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('user_concept_mastery')
            .select('*')
            .order('mastery_score', { ascending: false });
          if (!error && data) {
            setMasteryRecords(data as ConceptMasteryRow[]);
          }
        }
      } catch (err) {
        console.error('[PROGRESS] Error fetching concept mastery:', err);
      } finally {
        setLoadingMastery(false);
      }
    }
    fetchMastery();
  }, []);

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
        <p className="text-xs text-zinc-400 mt-1">Review your current standing, concept mastery, and learning analytics.</p>
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

      {/* STAGE 12.4: PERSISTED CONCEPT MASTERY TRACKER */}
      <div className="p-6 rounded-2xl glass-panel border border-zinc-800/80 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Concept Mastery Tracker</h3>
              <p className="text-[11px] text-zinc-400">Persistent analytics derived from your quiz attempts.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            {masteryRecords.length} Concepts Tracked
          </span>
        </div>

        {loadingMastery ? (
          <div className="py-6 text-center text-xs text-zinc-500 font-mono animate-pulse">
            Loading concept mastery analytics...
          </div>
        ) : masteryRecords.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-950/40 border border-zinc-900 text-center space-y-2">
            <BookOpen className="w-6 h-6 text-indigo-400 mx-auto" />
            <p className="text-xs text-zinc-400">No concept mastery records tracked yet.</p>
            <p className="text-[11px] text-zinc-500">Complete an AI quiz to populate your personalized concept intelligence profile.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {masteryRecords.map((m) => {
              const isMastered = m.last_result === 'mastered';
              const isProficient = m.last_result === 'proficient';
              const isDeveloping = m.last_result === 'developing';
              
              const levelColor = isMastered
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : isProficient
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                : isDeveloping
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                : 'bg-red-950/60 border-red-500/40 text-red-300';

              return (
                <div key={m.id} className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-white block">{m.concept}</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {m.questions_correct} / {m.questions_attempted} Questions Correct
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Mastery Bar */}
                    <div className="w-24 bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850 hidden sm:block">
                      <div 
                        className={`h-full ${
                          isMastered ? 'bg-emerald-400' : isProficient ? 'bg-cyan-400' : isDeveloping ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${m.mastery_score}%` }}
                      />
                    </div>

                    <span className="text-xs font-mono font-bold text-white">{m.mastery_score}%</span>

                    <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md border ${levelColor}`}>
                      {m.last_result}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gamification Achievements */}
      <div className="p-6 rounded-2xl glass-panel border border-zinc-800/80 space-y-4 bg-gradient-to-br from-indigo-950/5 to-cyan-950/5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Unlock Gamified Achievements</h4>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Maintain active study streaks to earn badge multipliers. Mastering concepts unlocks customized AI quiz formats and advanced practice modes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
