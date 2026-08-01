'use client';

import React, { useState } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  MessageSquare,
  Bookmark,
  Sparkles,
  ArrowRight,
  Printer,
  ChevronRight
} from 'lucide-react';

interface NoteData {
  title: string;
  content: string;
}

interface NotesTabProps {
  notes: { [nodeId: string]: NoteData };
  activeNodeId: string;
  nodeList: { id: string; title: string; status: 'completed' | 'in_progress' | 'locked' }[];
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
  const [searchTerm, setSearchTerm] = useState('');

  const activeNote = notes[activeNodeId] || {
    title: "Select a Topic",
    content: "Please select an unlocked topic from the roadmap or sidebar to display the study notes."
  };

  const handleAskTutor = () => {
    onAskTutorAboutNote(activeNote.title);
  };

  // Simple Markdown-to-HTML formatter to render headers, bold text, lists, and code blocks
  const renderFormattedContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-base font-bold text-zinc-100 mt-6 mb-2 flex items-center gap-1.5">{line.substring(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-lg font-bold text-white mt-8 mb-3 border-b border-zinc-900 pb-1 flex items-center gap-2">{line.substring(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent mt-4 mb-4">{line.substring(2)}</h2>;
      }

      // Code blocks or monospace terms (e.g. `User vs Kernel Threads`)
      if (line.startsWith('```')) {
        // Find if this line starts a block
        return null; // For simple rendering we parse blocks below, or treat code block formatting line-by-line
      }

      // List items
      if (line.startsWith('- ')) {
        return (
          <li key={idx} className="ml-5 list-disc text-zinc-300 text-xs my-1.5 leading-relaxed">
            {parseInlineStyles(line.substring(2))}
          </li>
        );
      }

      // Sub-bullet list items
      if (line.startsWith('  - ') || line.startsWith('    - ')) {
        return (
          <li key={idx} className="ml-10 list-square text-zinc-400 text-xs my-1 leading-relaxed">
            {parseInlineStyles(line.trim().substring(2))}
          </li>
        );
      }

      // Numbered List
      if (/^\d+\.\s/.test(line)) {
        const content = line.replace(/^\d+\.\s/, '');
        return (
          <div key={idx} className="flex gap-2.5 my-2 text-xs leading-relaxed text-zinc-300">
            <span className="font-mono text-cyan-400 font-bold">{line.match(/^\d+/)![0]}.</span>
            <span>{parseInlineStyles(content)}</span>
          </div>
        );
      }

      // Blockquote/Important Alert style
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-2 border-indigo-500 bg-indigo-950/10 p-3 rounded-r-lg my-4 text-xs italic text-indigo-300">
            {parseInlineStyles(line.substring(2))}
          </blockquote>
        );
      }

      // Empty space
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }

      // Default paragraph
      return (
        <p key={idx} className="text-xs text-zinc-300 leading-relaxed my-2">
          {parseInlineStyles(line)}
        </p>
      );
    });
  };

  // Basic inline formatter for bold **text** and monospace `code`
  const parseInlineStyles = (text: string) => {
    // Regex for bold **word**
    const boldRegex = /\*\*(.*?)\*\*/g;
    // Regex for code `word`
    const codeRegex = /`(.*?)`/g;

    let parts = [];
    let lastIndex = 0;
    
    // Simple state machine or replace tokens with key tags
    // Let's create an array of elements
    const combinedRegex = /\*\*(.*?)\*\*|`(.*?)`/g;
    let match;
    let index = 0;

    while ((match = combinedRegex.exec(text)) !== null) {
      // Add leading text
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      if (match[1]) {
        // Bold match
        parts.push(<strong key={index++} className="font-bold text-white">{match[1]}</strong>);
      } else if (match[2]) {
        // Monospace code match
        parts.push(
          <code key={index++} className="font-mono text-[10px] bg-zinc-900 border border-zinc-800 text-cyan-400 px-1.5 py-0.5 rounded-md">
            {match[2]}
          </code>
        );
      }

      lastIndex = combinedRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Filter nodes that have study notes associated
  const notesAvailableNodes = nodeList.filter(node => node.status !== 'locked');

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full items-start">
      
      {/* Outline / Sidebar Outline Navigator (3 Cols) */}
      <div className="md:col-span-3 space-y-4">
        <div className="p-4 rounded-xl glass-panel border border-zinc-900">
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block mb-3">
            Topics Outline
          </span>
          <div className="space-y-1">
            {notesAvailableNodes.map((node) => {
              const hasNotes = !!notes[node.id];
              const isSelected = activeNodeId === node.id;
              
              return (
                <button
                  key={node.id}
                  disabled={!hasNotes}
                  onClick={() => onSelectNode(node.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all duration-200 flex items-center justify-between border ${
                    !hasNotes 
                      ? 'opacity-40 cursor-not-allowed border-transparent text-zinc-600'
                      : isSelected
                      ? 'bg-zinc-800/80 border-zinc-700 text-white font-medium shadow-sm'
                      : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
                  }`}
                >
                  <span className="truncate pr-2">{node.title}</span>
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
      <div className="md:col-span-9 p-6 rounded-2xl glass-panel border border-zinc-800/80 min-h-[500px] flex flex-col justify-between shadow-lg">
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
              <span className="text-[9px] font-mono text-zinc-500">FORMAT: MARKDOWN COMPASS</span>
              <span className="w-1 h-1 rounded-full bg-zinc-800" />
              <span className="text-[9px] font-mono text-zinc-500">LENGTH: ~500 WORDS</span>
            </div>
          </div>

          {/* Formatted Content */}
          <article className="prose prose-invert max-w-none text-zinc-300">
            {renderFormattedContent(activeNote.content)}
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
