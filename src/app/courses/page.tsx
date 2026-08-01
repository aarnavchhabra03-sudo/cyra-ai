'use client';

import React from 'react';
import Link from 'next/link';
import { 
  GraduationCap, 
  ArrowRight, 
  Sparkles,
  BookOpen,
  ArrowUpRight
} from 'lucide-react';
import { mockCourses } from '@/data/mockData';

export default function CoursesPage() {
  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center gap-2.5 text-zinc-400 mb-1">
          <GraduationCap className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">Workspace Index</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Active Learning Pathways</h2>
        <p className="text-xs text-zinc-400 mt-1">Access all your AI-synthesized curriculums and roadmaps below.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockCourses.map((c) => (
          <Link 
            href={`/course/${c.id}`} 
            key={c.id} 
            className="group p-6 rounded-2xl glass-card block relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/20">
                  {c.progress}% COMPLETE
                </span>
                <h3 className="text-lg font-bold text-white mt-3 group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                  {c.title}
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">
                  {c.description}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-900/60 flex justify-between items-center text-[11px]">
              <span className="text-zinc-500 font-mono">Module: {c.activeModuleName}</span>
              <span className="text-cyan-400 font-semibold flex items-center gap-1">
                Enter Course
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
