'use client';

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import TutorTab from '@/components/tutor-tab';

export default function StandaloneTutorPage() {
  return (
    <div className="flex-1 p-8 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <div className="flex items-center gap-2.5 text-zinc-400 mb-1">
          <Bot className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">AI Assistant Hub</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">CYRA AI Tutor Workspace</h2>
        <p className="text-xs text-zinc-400 mt-1">Prompt the assistant with questions, request quizzes, or get assistance summarizing topics.</p>
      </div>

      <TutorTab />
    </div>
  );
}
