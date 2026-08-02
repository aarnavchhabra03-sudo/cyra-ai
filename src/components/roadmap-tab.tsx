'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  Circle, 
  Lock, 
  Clock, 
  Compass, 
  ChevronRight, 
  ArrowRight,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Module, RoadmapNode } from '@/data/mockData';

interface RoadmapTabProps {
  modules: Module[];
  learningPathId?: string;
  onSelectNode: (nodeId: string, nodeTitle: string) => void;
  onSwitchTab: (tabName: 'roadmap' | 'notes' | 'resources' | 'quiz' | 'tutor') => void;
  onOpenLesson?: (lessonId: string) => void;
}

export default function RoadmapTab({
  modules,
  learningPathId,
  onSelectNode,
  onSwitchTab,
  onOpenLesson
}: RoadmapTabProps) {
  const router = useRouter();
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number>(0);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number>(0);

  const handleNodeClick = (node: RoadmapNode, moduleId: string, modIdx: number, nodeIdx: number) => {
    setSelectedNode(node);
    setSelectedModuleId(moduleId);
    setSelectedModuleIdx(modIdx);
    setSelectedNodeIdx(nodeIdx);
    onSelectNode(node.id, node.title);
  };

  const handleStartLearning = () => {
    if (!selectedNode) return;

    if (onOpenLesson) {
      onOpenLesson(selectedNode.id);
    } else if (learningPathId) {
      router.push(`/learn/${learningPathId}/lesson/${selectedNode.id}`);
    } else {
      onSelectNode(selectedNode.id, selectedNode.title);
      onSwitchTab('notes');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-full">
      {/* Visual Roadmap Flow Tree (8 Cols) */}
      <div className="lg:col-span-8 space-y-8 pr-2">
        {modules.map((mod, modIdx) => (
          <div key={mod.id} className="space-y-4">
            {/* Module Header */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold border ${
                mod.status === 'completed' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : mod.status === 'in_progress'
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-600'
              }`}>
                {modIdx + 1}
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-200">{mod.title}</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">{mod.description}</p>
              </div>
            </div>

            {/* Nodes Container with Connecting Line */}
            <div className="relative pl-4 space-y-4">
              {/* Vertical connecting line */}
              <div className="absolute left-4 top-2 bottom-6 w-0.5 bg-gradient-to-b from-indigo-500/30 to-zinc-800" />

              {mod.nodes.map((node, nodeIdx) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div 
                    key={node.id} 
                    onClick={() => handleNodeClick(node, mod.id, modIdx, nodeIdx)}
                    className={`ml-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer relative group ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                        : 'bg-zinc-900/30 border-zinc-800/80 hover:bg-zinc-800/20 hover:border-indigo-500/40'
                    }`}
                  >
                    {/* Active Node Indicator Left Dot */}
                    <div className="absolute -left-[20px] top-[22px] w-2.5 h-2.5 rounded-full border border-background z-10 flex items-center justify-center">
                      <div className={`w-full h-full rounded-full ${
                        node.status === 'completed' 
                          ? 'bg-emerald-500' 
                          : node.status === 'in_progress'
                          ? 'bg-indigo-500 animate-ping'
                          : 'bg-zinc-700'
                      }`} />
                    </div>

                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-zinc-500">
                            {modIdx + 1}.{nodeIdx + 1}
                          </span>
                          <h5 className={`text-xs font-bold ${
                            node.status === 'locked' ? 'text-zinc-500' : 'text-zinc-200 group-hover:text-white'
                          }`}>
                            {node.title}
                          </h5>
                          
                          {/* Mini status pill */}
                          {node.status === 'in_progress' && (
                            <span className="text-[8px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-1 rounded-md border border-indigo-500/30">
                              IN PROGRESS
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 line-clamp-1 group-hover:line-clamp-none transition-all duration-200">
                          {node.description}
                        </p>
                      </div>

                      {/* Right Icons & Action */}
                      <div className="flex-shrink-0 flex items-center gap-2.5 text-zinc-500">
                        <div className="flex items-center gap-1 text-[9px] font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{node.estimatedMinutes}m</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeClick(node, mod.id, modIdx, nodeIdx);
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm shadow-indigo-500/30'
                              : 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border-indigo-500/30'
                          }`}
                        >
                          <span>{isSelected ? 'Selected' : 'Open'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Lesson Inspection Side-Panel (4 Cols) */}
      <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-4">
        {selectedNode ? (
          <div className="p-5 rounded-2xl glass-panel border border-zinc-800/80 space-y-5 shadow-xl animate-fade-in">
            {/* Header info */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  LESSON {selectedModuleIdx + 1}.{selectedNodeIdx + 1}
                </span>

                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    selectedNode.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : selectedNode.status === 'in_progress'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                  }`}>
                    {selectedNode.status.toUpperCase()}
                  </span>
                  
                  <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                    <Clock className="w-3 h-3" />
                    <span>{selectedNode.estimatedMinutes} Mins</span>
                  </div>
                </div>
              </div>

              <h4 className="text-sm font-bold text-white leading-snug">{selectedNode.title}</h4>
            </div>

            {/* Overview / Description */}
            {selectedNode.description && (
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                  Overview
                </span>
                <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-950/50 p-3 rounded-xl border border-zinc-900">
                  {selectedNode.description}
                </p>
              </div>
            )}

            {/* Lesson Content Preview */}
            {selectedNode.topics && selectedNode.topics.length > 0 && (
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">
                  Lesson Content Preview
                </span>
                <div className="space-y-1.5">
                  {selectedNode.topics.map((topic, index) => (
                    <div key={index} className="flex items-center gap-2 text-[10px] text-zinc-300 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-900">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                      <span className="font-medium truncate">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Start Lesson CTA button */}
            <button
              onClick={handleStartLearning}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-indigo-500/20"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Start Lesson</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="p-6 rounded-2xl glass-panel border border-zinc-900/80 text-center space-y-3 py-12">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-300">Select a Roadmap Node</h4>
              <p className="text-[10px] text-zinc-500 mt-1">Select any learning topic from the roadmap tree to inspect lesson overview, duration, and start learning.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
