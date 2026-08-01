'use client';

import React, { useState } from 'react';
import { 
  Award, 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  ChevronRight, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { Quiz, QuizQuestion } from '@/data/mockData';

interface QuizTabProps {
  quizzes: Quiz[];
  onCompleteQuiz: (scorePercent: number, xpReward: number) => void;
  onSwitchTab: (tabName: 'roadmap' | 'notes' | 'resources' | 'quiz' | 'tutor') => void;
}

export default function QuizTab({ quizzes, onCompleteQuiz, onSwitchTab }: QuizTabProps) {
  const activeQuiz = quizzes[0]; // Take the first mock quiz

  // Quiz States
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [numberCorrect, setNumberCorrect] = useState(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);

  const question = activeQuiz.questions[currentQuestionIndex];

  const handleSelectOption = (index: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOptionIndex(index);
  };

  const handleSubmitAnswer = () => {
    if (selectedOptionIndex === null || isAnswerSubmitted) return;

    setIsAnswerSubmitted(true);
    if (selectedOptionIndex === question.correctIndex) {
      setNumberCorrect(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    // Check if we have more questions
    if (currentQuestionIndex < activeQuiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOptionIndex(null);
      setIsAnswerSubmitted(false);
    } else {
      // Quiz complete!
      setIsQuizCompleted(true);
      const scorePercent = Math.round((numberCorrect / activeQuiz.questions.length) * 100);
      const xpReward = scorePercent >= 60 ? 50 : 10; // Earn XP!
      onCompleteQuiz(scorePercent, xpReward);
    }
  };

  const handleRetake = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptionIndex(null);
    setIsAnswerSubmitted(false);
    setNumberCorrect(0);
    setIsQuizCompleted(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      
      {/* 1. QUIZ COMPLETED SCREEN */}
      {isQuizCompleted ? (
        <div className="p-8 rounded-2xl glass-panel border border-zinc-800/80 text-center space-y-6 shadow-xl animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 p-[1.5px] mx-auto shadow-[0_0_20px_rgba(99,102,241,0.25)] flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
              <Award className="w-8 h-8 text-cyan-400 animate-bounce" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white tracking-wide">Quiz Completed!</h3>
            <p className="text-xs text-zinc-400 font-mono">Module 2: Memory & Paging Basics</p>
          </div>

          {/* Results Badge Grid */}
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-900 text-center">
              <span className="text-[10px] font-mono text-zinc-500 block uppercase">Final Score</span>
              <span className="text-2xl font-bold text-white font-mono">
                {numberCorrect} / {activeQuiz.questions.length}
              </span>
              <span className="text-[10px] text-cyan-400 font-semibold block mt-1">
                {Math.round((numberCorrect / activeQuiz.questions.length) * 100)}% Accuracy
              </span>
            </div>

            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-900 text-center flex flex-col justify-center items-center">
              <span className="text-[10px] font-mono text-zinc-500 block uppercase">XP Rewarded</span>
              <span className="text-2xl font-bold text-indigo-400 font-mono">
                +{Math.round((numberCorrect / activeQuiz.questions.length) * 100) >= 60 ? 50 : 10} XP
              </span>
              <span className="text-[9px] text-zinc-500 mt-1 block">Level progress saved</span>
            </div>
          </div>

          {/* CTA actions */}
          <div className="flex gap-3 max-w-md mx-auto pt-4">
            <button
              onClick={handleRetake}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retake Quiz
            </button>

            <button
              onClick={() => onSwitchTab('tutor')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-200"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Discuss with Tutor
            </button>
          </div>
        </div>
      ) : (
        
        // 2. ACTIVE QUIZ PLAYBACK SCREEN
        <div className="space-y-6">
          
          {/* Quiz Stats Header */}
          <div className="flex justify-between items-center bg-zinc-900/40 p-4 rounded-xl border border-zinc-900/60">
            <div className="flex items-center gap-2 text-zinc-300">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold truncate">{activeQuiz.title}</span>
            </div>
            <span className="text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-400">
              QUESTION {currentQuestionIndex + 1} OF {activeQuiz.questions.length}
            </span>
          </div>

          {/* Quiz Question Card */}
          <div className="p-6 rounded-2xl glass-panel border border-zinc-800/80 space-y-6">
            
            {/* Question Text */}
            <h3 className="text-sm font-bold text-white leading-relaxed">
              {question.question}
            </h3>

            {/* Answer Options Grid */}
            <div className="space-y-3">
              {question.options.map((option, idx) => {
                // Formatting states
                let optionStyle = "border-zinc-850 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800/20 hover:border-zinc-700/60";
                
                if (selectedOptionIndex === idx) {
                  optionStyle = "border-indigo-500/50 bg-indigo-950/15 text-indigo-200";
                }

                if (isAnswerSubmitted) {
                  if (idx === question.correctIndex) {
                    optionStyle = "border-emerald-500/60 bg-emerald-950/20 text-emerald-200";
                  } else if (selectedOptionIndex === idx) {
                    optionStyle = "border-red-500/60 bg-red-950/20 text-red-200";
                  } else {
                    optionStyle = "border-zinc-900 bg-zinc-950/30 text-zinc-500 opacity-60";
                  }
                }

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    className={`p-3.5 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-200 flex items-start gap-3.5 ${optionStyle}`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] border flex-shrink-0 ${
                      selectedOptionIndex === idx 
                        ? 'border-indigo-400 bg-indigo-500/10 text-indigo-300' 
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-500'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span>{option}</span>
                  </div>
                );
              })}
            </div>

            {/* AI Explanation Accordion (Visible after submission) */}
            {isAnswerSubmitted && (
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-900/80 space-y-2.5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-200">
                    CYRA AI Explanation
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {question.explanation}
                </p>
              </div>
            )}

            {/* Progress bar */}
            <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-900">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + (isAnswerSubmitted ? 1 : 0)) / activeQuiz.questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-end">
            {!isAnswerSubmitted ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedOptionIndex === null}
                className="py-2.5 px-6 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:pointer-events-none text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-500/15"
              >
                Submit Answer
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-indigo-500/15"
              >
                {currentQuestionIndex === activeQuiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
