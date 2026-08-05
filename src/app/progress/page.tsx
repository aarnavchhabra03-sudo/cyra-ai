'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  Flame, 
  Award, 
  Target,
  Sparkles,
  BookOpen,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Zap,
  BookMarked,
  Loader2,
  GitBranch
} from 'lucide-react';
import { mockUserStats } from '@/data/mockData';
import { createClient } from '@/lib/supabase/client';

export interface ConceptMasteryRow {
  id: string;
  concept: string;
  mastery_score: number;
  questions_attempted: number;
  questions_correct: number;
  last_result: 'weak' | 'developing' | 'proficient' | 'mastered';
  last_practiced_at: string;
}

export interface AdaptiveRecommendationUI {
  concept: string;
  masteryScore: number;
  masteryLevel: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendationType: string;
  title: string;
  reason: string;
  suggestedAction: string;
  lessonId?: string | null;
  readinessScore?: number;
  blocked?: boolean;
  blockingPrerequisites?: Array<{ concept: string; masteryScore: number }>;
}

export interface AdaptiveSummaryUI {
  totalConcepts: number;
  weakConcepts: number;
  developingConcepts: number;
  proficientConcepts: number;
  masteredConcepts: number;
}

export interface RootGapUI {
  concept: string;
  masteryScore: number;
  rootGapScore: number;
  affectedDownstreamConcepts: Array<{ concept: string; masteryScore: number }>;
  blockingCount: number;
}

function normalizeGraphConcept(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export default function ProgressPage() {
  const router = useRouter();
  const [masteryRecords, setMasteryRecords] = useState<ConceptMasteryRow[]>([]);
  const [loadingMastery, setLoadingMastery] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<AdaptiveRecommendationUI[]>([]);
  const [summary, setSummary] = useState<AdaptiveSummaryUI | null>(null);
  const [loadingRecs, setLoadingRecs] = useState<boolean>(true);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [generatingConcept, setGeneratingConcept] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [rootGaps, setRootGaps] = useState<RootGapUI[]>([]);
  const [effectivenessData, setEffectivenessData] = useState<any | null>(null);
  const [paths, setPaths] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      // 1. Fetch active learning paths first
      let activePaths: any[] = [];
      try {
        const { data: lpData } = await supabase
          .from('learning_paths')
          .select(`
            id,
            title,
            modules (
              id,
              lessons (
                id,
                title,
                study_notes (
                  key_concepts
                )
              )
            )
          `);
        if (lpData) {
          activePaths = lpData;
          setPaths(lpData);
        }
      } catch (lpErr) {
        console.warn('[PROGRESS] Error fetching learning paths for mapping:', lpErr);
      }
      
      // 2. Fetch concept mastery records
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('user_concept_mastery')
            .select('*')
            .order('mastery_score', { ascending: false });
          if (!error && data) {
            setMasteryRecords(data as ConceptMasteryRow[]);
          }
        }
      } catch (err) {
        console.error('[PROGRESS] Error fetching concept mastery:', err);
      } finally {
        setLoadingMastery(false);
      }

      // 3. Fetch adaptive recommendations for each course
      try {
        const allRecs: AdaptiveRecommendationUI[] = [];
        let combinedSummary = {
          totalConcepts: 0,
          weakConcepts: 0,
          developingConcepts: 0,
          proficientConcepts: 0,
          masteredConcepts: 0,
        };

        for (const lp of activePaths) {
          const res = await fetch(`/api/adaptive/recommendations?learningPathId=${encodeURIComponent(lp.id)}`);
          const result = await res.json();
          if (res.ok && result.success && result.data) {
            if (Array.isArray(result.data.recommendations)) {
              allRecs.push(...result.data.recommendations);
            }
            if (result.data.summary) {
              combinedSummary.totalConcepts += result.data.summary.totalConcepts || 0;
              combinedSummary.weakConcepts += result.data.summary.weakConcepts || 0;
              combinedSummary.developingConcepts += result.data.summary.developingConcepts || 0;
              combinedSummary.proficientConcepts += result.data.summary.proficientConcepts || 0;
              combinedSummary.masteredConcepts += result.data.summary.masteredConcepts || 0;
            }
          }
        }

        setRecommendations(allRecs);
        setSummary(combinedSummary);
      } catch (err: any) {
        console.error('[PROGRESS] Error fetching adaptive recommendations:', err);
        setRecsError('Could not connect to recommendation engine.');
      } finally {
        setLoadingRecs(false);
      }

      // 4. Fetch intervention effectiveness from GET /api/adaptive/intervention-effectiveness
      try {
        const effRes = await fetch('/api/adaptive/intervention-effectiveness');
        const effResult = await effRes.json();
        if (effRes.ok && effResult.success && effResult.data) {
          setEffectivenessData(effResult.data);
        }
      } catch (effErr) {
        console.warn('[PROGRESS] Error fetching intervention effectiveness:', effErr);
      }
    }

    fetchData();
  }, []);

  const conceptToCourseMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const lp of paths) {
      if (lp.modules) {
        for (const mod of lp.modules) {
          if (mod.lessons) {
            for (const les of mod.lessons) {
              if (les.title) {
                map.set(normalizeGraphConcept(les.title), lp.title);
              }
              const notesList = les.study_notes;
              const notes = Array.isArray(notesList) ? notesList[0] : notesList;
              if (notes && Array.isArray(notes.key_concepts)) {
                for (const kc of notes.key_concepts) {
                  if (kc && typeof kc === 'string') {
                    map.set(normalizeGraphConcept(kc), lp.title);
                  }
                }
              }
            }
          }
        }
      }
    }
    return map;
  }, [paths]);

  const groupedMastery = React.useMemo(() => {
    const groups = new Map<string, ConceptMasteryRow[]>();
    for (const record of masteryRecords) {
      const norm = normalizeGraphConcept(record.concept);
      const course = conceptToCourseMap.get(norm) || 'Other Course Concepts';
      const list = groups.get(course) || [];
      list.push(record);
      groups.set(course, list);
    }
    return groups;
  }, [masteryRecords, conceptToCourseMap]);

  const groupedRecs = React.useMemo(() => {
    const groups = new Map<string, AdaptiveRecommendationUI[]>();
    for (const rec of recommendations) {
      const norm = normalizeGraphConcept(rec.concept);
      const course = conceptToCourseMap.get(norm) || 'Other Course Concepts';
      const list = groups.get(course) || [];
      list.push(rec);
      groups.set(course, list);
    }
    return groups;
  }, [recommendations, conceptToCourseMap]);

  const handleStartPractice = async (concept: string, lessonId: string) => {
    if (generatingConcept) return;

    setGeneratingConcept(concept);
    setGenError(null);

    try {
      const res = await fetch('/api/adaptive/practice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept, lessonId }),
      });

      const result = await res.json();

      if (!res.ok || !result.success || !result.data?.sessionId) {
        throw new Error(result.error || 'Failed to generate practice session.');
      }

      router.push(`/practice/${result.data.sessionId}`);
    } catch (err: any) {
      console.error('[PROGRESS] Practice generation error:', err);
      setGenError(err.message || 'Could not generate targeted practice.');
      setGeneratingConcept(null);
    }
  };

  const statsList = [
    { label: 'Current level', value: mockUserStats.level, sub: mockUserStats.levelTitle, color: 'text-indigo-400', icon: Award },
    { label: 'Study streak', value: `${mockUserStats.streakDays} Days`, sub: 'Active Streak', color: 'text-amber-500', icon: Flame },
    { label: 'XP accumulated', value: `${mockUserStats.xp} XP`, sub: `Next tier: ${mockUserStats.xpNextLevel} XP`, color: 'text-cyan-400', icon: TrendingUp }
  ];

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center gap-2.5 text-zinc-400 mb-1">
          <Target className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">Analytics Dashboard</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Your Progress Profile</h2>
        <p className="text-xs text-zinc-400 mt-1">Review your current standing, adaptive recommendations, and learning analytics.</p>
      </div>

      {/* Grid of basic stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {statsList.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="p-6 rounded-2xl glass-panel border border-zinc-900 flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white font-mono">{stat.value}</span>
                <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CYRA LEARNING IMPACT CARD (STAGE 12.9) */}
      {effectivenessData && effectivenessData.totalCompletedInterventions > 0 && (
        <div className="p-6 rounded-2xl glass-panel border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-cyan-950/10 to-zinc-950/40 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              CYRA Learning Impact
            </span>
            <span className="text-[9px] font-mono text-zinc-400">
              {effectivenessData.totalCompletedInterventions} Interventions Measured
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Most Effective Strategy */}
            {effectivenessData.mostEffectiveStrategy && (
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">
                  Most Effective Approach
                </span>
                <h4 className="text-sm font-bold text-white uppercase tracking-tight">
                  {effectivenessData.mostEffectiveStrategy.strategy.replace('_', ' ')}
                </h4>
                <p className="text-xs text-emerald-400 font-semibold">
                  Average mastery gain: +{effectivenessData.mostEffectiveStrategy.averageMasteryGain}%
                </p>
              </div>
            )}

            {/* Recent Intervention Result */}
            {effectivenessData.recentOutcomes && effectivenessData.recentOutcomes.length > 0 && (
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">
                  Recent Impact
                </span>
                <h4 className="text-xs font-bold text-white truncate">
                  {effectivenessData.recentOutcomes[0].concept}
                </h4>
                <p className="text-xs text-cyan-400 font-semibold">
                  {effectivenessData.recentOutcomes[0].masteryBefore}% &rarr; {effectivenessData.recentOutcomes[0].masteryAfter}% (+{effectivenessData.recentOutcomes[0].masteryDelta}%)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAGE 12.8A: ROOT KNOWLEDGE GAPS SECTION */}
      {rootGaps.length > 0 && (
        <div className="p-6 rounded-2xl glass-panel border border-amber-900/40 bg-amber-950/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-amber-900/30 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">Root Knowledge Gaps Detected</h3>
                <p className="text-[11px] text-zinc-400">Prerequisite concepts holding back downstream learning progress.</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-500/30">
              {rootGaps.length} Root Gaps
            </span>
          </div>

          <div className="space-y-3">
            {rootGaps.map((rg, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-zinc-950/80 border border-amber-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">{rg.concept}</span>
                  <span className="text-xs font-mono font-bold text-white">Mastery: {rg.masteryScore}%</span>
                </div>
                {rg.affectedDownstreamConcepts.length > 0 && (
                  <div className="text-[11px] text-zinc-400">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold block mb-1">
                      Strengthening this concept may improve ({rg.blockingCount} dependent concepts):
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px] text-zinc-300">
                      {rg.affectedDownstreamConcepts.slice(0, 3).map((dep, dIdx) => (
                        <li key={dIdx}>
                          {dep.concept} ({dep.masteryScore}% mastery)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 12.5A & 12.5B & 12.8A: ADAPTIVE LEARNING RECOMMENDATIONS SECTION */}
      <div className="p-6 rounded-2xl glass-panel border border-zinc-800/80 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Adaptive Learning Recommendations</h3>
              <p className="text-[11px] text-zinc-400">Targeted priorities generated by CYRA&apos;s concept mastery and knowledge graph engine.</p>
            </div>
          </div>
          {summary && (
            <span className="text-[10px] font-mono text-zinc-400 uppercase bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-850">
              {summary.weakConcepts + summary.developingConcepts} Action Items
            </span>
          )}
        </div>

        {genError && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{genError}</span>
          </div>
        )}

        {loadingRecs ? (
          <div className="py-6 text-center text-xs text-zinc-500 font-mono animate-pulse">
            Calculating adaptive recommendations...
          </div>
        ) : recsError ? (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{recsError}</span>
          </div>
        ) : summary && summary.totalConcepts === 0 ? (
          /* EMPTY STATE 1: No quizzes completed yet */
          <div className="p-6 rounded-xl bg-zinc-950/40 border border-zinc-900 text-center space-y-2">
            <BookMarked className="w-6 h-6 text-indigo-400 mx-auto" />
            <p className="text-xs text-zinc-300 font-semibold">No Quiz Data Available</p>
            <p className="text-[11px] text-zinc-400">Complete your first quiz to unlock adaptive recommendations.</p>
          </div>
        ) : recommendations.length === 0 && summary && summary.masteredConcepts === summary.totalConcepts ? (
          /* EMPTY STATE 2: All concepts mastered */
          <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-center space-y-2">
            <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-xs font-semibold text-emerald-200">Complete Concept Mastery</p>
            <p className="text-[11px] text-zinc-400">You&apos;re currently strong across all tracked concepts!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(groupedRecs.entries()).map(([courseTitle, recs]) => {
              if (recs.length === 0) return null;
              return (
                <div key={courseTitle} className="space-y-3">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold pl-1">
                    Course: {courseTitle}
                  </h4>
                  <div className="space-y-3">
                    {recs.map((rec, idx) => {
                      const isBlocked = rec.blocked === true;
                      const isCritical = rec.priority === 'critical' || rec.priority === 'high';
                      const isMedium = rec.priority === 'medium';
                      const isGeneratingThis = generatingConcept === rec.concept;

                      const priorityPillClass = isBlocked
                        ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 font-extrabold'
                        : isCritical
                        ? 'bg-red-950/60 border-red-500/40 text-red-300'
                        : isMedium
                        ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                        : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300';

                      return (
                        <div 
                          key={idx} 
                          className={`p-5 rounded-xl border space-y-3 transition-all ${
                            isBlocked
                              ? 'bg-amber-950/20 border-amber-800/40'
                              : isCritical 
                              ? 'bg-red-950/10 border-red-900/30' 
                              : isMedium 
                              ? 'bg-amber-950/10 border-amber-900/30' 
                              : 'bg-zinc-950/60 border-zinc-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded border ${priorityPillClass}`}>
                              {isBlocked ? 'PREREQUISITE FIRST' : `${rec.priority.toUpperCase()} PRIORITY (${rec.recommendationType.toUpperCase()})`}
                            </span>

                            <span className="text-[11px] font-mono text-zinc-400">
                              <strong className="text-white">{rec.masteryScore}%</strong> mastery · <span className="uppercase">{rec.masteryLevel}</span>
                              {rec.readinessScore !== undefined && (
                                <span> · Readiness: <strong className="text-cyan-400">{rec.readinessScore}%</strong></span>
                              )}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-white tracking-wide">{rec.concept}</h4>
                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{rec.reason}</p>
                          </div>

                          <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-2 flex-wrap text-xs">
                            <span className="text-[11px] text-zinc-400 italic flex-1">
                              Action: {rec.suggestedAction}
                            </span>

                            {rec.lessonId && (
                              <button
                                onClick={() => handleStartPractice(rec.concept, rec.lessonId!)}
                                disabled={!!generatingConcept}
                                className="py-1.5 px-4 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-60 flex-shrink-0"
                              >
                                {isGeneratingThis ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                    Generating Practice...
                                  </>
                                ) : (
                                  <>
                                    {isBlocked ? 'Fix Prerequisite First' : 'Practice This Concept'}
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STAGE 12.4: PERSISTED CONCEPT MASTERY TRACKER */}
      <div className="p-6 rounded-2xl glass-panel border border-zinc-800/80 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Concept Mastery Tracker</h3>
              <p className="text-[11px] text-zinc-400">Persistent analytics derived from your quiz attempts.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            {masteryRecords.length} Concepts Tracked
          </span>
        </div>

        {loadingMastery ? (
          <div className="py-6 text-center text-xs text-zinc-500 font-mono animate-pulse">
            Loading concept mastery analytics...
          </div>
        ) : masteryRecords.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-950/40 border border-zinc-900 text-center space-y-2">
            <BookOpen className="w-6 h-6 text-indigo-400 mx-auto" />
            <p className="text-xs text-zinc-400">No concept mastery records tracked yet.</p>
            <p className="text-[11px] text-zinc-500">Complete an AI quiz to populate your personalized concept intelligence profile.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(groupedMastery.entries()).map(([courseTitle, records]) => {
              if (records.length === 0) return null;
              return (
                <div key={courseTitle} className="space-y-3">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold pl-1">
                    Course: {courseTitle}
                  </h4>
                  <div className="space-y-3">
                    {records.map((m) => {
                      const isMastered = m.last_result === 'mastered';
                      const isProficient = m.last_result === 'proficient';
                      const isDeveloping = m.last_result === 'developing';
                      
                      const levelColor = isMastered
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : isProficient
                        ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                        : isDeveloping
                        ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                        : 'bg-red-950/60 border-red-500/40 text-red-300';

                      return (
                        <div key={m.id} className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-white block">{m.concept}</span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {m.questions_correct} / {m.questions_attempted} Questions Correct
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Mastery Bar */}
                            <div className="w-24 bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850 hidden sm:block">
                              <div 
                                className={`h-full ${
                                  isMastered ? 'bg-emerald-400' : isProficient ? 'bg-cyan-400' : isDeveloping ? 'bg-amber-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${m.mastery_score}%` }}
                              />
                            </div>

                            <span className="text-xs font-mono font-bold text-white">{m.mastery_score}%</span>

                            <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md border ${levelColor}`}>
                              {m.last_result}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gamification Achievements */}
      <div className="p-6 rounded-2xl glass-panel border border-zinc-800/80 space-y-4 bg-gradient-to-br from-indigo-950/5 to-cyan-950/5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Unlock Gamified Achievements</h4>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Maintain active study streaks to earn badge multipliers. Mastering concepts unlocks customized AI quiz formats and advanced practice modes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
