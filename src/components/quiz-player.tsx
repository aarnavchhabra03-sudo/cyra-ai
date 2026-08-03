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
  FileText
} from 'lucide-react';
import { QuizRecord, SafeQuizQuestion } from '@/types/quiz';

interface QuizPlayerProps {
  quiz: QuizRecord;
  questions: SafeQuizQuestion[];
  onExit: () => void;
}

export default function QuizPlayer({ quiz, questions, onExit }: QuizPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitNotice, setSubmitNotice] = useState<boolean>(false);

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

  const handleNextOrSubmit = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Final question -> show Stage 12.3B submission notice banner
      setSubmitNotice(true);
    }
  };

  const progressPercentage = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP HEADER BAR */}
      <div className="flex items-center justify-between bg-zinc-900/40 p-4 rounded-xl border border-zinc-900/80">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
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
                  onClick={() => handleSelectOption(opt.id)}
                  className={`p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-3.5 ${
                    isSelected
                      ? 'border-cyan-500/60 bg-cyan-950/20 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'border-zinc-850 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/30 hover:border-zinc-700'
                  }`}
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
                  onClick={() => handleSelectOption(opt.id)}
                  className={`p-5 rounded-xl border text-sm font-bold text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                    isSelected
                      ? 'border-indigo-500/60 bg-indigo-950/30 text-indigo-200 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                      : 'border-zinc-850 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/30 hover:border-zinc-700'
                  }`}
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
                  onClick={() => handleToggleMultiSelect(opt.id)}
                  className={`p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 flex items-center gap-3.5 ${
                    isSelected
                      ? 'border-cyan-500/60 bg-cyan-950/20 text-cyan-200'
                      : 'border-zinc-850 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/30 hover:border-zinc-700'
                  }`}
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
              value={currentAnswer?.answer_text || ''}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Type your response here..."
              className="w-full p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 transition-all resize-none"
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
                onClick={() => setCurrentIndex(idx)}
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

      {/* 6. IN-APP SUBMISSION NOTICE BANNER */}
      {submitNotice && (
        <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-3 animate-fade-in text-center relative overflow-hidden">
          <div className="flex items-center justify-center gap-2 text-indigo-300 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Interactive Answers Saved</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed max-w-lg mx-auto">
            Secure quiz submission, server-side grading, XP rewards, and weak concept analysis will be activated in <strong className="text-cyan-400">Stage 12.3B</strong>!
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => setSubmitNotice(false)}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold hover:text-white"
            >
              Review Answers
            </button>
            <button
              onClick={onExit}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Return to Overview
            </button>
          </div>
        </div>
      )}

      {/* 7. BOTTOM ACTION BUTTONS */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="py-2.5 px-5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        <button
          onClick={handleNextOrSubmit}
          className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs transition-all duration-200 shadow-md shadow-indigo-500/15 flex items-center gap-1.5"
        >
          {currentIndex === totalQuestions - 1 ? (
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
