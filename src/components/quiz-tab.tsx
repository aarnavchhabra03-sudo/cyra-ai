'use client';

import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  Target, 
  FileQuestion,
  Loader2,
  AlertCircle,
  BookOpen
} from 'lucide-react';
import { QuizRecord, SafeQuizQuestion } from '@/types/quiz';
import { createClient } from '@/lib/supabase/client';
import QuizPlayer from './quiz-player';

interface QuizTabProps {
  activeNodeId?: string;
  nodeList?: Array<{ id: string; title: string; status: 'completed' | 'in_progress' | 'locked' }>;
  onSelectNode?: (id: string) => void;
  onSwitchTab?: (tabName: 'roadmap' | 'notes' | 'resources' | 'quiz' | 'tutor') => void;
  onCompleteQuiz?: (scorePercent: number, xpReward: number) => void;
}

export default function QuizTab({ 
  activeNodeId, 
  nodeList, 
  onSelectNode, 
  onSwitchTab, 
  onCompleteQuiz 
}: QuizTabProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'overview' | 'playing'>('overview');
  const [quiz, setQuiz] = useState<QuizRecord | null>(null);
  const [questions, setQuestions] = useState<SafeQuizQuestion[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset player state and check if a quiz already exists for the selected activeNodeId
  useEffect(() => {
    setViewMode('overview');

    if (!activeNodeId) {
      setLoading(false);
      return;
    }

    let isSubscribed = true;

    async function checkQuizCache() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const supabase = createClient();
        
        // 1. Query Supabase quizzes for activeNodeId
        const { data: existingQuiz, error: quizErr } = await supabase
          .from('quizzes')
          .select('*')
          .eq('lesson_id', activeNodeId)
          .eq('version', 1)
          .maybeSingle();

        if (quizErr) {
          console.warn('[QUIZ TAB] Error fetching quiz cache:', quizErr);
        }

        if (existingQuiz && isSubscribed) {
          setQuiz(existingQuiz as QuizRecord);

          // 2. Fetch browser-safe questions via RPC
          const { data: safeQuestions, error: rpcErr } = await supabase.rpc('get_safe_quiz_questions', {
            p_quiz_id: existingQuiz.id
          });

          if (!rpcErr && safeQuestions && isSubscribed) {
            setQuestions(safeQuestions as SafeQuizQuestion[]);
          }
        } else if (isSubscribed) {
          setQuiz(null);
          setQuestions([]);
        }
      } catch (err) {
        console.error('[QUIZ TAB] Unexpected cache check error:', err);
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    checkQuizCache();

    return () => {
      isSubscribed = false;
    };
  }, [activeNodeId]);

  const handleGenerateQuiz = async () => {
    if (!activeNodeId || generating) return;

    setGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: activeNodeId }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate quiz.');
      }

      setQuiz(result.data.quiz);
      setQuestions(result.data.questions || []);
    } catch (err: any) {
      console.error('[QUIZ TAB] Quiz generation error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred while generating the quiz.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* 1. LESSON SELECTOR / TOPIC OUTLINE (IF NODES PROVIDED) */}
      {nodeList && nodeList.length > 0 && onSelectNode && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 flex-shrink-0 mr-1">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            Select Lesson:
          </span>
          {nodeList.map((node) => {
            const isSelected = node.id === activeNodeId;
            const isLocked = node.status === 'locked';

            return (
              <button
                key={node.id}
                onClick={() => {
                  if (!isLocked) {
                    setViewMode('overview');
                    onSelectNode(node.id);
                  }
                }}
                disabled={isLocked}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-indigo-500/40 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                    : isLocked
                    ? 'bg-zinc-900/30 border border-zinc-900 text-zinc-600 cursor-not-allowed'
                    : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span className="truncate max-w-[160px]">{node.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. INTERACTIVE QUIZ PLAYER VIEW */}
      {viewMode === 'playing' && quiz ? (
        <QuizPlayer
          quiz={quiz}
          questions={questions}
          onExit={() => setViewMode('overview')}
        />
      ) : loading ? (

        /* 3. LOADING SKELETON */
        <div className="p-8 rounded-2xl glass-panel border border-zinc-800/80 text-center space-y-4 animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 mx-auto flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
          <p className="text-xs text-zinc-400 font-mono">Checking quiz availability...</p>
        </div>
      ) : generating ? (

        /* 4. GENERATING AI ANIMATED STATE */
        <div className="p-10 rounded-2xl glass-panel border border-indigo-500/30 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-cyan-500/10 to-transparent animate-pulse" />
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-[1.5px] mx-auto shadow-[0_0_25px_rgba(99,102,241,0.3)]">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          </div>

          <div className="space-y-2 relative z-10">
            <h3 className="text-lg font-bold text-white tracking-wide">Generating Adaptive Quiz...</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              CYRA is analyzing lesson content, key concepts, and study notes to construct a tailored assessment.
            </p>
          </div>
        </div>
      ) : !quiz ? (

        /* 5. EMPTY STATE: NO QUIZ GENERATED YET */
        <div className="p-10 rounded-2xl glass-panel border border-zinc-800/80 text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
            <FileQuestion className="w-8 h-8 text-indigo-400" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white tracking-wide">No Quiz Generated Yet</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              No assessment pack has been generated for this lesson. Click below to generate an AI-powered quiz tailored strictly to this lesson&apos;s concepts.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 text-xs flex items-center gap-2 max-w-md mx-auto">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={handleGenerateQuiz}
            className="py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs transition-all duration-200 shadow-lg shadow-indigo-500/20 inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Generate Quiz
          </button>
        </div>
      ) : (

        /* 6. PERSISTED QUIZ OVERVIEW CARD */
        <div className="p-8 rounded-2xl glass-panel border border-zinc-800/80 space-y-6 shadow-xl animate-fade-in">
          
          {/* Header & Badges */}
          <div className="space-y-3 border-b border-zinc-900 pb-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <HelpCircle className="w-4 h-4" />
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                  AI Quiz Ready
                </span>
              </div>

              {/* Difficulty Badge */}
              <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
                {quiz.difficulty} Level
              </span>
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">{quiz.title}</h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">{quiz.description}</p>
          </div>

          {/* Key Assessment Specs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900/80 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <FileQuestion className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">Questions</span>
                <span className="text-sm font-bold text-white font-mono">
                  {questions.length || quiz.question_count} Questions
                </span>
              </div>
            </div>

            <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900/80 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">Est. Time</span>
                <span className="text-sm font-bold text-white font-mono">
                  {quiz.estimated_minutes} Minutes
                </span>
              </div>
            </div>

            <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900/80 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-zinc-500 block uppercase">Passing Score</span>
                <span className="text-sm font-bold text-white font-mono">
                  {quiz.passing_score}% Score
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex items-center justify-between border-t border-zinc-900">
            <span className="text-[11px] text-zinc-500 italic">
              Clicking Start Quiz launches the interactive assessment engine.
            </span>

            <button
              onClick={() => setViewMode('playing')}
              className="py-3 px-7 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs transition-all duration-200 shadow-lg shadow-indigo-500/20 inline-flex items-center gap-2"
            >
              Start Quiz
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
