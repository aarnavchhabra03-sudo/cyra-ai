'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Flame, CheckCircle2, Circle,
  Clock, Award, BookOpen, ArrowUpRight,
  Sparkles, Zap, ChevronRight, Compass,
  ChevronDown, ChevronUp, Calendar, AlertTriangle,
  RefreshCw, X, Layers, Check
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile, LearningPath, DailyTaskRecord } from '@/types/database';
import { DifficultyLevel, LearningPathGeneration } from '@/types/ai';
import { mockDailyTasks, mockCourses } from '@/data/mockData';

/* ── Generation loading steps ─────────────────────── */
const LOADING_STEPS = [
  'Understanding your goal...',
  'Assessing your current level...',
  'Identifying prerequisites...',
  'Designing your curriculum...',
  'Optimizing your study schedule...',
  'Building your roadmap...',
  'Preparing your CYRA workspace...',
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

  const [query, setQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  // Personalization States
  const [experienceLevel, setExperienceLevel] = useState<DifficultyLevel>('beginner');
  const [goal, setGoal] = useState<string>('General Learning');
  const [minutesPerDay, setMinutesPerDay] = useState<number>(30);
  const [targetDate, setTargetDate] = useState<string>('');

  // AI Generation & Preview States
  const [generating, setGenerating] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [generationError, setGenerationError] = useState<{ message: string; code?: string } | null>(null);
  const [previewData, setPreviewData] = useState<LearningPathGeneration | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({ 1: true });

  // Supabase Data States
  const [profile, setProfile] = useState<Profile | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [tasks, setTasks] = useState<DailyTaskRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  /* Focus input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Load data from Supabase */
  useEffect(() => {
    async function loadDashboardData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);

          // 1. Fetch Profile
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profData) {
            setProfile(profData);
          } else {
            setProfile({
              id: user.id,
              full_name: user.user_metadata?.full_name || 'CYRA Learner',
              xp: 0,
              current_streak: 1,
              longest_streak: 1,
            });
          }

          // 2. Fetch Learning Paths
          const { data: pathData } = await supabase
            .from('learning_paths')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (pathData) {
            setLearningPaths(pathData);
          }

          // 3. Fetch Daily Tasks
          const { data: taskData } = await supabase
            .from('daily_tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

          if (taskData && taskData.length > 0) {
            setTasks(taskData);
          } else {
            // Seed initial daily tasks if empty
            const initialTasks: DailyTaskRecord[] = mockDailyTasks.map(t => ({
              id: t.id,
              user_id: user.id,
              title: t.title,
              xp_reward: t.xpReward,
              completed: t.completed,
              category: t.category,
              due_date: new Date().toISOString().split('T')[0],
            }));
            setTasks(initialTasks);
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    loadDashboardData();
  }, []);

  /* Toggle daily task */
  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !userId) return;

    const nextCompleted = !task.completed;
    const xpChange = nextCompleted ? task.xp_reward : -task.xp_reward;

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: nextCompleted } : t));
    setProfile(prev => prev ? { ...prev, xp: Math.max(0, prev.xp + xpChange) } : null);

    try {
      const supabase = createClient();
      if (!taskId.startsWith('task-')) {
        await supabase.from('daily_tasks').update({ completed: nextCompleted }).eq('id', taskId);
      }
      if (profile) {
        await supabase.from('profiles').update({ xp: Math.max(0, profile.xp + xpChange) }).eq('id', userId);
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  /* Call POST /api/ai/generate-learning-path */
  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || generating) return;

    setGenerating(true);
    setGenerationError(null);
    setPreviewData(null);
    setLoadingStepIndex(0);

    // Smoothly cycle loading messages
    const stepInterval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 2000);

    try {
      const response = await fetch('/api/ai/generate-learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: query.trim(),
          experienceLevel,
          goal,
          minutesPerDay,
          targetDate: targetDate || undefined,
        }),
      });

      const resData = await response.json();
      clearInterval(stepInterval);

      if (!response.ok || !resData.success) {
        if (response.status === 401 || resData.code === 'AUTH_REQUIRED') {
          setGenerationError({
            message: 'You must be signed in to generate a learning path.',
            code: 'AUTH_REQUIRED',
          });
        } else if (response.status === 429 || resData.code === 'AI_RATE_LIMIT') {
          setGenerationError({
            message: 'AI service rate limit reached. Please wait a moment and try again.',
            code: 'AI_RATE_LIMIT',
          });
        } else {
          setGenerationError({
            message: resData.error || 'Unable to synthesize learning path. Please try again.',
            code: resData.code || 'AI_GENERATION_FAILED',
          });
        }
      } else {
        // Success: preview generated curriculum
        setPreviewData(resData.data);
        setExpandedModules({ 1: true });
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setGenerationError({
        message: 'Network error communicating with CYRA AI server. Please check your connection.',
        code: 'NETWORK_ERROR',
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleModuleExpand = (moduleOrder: number) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleOrder]: !prev[moduleOrder],
    }));
  };

  const userFirstName = profile?.full_name?.split(' ')[0] || 'Learner';
  const userXp = profile?.xp ?? 0;
  const userStreak = profile?.current_streak ?? 1;
  const level = Math.floor(userXp / 300) + 1;
  const xpNextLevel = level * 300;
  const xpPct = Math.min(100, Math.max(0, (userXp / xpNextLevel) * 100));
  const completedTasksCount = tasks.filter(t => t.completed).length;

  const hasPaths = learningPaths.length > 0;
  const activeCourse = hasPaths
    ? {
        id: learningPaths[0].id,
        title: learningPaths[0].title,
        description: `Custom AI-synthesized pathway for ${learningPaths[0].goal}`,
        progress: learningPaths[0].progress,
        activeModuleName: 'Module 1: Foundations',
      }
    : mockCourses[0];

  return (
    <>
      {/* ══ 1. Loading Overlay (No Fake Percentages) ════════════════════ */}
      {generating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(7,7,10,0.88)', backdropFilter: 'blur(24px)' }}
        >
          <div
            className="w-full max-w-md text-center animate-scale-in"
            style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 24, padding: 36 }}
          >
            {/* Spinning & Pulsing AI Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full animate-spin-slow"
                  style={{ background: 'conic-gradient(from 0deg, transparent 0%, var(--primary) 60%, var(--cyan) 100%)', padding: 2 }}
                >
                  <div className="w-full h-full rounded-full" style={{ background: 'var(--bg-elevated)' }} />
                </div>
                <Zap className="w-6 h-6 relative z-10 text-cyan-400 animate-pulse" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Synthesizing Learning Path</h3>
            <p className="text-xs text-indigo-300 font-medium mb-6 line-clamp-1">
              "{query}"
            </p>

            {/* Cycling Loading Step Indicator */}
            <div
              className="p-4 rounded-xl mb-4 border transition-all duration-500"
              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-white">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>{LOADING_STEPS[loadingStepIndex]}</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1.5">
                Step {loadingStepIndex + 1} of {LOADING_STEPS.length}
              </p>
            </div>

            <p className="text-[11px] text-zinc-500">
              CYRA's AI curriculum architect is tailoring modules & lessons for you.
            </p>
          </div>
        </div>
      )}

      {/* ══ 2. Error Modal Overlay ══════════════════════════════════════ */}
      {generationError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(7,7,10,0.85)', backdropFilter: 'blur(20px)' }}
        >
          <div
            className="w-full max-w-md animate-scale-in"
            style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 24, padding: 32 }}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-center text-base font-bold text-white mb-2">Generation Failed</h3>
            <p className="text-center text-xs text-zinc-300 leading-relaxed mb-6">
              {generationError.message}
            </p>

            <div className="flex items-center gap-3">
              {generationError.code === 'AUTH_REQUIRED' ? (
                <button
                  onClick={() => router.push('/login')}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  Sign In to CYRA
                </button>
              ) : (
                <button
                  onClick={() => handleGenerate()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Generation</span>
                </button>
              )}

              <button
                onClick={() => setGenerationError(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 3. Temporary Learning Path Preview Modal ═══════════════════ */}
      {previewData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto animate-fade-in"
          style={{ background: 'rgba(7,7,10,0.92)', backdropFilter: 'blur(24px)' }}
        >
          <div
            className="w-full max-w-3xl my-auto animate-scale-in flex flex-col max-h-[90vh] overflow-hidden"
            style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 24 }}
          >
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-zinc-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {previewData.difficulty}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {previewData.estimatedWeeks} Weeks ({previewData.weeklyHours} hrs/wk)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {previewData.modules.length} Modules
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white leading-tight">{previewData.title}</h2>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{previewData.description}</p>
              </div>

              <button
                onClick={() => setPreviewData(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">

              {/* Prerequisites & Outcomes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Prerequisites */}
                {previewData.prerequisites && previewData.prerequisites.length > 0 && (
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                      Prerequisites
                    </h4>
                    <ul className="space-y-1.5 text-xs text-zinc-300">
                      {previewData.prerequisites.map((req, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Learning Outcomes */}
                {previewData.learningOutcomes && previewData.learningOutcomes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      Learning Outcomes
                    </h4>
                    <ul className="space-y-1.5 text-xs text-zinc-300">
                      {previewData.learningOutcomes.map((outcome, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Curriculum Modules Accordion */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Curriculum Roadmap ({previewData.modules.length} Modules)
                </h4>

                <div className="space-y-3">
                  {previewData.modules.map((mod) => {
                    const isExpanded = !!expandedModules[mod.order];

                    return (
                      <div
                        key={mod.order}
                        className="rounded-2xl border transition-all"
                        style={{
                          background: isExpanded ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)',
                          borderColor: isExpanded ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        {/* Module Header Toggle */}
                        <button
                          onClick={() => toggleModuleExpand(mod.order)}
                          className="w-full p-4 flex items-center justify-between text-left gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono"
                              style={{
                                background: isExpanded ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                                color: isExpanded ? '#a5b4fc' : '#9ca3af',
                                border: `1px solid ${isExpanded ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                              }}
                            >
                              {mod.order}
                            </span>
                            <div>
                              <h5 className="text-sm font-bold text-white">{mod.title}</h5>
                              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{mod.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-[11px] font-mono text-zinc-400">
                              {mod.estimatedHours} hrs • {mod.lessons.length} lessons
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                        </button>

                        {/* Module Expanded Content: Lessons */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 space-y-3">
                            {mod.objectives && mod.objectives.length > 0 && (
                              <div className="mb-3 pt-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                                  Module Objectives
                                </span>
                                <ul className="text-xs text-zinc-300 space-y-1">
                                  {mod.objectives.map((obj, oi) => (
                                    <li key={oi} className="flex items-center gap-1.5">
                                      <span className="w-1 h-1 rounded-full bg-cyan-400" />
                                      <span>{obj}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                              Lessons
                            </span>

                            {mod.lessons.map((lesson) => (
                              <div
                                key={lesson.order}
                                className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-2"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                                    <h6 className="text-xs font-bold text-white">{lesson.title}</h6>
                                  </div>
                                  <span className="text-[10px] font-mono text-indigo-300 flex-shrink-0">
                                    {lesson.estimatedMinutes} mins
                                  </span>
                                </div>

                                <p className="text-[11px] text-zinc-400 pl-3.5 leading-relaxed">
                                  {lesson.description}
                                </p>

                                {lesson.keyConcepts && lesson.keyConcepts.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pl-3.5 pt-1">
                                    {lesson.keyConcepts.map((kc, kci) => (
                                      <span
                                        key={kci}
                                        className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60"
                                      >
                                        {kc}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer CTA */}
            <div className="p-6 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-4">
              <span className="text-xs text-zinc-400">
                Validated AI Curriculum Ready
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPreviewData(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    // For this checkpoint, show acknowledgment and redirect to course workspace
                    router.push('/course/operating-systems');
                  }}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20"
                >
                  Create This Learning Path
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Main page ═══════════════════════════════════════════════════ */}
      <div className="min-h-screen flex flex-col">

        {/* ── Hero section ─────────────────────────────────────────── */}
        <section className="flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
            <div
              className="w-[500px] h-[300px] rounded-full opacity-40"
              style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
            />
          </div>

          {/* User Welcome Eyebrow */}
          <div
            className="animate-fade-up flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Welcome back, <strong className="text-white font-bold">{userFirstName}</strong></span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-75 text-[38px] md:text-[44px] font-extrabold leading-[1.12] tracking-tight text-white max-w-xl mb-3">
            What do you want<br />
            <span className="text-gradient-brand">to learn today?</span>
          </h1>

          <p className="animate-fade-up delay-150 text-sm max-w-md mb-8 leading-relaxed text-zinc-400">
            {!hasPaths
              ? "Your learning journey starts here. Enter any topic below and CYRA will build your personalized workspace."
              : "Tell CYRA a new topic or prompt, and it will synthesize a complete learning path for you."}
          </p>

          {/* ── Hero AI Input Form ─────────────────────────── */}
          <form onSubmit={handleGenerate} className="animate-fade-up delay-225 w-full max-w-2xl relative space-y-3">
            <div className="cyra-input-wrapper flex items-center gap-3 p-2 pl-5">
              <Sparkles
                className="w-4 h-4 flex-shrink-0 transition-colors duration-300"
                style={{ color: inputFocused ? 'var(--cyan)' : 'var(--text-muted)' }}
              />
              <input
                ref={inputRef}
                type="text"
                disabled={generating}
                placeholder="e.g., Learn Operating Systems, Master Machine Learning..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                className="flex-1 bg-transparent text-sm text-white placeholder-[var(--text-muted)] focus:outline-none py-3 disabled:opacity-50"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="submit"
                disabled={!query.trim() || generating}
                className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold tracking-wide text-white uppercase transition-all duration-200 disabled:opacity-35 disabled:pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 50%, var(--cyan) 100%)',
                  boxShadow: query.trim() && !generating ? '0 0 20px -4px rgba(99,102,241,0.4)' : 'none',
                }}
              >
                <span>{generating ? 'Generating...' : 'Generate My Learning Path'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ── Compact Personalization Controls ─────────────────────── */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {/* Experience Level Selector */}
              <div className="relative">
                <select
                  disabled={generating}
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as DifficultyLevel)}
                  className="appearance-none bg-zinc-900/90 hover:bg-zinc-800/90 text-zinc-300 hover:text-white border border-zinc-800/80 rounded-xl text-[11px] font-semibold px-3 py-1.5 pr-7 focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <option value="beginner">Experience: Beginner</option>
                  <option value="intermediate">Experience: Intermediate</option>
                  <option value="advanced">Experience: Advanced</option>
                </select>
                <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Goal Selector */}
              <div className="relative">
                <select
                  disabled={generating}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="appearance-none bg-zinc-900/90 hover:bg-zinc-800/90 text-zinc-300 hover:text-white border border-zinc-800/80 rounded-xl text-[11px] font-semibold px-3 py-1.5 pr-7 focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <option value="General Learning">Goal: General Learning</option>
                  <option value="Exam Preparation">Goal: Exam Preparation</option>
                  <option value="Interview Preparation">Goal: Interview Preparation</option>
                  <option value="Build a Project">Goal: Build a Project</option>
                  <option value="Career Development">Goal: Career Development</option>
                </select>
                <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Daily Study Time Selector */}
              <div className="relative">
                <select
                  disabled={generating}
                  value={minutesPerDay}
                  onChange={(e) => setMinutesPerDay(Number(e.target.value))}
                  className="appearance-none bg-zinc-900/90 hover:bg-zinc-800/90 text-zinc-300 hover:text-white border border-zinc-800/80 rounded-xl text-[11px] font-semibold px-3 py-1.5 pr-7 focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <option value={15}>15 min/day</option>
                  <option value={30}>30 min/day</option>
                  <option value={45}>45 min/day</option>
                  <option value={60}>60 min/day</option>
                  <option value={90}>90 min/day</option>
                </select>
                <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Optional Target Date Selector */}
              <div className="relative flex items-center">
                <Calendar className="w-3 h-3 text-zinc-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="date"
                  disabled={generating}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  placeholder="Target date"
                  className="bg-zinc-900/90 hover:bg-zinc-800/90 text-zinc-300 hover:text-white border border-zinc-800/80 rounded-xl text-[11px] font-semibold pl-7 pr-3 py-1.5 focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-colors min-w-[130px] disabled:opacity-50"
                />
              </div>
            </div>
          </form>

          {/* Prompt suggestions */}
          <div className="animate-fade-up delay-300 flex flex-wrap items-center justify-center gap-2 mt-5">
            {PROMPTS.map(p => (
              <button
                key={p}
                disabled={generating}
                className="prompt-pill disabled:opacity-50"
                onClick={() => { setQuery(p); inputRef.current?.focus(); }}
              >
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* ── Workspace Content Section ─────────────────────────────── */}
        <section className="flex-1 px-8 pb-12 max-w-5xl mx-auto w-full">

          <div className="flex items-center gap-4 mb-8">
            <div className="divider-line flex-1" />
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Your active workspace
            </span>
            <div className="divider-line flex-1" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ── LEFT: Learning Paths / Active Course + Stats ──────── */}
            <div className="lg:col-span-7 space-y-4">

              {!hasPaths ? (
                /* Polished Empty State */
                <div className="glass-card p-8 text-center space-y-4 border border-indigo-500/20">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-cyan-400">
                    <Compass className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Your learning journey starts here.</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                      No active learning paths created yet. Type what you want to learn above and CYRA will build your custom roadmap.
                    </p>
                  </div>
                </div>
              ) : (
                /* Active Course Card */
                <div
                  onClick={() => router.push('/course/operating-systems')}
                  className="glass-card p-6 cursor-pointer group relative overflow-hidden"
                >
                  <div
                    className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)' }}
                  />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span
                        className="inline-flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded-md mb-3"
                        style={{ background: 'rgba(34,211,238,0.08)', color: 'var(--cyan)', border: '1px solid rgba(34,211,238,0.2)' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        Active learning path
                      </span>
                      <h2 className="text-xl font-bold text-white leading-tight mb-2 group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                        {activeCourse.title}
                        <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-cyan-400" />
                      </h2>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {activeCourse.description}
                      </p>
                    </div>

                    <div className="flex-shrink-0 relative w-14 h-14">
                      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
                        <defs>
                          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#22d3ee" />
                          </linearGradient>
                        </defs>
                        <circle cx="28" cy="28" r="22" className="progress-ring-track" strokeWidth="3.5" fill="none" />
                        <circle
                          cx="28"
                          cy="28"
                          r="22"
                          className="progress-ring-fill"
                          strokeWidth="3.5"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 22}`}
                          strokeDashoffset={`${2 * Math.PI * 22 * (1 - activeCourse.progress / 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold font-mono text-white">
                        {activeCourse.progress}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                    <div>
                      <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Current module</p>
                      <p className="text-xs font-semibold text-white">{activeCourse.activeModuleName}</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors group-hover:underline" style={{ color: 'var(--cyan)' }}>
                      Enter Workspace
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              )}

              {/* Stat pills row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Learning Paths',
                    value: `${learningPaths.length}`,
                    sub: 'active paths',
                    color: '#818cf8',
                    bg: 'rgba(99,102,241,0.08)',
                    icon: BookOpen,
                  },
                  {
                    label: 'XP Earned',
                    value: `${userXp}`,
                    sub: `Level ${level}`,
                    color: 'var(--emerald)',
                    bg: 'rgba(52,211,153,0.08)',
                    icon: Award,
                  },
                  {
                    label: 'Streak',
                    value: `${userStreak}`,
                    sub: 'days active',
                    color: 'var(--amber)',
                    bg: 'rgba(251,191,36,0.08)',
                    icon: Flame,
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

            {/* ── RIGHT: Daily Tasks ─────────── */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Daily Tasks</h3>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {completedTasksCount} of {tasks.length} completed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: tasks.length ? `${(completedTasksCount / tasks.length) * 100}%` : '0%',
                        background: 'linear-gradient(90deg, var(--primary), var(--cyan))',
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {tasks.length ? Math.round((completedTasksCount / tasks.length) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Task list */}
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className="group flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-200"
                    style={{
                      background: task.completed ? 'rgba(255,255,255,0.02)' : 'var(--bg-raised)',
                      border: `1px solid ${task.completed ? 'var(--border)' : 'var(--border-hover)'}`,
                      opacity: task.completed ? 0.55 : 1,
                    }}
                  >
                    <div className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 transition-colors group-hover:stroke-indigo-400 text-gray-600" />
                      )}
                    </div>

                    <span
                      className={`flex-1 text-xs font-medium leading-snug ${task.completed ? 'line-through' : 'text-white'}`}
                      style={task.completed ? { color: 'var(--text-muted)' } : {}}
                    >
                      {task.title}
                    </span>

                    <span
                      className="flex-shrink-0 text-[9px] font-mono font-bold px-2 py-1 rounded-lg"
                      style={{
                        background: task.completed ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.1)',
                        color: task.completed ? 'var(--text-muted)' : '#a5b4fc',
                        border: `1px solid ${task.completed ? 'var(--border)' : 'rgba(99,102,241,0.2)'}`,
                      }}
                    >
                      +{task.xp_reward} XP
                    </span>
                  </div>
                ))}
              </div>

              {/* Level up banner */}
              <div
                className="p-4 rounded-2xl relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(34,211,238,0.04) 100%)',
                  border: '1px solid rgba(99,102,241,0.15)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
                  >
                    <Zap className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white mb-0.5">Level {level + 1} incoming</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {xpNextLevel - userXp} more XP to reach next rank
                    </p>
                  </div>
                </div>
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
