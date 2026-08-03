import { adminClient } from '@/lib/supabase/admin';
import { GradedQuestionResult } from './grading';

export type MasteryLevel = 'weak' | 'developing' | 'proficient' | 'mastered';

export interface ConceptMasterySummaryItem {
  concept: string;
  score: number;
  level: MasteryLevel;
}

export interface LearningInsights {
  strongestConcepts: ConceptMasterySummaryItem[];
  weakConcepts: ConceptMasterySummaryItem[];
  recommendations: string[];
}

/**
 * Classifies a 0-100 mastery score into a deterministic level.
 */
export function getMasteryLevel(score: number): MasteryLevel {
  if (score < 40) return 'weak';
  if (score < 70) return 'developing';
  if (score < 85) return 'proficient';
  return 'mastered';
}

/**
 * Generates a deterministic learning recommendation for a concept.
 */
export function getConceptRecommendation(concept: string, level: MasteryLevel): string {
  switch (level) {
    case 'weak':
      return `Review foundational principles of ${concept} before continuing.`;
    case 'developing':
      return `Practice a few more questions on ${concept} to strengthen your understanding.`;
    case 'proficient':
      return `Good progress! A brief revision of ${concept} will bring you to complete mastery.`;
    case 'mastered':
      return `You have demonstrated strong mastery of ${concept}!`;
  }
}

/**
 * Server-side engine to calculate and update user concept mastery.
 * Uses an exponential moving average giving recent attempts 35% weight and historical performance 65% weight.
 * Clamps all scores between 0 and 100 deterministically.
 */
export async function updateUserConceptMastery(
  userId: string,
  gradedResults: GradedQuestionResult[],
  isDuplicateSubmission: boolean = false
): Promise<LearningInsights> {
  // 1. Group quiz results by question concept
  const conceptGroups = new Map<string, {
    attempted: number;
    correct: number;
    pointsPossible: number;
    pointsEarned: number;
  }>();

  for (const r of gradedResults) {
    const rawConcept = r.concept?.trim();
    if (!rawConcept) continue;

    const existing = conceptGroups.get(rawConcept) || {
      attempted: 0,
      correct: 0,
      pointsPossible: 0,
      pointsEarned: 0,
    };

    existing.attempted += 1;
    if (r.isCorrect) existing.correct += 1;
    existing.pointsPossible += r.maxPoints || 1;
    existing.pointsEarned += r.pointsEarned || 0;

    conceptGroups.set(rawConcept, existing);
  }

  const updatedConceptItems: ConceptMasterySummaryItem[] = [];

  // 2. Process each concept
  for (const [concept, stats] of conceptGroups.entries()) {
    const currentQuizPerf = stats.pointsPossible > 0
      ? (stats.pointsEarned / stats.pointsPossible) * 100
      : 0;

    // Fetch existing historical record for (user_id, concept)
    const { data: existingRecord } = await adminClient
      .from('user_concept_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('concept', concept)
      .maybeSingle();

    let newScore: number;
    let newAttemptCount: number;
    let newAttemptedTotal: number;
    let newCorrectTotal: number;
    let newPointsPossible: number;
    let newPointsEarned: number;

    if (existingRecord) {
      if (isDuplicateSubmission) {
        // Do not double-increment statistics on duplicate submissions
        newScore = existingRecord.mastery_score;
        newAttemptCount = existingRecord.attempt_count;
        newAttemptedTotal = existingRecord.questions_attempted;
        newCorrectTotal = existingRecord.questions_correct;
        newPointsPossible = existingRecord.total_points_possible;
        newPointsEarned = existingRecord.total_points_earned;
      } else {
        // Weighted Exponential Moving Average: 65% historical, 35% recent quiz
        const calculated = Math.round((existingRecord.mastery_score * 0.65) + (currentQuizPerf * 0.35));
        newScore = Math.max(0, Math.min(100, calculated));
        newAttemptCount = existingRecord.attempt_count + 1;
        newAttemptedTotal = existingRecord.questions_attempted + stats.attempted;
        newCorrectTotal = existingRecord.questions_correct + stats.correct;
        newPointsPossible = existingRecord.total_points_possible + stats.pointsPossible;
        newPointsEarned = existingRecord.total_points_earned + stats.pointsEarned;
      }
    } else {
      // First attempt for this concept
      newScore = Math.max(0, Math.min(100, Math.round(currentQuizPerf)));
      newAttemptCount = 1;
      newAttemptedTotal = stats.attempted;
      newCorrectTotal = stats.correct;
      newPointsPossible = stats.pointsPossible;
      newPointsEarned = stats.pointsEarned;
    }

    const level = getMasteryLevel(newScore);

    // Upsert into user_concept_mastery via adminClient
    const { error: upsertErr } = await adminClient
      .from('user_concept_mastery')
      .upsert({
        user_id: userId,
        concept: concept,
        mastery_score: newScore,
        questions_attempted: newAttemptedTotal,
        questions_correct: newCorrectTotal,
        total_points_possible: newPointsPossible,
        total_points_earned: newPointsEarned,
        attempt_count: newAttemptCount,
        last_result: level,
        last_practiced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, concept' });

    if (upsertErr) {
      console.error(`[MASTERY ENGINE] Error updating concept "${concept}" for user ${userId}:`, upsertErr);
    }

    updatedConceptItems.push({
      concept,
      score: newScore,
      level,
    });
  }

  // 3. Sort & categorize concepts for adaptive insights
  const strongest = updatedConceptItems
    .filter((c) => c.level === 'mastered' || c.level === 'proficient')
    .sort((a, b) => b.score - a.score);

  const weak = updatedConceptItems
    .filter((c) => c.level === 'weak' || c.level === 'developing')
    .sort((a, b) => a.score - b.score);

  const recommendations: string[] = [];
  for (const item of weak) {
    recommendations.push(getConceptRecommendation(item.concept, item.level));
  }
  for (const item of strongest) {
    if (recommendations.length < 3) {
      recommendations.push(getConceptRecommendation(item.concept, item.level));
    }
  }

  return {
    strongestConcepts: strongest,
    weakConcepts: weak,
    recommendations,
  };
}
