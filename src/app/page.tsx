'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Flame, CheckCircle2, Circle,
  Clock, Award, BookOpen, ArrowUpRight,
  Sparkles, Zap, ChevronRight
} from 'lucide-react';
import {
  mockUserStats, mockDailyTasks, mockCourses,
  DailyTask, UserStats
} from '@/data/mockData';

/* ── Generation step labels ─────────────────────── */
const GEN_STEPS = [
  'Mapping knowledge graph…',
  'Structuring learning roadmap…',
  'Curating reference material…',
  'Building module nodes & quizzes…',
  'Calibrating AI tutor context…',
];

/* ── Prompt suggestions ─────────────────────────── */
const PROMPTS = [
  'Operating Systems',
  'Machine Learning',
  'Master C++',
  'Web Development',
  'Data Structures',
  'Computer Networks',
];

export default function Dashboard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,       setQuery]       = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [step,        setStep]        = useState(0);
  const [progress,    setProgress]    = useState(0);
  const [tasks,       setTasks]       = useState<DailyTask[]>(mockDailyTasks);
  const [stats,       setStats]       = useState<UserStats>(mockUserStats);
  const [inputFocused, setInputFocused] = useState(false);

  /* Focus input on mount for immediate engagement */
  useEffect(() => { inputRef.current?.focus(); }, []);

  /* XP toggle handler */
  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next = !t.completed;
      setStats(s => {
        const xp = Math.max(0, s.xp + (next ? t.xpReward : -t.xpReward));
        return { ...s, xp };
      });
      return { ...t, completed: next };
    }));
  };

  /* Generation simulation */
  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setGenerating(true);
    setStep(0);
    setProgress(0);

    GEN_STEPS.forEach((_, i) => {
      setTimeout(() => {
        setStep(i);
        setProgress(Math.round(((i + 1) / GEN_STEPS.length) * 100));
        if (i === GEN_STEPS.length - 1) {
          setTimeout(() => router.push('/course/operating-systems'), 350);
        }
      }, 480 * (i + 1));
    });
  };

  const activeCourse = mockCourses[0];
  const xpPct = (stats.xp / stats.xpNextLevel) * 100;
  const completedTasks = tasks.filter(t => t.completed).length;

  return (
    <>
      {/* ══ Generation overlay ══════════════════════════════════════════ */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(7,7,10,0.88)', backdropFilter: 'blur(20px)' }}>
          <div className="w-full max-w-sm animate-scale-in"
            style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 20, padding: 32 }}>

            {/* Spinning icon */}
            <div className="flex justify-center mb-6">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full animate-spin-slow"
                  style={{ background: 'conic-gradient(from 0deg, transparent 0%, var(--primary) 60%, var(--cyan) 100%)', padding: 2 }}>
                  <div className="w-full h-full rounded-full" style={{ background: 'var(--bg-elevated)' }} />
                </div>
                <Zap className="w-5 h-5 relative z-10 text-cyan-400" />
              </div>
            </div>

            <h3 className="text-center text-base font-bold text-white mb-1">Building your workspace</h3>
            <p className="text-center text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
              "{query}"
            </p>

            {/* Steps */}
            <div className="space-y-2 mb-5">
              {GEN_STEPS.map((label, i) => {
                const done    = i < step;
                const current = i === step;
                return (
                  <div key={i} className="flex items-center gap-2.5 text-[11px]"
                    style={{ color: done ? 'var(--emerald)' : current ? '#fff' : 'var(--text-muted)' }}>
                    <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center rounded-full text-[8px] font-bold"
                      style={{
                        background: done ? 'rgba(52,211,153,0.15)' : current ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${done ? 'rgba(52,211,153,0.4)' : current ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`
                      }}>
                      {done ? '✓' : i + 1}
                    </span>
                    {label}
                    {current && <span className="ml-auto inline-block w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary), var(--cyan))' }} />
            </div>
            <p className="text-right text-[9px] font-mono mt-1.5" style={{ color: 'var(--text-muted)' }}>{progress}%</p>
          </div>
        </div>
      )}

      {/* ══ Main page ═══════════════════════════════════════════════════ */}
      <div className="min-h-screen flex flex-col">
        
        {/* ── Hero section ─────────────────────────────────────────── */}
        <section className="flex flex-col items-center justify-center px-6 pt-20 pb-14 text-center relative">
          {/* Ambient glow behind input */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
            <div className="w-[500px] h-[300px] rounded-full opacity-40"
              style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
          </div>

          {/* Eyebrow label */}
          <div className="animate-fade-up flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
            <Zap className="w-3 h-3" />
            AI-powered learning workspace
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-75 text-[40px] font-extrabold leading-[1.12] tracking-tight text-white max-w-xl mb-3">
            What do you want<br />
            <span className="text-gradient-brand">to learn today?</span>
          </h1>

          <p className="animate-fade-up delay-150 text-sm max-w-sm mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Tell CYRA a topic and it will build a complete, personalized learning experience — roadmap, notes, quizzes, and a tutor.
          </p>

          {/* ── Hero AI Input ─────────────────────────── */}
          <form onSubmit={handleGenerate}
            className="animate-fade-up delay-225 w-full max-w-xl relative">
            <div className="cyra-input-wrapper flex items-center gap-3 p-2 pl-5">
              {/* Icon */}
              <Sparkles
                className="w-4 h-4 flex-shrink-0 transition-colors duration-300"
                style={{ color: inputFocused ? 'var(--cyan)' : 'var(--text-muted)' }}
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="e.g., Operating Systems, Machine Learning, Rust…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                className="flex-1 bg-transparent text-sm text-white placeholder-[var(--text-muted)] focus:outline-none py-3"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-35 disabled:pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 50%, var(--cyan) 100%)',
                  boxShadow: query.trim() ? '0 0 20px -4px rgba(99,102,241,0.4)' : 'none'
                }}
              >
                Build
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Prompt pills */}
          <div className="animate-fade-up delay-300 flex flex-wrap items-center justify-center gap-2 mt-5">
            {PROMPTS.map(p => (
              <button key={p} className="prompt-pill" onClick={() => { setQuery(p); inputRef.current?.focus(); }}>
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* ── Body content ─────────────────────────────────────────── */}
        <section className="flex-1 px-8 pb-12 max-w-5xl mx-auto w-full">
          
          {/* Section divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="divider-line flex-1" />
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Your workspace
            </span>
            <div className="divider-line flex-1" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ── LEFT: Course + Stats (7 cols) ──────── */}
            <div className="lg:col-span-7 space-y-4">

              {/* Active course card */}
              <div
                onClick={() => router.push(`/course/${activeCourse.id}`)}
                className="glass-card p-6 cursor-pointer group relative overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)' }} />

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded-md mb-3"
                      style={{ background: 'rgba(34,211,238,0.08)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.2)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Active course
                    </span>
                    <h2 className="text-xl font-bold text-white leading-tight mb-2 group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                      {activeCourse.title}
                      <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-cyan-400" />
                    </h2>
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {activeCourse.description}
                    </p>
                  </div>

                  {/* Radial progress ring */}
                  <div className="flex-shrink-0 relative w-14 h-14">
                    <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
                      <defs>
                        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#22d3ee" />
                        </linearGradient>
                      </defs>
                      <circle cx="28" cy="28" r="22" className="progress-ring-track" strokeWidth="3.5" fill="none" />
                      <circle cx="28" cy="28" r="22" className="progress-ring-fill" strokeWidth="3.5" fill="none"
                        strokeDasharray={`${2 * Math.PI * 22}`}
                        strokeDashoffset={`${2 * Math.PI * 22 * (1 - activeCourse.progress / 100)}`}
                        strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono text-white">
                      {activeCourse.progress}%
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-5 pt-4 flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--border)' }}>
                  <div>
                    <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Current module</p>
                    <p className="text-xs font-semibold text-white">{activeCourse.activeModuleName}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors group-hover:underline"
                    style={{ color: 'var(--cyan)' }}>
                    Resume
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Stat pills row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Study Time',
                    value: `${stats.studyHoursThisWeek}h`,
                    sub: 'this week',
                    color: '#818cf8',
                    bg: 'rgba(99,102,241,0.08)',
                    icon: Clock
                  },
                  {
                    label: 'XP Earned',
                    value: `${stats.xp}`,
                    sub: `of ${stats.xpNextLevel} XP`,
                    color: 'var(--emerald)',
                    bg: 'rgba(52,211,153,0.08)',
                    icon: Award
                  },
                  {
                    label: 'Streak',
                    value: `${stats.streakDays}`,
                    sub: 'days active',
                    color: 'var(--amber)',
                    bg: 'rgba(251,191,36,0.08)',
                    icon: Flame
                  },
                ].map(({ label, value, sub, color, bg, icon: Icon }) => (
                  <div key={label} className="stat-card p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                        <span style={{ color }}><Icon className="w-3.5 h-3.5" /></span>
                      </div>
                    </div>
                    <div>
                      <p className="text-2xl font-bold font-mono text-white leading-none">{value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: Daily Tasks (5 cols) ─────────── */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Daily Tasks</h3>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {completedTasks} of {tasks.length} completed
                  </p>
                </div>
                {/* Mini progress */}
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(completedTasks / tasks.length) * 100}%`,
                        background: 'linear-gradient(90deg, var(--primary), var(--cyan))'
                      }} />
                  </div>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {Math.round((completedTasks / tasks.length) * 100)}%
                  </span>
                </div>
              </div>

              {/* Task list */}
              <div className="space-y-2">
                {tasks.map((task, i) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className="group flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-200"
                    style={{
                      background: task.completed ? 'rgba(255,255,255,0.02)' : 'var(--bg-raised)',
                      border: `1px solid ${task.completed ? 'var(--border)' : 'var(--border-hover)'}`,
                      opacity: task.completed ? 0.55 : 1,
                      animationDelay: `${i * 60}ms`
                    }}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                      {task.completed
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : <Circle className="w-4 h-4 transition-colors group-hover:stroke-indigo-400 text-gray-600" />
                      }
                    </div>

                    <span className={`flex-1 text-xs font-medium leading-snug ${task.completed ? 'line-through' : 'text-white'}`}
                      style={task.completed ? { color: 'var(--text-muted)' } : {}}>
                      {task.title}
                    </span>

                    <span className="flex-shrink-0 text-[9px] font-mono font-bold px-2 py-1 rounded-lg"
                      style={{
                        background: task.completed ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.1)',
                        color: task.completed ? 'var(--text-muted)' : '#a5b4fc',
                        border: `1px solid ${task.completed ? 'var(--border)' : 'rgba(99,102,241,0.2)'}`
                      }}>
                      +{task.xpReward} XP
                    </span>
                  </div>
                ))}
              </div>

              {/* XP level-up nudge */}
              <div className="p-4 rounded-2xl relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(34,211,238,0.04) 100%)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <Zap className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white mb-0.5">Level {stats.level + 1} incoming</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {stats.xpNextLevel - stats.xp} more XP to reach{' '}
                      <span className="text-white font-semibold">Thread Weaver</span>
                    </p>
                  </div>
                </div>
                {/* XP bar */}
                <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, var(--primary), var(--cyan))' }} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
