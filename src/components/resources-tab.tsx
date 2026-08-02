'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  ExternalLink, 
  Video, 
  FileText, 
  Code, 
  Layers, 
  Sparkles, 
  ChevronRight,
  CheckCircle2,
  Circle,
  Lock,
  Loader2,
  AlertTriangle,
  Star,
  Clock,
  Search,
  Check
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NoteNode } from '@/components/notes-tab';
import { ResourcePlanItem } from '@/lib/ai/types';

export interface LearningResourceRow {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: string;
  url: string;
  source?: string;
  description?: string;
  duration?: string;
  difficulty?: string;
  is_recommended?: boolean;
  created_at?: string;
}

interface ResourcesTabProps {
  activeNodeId: string;
  nodeList: NoteNode[];
  onSelectNode: (nodeId: string) => void;
}

export default function ResourcesTab({ 
  activeNodeId, 
  nodeList, 
  onSelectNode 
}: ResourcesTabProps) {
  // Session cache for fetched database resource rows per lesson UUID
  const [resourcesCache, setResourcesCache] = useState<{ [lessonId: string]: LearningResourceRow[] }>({});
  
  // Session cache for AI generated Resource Discovery Plans (awaiting URL resolution)
  const [generatedPlanMap, setGeneratedPlanMap] = useState<{ [lessonId: string]: ResourcePlanItem[] }>({});

  const [fetching, setFetching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-select first unlocked node on initial mount if activeNodeId is empty or invalid
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

  // Fetch learning_resources from Supabase for activeNodeId
  useEffect(() => {
    async function fetchLessonResources() {
      if (!activeNodeId) return;

      const targetNode = nodeList.find(n => n.id === activeNodeId);
      if (!targetNode || targetNode.status === 'locked') return;

      // Check session cache first
      if (resourcesCache[activeNodeId]) {
        setErrorMsg(null);
        return;
      }

      setFetching(true);
      setErrorMsg(null);

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('learning_resources')
          .select('*')
          .eq('lesson_id', activeNodeId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[RESOURCES TAB] Supabase fetch error:', error);
          setErrorMsg('Failed to load resources for this lesson.');
          setResourcesCache(prev => ({ ...prev, [activeNodeId]: [] }));
        } else {
          setResourcesCache(prev => ({
            ...prev,
            [activeNodeId]: (data as LearningResourceRow[]) || [],
          }));
        }
      } catch (err) {
        console.error('[RESOURCES TAB] Unexpected fetch error:', err);
        setErrorMsg('Network error while querying lesson resources.');
      } finally {
        setFetching(false);
      }
    }

    fetchLessonResources();
  }, [activeNodeId, nodeList, resourcesCache]);

  // Handle explicit AI Resource Discovery Plan generation
  const handleGenerateResourcePlan = async () => {
    if (!activeNodeId || generating) return;

    setGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/generate-resource-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: activeNodeId }),
      });

      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.resources)) {
        setGeneratedPlanMap(prev => ({
          ...prev,
          [activeNodeId]: data.resources,
        }));
      } else {
        if (res.status === 429 || data.code === 'AI_RATE_LIMIT') {
          setErrorMsg('AI is temporarily busy. Please wait a moment and try again.');
        } else {
          setErrorMsg(data.error || 'Failed to generate resource discovery plan. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error generating resource plan:', err);
      setErrorMsg('Network or server error while building resource pack.');
    } finally {
      setGenerating(false);
    }
  };

  const selectedNodeObj = nodeList.find(n => n.id === activeNodeId);
  const currentPersistedResources = activeNodeId ? (resourcesCache[activeNodeId] || []) : [];
  const currentSuggestedPlan = activeNodeId ? (generatedPlanMap[activeNodeId] || []) : [];

  // Categorize persisted resources
  const readingPersisted = currentPersistedResources.filter(r => 
    ['article', 'documentation', 'textbook', 'reference'].includes((r.resource_type || '').toLowerCase())
  );
  const videoPersisted = currentPersistedResources.filter(r => 
    (r.resource_type || '').toLowerCase() === 'video'
  );
  const practicePersisted = currentPersistedResources.filter(r => 
    (r.resource_type || '').toLowerCase() === 'practice'
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full items-start">
      
      {/* Topics / Lessons Left Sidebar Navigator (3 Cols) */}
      <div className="md:col-span-3 space-y-4">
        <div className="p-4 rounded-xl glass-panel border border-zinc-900">
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block mb-3">
            Lesson Resources
          </span>
          <div className="space-y-1">
            {nodeList.map((node) => {
              const isUnlocked = node.status === 'completed' || node.status === 'in_progress';
              const isSelected = activeNodeId === node.id;
              const persistedCount = (resourcesCache[node.id] || []).length;
              const planCount = (generatedPlanMap[node.id] || []).length;
              
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

                  <div className="flex items-center gap-1.5">
                    {persistedCount > 0 ? (
                      <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {persistedCount}
                      </span>
                    ) : planCount > 0 ? (
                      <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                        {planCount}
                      </span>
                    ) : null}
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                      isSelected ? 'transform rotate-90 text-cyan-400' : 'text-zinc-600'
                    }`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Resources Content Display Panel (9 Cols) */}
      <div className="md:col-span-9 p-6 md:p-8 rounded-2xl glass-panel border border-zinc-800/80 min-h-[500px] flex flex-col justify-between shadow-lg">
        {fetching ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-7 h-7 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs font-mono text-zinc-400">Loading resources for lesson...</p>
          </div>
        ) : currentPersistedResources.length > 0 || currentSuggestedPlan.length > 0 ? (
          <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
              <div>
                <span className="text-[10px] font-mono tracking-wider font-semibold uppercase text-cyan-400 block mb-1">
                  {currentPersistedResources.length > 0 ? 'PERSISTED LEARNING PACK' : 'RESOURCE DISCOVERY PLAN'}
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {selectedNodeObj?.title || 'Lesson Resources'}
                </h2>
              </div>
              <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                {currentPersistedResources.length || currentSuggestedPlan.length} { (currentPersistedResources.length || currentSuggestedPlan.length) === 1 ? 'RESOURCE' : 'RESOURCES'}
              </span>
            </div>

            {/* A. PERSISTED RESOURCES FROM SUPABASE (VERIFIED URLS) */}
            {currentPersistedResources.length > 0 && (
              <div className="space-y-6">
                {/* Reading */}
                {readingPersisted.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <BookOpen className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-wider font-mono">READING & DOCUMENTATION</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {readingPersisted.map((res) => (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group p-4 rounded-xl border bg-zinc-900/30 border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-900/60 flex justify-between items-start transition-all duration-200"
                        >
                          <div className="space-y-1.5 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                {res.resource_type || 'READING'}
                              </span>
                              {res.is_recommended && (
                                <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-amber-300" />
                                  RECOMMENDED
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-cyan-300 transition-colors">
                              {res.title}
                            </h4>
                            {res.description && (
                              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                                {res.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-[10px] text-zinc-500 pt-1">
                              {res.source && <span>Source: <strong className="text-zinc-300">{res.source}</strong></span>}
                              {res.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {res.duration}</span>}
                              {res.difficulty && <span className="uppercase text-indigo-300">{res.difficulty}</span>}
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors flex-shrink-0 mt-1" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos */}
                {videoPersisted.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Video className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-wider font-mono">VIDEO TUTORIALS & STREAMS</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {videoPersisted.map((res) => (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group p-4 rounded-xl border bg-zinc-900/30 border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-900/60 flex justify-between items-start transition-all duration-200"
                        >
                          <div className="space-y-1.5 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                VIDEO
                              </span>
                              {res.is_recommended && (
                                <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-amber-300" />
                                  RECOMMENDED
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                              {res.title}
                            </h4>
                            {res.description && (
                              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                                {res.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-[10px] text-zinc-500 pt-1">
                              {res.source && <span>Channel: <strong className="text-zinc-300">{res.source}</strong></span>}
                              {res.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {res.duration}</span>}
                              {res.difficulty && <span className="uppercase text-indigo-300">{res.difficulty}</span>}
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Practice */}
                {practicePersisted.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Code className="w-4 h-4" />
                      <h3 className="text-xs font-bold uppercase tracking-wider font-mono">HANDS-ON EXERCISES & PRACTICE</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {practicePersisted.map((res) => (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group p-4 rounded-xl border bg-zinc-900/30 border-zinc-800/80 hover:border-emerald-500/50 hover:bg-zinc-900/60 flex justify-between items-start transition-all duration-200"
                        >
                          <div className="space-y-1.5 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                PRACTICE
                              </span>
                              {res.is_recommended && (
                                <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-amber-300" />
                                  RECOMMENDED
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                              {res.title}
                            </h4>
                            {res.description && (
                              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                                {res.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-[10px] text-zinc-500 pt-1">
                              {res.source && <span>Platform: <strong className="text-zinc-300">{res.source}</strong></span>}
                              {res.difficulty && <span className="uppercase text-emerald-300">{res.difficulty}</span>}
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-1" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* B. AI-GENERATED RESOURCE DISCOVERY PLAN (AWAITING URL DISCOVERY) */}
            {currentSuggestedPlan.length > 0 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-300">
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
                      SUGGESTED DISCOVERY PLAN (AWAITING URL DISCOVERY)
                    </h3>
                  </div>
                  <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    AI SYNTHESIZED
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {currentSuggestedPlan.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border bg-zinc-900/40 border-zinc-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {item.resource_type}
                          </span>
                          {item.is_recommended && (
                            <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-amber-300" />
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">
                          Suggested Source: <strong className="text-zinc-300">{item.source}</strong>
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-zinc-100">
                        {item.title}
                      </h4>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-2 border-t border-zinc-900">
                        <div className="flex items-center gap-3">
                          {item.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-zinc-500" /> {item.duration}</span>}
                          {item.difficulty && <span className="uppercase text-indigo-300 font-semibold">{item.difficulty}</span>}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-500 bg-zinc-950 px-2 py-1 rounded border border-zinc-900">
                          <Search className="w-2.5 h-2.5 text-cyan-400" />
                          <span>Query: {item.search_query}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State — Prompt User to Generate Resources */
          <div className="py-16 text-center space-y-6 max-w-lg mx-auto my-auto">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-xl">
              <BookOpen className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                No resources generated yet
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                CYRA can build a curated resource pack for this lesson.
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
              onClick={handleGenerateResourcePlan}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 mx-auto transition-all shadow-lg shadow-indigo-500/20"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Building resource pack...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <span>Generate Resources</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>CYRA RESOURCE DISCOVERY ENGINE</span>
          <span>STAGE 11.4 DISCOVERY PLAN</span>
        </div>
      </div>

    </div>
  );
}
