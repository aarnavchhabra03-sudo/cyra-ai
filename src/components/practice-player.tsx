'use client';

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Sparkles,
  Info,
  Loader2,
  AlertCircle,
  Award,
  RotateCcw,
  BookOpen,
  Target,
  TrendingUp,
  CheckCircle
} from 'lucide-react';

export interface PracticeQuestionItem {
  id: string;
  question_order: number;
  question_type: string;
  question_text: string;
  options: Array<{ id: string; text: string }>;
  concept: string;
  difficulty: string;
  points: number;
}

export interface GradedResultItem {
  questionId: string;
  questionOrder: number;
  questionType: string;
  questionText: string;
  options: any[];
  selectedAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  explanation: string;
  concept?: string | null;
}

export interface PracticeSubmissionData {
  attemptId: string;
  sessionId: string;
  concept: string;
  score: number;
  percentage: number;
  passed: boolean;
  masteryBefore: number;
  masteryAfter: number;
  masteryChange: number;
  durationSeconds: number;
  results: GradedResultItem[];
}

interface PracticePlayerProps {
  sessionId: string;
  concept: string;
  masteryBefore: number;
  questions: PracticeQuestionItem[];
  onExit: () => void;
}

export default function PracticePlayer({
  sessionId,
  concept,
  masteryBefore,
  questions,
  onExit,
}: PracticePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'playing' | 'results'>('playing');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionData, setSubmissionData] = useState<PracticeSubmissionData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startTime] = useState<number>(() => Date.now());

  if (!questions || questions.length === 0) {
    return (
      <div className="p-8 text-center glass-panel border border-zinc-800 rounded-2xl max-w-lg mx-auto">
        <p className="text-sm text-zinc-400">No questions available for this practice session.</p>
        <button
          onClick={onExit}
          className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded-xl text-xs"
        >
          Return to Progress
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const currentAnswer = answers[currentQuestion.id];

  const handleSelectOption = (optionId: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: { option_id: optionId }
    }));
  };

  const handleToggleMultiSelect = (optionId: string) => {
    const existing = answers[currentQuestion.id]?.option_ids || [];
    const updated = existing.includes(optionId)
      ? existing.filter((id: string) => id !== optionId)
      : [...existing, optionId];

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: { option_ids: updated }
    }));
  };

  const handleTextChange = (text: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: { answer_text: text }
    }));
  };

  const isQuestionAnswered = (qId: string): boolean => {
    const ans = answers[qId];
    if (!ans) return false;
    if (ans.option_id) return true;
    if (Array.isArray(ans.option_ids) && ans.option_ids.length > 0) return true;
    if (typeof ans.answer_text === 'string' && ans.answer_text.trim().length > 0) return true;
    return false;
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmitPractice = async () => {
    if (isSubmitting) return;

    console.log('[PRACTICE CLIENT] submit clicked');
    console.log('[PRACTICE CLIENT] sessionId:', sessionId);

    setIsSubmitting(true);
    setSubmitError(null);

    const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
      questionId: qId,
      selectedAnswer: val,
    }));

    console.log('[PRACTICE CLIENT] answers:', formattedAnswers);

    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    try {
      const res = await fetch('/api/adaptive/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          answers: formattedAnswers,
          durationSeconds,
        }),
      });

      console.log('[PRACTICE CLIENT] response status:', res.status);
      const result = await res.json();
      console.log('[PRACTICE CLIENT] response:', result);

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit practice session for grading.');
      }

      setSubmissionData(result.data);
      setViewMode('results');
    } catch (err: any) {
      console.error('[PRACTICE CLIENT] Submission error:', err);
      setSubmitError(err.message || 'Practice submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextOrSubmit = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleSubmitPractice();
    }
  };

  const progressPercentage = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  const formatOptionValue = (val: any): string => {
    if (val === null || val === undefined) return 'No answer provided';
    if (typeof val === 'string') return val;
    if (val.option_id) return `Option ${val.option_id}`;
    if (Array.isArray(val.option_ids)) return `Options: ${val.option_ids.join(', ')}`;
    if (val.answer_text) return val.answer_text;
    return JSON.stringify(val);
  };

  // ============================================================
  // VIEW MODE: RESULTS SCREEN
  // ============================================================
  if (viewMode === 'results' && submissionData) {
    const isPassed = submissionData.passed;

    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        {/* Results Main Card */}
        <div className="p-8 rounded-2xl glass-panel border border-zinc-800/80 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-cyan-500/5 to-transparent" />

          {/* Badge & Icon */}
          <div className="relative z-10 space-y-3">
            <div className="w-16 h-16 rounded-2xl border border-indigo-500/40 bg-indigo-950/60 text-indigo-400 mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.25)]">
              <Target className="w-8 h-8" />
            </div>

            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-400 block">
              TARGETED PRACTICE COMPLETE
            </span>

            <h3 className="text-lg font-bold text-white tracking-wide">{submissionData.concept}</h3>

            <div className="space-y-1">
              <h2 className="text-4xl font-extrabold text-white tracking-tight font-mono">
                {submissionData.percentage}%
              </h2>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                isPassed 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {isPassed ? 'PRACTICE PASSED' : 'PRACTICE COMPLETED'}
              </span>
            </div>
          </div>

          {/* MASTERY PROGRESS BADGE */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 relative z-10 space-y-2">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              Concept Mastery Progress
            </span>

            <div className="flex items-center justify-center gap-3 font-mono">
              <span className="text-sm font-bold text-zinc-400">{submissionData.masteryBefore}%</span>
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span className="text-lg font-extrabold text-cyan-300">{submissionData.masteryAfter}%</span>
              {submissionData.masteryChange > 0 && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{submissionData.masteryChange}%
                </span>
              )}
            </div>
          </div>

          {/* Itemized Questions Breakdown */}
          <div className="space-y-4 text-left relative z-10 pt-2">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
              Answer Review:
            </h4>

            {submissionData.results.map((item, idx) => (
              <div 
                key={item.questionId}
                className={`p-4 rounded-xl border space-y-2 text-xs ${
                  item.isCorrect ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-red-500/30 bg-red-950/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Question {idx + 1}</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    item.isCorrect ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                  }`}>
                    {item.isCorrect ? 'CORRECT' : 'INCORRECT'}
                  </span>
                </div>
                <p className="text-zinc-300 font-medium">{item.questionText}</p>
                {item.explanation && (
                  <p className="text-[11px] text-zinc-400 italic bg-zinc-900/50 p-2.5 rounded border border-zinc-850">
                    {item.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Return Button */}
          <div className="pt-4 border-t border-zinc-900 relative z-10 flex justify-center">
            <button
              onClick={onExit}
              className="py-3 px-8 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs transition-all shadow-md inline-flex items-center gap-2"
            >
              Return to Progress Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW MODE: ACTIVE TARGETED PRACTICE PLAYER
  // ============================================================
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* 1. TOP HEADER BAR */}
      <div className="flex items-center justify-between bg-zinc-900/40 p-4 rounded-xl border border-zinc-900/80">
        <button
          onClick={onExit}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Practice</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-500/30">
            TARGETED PRACTICE
          </span>

          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
            {currentIndex + 1} OF {totalQuestions}
          </span>
        </div>
      </div>

      {/* 2. PROGRESS BAR */}
      <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-900">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* ERROR BANNER VISIBLE AT TOP OF GAME CARD IF SUBMISSION FAILS */}
      {submitError && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center justify-between gap-3 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{submitError}</span>
          </div>
          <button
            onClick={() => setSubmitError(null)}
            className="text-[10px] font-mono text-red-400 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. QUESTION CARD */}
      <div className="p-7 rounded-2xl glass-panel border border-zinc-800/80 space-y-6 shadow-xl relative">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-500/30 uppercase tracking-wider">
            Target Concept: {concept}
          </span>

          <span className="text-[10px] font-mono text-zinc-400">
            Mastery: {masteryBefore}%
          </span>
        </div>

        <h3 className="text-base font-bold text-white leading-relaxed">
          {currentQuestion.question_text}
        </h3>

        {/* OPTIONS DISPLAY */}
        {currentQuestion.question_type === 'multiple_choice' && (
          <div className="space-y-3 pt-2">
            {currentQuestion.options?.map((opt) => {
              const isSelected = currentAnswer?.option_id === opt.id;

              return (
                <div
                  key={opt.id}
                  onClick={() => !isSubmitting && handleSelectOption(opt.id)}
                  className={`p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-3.5 ${
                    isSelected
                      ? 'border-indigo-500/60 bg-indigo-950/20 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                      : 'border-zinc-850 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/30 hover:border-zinc-700'
                  } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[11px] border flex-shrink-0 ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300 font-bold'
                      : 'border-zinc-800 bg-zinc-950/60 text-zinc-500'
                  }`}>
                    {opt.id}
                  </div>
                  <span className="flex-1">{opt.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {currentQuestion.question_type === 'true_false' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            {(currentQuestion.options?.length ? currentQuestion.options : [
              { id: 'true', text: 'True' },
              { id: 'false', text: 'False' }
            ]).map((opt) => {
              const isSelected = currentAnswer?.option_id === opt.id;

              return (
                <div
                  key={opt.id}
                  onClick={() => !isSubmitting && handleSelectOption(opt.id)}
                  className={`p-5 rounded-xl border text-sm font-bold text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                    isSelected
                      ? 'border-indigo-500/60 bg-indigo-950/30 text-indigo-200 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                      : 'border-zinc-850 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/30 hover:border-zinc-700'
                  } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs ${
                    isSelected ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300' : 'border-zinc-800 bg-zinc-950 text-zinc-500'
                  }`}>
                    {opt.id === 'true' ? 'T' : 'F'}
                  </div>
                  <span>{opt.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. QUESTION NAVIGATOR */}
      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/80 flex items-center justify-between gap-4 flex-wrap">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
          Practice Progress:
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const answered = isQuestionAnswered(q.id);

            return (
              <button
                key={q.id}
                onClick={() => !isSubmitting && setCurrentIndex(idx)}
                disabled={isSubmitting}
                className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition-all duration-200 flex items-center justify-center relative ${
                  isCurrent
                    ? 'bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    : answered
                    ? 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                    : 'bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. BOTTOM ACTIONS */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0 || isSubmitting}
          className="py-2.5 px-5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        <button
          onClick={handleNextOrSubmit}
          disabled={isSubmitting}
          className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs transition-all duration-200 shadow-md shadow-indigo-500/15 flex items-center gap-1.5 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              Grading Practice...
            </>
          ) : currentIndex === totalQuestions - 1 ? (
            <>
              Submit Practice
              <CheckCircle className="w-4 h-4 text-emerald-300" />
            </>
          ) : (
            <>
              Next Question
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
