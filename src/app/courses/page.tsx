'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  ArrowRight, 
  Sparkles,
  BookOpen,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { LearningPath } from '@/types/database';

export default function CoursesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);

  useEffect(() => {
    async function fetchUserCourses() {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) {
          setError('Authentication required. Please sign in to view your courses.');
          setLoading(false);
          return;
        }

        // Query learning paths belonging strictly to authenticated user
        const { data, error: dbError } = await supabase
          .from('learning_paths')
          .select('id, user_id, title, goal, experience_level, minutes_per_day, status, progress, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (dbError) {
          console.error('Error fetching learning paths:', dbError);
          setError('Failed to load active learning pathways from database.');
        } else {
          setLearningPaths(data || []);
        }
      } catch (err) {
        console.error('Unexpected error fetching courses:', err);
        setError('An unexpected error occurred while loading your courses.');
      } finally {
        setLoading(false);
      }
    }

    fetchUserCourses();
  }, []);

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-8">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-zinc-400 mb-1">
            <GraduationCap className="w-5 h-5 text-indigo-400" />
            <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">Workspace Index</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Active Learning Pathways</h2>
          <p className="text-xs text-zinc-400 mt-1">Access all your AI-synthesized curriculums and roadmaps below.</p>
        </div>

        <Link
          href="/"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-90 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>New Learning Path</span>
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading your learning workspace...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-8 rounded-2xl glass-card border border-red-500/20 text-center max-w-md mx-auto space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">Database Error</h3>
          <p className="text-xs text-zinc-400">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && learningPaths.length === 0 && (
        <div className="p-10 rounded-3xl glass-card border border-zinc-800 text-center space-y-4 py-16">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-white">No learning paths yet</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Create your first personalized AI learning path to build your roadmap and interactive lessons.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Create Your First Learning Path</span>
          </Link>
        </div>
      )}

      {/* Course Cards Grid */}
      {!loading && !error && learningPaths.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {learningPaths.map((c) => {
            const levelUpper = (c.experience_level || 'beginner').toUpperCase();

            return (
              <Link 
                href={`/learn/${c.id}`} 
                key={c.id} 
                className="group p-6 rounded-2xl glass-card block relative overflow-hidden transition-all duration-200 hover:border-indigo-500/50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/20">
                        {c.progress || 0}% COMPLETE
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-800">
                        {levelUpper}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mt-3 group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                      {c.title}
                      <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </h3>

                    <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">
                      Goal: {c.goal} ({c.minutes_per_day || 30} mins/day)
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-900/60 flex justify-between items-center text-[11px]">
                  <span className="text-zinc-500 font-mono text-[10px]">
                    Created {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recently'}
                  </span>
                  <span className="text-cyan-400 font-semibold flex items-center gap-1 group-hover:underline">
                    Enter Course
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
