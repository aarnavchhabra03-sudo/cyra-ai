'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Map, FileText, BookOpen, FileCheck, Bot } from 'lucide-react';

import { mockOSCourseDetail } from '@/data/mockData';
import RoadmapTab    from '@/components/roadmap-tab';
import NotesTab      from '@/components/notes-tab';
import ResourcesTab  from '@/components/resources-tab';
import QuizTab       from '@/components/quiz-tab';
import TutorTab      from '@/components/tutor-tab';

type TabType = 'roadmap' | 'notes' | 'resources' | 'quiz' | 'tutor';

const TABS: { type: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'roadmap',   label: 'Roadmap',     icon: Map },
  { type: 'notes',     label: 'Study Notes', icon: FileText },
  { type: 'resources', label: 'Resources',   icon: BookOpen },
  { type: 'quiz',      label: 'Quiz',        icon: FileCheck },
  { type: 'tutor',     label: 'AI Tutor',    icon: Bot },
];

export default function CourseWorkspace() {
  const course = mockOSCourseDetail;

  const [activeTab,    setActiveTab]    = useState<TabType>('roadmap');
  const [activeNodeId, setActiveNodeId] = useState('node-2-1');
  const [tutorCtx,     setTutorCtx]     = useState('');
  const [progress,     setProgress]     = useState(course.progress);

  const allNodes = course.modules.flatMap(m =>
    m.nodes.map(n => ({ id: n.id, title: n.title, status: n.status }))
  );

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    if (tab !== 'tutor') setTutorCtx('');
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header
        className="h-14 px-6 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(7,7,10,0.7)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>

          <div className="w-px h-5" style={{ background: 'var(--border)' }} />

          <div>
            <h1 className="text-sm font-semibold text-white leading-none">{course.title}</h1>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              Computer Science Fundamentals
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {progress}% complete
          </span>
          <div className="w-28 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary), var(--cyan))' }}
            />
          </div>
        </div>
      </header>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-5"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(7,7,10,0.5)' }}
      >
        <div className="flex">
          {TABS.map(({ type, label, icon: Icon }) => {
            const active = activeTab === type;
            return (
              <button
                key={type}
                onClick={() => switchTab(type)}
                className="relative flex items-center gap-2 px-4 py-3.5 text-xs font-medium transition-colors"
                style={{ color: active ? '#fff' : 'var(--text-muted)' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-cyan-400' : ''}`} />
                {label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                    style={{ background: 'linear-gradient(90deg, var(--primary), var(--cyan))' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <span className="text-[9px] font-mono hidden md:block" style={{ color: 'var(--text-muted)' }}>
          {course.activeModuleName}
        </span>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-7">
        {activeTab === 'roadmap'   && <RoadmapTab   modules={course.modules} onSelectNode={id => setActiveNodeId(id)} onSwitchTab={switchTab} />}
        {activeTab === 'notes'     && <NotesTab     notes={course.notes} activeNodeId={activeNodeId} nodeList={allNodes} onSelectNode={setActiveNodeId} onAskTutorAboutNote={t => { setTutorCtx(t); setActiveTab('tutor'); }} />}
        {activeTab === 'resources' && <ResourcesTab videos={course.resources.videos} texts={course.resources.texts} />}
        {activeTab === 'quiz'      && <QuizTab      quizzes={course.quizzes} onCompleteQuiz={pct => { if (pct >= 60) setProgress(p => Math.min(100, p + 15)); }} onSwitchTab={switchTab} />}
        {activeTab === 'tutor'     && <TutorTab     initialContext={tutorCtx} />}
      </div>
    </div>
  );
}
