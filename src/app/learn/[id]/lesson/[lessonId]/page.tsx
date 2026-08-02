'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Lock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import LessonContentRenderer from '@/components/lesson-content-renderer';

interface FlatLesson {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  lessonOrder: number;
  estimatedMinutes: number;
}

export default function LessonPage() {
  const router = useRouter();
  const rawParams = useParams();

  const learningPathId = rawParams?.id as string;
  const lessonId = rawParams?.lessonId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);

  // Lesson & Context Data
  const [courseTitle, setCourseTitle] = useState('');
  const [moduleTitle, setModuleTitle] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);

  // Completion State
  const [isCompleted, setIsCompleted] = useState(false);
  const [togglingProgress, setTogglingProgress] = useState(false);
  const [courseProgress, setCourseProgress] = useState(0);

  // Navigation List (Flat list of all lessons across all modules in order)
  const [flatLessons, setFlatLessons] = useState<FlatLesson[]>([]);
  const [prevLesson, setPrevLesson] = useState<FlatLesson | null>(null);
  const [nextLesson, setNextLesson] = useState<FlatLesson | null>(null);

  useEffect(() => {
    async function loadLessonData() {
      if (!learningPathId || !lessonId) {
        console.warn('[LESSON ROUTE DEBUG] PARAMS NOT READY YET:', { learningPathId, lessonId });
        return;
      }

      setLoading(true);
      setError(null);

      console.log('[LESSON ROUTE DEBUG]', { learningPathId, lessonId });

      try {
        const supabase = createClient();

        // 1. Authenticate User
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) {
          console.error('[CYRA DEBUG] AUTH FAILURE:', authErr);
          setError({
            message: 'Authentication required. Please sign in to view this lesson.',
            code: 'AUTH_REQUIRED',
          });
          setLoading(false);
          return;
        }

        // 2. Fetch Learning Path to verify ownership
        const { data: pathRecord, error: pathErr } = await supabase
          .from('learning_paths')
          .select('id, title, user_id, progress')
          .eq('id', learningPathId)
          .single();

        if (pathErr || !pathRecord) {
          console.error('[CYRA DEBUG] LEARNING PATH FETCH ERROR:', pathErr);
          setError({
            message: 'Learning path not found in database.',
            code: 'COURSE_NOT_FOUND',
          });
          setLoading(false);
          return;
        }

        if (pathRecord.user_id !== user.id) {
          console.error('[CYRA DEBUG] UNAUTHORIZED ACCESS ATTEMPT:', { ownerId: pathRecord.user_id, userId: user.id });
          setError({
            message: 'You are not authorized to view this learning path.',
            code: 'UNAUTHORIZED',
          });
          setLoading(false);
          return;
        }

        setCourseTitle(pathRecord.title);
        setCourseProgress(pathRecord.progress || 0);

        // 3. Fetch All Modules for this Learning Path (sorted by module_order)
        const { data: modulesData, error: modulesErr } = await supabase
          .from('modules')
          .select('*')
          .eq('learning_path_id', learningPathId)
          .order('module_order', { ascending: true });

        if (modulesErr) {
          console.error('[CYRA DEBUG] MODULES FETCH ERROR:', modulesErr);
          setError({
            message: 'Failed to fetch course modules from database.',
            code: 'DATABASE_ERROR',
          });
          setLoading(false);
          return;
        }

        if (!modulesData || modulesData.length === 0) {
          console.warn('[CYRA DEBUG] ZERO MODULES FOUND FOR PATH:', learningPathId);
          setError({
            message: 'No modules found for this learning path.',
            code: 'MODULES_NOT_FOUND',
          });
          setLoading(false);
          return;
        }

        const moduleIds = modulesData.map(m => m.id);

        // 4. Fetch All Lessons for these Modules (select '*' to match PostgREST schema)
        const { data: lessonsData, error: lessonsErr } = await supabase
          .from('lessons')
          .select('*')
          .in('module_id', moduleIds)
          .order('lesson_order', { ascending: true });

        if (lessonsErr) {
          console.error('[CYRA DEBUG] LESSONS FETCH ERROR:', lessonsErr);
          setError({
            message: 'Failed to fetch lesson content from database.',
            code: 'DATABASE_ERROR',
          });
          setLoading(false);
          return;
        }

        if (!lessonsData || lessonsData.length === 0) {
          console.warn('[CYRA DEBUG] ZERO LESSONS RETURNED FOR MODULES:', moduleIds);
          setError({
            message: 'No lessons found for this course.',
            code: 'LESSONS_NOT_FOUND',
          });
          setLoading(false);
          return;
        }

        // Build flat ordered list of lessons across all modules
        const moduleMap = new Map(modulesData.map(m => [m.id, m]));
        const orderedFlatLessons: FlatLesson[] = [];

        modulesData.forEach(mod => {
          const modLessons = lessonsData
            .filter(l => l.module_id === mod.id)
            .sort((a, b) => (a.lesson_order || 0) - (b.lesson_order || 0));

          modLessons.forEach(l => {
            const desc = (l as any).description || (l.content ? l.content.split('\n')[0].replace(/^#+\s*/, '') : '');
            orderedFlatLessons.push({
              id: l.id,
              title: l.title,
              description: desc,
              moduleId: mod.id,
              moduleTitle: mod.title,
              moduleOrder: mod.module_order || 0,
              lessonOrder: l.lesson_order || 0,
              estimatedMinutes: l.estimated_minutes || 15,
            });
          });
        });

        setFlatLessons(orderedFlatLessons);

        // 5. Find target lesson by UUID
        const targetLessonIndex = orderedFlatLessons.findIndex(l => l.id === lessonId);

        if (targetLessonIndex === -1) {
          console.warn('[CYRA DEBUG] REQUESTED LESSON ID NOT IN FLAT LESSONS:', lessonId);
          setError({
            message: 'Requested lesson was not found in this curriculum.',
            code: 'LESSON_NOT_FOUND',
          });
          setLoading(false);
          return;
        }

        const currentLessonObj = lessonsData.find(l => l.id === lessonId)!;
        const currentModObj = moduleMap.get(currentLessonObj.module_id);
        const derivedDesc = (currentLessonObj as any).description || (currentLessonObj.content ? currentLessonObj.content.split('\n')[0].replace(/^#+\s*/, '') : '');

        setModuleTitle(currentModObj?.title || '');
        setLessonTitle(currentLessonObj.title);
        setLessonDescription(derivedDesc);
        setLessonContent(currentLessonObj.content || '');
        setEstimatedMinutes(currentLessonObj.estimated_minutes || 15);

        // Set previous & next lesson navigation links
        setPrevLesson(targetLessonIndex > 0 ? orderedFlatLessons[targetLessonIndex - 1] : null);
        setNextLesson(targetLessonIndex < orderedFlatLessons.length - 1 ? orderedFlatLessons[targetLessonIndex + 1] : null);

        // 6. Check Completion State from user_progress table
        const { data: progressRow } = await supabase
          .from('user_progress')
          .select('id')
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId)
          .single();

        setIsCompleted(!!progressRow);
        console.log('[CYRA DEBUG] LESSON DATA LOADED SUCCESSFULLY:', { lessonId, title: currentLessonObj.title });
      } catch (err: any) {
        console.error('[CYRA DEBUG] UNEXPECTED EXCEPTION:', err);
        setError({
          message: 'An unexpected error occurred loading this lesson.',
          code: 'DATABASE_ERROR',
        });
      } finally {
        setLoading(false);
      }
    }

    loadLessonData();
  }, [learningPathId, lessonId]);

  /* Toggle Mark as Complete */
  const handleToggleComplete = async () => {
    if (togglingProgress) return;

    setTogglingProgress(true);
    const nextCompleted = !isCompleted;
    setIsCompleted(nextCompleted);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      if (nextCompleted) {
        await supabase
          .from('user_progress')
          .upsert(
            { user_id: user.id, lesson_id: lessonId, completed_at: new Date().toISOString() },
            { onConflict: 'user_id,lesson_id' }
          );
      } else {
        await supabase
          .from('user_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_id', lessonId);
      }

      if (flatLessons.length > 0) {
        const allLessonIds = flatLessons.map(l => l.id);
        const { data: allProgress } = await supabase
          .from('user_progress')
          .select('lesson_id')
          .eq('user_id', user.id)
          .in('lesson_id', allLessonIds);

        const completedCount = allProgress ? allProgress.length : 0;
        const newPct = Math.min(100, Math.round((completedCount / flatLessons.length) * 100));

        setCourseProgress(newPct);

        await supabase
          .from('learning_paths')
          .update({ progress: newPct })
          .eq('id', learningPathId);
      }
    } catch (err) {
      console.error('Error updating lesson progress:', err);
    } finally {
      setTogglingProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-xs font-mono text-zinc-400">Loading CYRA Interactive Lesson...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="p-8 rounded-2xl glass-panel border border-zinc-800/80 text-center max-w-md space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1">Lesson Unavailable</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{error.message}</p>
            <span className="inline-block mt-2 text-[9px] font-mono text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              Code: {error.code}
            </span>
          </div>
          <Link
            href={`/learn/${learningPathId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Roadmap</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* ── Top Header Navigation ──────────────────────────────────── */}
      <header
        className="h-14 px-6 flex items-center justify-between flex-shrink-0 sticky top-0 z-30"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(9, 9, 13, 0.85)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-4">
          <Link
            href={`/learn/${learningPathId}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
            <span>Back to Roadmap</span>
          </Link>

          <div className="w-px h-5 bg-zinc-800" />

          <div className="hidden sm:block">
            <h2 className="text-xs font-bold text-white line-clamp-1">{courseTitle}</h2>
            <p className="text-[10px] text-zinc-500 font-medium line-clamp-1">{moduleTitle}</p>
          </div>
        </div>

        {/* Course Progress Indicator */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">
            Course: {courseProgress}%
          </span>
          <div className="w-20 sm:w-28 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${courseProgress}%`, background: 'linear-gradient(90deg, #6366f1, #22d3ee)' }}
            />
          </div>
        </div>
      </header>

      {/* ── Main Lesson Area ────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 space-y-8">
        {/* Lesson Header Banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-indigo-950/20 border border-zinc-800/80 shadow-2xl relative overflow-hidden space-y-4">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              {moduleTitle}
            </span>

            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 bg-zinc-950/60 px-3 py-1 rounded-xl border border-zinc-900">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{estimatedMinutes} Mins Study</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
              {lessonTitle}
            </h1>
            {lessonDescription && (
              <p className="text-xs md:text-sm text-zinc-400 leading-relaxed max-w-2xl">
                {lessonDescription}
              </p>
            )}
          </div>
        </div>

        {/* Lesson Body Content */}
        <div className="p-6 md:p-8 rounded-3xl glass-panel border border-zinc-800/80 space-y-6 shadow-xl">
          <div className="flex items-center gap-2 pb-4 border-b border-zinc-800/80">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Lesson Material</h3>
          </div>

          <LessonContentRenderer content={lessonContent} />
        </div>

        {/* ── Lesson Navigation & Completion Footer ──────────────────── */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          {/* Previous Lesson Link */}
          {prevLesson ? (
            <Link
              href={`/learn/${learningPathId}/lesson/${prevLesson.id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700/60"
            >
              <ChevronLeft className="w-4 h-4" />
              <div className="text-left">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider block leading-none mb-0.5">Previous</span>
                <span className="line-clamp-1">{prevLesson.title}</span>
              </div>
            </Link>
          ) : (
            <div className="w-28" />
          )}

          {/* Mark as Complete Button */}
          <button
            disabled={togglingProgress}
            onClick={handleToggleComplete}
            className={`px-6 py-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shadow-lg disabled:opacity-50 ${
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/10 hover:bg-emerald-500/30'
                : 'bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-90 text-white shadow-indigo-500/20'
            }`}
          >
            {togglingProgress ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Completed</span>
              </>
            ) : (
              <>
                <Circle className="w-4 h-4" />
                <span>Mark as Complete</span>
              </>
            )}
          </button>

          {/* Next Lesson Link */}
          {nextLesson ? (
            <Link
              href={`/learn/${learningPathId}/lesson/${nextLesson.id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors border border-indigo-500/60"
            >
              <div className="text-right">
                <span className="text-[9px] text-indigo-200 uppercase tracking-wider block leading-none mb-0.5">Next</span>
                <span className="line-clamp-1">{nextLesson.title}</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href={`/learn/${learningPathId}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
            >
              <span>Roadmap Complete</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
