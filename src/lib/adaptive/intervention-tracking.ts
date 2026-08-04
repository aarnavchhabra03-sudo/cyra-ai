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
 * Starts tracking a new learning intervention.
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
}: {
  userId: string;
  learningPathId?: string | null;
  lessonId?: string | null;
  concept: string;
  interventionType: InterventionType;
  strategy?: string | null;
  triggerReason?: string | null;
  masteryBefore: number;
}): Promise<string | null> {
  if (!userId || !concept || !interventionType) return null;

  try {
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
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      console.warn('[INTERVENTION TRACKING] Error inserting intervention:', error);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('[INTERVENTION TRACKING] Exception starting intervention:', err);
    return null;
  }
}

/**
 * Completes a tracked learning intervention with verified post-intervention evidence.
 */
export async function completeLearningIntervention({
  interventionId,
  userId,
  concept,
  masteryAfter,
  score,
}: {
  interventionId?: string | null;
  userId: string;
  concept: string;
  masteryAfter: number;
  score?: number | null;
}): Promise<boolean> {
  if (!userId || !concept) return false;

  try {
    let targetId = interventionId;

    if (!targetId) {
      // Find recent open intervention matching concept
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: openInterventions } = await adminClient
        .from('learning_interventions')
        .select('id, mastery_before')
        .eq('user_id', userId)
        .is('completed_at', null)
        .gte('started_at', cutoff)
        .order('started_at', { ascending: false });

      const matching = (openInterventions || []).find(
        (i: any) => normalizeGraphConcept(i.concept || '') === normalizeGraphConcept(concept)
      );

      if (matching) {
        targetId = matching.id;
      }
    }

    if (!targetId) return false;

    // Load intervention record for masteryBefore
    const { data: record, error: getErr } = await adminClient
      .from('learning_interventions')
      .select('mastery_before')
      .eq('id', targetId)
      .single();

    if (getErr || !record) return false;

    const masteryBefore = record.mastery_before || 0;
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
      .eq('id', targetId);

    if (updateErr) {
      console.warn('[INTERVENTION TRACKING] Error completing intervention:', updateErr);
      return false;
    }

    console.log(`[INTERVENTION TRACKING] Completed intervention ${targetId}: gain = +${outcome.masteryDelta}%, score = ${outcome.effectivenessScore}`);
    return true;
  } catch (err) {
    console.error('[INTERVENTION TRACKING] Exception completing intervention:', err);
    return false;
  }
}

/**
 * Conservative Causal Attribution:
 * Correlates fresh assessment evidence (quiz / practice submission) with recent open interventions.
 * Attributes mastery change ONLY if concept strictly matches within a 60-minute window.
 */
export async function correlateAssessmentEvidence({
  userId,
  concept,
  lessonId,
  newMasteryScore,
  score,
}: {
  userId: string;
  concept: string;
  lessonId?: string | null;
  newMasteryScore: number;
  score?: number | null;
}): Promise<void> {
  if (!userId || !concept) return;

  try {
    await completeLearningIntervention({
      userId,
      concept,
      masteryAfter: newMasteryScore,
      score,
    });
  } catch (err) {
    console.warn('[INTERVENTION TRACKING] Error correlating evidence:', err);
  }
}

/**
 * Computes aggregated strategy effectiveness metrics for a user.
 */
export async function getInterventionEffectiveness(
  userId: string,
  concept?: string | null
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
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (concept) {
      const normC = normalizeGraphConcept(concept);
      // We will filter in-memory for concept normalization match
    }

    const { data: rows, error } = await query;

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

      const curr = strategyGroup.get(strat) || { count: 0, gainSum: 0, scoreSum: 0 };
      curr.count += 1;
      curr.gainSum += delta;
      curr.scoreSum += score;
      strategyGroup.set(strat, curr);
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
    console.error('[INTERVENTION TRACKING] Error fetching effectiveness:', err);
    return defaultReport;
  }
}

/**
 * Detects intervention stagnation when repeated interventions fail to yield meaningful gain (<5 points or <40 effectiveness score).
 */
export async function detectInterventionStagnation(
  userId: string,
  concept: string
): Promise<{ stagnant: boolean; recentAttempts: number; averageGain: number }> {
  if (!userId || !concept) return { stagnant: false, recentAttempts: 0, averageGain: 0 };

  try {
    const normC = normalizeGraphConcept(concept);

    const { data: rows } = await adminClient
      .from('learning_interventions')
      .select('*')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
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

    // Stagnant if >= 2 attempts resulting in average gain < 5 or avg effectiveness < 40
    const stagnant = avgGain < 5 || avgScore < 40;

    return {
      stagnant,
      recentAttempts: matching.length,
      averageGain: Math.round(avgGain),
    };
  } catch (err) {
    console.warn('[INTERVENTION TRACKING] Error checking stagnation:', err);
    return { stagnant: false, recentAttempts: 0, averageGain: 0 };
  }
}
