'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Map, FileText, BookOpen, FileCheck, Bot, Loader2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import RoadmapTab from '@/components/roadmap-tab';
import NotesTab from '@/components/notes-tab';
import ResourcesTab from '@/components/resources-tab';
import QuizTab from '@/components/quiz-tab';
import TutorTab from '@/components/tutor-tab';
import { mockOSCourseDetail, Module as UIModule } from '@/data/mockData';

type TabType = 'roadmap' | 'notes' | 'resources' | 'quiz' | 'tutor';

const TABS: { type: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'roadmap', label: 'Roadmap', icon: Map },
  { type: 'notes', label: 'Study Notes', icon: FileText },
  { type: 'resources', label: 'Resources', icon: BookOpen },
  { type: 'quiz', label: 'Quiz', icon: FileCheck },
  { type: 'tutor', label: 'AI Tutor', icon: Bot },
];

export default function CourseWorkspace() {
  const params = useParams();
  const learningPathId = params?.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [progress, setProgress] = useState(0);
  const [uiModules, setUiModules] = useState<UIModule[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>('roadmap');
  const [activeNodeId, setActiveNodeId] = useState('');
  const [tutorCtx, setTutorCtx] = useState('');

  useEffect(() => {
    async function fetchCourseData() {
      if (!learningPathId) return;

      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setError('Please sign in to access your learning path workspace.');
          setLoading(false);
          return;
        }

        // Fetch Learning Path
        const { data: pathData, error: pathErr } = await supabase
          .from('learning_paths')
          .select('*')
          .eq('id', learningPathId)
          .single();

        if (pathErr || !pathData || pathData.user_id !== user.id) {
          // Fallback to mock data if id is not a valid UUID path
          if (learningPathId === '1' || learningPathId === 'os-101') {
            setTitle(mockOSCourseDetail.title);
            setGoal('Computer Science Fundamentals');
            setProgress(mockOSCourseDetail.progress);
            setUiModules(mockOSCourseDetail.modules);
            setLoading(false);
            return;
          }

          setError('Learning path not found or access denied.');
          setLoading(false);
          return;
        }

        setTitle(pathData.title);
        setGoal(`${pathData.experience_level.toUpperCase()} • ${pathData.goal}`);
        setProgress(pathData.progress || 0);

        // Fetch Modules for Path
        const { data: modulesData } = await supabase
          .from('modules')
          .select('*')
          .eq('learning_path_id', learningPathId)
          .order('module_order', { ascending: true });

        if (!modulesData || modulesData.length === 0) {
          setUiModules([]);
          setLoading(false);
          return;
        }

        const moduleIds = modulesData.map(m => m.id);

        // Fetch Lessons for Modules
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('*')
          .in('module_id', moduleIds)
          .order('lesson_order', { ascending: true });

        // Fetch User Progress for Lessons
        const lessonIds = lessonsData ? lessonsData.map(l => l.id) : [];
        const { data: progressData } = lessonIds.length > 0
          ? await supabase
              .from('user_progress')
              .select('lesson_id')
              .eq('user_id', user.id)
              .in('lesson_id', lessonIds)
          : { data: [] };

        const completedLessonSet = new Set(progressData?.map(p => p.lesson_id) || []);

        // Map Supabase modules + lessons to UI format
        const mappedUiModules: UIModule[] = modulesData.map((mod, modIdx) => {
          const modLessons = lessonsData
            ? lessonsData.filter(l => l.module_id === mod.id).sort((a, b) => a.lesson_order - b.lesson_order)
            : [];

          const nodes = modLessons.map((l, lIdx) => {
            const isCompleted = completedLessonSet.has(l.id);
            const isFirst = modIdx === 0 && lIdx === 0;

            let status: 'completed' | 'in_progress' | 'locked' = 'locked';
            if (isCompleted) {
              status = 'completed';
            } else if (isFirst || modIdx === 0) {
              status = 'in_progress';
            }

            return {
              id: l.id,
              title: l.title,
              description: l.description || (l.content ? l.content.split('\n')[0].replace(/^#+\s*/, '') : ''),
              content: l.content || '',
              status,
              type: 'concept' as const,
              estimatedMinutes: l.estimated_minutes || 15,
              topics: l.content ? [l.content.split('\n')[0].replace(/^#+\s*/, '')] : [l.title],
            };
          });

          const completedNodesCount = nodes.filter(n => n.status === 'completed').length;
          const modProgress = nodes.length > 0 ? Math.round((completedNodesCount / nodes.length) * 100) : 0;
          const allModCompleted = nodes.length > 0 && completedNodesCount === nodes.length;

          const modStatus: 'completed' | 'in_progress' | 'locked' = allModCompleted
            ? 'completed'
            : modIdx === 0 ? 'in_progress' : 'locked';

          return {
            id: mod.id,
            title: mod.title,
            description: mod.description || '',
            progress: modProgress,
            status: modStatus,
            nodes,
          };
        });

        setUiModules(mappedUiModules);
        if (mappedUiModules.length > 0 && mappedUiModules[0].nodes.length > 0) {
          const firstInProgress = mappedUiModules[0].nodes.find(n => n.status === 'in_progress');
          const defaultNodeId = firstInProgress ? firstInProgress.id : mappedUiModules[0].nodes[0].id;
          setActiveNodeId(prev => prev || defaultNodeId);
        }
      } catch (err) {
        console.error('Error fetching workspace:', err);
        setError('Failed to load course workspace.');
      } finally {
        setLoading(false);
      }
    }

    fetchCourseData();
  }, [learningPathId]);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    if (tab !== 'tutor') setTutorCtx('');
  };

  const allNodes = uiModules.flatMap(m =>
    m.nodes.map(n => ({
      id: n.id,
      title: n.title,
      description: n.description,
      content: (n as any).content || '',
      status: n.status
    }))
  );

  const notesMap: { [nodeId: string]: { title: string; content: string } } = {};
  uiModules.forEach(m => {
    m.nodes.forEach(n => {
      notesMap[n.id] = {
        title: n.title,
        content: (n as any).content || n.description || 'Study notes for this lesson are available in the interactive lesson reader.'
      };
    });
  });

  if (loading) {
    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs font-mono text-zinc-400">Loading CYRA Workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="p-8 rounded-2xl glass-panel border border-zinc-800 text-center max-w-md space-y-4">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Workspace Error</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to My Courses</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950 text-white">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header
        className="h-14 px-6 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(7,7,10,0.7)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/courses"
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>

          <div className="w-px h-5" style={{ background: 'var(--border)' }} />

          <div>
            <h1 className="text-sm font-semibold text-white leading-none">{title}</h1>
            <p className="text-[10px] mt-0.5 font-medium text-zinc-400">
              {goal}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-400">
            {progress}% complete
          </span>
          <div className="w-28 h-1 rounded-full overflow-hidden bg-zinc-800">
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
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-7">
        {activeTab === 'roadmap' && (
          <RoadmapTab
            modules={uiModules}
            learningPathId={learningPathId}
            onSelectNode={(nodeId) => setActiveNodeId(nodeId)}
            onSwitchTab={switchTab}
            onOpenLesson={(lessonId) => router.push(`/learn/${learningPathId}/lesson/${lessonId}`)}
          />
        )}
        {activeTab === 'notes' && (
          <NotesTab
            notes={notesMap}
            activeNodeId={activeNodeId}
            nodeList={allNodes}
            onSelectNode={setActiveNodeId}
            onAskTutorAboutNote={t => { setTutorCtx(t); setActiveTab('tutor'); }}
          />
        )}
        {activeTab === 'resources' && (
          <ResourcesTab
            activeNodeId={activeNodeId}
            nodeList={allNodes}
            onSelectNode={setActiveNodeId}
          />
        )}
        {activeTab === 'quiz' && (
          <QuizTab
            activeNodeId={activeNodeId}
            nodeList={allNodes}
            onSelectNode={setActiveNodeId}
            onSwitchTab={switchTab}
            onCompleteQuiz={(pct, xp) => { if (pct >= 60) setProgress(p => Math.min(100, p + 15)); }}
          />
        )}
        {activeTab === 'tutor' && <TutorTab learningPathId={learningPathId} lessonId={activeNodeId || undefined} initialContext={tutorCtx} />}
      </div>
    </div>
  );
}
