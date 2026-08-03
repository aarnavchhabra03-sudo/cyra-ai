'use client';

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  HelpCircle, 
  CheckCircle, 
  Sparkles,
  Info,
  Type,
  FileText,
  Loader2,
  AlertCircle,
  XCircle,
  Award,
  Clock,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import { QuizRecord, SafeQuizQuestion } from '@/types/quiz';

interface QuizPlayerProps {
  quiz: QuizRecord;
  questions: SafeQuizQuestion[];
  onExit: () => void;
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

export interface QuizSubmissionData {
  attemptId: string;
  percentage: number;
  correctAnswers: number;
  totalQuestions: number;
  earnedPoints: number;
  totalPossiblePoints: number;
  passed: boolean;
  xpAwarded: number;
  durationSeconds: number;
  results: GradedResultItem[];
}

export default function QuizPlayer({ quiz, questions, onExit }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'playing' | 'results' | 'review'>('playing');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionData, setSubmissionData] = useState<QuizSubmissionData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startTime] = useState<number>(() => Date.now());

  if (!questions || questions.length === 0) {
    return (
      <div className="p-8 text-center glass-panel border border-zinc-800 rounded-2xl">
        <p className="text-sm text-zinc-400">No questions available for this quiz.</p>
        <button
          onClick={onExit}
          className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded-xl text-xs"
        >
          Back to Overview
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const currentAnswer = answers[currentQuestion.id];

  // Helper to update answer state by question ID
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

  const handleSubmitQuiz = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
      questionId: qId,
      selectedAnswer: val,
    }));

    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          answers: formattedAnswers,
          durationSeconds,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit quiz for grading.');
      }

      setSubmissionData(result.data);
      setViewMode('results');
    } catch (err: any) {
      console.error('[QUIZ PLAYER] Submission error:', err);
      setSubmitError(err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextOrSubmit = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const progressPercentage = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  // Helper formatting for answer choices display in Review Mode
  const formatOptionValue = (val: any): string => {
    if (val === null || val === undefined) return 'No answer provided';
    if (typeof val === 'string') return val;
    if (val.option_id) return `Option ${val.option_id}`;
    if (Array.isArray(val.option_ids)) return `Options: ${val.option_ids.join(', ')}`;
    if (val.answer_text) return val.answer_text;
    return JSON.stringify(val);
  };

  // ============================================================
  // VIEW MODE 1: QUIZ RESULTS SCREEN
  // ============================================================
  if (viewMode === 'results' && submissionData) {
    const isPassed = submissionData.passed;

    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        
        {/* Results Main Card */}
        <div className="p-8 rounded-2xl glass-panel border border-zinc-800/80 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-b ${
            isPassed ? 'from-emerald-500/10 via-cyan-500/5' : 'from-amber-500/10 via-red-500/5'
          } to-transparent`} />

          {/* Badge & Icon */}
          <div className="relative z-10 space-y-3">
            <div className={`w-16 h-16 rounded-2xl border mx-auto flex items-center justify-center shadow-xl ${
              isPassed 
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
            }`}>
              {isPassed ? <Award className="w-8 h-8" /> : <RotateCcw className="w-8 h-8" />}
            </div>

            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-400 block">
              Quiz Complete
            </span>

            <div className="space-y-1">
              <h2 className="text-4xl font-extrabold text-white tracking-tight font-mono">
                {submissionData.percentage}%
              </h2>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                isPassed 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {isPassed ? 'PASSED' : 'NEEDS PRACTICE'}
              </span>
            </div>

            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed pt-1">
              {isPassed 
                ? 'Excellent work! You have successfully mastered this lesson assessment.' 
                : 'Good effort! Review your answers below to strengthen your understanding before retaking.'}
            </p>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-3 gap-3 relative z-10 pt-2">
            <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-900 text-center space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 block uppercase">Correct</span>
              <span className="text-sm font-bold text-white font-mono">
                {submissionData.correctAnswers} / {submissionData.totalQuestions}
              </span>
            </div>

            <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-900 text-center space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 block uppercase">XP Earned</span>
              <span className="text-sm font-bold text-cyan-400 font-mono flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                +{submissionData.xpAwarded} XP
              </span>
            </div>

            <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-900 text-center space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 block uppercase">Time Taken</span>
              <span className="text-sm font-bold text-zinc-300 font-mono">
                {Math.floor(submissionData.durationSeconds / 60)}m {submissionData.durationSeconds % 60}s
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-zinc-900 flex items-center justify-center gap-3 relative z-10">
            <button
              onClick={() => setViewMode('review')}
              className="py-2.5 px-5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-800 text-xs font-semibold transition-all inline-flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-cyan-400" />
              Review Answers
            </button>

            <button
              onClick={onExit}
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs transition-all shadow-md inline-flex items-center gap-2"
            >
              Return to Course
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    );
  }

  // ============================================================
  // VIEW MODE 2: REVIEW ANSWERS BREAKDOWN
  // ============================================================
  if (viewMode === 'review' && submissionData) {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        
        {/* Review Header */}
        <div className="flex items-center justify-between bg-zinc-900/40 p-4 rounded-xl border border-zinc-900/80">
          <button
            onClick={() => setViewMode('results')}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Results Summary</span>
          </button>

          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
            Reviewing {submissionData.correctAnswers} / {submissionData.totalQuestions} Correct
          </span>
        </div>

        {/* Itemized Questions Breakdown */}
        <div className="space-y-5">
          {submissionData.results.map((item, idx) => (
            <div 
              key={item.questionId}
              className={`p-6 rounded-2xl glass-panel border space-y-4 shadow-md ${
                item.isCorrect ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-red-500/30 bg-red-950/10'
              }`}
            >
              {/* Question Top Row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center border ${
                    item.isCorrect 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    {item.questionType.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {item.concept && (
                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-500/30">
                      {item.concept}
                    </span>
                  )}
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    item.isCorrect
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-red-950 text-red-400 border-red-800'
                  }`}>
                    {item.isCorrect ? `+${item.pointsEarned} PT` : '0 PT'}
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <h4 className="text-sm font-bold text-white leading-relaxed">
                {item.questionText}
              </h4>

              {/* User Answer vs Correct Answer Box */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className={`p-3 rounded-xl border ${
                  item.isCorrect 
                    ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-200' 
                    : 'bg-red-950/30 border-red-900/50 text-red-200'
                }`}>
                  <span className="text-[10px] font-mono uppercase block text-zinc-400 mb-1">Your Answer:</span>
                  <p className="font-medium">{formatOptionValue(item.selectedAnswer)}</p>
                </div>

                <div className="p-3 rounded-xl border bg-zinc-950/60 border-zinc-800 text-zinc-200">
                  <span className="text-[10px] font-mono uppercase block text-cyan-400 mb-1">Correct Answer:</span>
                  <p className="font-medium text-cyan-200">{formatOptionValue(item.correctAnswer)}</p>
                </div>
              </div>

              {/* Explanation Panel */}
              {item.explanation && (
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-850 text-xs text-zinc-300 leading-relaxed space-y-1">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase block flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Explanation:
                  </span>
                  <p>{item.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Navigation */}
        <div className="pt-2 flex justify-center">
          <button
            onClick={onExit}
            className="py-2.5 px-6 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all inline-flex items-center gap-2"
          >
            Return to Overview
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    );
  }

  // ============================================================
  // VIEW MODE 3: ACTIVE INTERACTIVE QUIZ PLAYER
  // ============================================================
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP HEADER BAR */}
      <div className="flex items-center justify-between bg-zinc-900/40 p-4 rounded-xl border border-zinc-900/80">
        <button
          onClick={onExit}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Assessment</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-md border border-cyan-500/30">
            {currentQuestion.question_type.replace('_', ' ')}
          </span>

          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
            QUESTION {currentIndex + 1} OF {totalQuestions}
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

      {/* ERROR BANNER IF SUBMISSION FAILED */}
      {submitError && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{submitError}</span>
        </div>
      )}

      {/* 3. QUESTION CARD */}
      <div className="p-7 rounded-2xl glass-panel border border-zinc-800/80 space-y-6 shadow-xl relative">
        
        {/* Concept Badge & Points */}
        <div className="flex items-center justify-between gap-4">
          {currentQuestion.concept ? (
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-500/30 uppercase tracking-wider">
              Concept: {currentQuestion.concept}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-zinc-500 uppercase">General Assessment</span>
          )}

          <span className="text-[10px] font-mono text-zinc-400">
            {currentQuestion.points || 1} {currentQuestion.points === 1 ? 'Point' : 'Points'}
          </span>
        </div>

        {/* Question Text */}
        <h3 className="text-base font-bold text-white leading-relaxed">
          {currentQuestion.question_text}
        </h3>

        {/* 4. ANSWER OPTIONS DISPLAY (BY QUESTION TYPE) */}

        {/* TYPE A: MULTIPLE CHOICE */}
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
                      ? 'border-cyan-500/60 bg-cyan-950/20 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'border-zinc-850 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/30 hover:border-zinc-700'
                  } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[11px] border flex-shrink-0 transition-colors ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold'
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

        {/* TYPE B: TRUE / FALSE */}
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

        {/* TYPE C: MULTIPLE SELECT */}
        {currentQuestion.question_type === 'multiple_select' && (
          <div className="space-y-3 pt-2">
            <p className="text-[11px] text-zinc-400 italic">Select all that apply:</p>
            {currentQuestion.options?.map((opt) => {
              const selectedIds = currentAnswer?.option_ids || [];
              const isSelected = selectedIds.includes(opt.id);

              return (
                <div
                  key={opt.id}
                  onClick={() => !isSubmitting && handleToggleMultiSelect(opt.id)}
                  className={`p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-3.5 ${
                    isSelected
                      ? 'border-cyan-500/60 bg-cyan-950/20 text-cyan-200'
                      : 'border-zinc-850 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/30 hover:border-zinc-700'
                  } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 ${
                    isSelected ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300' : 'border-zinc-800 bg-zinc-950 text-zinc-500'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <span className="flex-1">{opt.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* TYPE D: FILL BLANK / SHORT ANSWER */}
        {(currentQuestion.question_type === 'fill_blank' || currentQuestion.question_type === 'short_answer') && (
          <div className="space-y-3 pt-2">
            <label className="text-[11px] text-zinc-400 block font-mono">Your Answer:</label>
            <textarea
              rows={3}
              disabled={isSubmitting}
              value={currentAnswer?.answer_text || ''}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Type your response here..."
              className="w-full p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 transition-all resize-none disabled:opacity-50"
            />
          </div>
        )}
      </div>

      {/* 5. QUESTION NAVIGATOR (NUMBERED PILLS) */}
      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/80 flex items-center justify-between gap-4 flex-wrap">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
          Question Navigator:
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
                {answered && !isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1 right-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. BOTTOM ACTION BUTTONS */}
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
              Grading Quiz...
            </>
          ) : currentIndex === totalQuestions - 1 ? (
            <>
              Submit Quiz
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
