'use client';

import React from 'react';
import { Sparkles, CheckCircle, Code, BookOpen } from 'lucide-react';

interface LessonContentRendererProps {
  content: string;
}

export default function LessonContentRenderer({ content }: LessonContentRendererProps) {
  if (!content || !content.trim()) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-zinc-400 text-sm">
        No additional text content recorded for this lesson yet.
      </div>
    );
  }

  // Split content into blocks by double newlines or single newlines
  const lines = content.split('\n');
  const blocks: { type: 'heading' | 'subheading' | 'keyconcepts' | 'list' | 'code' | 'paragraph'; text: string; items?: string[] }[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Code block toggle
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', text: codeBuffer.join('\n') });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(lines[i]);
      continue;
    }

    // Key Concepts callout
    if (line.toLowerCase().startsWith('key concepts:')) {
      const conceptText = line.substring(line.indexOf(':') + 1).trim();
      const items = conceptText.split(',').map(s => s.trim()).filter(Boolean);
      blocks.push({ type: 'keyconcepts', text: conceptText, items });
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      blocks.push({ type: 'heading', text: line.substring(2).trim() });
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('### ')) {
      blocks.push({ type: 'subheading', text: line.replace(/^#+\s*/, '').trim() });
      continue;
    }

    // Bullet items
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const lastBlock = blocks[blocks.length - 1];
      const itemText = line.substring(2).trim();
      if (lastBlock && lastBlock.type === 'list' && lastBlock.items) {
        lastBlock.items.push(itemText);
      } else {
        blocks.push({ type: 'list', text: '', items: [itemText] });
      }
      continue;
    }

    // Default paragraph
    blocks.push({ type: 'paragraph', text: line });
  }

  if (codeBuffer.length > 0) {
    blocks.push({ type: 'code', text: codeBuffer.join('\n') });
  }

  return (
    <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return (
              <h2 key={idx} className="text-xl font-bold text-white tracking-tight pt-2 pb-1 border-b border-zinc-800/80 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>{block.text}</span>
              </h2>
            );

          case 'subheading':
            return (
              <h3 key={idx} className="text-base font-semibold text-indigo-200 pt-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{block.text}</span>
              </h3>
            );

          case 'keyconcepts':
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-zinc-900/60 to-purple-950/30 border border-indigo-500/20 shadow-lg shadow-indigo-500/5 my-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Key Concepts</span>
                </div>
                {block.items && block.items.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {block.items.map((concept, cIdx) => (
                      <span
                        key={cIdx}
                        className="px-3 py-1 rounded-xl text-xs font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        {concept}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-300">{block.text}</p>
                )}
              </div>
            );

          case 'list':
            return (
              <ul key={idx} className="space-y-2 my-3 pl-1">
                {block.items?.map((item, iIdx) => (
                  <li key={iIdx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );

          case 'code':
            return (
              <div key={idx} className="my-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-indigo-200">
                <div className="flex items-center gap-2 pb-2 mb-2 border-b border-zinc-800/80 text-[10px] text-zinc-500 uppercase">
                  <Code className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Code Snippet / Technical Concept</span>
                </div>
                <pre className="whitespace-pre-wrap font-mono leading-relaxed">{block.text}</pre>
              </div>
            );

          case 'paragraph':
          default:
            return (
              <p key={idx} className="text-sm leading-relaxed text-zinc-300">
                {block.text}
              </p>
            );
        }
      })}
    </div>
  );
}
