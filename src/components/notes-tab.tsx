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
  Lock
} from 'lucide-react';
import LessonContentRenderer from '@/components/lesson-content-renderer';

interface NoteData {
  title: string;
  content: string;
}

export interface NoteNode {
  id: string;
  title: string;
  description?: string;
  content?: string;
  status: 'completed' | 'in_progress' | 'locked';
}

interface NotesTabProps {
  notes: { [nodeId: string]: NoteData };
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
  // Automatically select the first unlocked node if activeNodeId is empty or not in list
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

  const selectedNodeObj = nodeList.find(n => n.id === activeNodeId);

  const activeNote: NoteData = notes[activeNodeId] || {
    title: selectedNodeObj?.title || 'Select a Topic',
    content: selectedNodeObj?.content || selectedNodeObj?.description || 'Study notes for this topic are available in the interactive lesson reader.'
  };

  const handleAskTutor = () => {
    onAskTutorAboutNote(activeNote.title);
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

                  <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                    isSelected ? 'transform rotate-90 text-cyan-400' : 'text-zinc-600'
                  }`} />
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
        <div className="space-y-6">
          
          {/* Note Top Bar Controls */}
          <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
            <div className="flex items-center gap-2.5 text-zinc-400">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">AI Generated Notes</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => alert("Note Bookmarked!")}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
                title="Bookmark Note"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => window.print()}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
                title="Print Notes"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Headline Title */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{activeNote.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] font-mono text-zinc-500">FORMAT: STRUCTURED SYLLABUS</span>
              <span className="w-1 h-1 rounded-full bg-zinc-800" />
              <span className="text-[9px] font-mono text-zinc-500">
                STATUS: {selectedNodeObj?.status?.toUpperCase() || 'UNLOCKED'}
              </span>
            </div>
          </div>

          {/* Formatted Content */}
          <article className="prose prose-invert max-w-none text-zinc-300">
            <LessonContentRenderer content={activeNote.content} />
          </article>
        </div>

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
