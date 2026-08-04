'use client';

import React, { useState, useEffect } from 'react';
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
  BookOpen,
  Zap
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
  const [learningPlanTargets, setLearningPlanTargets] = useState<any[]>([]);

  useEffect(() => {
    async function loadLearningPlan() {
      try {
        const query = learningPathId ? `?learningPathId=${encodeURIComponent(learningPathId)}` : '';
        const res = await fetch(`/api/adaptive/learning-plan${query}`);
        const result = await res.json();
        if (res.ok && result.success && result.data?.nextTargets) {
          setLearningPlanTargets(result.data.nextTargets);
        }
      } catch (err) {
        console.warn('[ROADMAP TAB] Error loading learning plan:', err);
      }
    }

    loadLearningPlan();
  }, [learningPathId]);

  const handleNodeClick = (node: RoadmapNode, moduleId: string, modIdx: number, nodeIdx: number) => {
    setSelectedNode(node);
    setSelectedModuleId(moduleId);
    setSelectedModuleIdx(modIdx);
    setSelectedNodeIdx(nodeIdx);
    onSelectNode(node.id, node.title);
  };

  const handleStartLearning = () => {
    if (!selectedNode) return;

    const dbLessonId = (selectedNode as any).dbLessonId;
    if (onOpenLesson && dbLessonId) {
      onOpenLesson(dbLessonId);
    } else {
      onSwitchTab('notes');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {/* LEFT / CENTER: Interactive Roadmap Modules */}
      <div className="lg:col-span-2 space-y-6">
        {/* CYRA RECOMMENDS NEXT HEADER CARD */}
        {learningPlanTargets.length > 0 && (
          <div className="p-4 rounded-xl glass-panel border border-cyan-900/40 bg-cyan-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                CYRA Recommends Next
              </span>
              <span className="text-[9px] font-mono text-zinc-400">
                Adaptive Intelligence Overlay
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {learningPlanTargets.slice(0, 3).map((target, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase">
                      Rank {target.rank}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400">
                      {target.masteryScore}% mastery
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-white truncate">{target.concept}</h5>
                  <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2">{target.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider font-semibold">
              Curriculum Roadmap ({modules.length} Modules)
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Select a node to inspect</span>
          </div>

          {modules.map((module, modIdx) => (
            <div 
              key={module.id} 
              className="p-5 rounded-2xl glass-panel border border-zinc-850 space-y-4 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                    Module {modIdx + 1}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-0.5">{module.title}</h4>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {module.nodes.filter(n => n.status === 'completed').length} / {module.nodes.length} Completed
                </span>
              </div>

              {/* Lesson Nodes Sequence */}
              <div className="space-y-2 pt-1">
                {module.nodes.map((node, nodeIdx) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isCompleted = node.status === 'completed';
                  const isCurrent = node.status === 'in_progress';

                  let statusIcon = <Circle className="w-4 h-4 text-zinc-600" />;
                  let badgeColor = 'border-zinc-800 text-zinc-400 bg-zinc-900/50';

                  if (isCompleted) {
                    statusIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
                    badgeColor = 'border-emerald-500/30 text-emerald-300 bg-emerald-950/30';
                  } else if (isCurrent) {
                    statusIcon = <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />;
                    badgeColor = 'border-cyan-500/30 text-cyan-300 bg-cyan-950/30';
                  }

                  return (
                    <button
                      key={node.id}
                      onClick={() => handleNodeClick(node, module.id, modIdx, nodeIdx)}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'border-indigo-500/80 bg-indigo-950/40 shadow-md ring-1 ring-indigo-500/30' 
                          : 'border-zinc-900 bg-zinc-950/50 hover:bg-zinc-900/70 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {statusIcon}
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-white block truncate">{node.title}</span>
                          <span className="text-[10px] font-mono text-zinc-500 block truncate">{node.description}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(node as any).duration && (
                          <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1 hidden sm:inline-flex">
                            <Clock className="w-3 h-3" />
                            {(node as any).duration}
                          </span>
                        )}
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-zinc-600'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Node Detail Inspection Panel */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 p-6 rounded-2xl glass-panel border border-zinc-850 space-y-5 shadow-xl">
          {selectedNode ? (
            <>
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                  Module {selectedModuleIdx + 1} • Lesson {selectedNodeIdx + 1}
                </span>
                <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                  selectedNode.status === 'completed' 
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/30' 
                    : 'border-cyan-500/30 text-cyan-400 bg-cyan-950/30'
                }`}>
                  {selectedNode.status}
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-white tracking-tight">{selectedNode.title}</h4>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{selectedNode.description}</p>
              </div>

              {(selectedNode as any).duration && (
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-950/50 p-2.5 rounded-xl border border-zinc-900">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Estimated Duration: {(selectedNode as any).duration}</span>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-900 space-y-2">
                <button
                  onClick={handleStartLearning}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Open Lesson & Study Notes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onSwitchTab('quiz')}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Take Quiz on This Topic</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center space-y-3">
              <Compass className="w-8 h-8 text-zinc-600 mx-auto animate-spin-slow" />
              <p className="text-xs font-semibold text-zinc-300">Select a Lesson Node</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                Click any lesson node in the roadmap sequence to inspect its description, study notes, and quiz actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
