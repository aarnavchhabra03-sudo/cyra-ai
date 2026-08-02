'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  MessageSquare,
  Bookmark,
  Sparkles,
  ArrowRight,
  Printer,
  ChevronRight,
  CheckCircle2,
  Circle,
  Lock,
  Loader2,
  AlertTriangle,
  Lightbulb,
  Check,
  Code,
  Star,
  FileText
} from 'lucide-react';
import LessonContentRenderer from '@/components/lesson-content-renderer';

export interface StudyNotesRow {
  id?: string;
  lesson_id: string;
  overview: string;
  explanation: string;
  key_concepts: string[];
  examples: string[];
  important_points: string[];
  quick_revision: string;
  raw_markdown?: string;
}

export interface NoteNode {
  id: string;
  title: string;
  description?: string;
  content?: string;
  status: 'completed' | 'in_progress' | 'locked';
}

interface NotesTabProps {
  notes: { [nodeId: string]: { title: string; content: string } };
  activeNodeId: string;
  nodeList: NoteNode[];
  onSelectNode: (nodeId: string) => void;
  onAskTutorAboutNote: (noteTitle: string, paragraphSnippet?: string) => void;
}

export default function NotesTab({ 
  notes, 
  activeNodeId, 
  nodeList, 
  onSelectNode,
  onAskTutorAboutNote 
}: NotesTabProps) {
  // Local cache for study notes rows fetched or generated during session
  const [studyNotesCache, setStudyNotesCache] = useState<{ [lessonId: string]: StudyNotesRow }>({});
  const [fetchingNotes, setFetchingNotes] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-select first unlocked node if activeNodeId is empty or not in list
  useEffect(() => {
    if (nodeList.length > 0) {
      const exists = nodeList.some(n => n.id === activeNodeId);
      if (!activeNodeId || !exists) {
        const firstUnlocked = nodeList.find(n => n.status === 'completed' || n.status === 'in_progress');
        if (firstUnlocked) {
          onSelectNode(firstUnlocked.id);
        } else if (nodeList[0]) {
          onSelectNode(nodeList[0].id);
        }
      }
    }
  }, [activeNodeId, nodeList, onSelectNode]);

  // Fetch or check DB cache whenever activeNodeId changes
  useEffect(() => {
    async function checkSavedStudyNotes() {
      if (!activeNodeId) return;

      const targetNode = nodeList.find(n => n.id === activeNodeId);
      if (!targetNode || targetNode.status === 'locked') return;

      // Check local session cache first
      if (studyNotesCache[activeNodeId]) {
        setErrorMsg(null);
        return;
      }

      setFetchingNotes(true);
      setErrorMsg(null);

      try {
        const res = await fetch('/api/ai/generate-study-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: activeNodeId }),
        });

        const data = await res.json();

        if (res.ok && data.success && data.data) {
          setStudyNotesCache(prev => ({
            ...prev,
            [activeNodeId]: data.data,
          }));
        } else if (data.cached === false) {
          // No note existed in DB yet; UI will show "Generate Study Notes" CTA button
        }
      } catch (err) {
        console.error('Error fetching study notes:', err);
      } finally {
        setFetchingNotes(false);
      }
    }

    checkSavedStudyNotes();
  }, [activeNodeId, nodeList, studyNotesCache]);

  // Handle explicit AI Study Notes generation trigger
  const handleGenerateNotes = async () => {
    if (!activeNodeId || generating) return;

    setGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/generate-study-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: activeNodeId }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setStudyNotesCache(prev => ({
          ...prev,
          [activeNodeId]: data.data,
        }));
      } else {
        if (res.status === 429 || data.code === 'AI_RATE_LIMIT') {
          setErrorMsg('AI is temporarily busy. Please wait a moment and try again.');
        } else {
          setErrorMsg(data.error || 'Failed to generate study notes. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error generating notes:', err);
      setErrorMsg('Network or server error while generating study notes.');
    } finally {
      setGenerating(false);
    }
  };

  const selectedNodeObj = nodeList.find(n => n.id === activeNodeId);
  const activeStudyNote = activeNodeId ? studyNotesCache[activeNodeId] : null;

  const handleAskTutor = () => {
    const title = selectedNodeObj?.title || 'Study Topic';
    onAskTutorAboutNote(title);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full items-start">
      
      {/* Outline / Sidebar Outline Navigator (3 Cols) */}
      <div className="md:col-span-3 space-y-4">
        <div className="p-4 rounded-xl glass-panel border border-zinc-900">
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block mb-3">
            Topics Outline
          </span>
          <div className="space-y-1">
            {nodeList.map((node) => {
              const isUnlocked = node.status === 'completed' || node.status === 'in_progress';
              const isSelected = activeNodeId === node.id;
              const hasGeneratedNotes = !!studyNotesCache[node.id];
              
              return (
                <button
                  key={node.id}
                  disabled={!isUnlocked}
                  onClick={() => onSelectNode(node.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all duration-200 flex items-center justify-between border ${
                    !isUnlocked 
                      ? 'opacity-40 cursor-not-allowed border-transparent text-zinc-600'
                      : isSelected
                      ? 'bg-indigo-600/20 border-indigo-500/60 text-white font-medium shadow-sm shadow-indigo-500/10'
                      : 'bg-transparent border-transparent text-zinc-300 hover:text-white hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {node.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : node.status === 'in_progress' ? (
                      <Circle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 animate-pulse" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                    )}
                    <span className="truncate">{node.title}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {hasGeneratedNotes && (
                      <span title="AI Notes Saved">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                      </span>
                    )}
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                      isSelected ? 'transform rotate-90 text-cyan-400' : 'text-zinc-600'
                    }`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Helper Widget */}
        <div className="p-4 rounded-xl glass-panel border border-zinc-800/60 bg-gradient-to-tr from-indigo-950/10 to-transparent space-y-3">
          <div className="flex gap-2 text-indigo-400">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 animate-pulse" />
            <h5 className="text-[11px] font-bold text-zinc-200 uppercase tracking-wide">Context Tutor</h5>
          </div>
          <p className="text-[10px] text-zinc-400 leading-normal">
            Struggling with a formula or concept? You can prompt the AI Tutor directly about this study note topic.
          </p>
          <button
            onClick={handleAskTutor}
            className="w-full py-2 px-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white border border-indigo-500/25 transition-all text-[10px] font-bold flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-3 h-3" />
            Discuss with AI Tutor
          </button>
        </div>
      </div>

      {/* Main Study Note Content (9 Cols) */}
      <div className="md:col-span-9 p-6 md:p-8 rounded-2xl glass-panel border border-zinc-800/80 min-h-[500px] flex flex-col justify-between shadow-lg">
        {fetchingNotes ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-7 h-7 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs font-mono text-zinc-400">Checking saved AI study notes...</p>
          </div>
        ) : activeStudyNote ? (
          /* Render Persistent AI Generated Study Notes */
          <div className="space-y-8">
            {/* Top Bar Header */}
            <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-2.5 text-zinc-400">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">AI GENERATED NOTES</span>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                PERSISTED IN DATABASE
              </span>
            </div>

            {/* Lesson Title */}
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight leading-snug">
                {selectedNodeObj?.title || 'Lesson Study Notes'}
              </h1>
            </div>

            {/* 1. OVERVIEW */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>OVERVIEW</span>
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-4 rounded-xl border border-zinc-900">
                {activeStudyNote.overview}
              </p>
            </div>

            {/* 2. DETAILED EXPLANATION */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold font-mono text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>DETAILED EXPLANATION</span>
              </h3>
              <div className="p-4 md:p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/80">
                <LessonContentRenderer content={activeStudyNote.explanation} />
              </div>
            </div>

            {/* 3. KEY CONCEPTS */}
            {activeStudyNote.key_concepts && activeStudyNote.key_concepts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span>KEY CONCEPTS</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeStudyNote.key_concepts.map((concept, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2 text-xs text-indigo-200">
                      <Check className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <span>{concept}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. EXAMPLES */}
            {activeStudyNote.examples && activeStudyNote.examples.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <span>EXAMPLES</span>
                </h3>
                <div className="space-y-2">
                  {activeStudyNote.examples.map((example, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono leading-relaxed">
                      <span className="text-[10px] text-zinc-500 block mb-1">EXAMPLE #{idx + 1}</span>
                      <p>{example}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. IMPORTANT POINTS */}
            {activeStudyNote.important_points && activeStudyNote.important_points.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold font-mono text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <Star className="w-4 h-4 text-purple-400" />
                  <span>IMPORTANT POINTS</span>
                </h3>
                <div className="space-y-2">
                  {activeStudyNote.important_points.map((point, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. QUICK REVISION */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-zinc-900/80 to-purple-950/50 border border-indigo-500/30 space-y-2 shadow-lg">
              <div className="flex items-center gap-2 text-cyan-400">
                <Sparkles className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">QUICK REVISION</h4>
              </div>
              <p className="text-xs text-indigo-200 leading-relaxed">
                {activeStudyNote.quick_revision}
              </p>
            </div>
          </div>
        ) : (
          /* Empty State — Prompt User to Generate Notes */
          <div className="py-16 text-center space-y-6 max-w-lg mx-auto my-auto">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-xl">
              <Sparkles className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {selectedNodeObj?.title || 'AI Study Notes'}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                No AI study notes generated for this lesson yet. Click below to synthesize deep, structured study notes covering detailed explanations, key concepts, examples, and exam revision.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              disabled={generating}
              onClick={handleGenerateNotes}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 mx-auto transition-all shadow-lg shadow-indigo-500/20"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Detailed Study Notes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <span>Generate Study Notes</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer Info / Progress Actions */}
        <div className="mt-8 pt-4 border-t border-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="font-mono">CYRA V1.0 SYLLABUS ENGINE</span>
          <div className="flex items-center gap-4">
            <button
              onClick={handleAskTutor}
              className="text-cyan-400 hover:underline font-semibold flex items-center gap-1"
            >
              Ask AI to summarize
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
