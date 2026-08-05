import { adminClient } from '@/lib/supabase/admin';
import { normalizeGraphConcept } from './knowledge-graph';

export type InterventionType =
  | 'tutor_explanation'
  | 'tutor_analogy'
  | 'tutor_step_by_step'
  | 'tutor_socratic'
  | 'targeted_practice'
  | 'prerequisite_repair'
  | 'study_notes_review'
  | 'quiz'
  | 'challenge_practice';

export type EffectivenessCategory =
  | 'ineffective'
  | 'weak'
  | 'moderate'
  | 'effective'
  | 'highly_effective';

export interface LearningInterventionRecord {
  id: string;
  userId: string;
  learningPathId?: string | null;
  lessonId?: string | null;
  concept: string;
  interventionType: InterventionType;
  strategy?: string | null;
  triggerReason?: string | null;
  masteryBefore: number;
  masteryAfter?: number | null;
  masteryDelta?: number | null;
  score?: number | null;
  effectivenessScore?: number | null;
  successful?: boolean | null;
  sourcePracticeSessionId?: string | null;
  sourceQuizAttemptId?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export interface StrategyEffectivenessSummary {
  strategy: string;
  sampleSize: number;
  averageMasteryGain: number;
  effectivenessScore: number;
  category: EffectivenessCategory;
}

export interface InterventionEffectivenessReport {
  totalCompletedInterventions: number;
  averageMasteryGain: number;
  mostEffectiveStrategy: StrategyEffectivenessSummary | null;
  strategyBreakdown: StrategyEffectivenessSummary[];
  recentOutcomes: Array<{
    id: string;
    concept: string;
    interventionType: InterventionType;
    masteryBefore: number;
    masteryAfter: number;
    masteryDelta: number;
    effectivenessScore: number;
    completedAt: string;
  }>;
}

/**
 * Deterministically evaluates intervention outcome and effectiveness score (0-100).
 */
export function evaluateInterventionOutcome({
  masteryBefore,
  masteryAfter,
  score,
}: {
  masteryBefore: number;
  masteryAfter: number;
  score?: number | null;
}): {
  masteryDelta: number;
  effectivenessScore: number;
  successful: boolean;
  category: EffectivenessCategory;
} {
  const masteryDelta = Math.max(-100, Math.min(100, masteryAfter - masteryBefore));
  let baseScore = 50 + masteryDelta * 1.5;

  if (typeof score === 'number' && !isNaN(score)) {
    baseScore += (score - 50) * 0.4;
  }

  const effectivenessScore = Math.min(100, Math.max(0, Math.round(baseScore)));
  const successful = masteryDelta >= 10 || (typeof score === 'number' && score >= 70);

  let category: EffectivenessCategory = 'moderate';
  if (effectivenessScore < 30) category = 'ineffective';
  else if (effectivenessScore < 50) category = 'weak';
  else if (effectivenessScore < 70) category = 'moderate';
  else if (effectivenessScore < 85) category = 'effective';
  else category = 'highly_effective';

  return {
    masteryDelta,
    effectivenessScore,
    successful,
    category,
  };
}

/**
 * Starts tracking a new learning intervention with optional deterministic source IDs.
 */
export async function startLearningIntervention({
  userId,
  learningPathId,
  lessonId,
  concept,
  interventionType,
  strategy,
  triggerReason,
  masteryBefore,
  sourcePracticeSessionId,
  sourceQuizAttemptId,
}: {
  userId: string;
  learningPathId?: string | null;
  lessonId?: string | null;
  concept: string;
  interventionType: InterventionType;
  strategy?: string | null;
  triggerReason?: string | null;
  masteryBefore: number;
  sourcePracticeSessionId?: string | null;
  sourceQuizAttemptId?: string | null;
}): Promise<string | null> {
  if (!userId || !concept || !interventionType) return null;

  try {
    // DUPLICATE CHECK: If intervention already exists for this practice session, reuse it
    if (sourcePracticeSessionId) {
      const { data: existing } = await adminClient
        .from('learning_interventions')
        .select('id')
        .eq('user_id', userId)
        .eq('source_practice_session_id', sourcePracticeSessionId)
        .maybeSingle();

      if (existing) {
        console.log(`[INTERVENTION] PRACTICE SESSION LINKED (EXISTS): id=${existing.id}, session=${sourcePracticeSessionId}`);
        return existing.id;
      }
    }

    const { data, error } = await adminClient
      .from('learning_interventions')
      .insert({
        user_id: userId,
        learning_path_id: learningPathId || null,
        lesson_id: lessonId || null,
        concept: concept.trim(),
        intervention_type: interventionType,
        strategy: strategy || null,
        trigger_reason: triggerReason || null,
        mastery_before: Math.max(0, Math.min(100, masteryBefore)),
        source_practice_session_id: sourcePracticeSessionId || null,
        source_quiz_attempt_id: sourceQuizAttemptId || null,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      console.warn('[INTERVENTION] Error inserting intervention:', error);
      return null;
    }

    console.log(`[INTERVENTION] STARTED: id=${data.id}, concept="${concept}", practiceSessionId=${sourcePracticeSessionId || 'none'}`);
    return data.id;
  } catch (err) {
    console.error('[INTERVENTION] Exception starting intervention:', err);
    return null;
  }
}

/**
 * Completes a tracked learning intervention with verified post-intervention evidence.
 * Supports deterministic source lookup as primary matching logic.
 */
export async function completeLearningIntervention({
  interventionId,
  sourcePracticeSessionId,
  sourceQuizAttemptId,
  userId,
  concept,
  learningPathId,
  masteryAfter,
  score,
}: {
  interventionId?: string | null;
  sourcePracticeSessionId?: string | null;
  sourceQuizAttemptId?: string | null;
  userId: string;
  concept: string;
  learningPathId?: string | null;
  masteryAfter: number;
  score?: number | null;
}): Promise<boolean> {
  if (!userId || !concept) return false;

  console.log(`[INTERVENTION] EVIDENCE RECEIVED: concept="${concept}", practiceSessionId=${sourcePracticeSessionId || 'none'}, masteryAfter=${masteryAfter}, score=${score ?? 'none'}`);

  try {
    let targetRecord: { id: string; mastery_before: number; concept: string } | null = null;

    // 1. Primary Lookup: Deterministic source_practice_session_id match
    if (sourcePracticeSessionId) {
      let query = adminClient
        .from('learning_interventions')
        .select('id, mastery_before, concept')
        .eq('user_id', userId)
        .eq('source_practice_session_id', sourcePracticeSessionId);

      if (learningPathId) {
        query = query.eq('learning_path_id', learningPathId);
      }

      const { data: recBySession } = await query.maybeSingle();

      if (recBySession) {
        targetRecord = recBySession;
        console.log(`[INTERVENTION] MATCHED VIA SESSION ID: interventionId=${recBySession.id}, concept="${recBySession.concept}"`);
      }
    }

    // 2. Secondary Lookup: Deterministic source_quiz_attempt_id match
    if (!targetRecord && sourceQuizAttemptId) {
      let query = adminClient
        .from('learning_interventions')
        .select('id, mastery_before, concept')
        .eq('user_id', userId)
        .eq('source_quiz_attempt_id', sourceQuizAttemptId);

      if (learningPathId) {
        query = query.eq('learning_path_id', learningPathId);
      }

      const { data: recByQuiz } = await query.maybeSingle();

      if (recByQuiz) {
        targetRecord = recByQuiz;
        console.log(`[INTERVENTION] MATCHED VIA QUIZ ATTEMPT ID: interventionId=${recByQuiz.id}`);
      }
    }

    // 3. Tertiary Lookup: Direct interventionId match
    if (!targetRecord && interventionId) {
      let query = adminClient
        .from('learning_interventions')
        .select('id, mastery_before, concept')
        .eq('id', interventionId)
        .eq('user_id', userId);

      if (learningPathId) {
        query = query.eq('learning_path_id', learningPathId);
      }

      const { data: recById } = await query.maybeSingle();

      if (recById) {
        targetRecord = recById;
      }
    }

    // 4. Fallback: Safe temporal concept matching within 60 minutes
    if (!targetRecord) {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      let query = adminClient
        .from('learning_interventions')
        .select('id, mastery_before, concept')
        .eq('user_id', userId)
        .is('completed_at', null)
        .gte('started_at', cutoff);

      if (learningPathId) {
        query = query.eq('learning_path_id', learningPathId);
      }

      const { data: openInterventions } = await query.order('started_at', { ascending: false });

      const normC = normalizeGraphConcept(concept);
      const matching = (openInterventions || []).find(
        (i: any) => normalizeGraphConcept(i.concept || '') === normC
      );

      if (matching) {
        targetRecord = matching;
        console.log(`[INTERVENTION] MATCHED VIA TEMPORAL FALLBACK: interventionId=${matching.id}`);
      }
    }

    if (!targetRecord) {
      console.warn(`[INTERVENTION] ATTRIBUTION FAILED: user=${userId}, concept="${concept}", practiceSessionId=${sourcePracticeSessionId || 'none'}`);
      return false;
    }

    const masteryBefore = targetRecord.mastery_before || 0;
    const outcome = evaluateInterventionOutcome({
      masteryBefore,
      masteryAfter,
      score,
    });

    const nowIso = new Date().toISOString();

    const { error: updateErr } = await adminClient
      .from('learning_interventions')
      .update({
        mastery_after: Math.max(0, Math.min(100, masteryAfter)),
        mastery_delta: outcome.masteryDelta,
        score: typeof score === 'number' ? score : null,
        effectiveness_score: outcome.effectivenessScore,
        successful: outcome.successful,
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', targetRecord.id);

    if (updateErr) {
      console.warn('[INTERVENTION] Error completing intervention:', updateErr);
      return false;
    }

    console.log(`[INTERVENTION] COMPLETED: id=${targetRecord.id}, concept="${targetRecord.concept}", masteryBefore=${masteryBefore}, masteryAfter=${masteryAfter}, delta=+${outcome.masteryDelta}%, score=${score ?? 'none'}, effectivenessScore=${outcome.effectivenessScore}`);
    return true;
  } catch (err) {
    console.error('[INTERVENTION] Exception completing intervention:', err);
    return false;
  }
}

/**
 * Conservative Causal Attribution:
 * Correlates fresh assessment evidence (quiz / practice submission) with recent interventions.
 */
export async function correlateAssessmentEvidence({
  userId,
  concept,
  lessonId,
  learningPathId,
  newMasteryScore,
  score,
  sourcePracticeSessionId,
  sourceQuizAttemptId,
}: {
  userId: string;
  concept: string;
  lessonId?: string | null;
  learningPathId?: string | null;
  newMasteryScore: number;
  score?: number | null;
  sourcePracticeSessionId?: string | null;
  sourceQuizAttemptId?: string | null;
}): Promise<void> {
  if (!userId || !concept) return;

  try {
    await completeLearningIntervention({
      userId,
      concept,
      learningPathId,
      masteryAfter: newMasteryScore,
      score,
      sourcePracticeSessionId,
      sourceQuizAttemptId,
    });
  } catch (err) {
    console.warn('[INTERVENTION] Error correlating evidence:', err);
  }
}

/**
 * Computes aggregated strategy effectiveness metrics for a user.
 */
export async function getInterventionEffectiveness(
  userId: string,
  concept?: string | null,
  learningPathId?: string | null
): Promise<InterventionEffectivenessReport> {
  const defaultReport: InterventionEffectivenessReport = {
    totalCompletedInterventions: 0,
    averageMasteryGain: 0,
    mostEffectiveStrategy: null,
    strategyBreakdown: [],
    recentOutcomes: [],
  };

  if (!userId) return defaultReport;

  try {
    let query = adminClient
      .from('learning_interventions')
      .select('*')
      .eq('user_id', userId)
      .not('completed_at', 'is', null);

    if (learningPathId) {
      query = query.eq('learning_path_id', learningPathId);
    }

    const { data: rows, error } = await query.order('completed_at', { ascending: false });

    if (error || !rows || rows.length === 0) {
      return defaultReport;
    }

    const filteredRows = concept
      ? rows.filter((r) => normalizeGraphConcept(r.concept) === normalizeGraphConcept(concept))
      : rows;

    if (filteredRows.length === 0) return defaultReport;

    let totalGain = 0;
    const strategyGroup = new Map<string, { count: number; gainSum: number; scoreSum: number }>();

    for (const r of filteredRows) {
      const delta = r.mastery_delta || 0;
      const score = r.effectiveness_score || 50;
      const strat = r.strategy || r.intervention_type || 'general';

      totalGain += delta;

      const group = strategyGroup.get(strat) || { count: 0, gainSum: 0, scoreSum: 0 };
      group.count++;
      group.gainSum += delta;
      group.scoreSum += score;
      strategyGroup.set(strat, group);
    }

    const strategyBreakdown: StrategyEffectivenessSummary[] = [];

    for (const [strat, stat] of strategyGroup.entries()) {
      const avgGain = Math.round(stat.gainSum / stat.count);
      const avgScore = Math.round(stat.scoreSum / stat.count);

      let category: EffectivenessCategory = 'moderate';
      if (avgScore < 30) category = 'ineffective';
      else if (avgScore < 50) category = 'weak';
      else if (avgScore < 70) category = 'moderate';
      else if (avgScore < 85) category = 'effective';
      else category = 'highly_effective';

      strategyBreakdown.push({
        strategy: strat,
        sampleSize: stat.count,
        averageMasteryGain: avgGain,
        effectivenessScore: avgScore,
        category,
      });
    }

    strategyBreakdown.sort((a, b) => b.effectivenessScore - a.effectivenessScore);

    const mostEffectiveStrategy =
      strategyBreakdown.find((s) => s.sampleSize >= 2) || strategyBreakdown[0] || null;

    const recentOutcomes = filteredRows.slice(0, 5).map((r) => ({
      id: r.id,
      concept: r.concept,
      interventionType: r.intervention_type as InterventionType,
      masteryBefore: r.mastery_before,
      masteryAfter: r.mastery_after || r.mastery_before,
      masteryDelta: r.mastery_delta || 0,
      effectivenessScore: r.effectiveness_score || 50,
      completedAt: r.completed_at!,
    }));

    return {
      totalCompletedInterventions: filteredRows.length,
      averageMasteryGain: Math.round(totalGain / filteredRows.length),
      mostEffectiveStrategy,
      strategyBreakdown,
      recentOutcomes,
    };
  } catch (err) {
    console.warn('[INTERVENTION EFFECTIVENESS] Error generating report:', err);
    return defaultReport;
  }
}

/**
 * Detects intervention stagnation when repeated interventions fail to yield meaningful gain (<5 points or <40 effectiveness score).
 */
export async function detectInterventionStagnation(
  userId: string,
  concept: string,
  learningPathId?: string | null
): Promise<{ stagnant: boolean; recentAttempts: number; averageGain: number }> {
  if (!userId || !concept) return { stagnant: false, recentAttempts: 0, averageGain: 0 };

  try {
    const normC = normalizeGraphConcept(concept);

    let query = adminClient
      .from('learning_interventions')
      .select('*')
      .eq('user_id', userId)
      .not('completed_at', 'is', null);

    if (learningPathId) {
      query = query.eq('learning_path_id', learningPathId);
    }

    const { data: rows } = await query
      .order('completed_at', { ascending: false })
      .limit(10);

    if (!rows) return { stagnant: false, recentAttempts: 0, averageGain: 0 };

    const matching = rows.filter((r) => normalizeGraphConcept(r.concept) === normC);

    if (matching.length < 2) {
      return { stagnant: false, recentAttempts: matching.length, averageGain: 0 };
    }

    const recentTwo = matching.slice(0, 2);
    const totalGain = recentTwo.reduce((sum, r) => sum + (r.mastery_delta || 0), 0);
    const avgGain = totalGain / recentTwo.length;
    const avgScore = recentTwo.reduce((sum, r) => sum + (r.effectiveness_score || 50), 0) / recentTwo.length;

    const stagnant = avgGain < 5 || avgScore < 40;

    return {
      stagnant,
      recentAttempts: matching.length,
      averageGain: Math.round(avgGain),
    };
  } catch (err) {
    console.warn('[INTERVENTION] Error checking stagnation:', err);
    return { stagnant: false, recentAttempts: 0, averageGain: 0 };
  }
}
