import { MasteryLevel, getMasteryLevel } from '@/lib/quiz/mastery';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationType = 'review' | 'reinforce' | 'practice';

export interface ConceptMasteryRecordInput {
  id?: string;
  user_id?: string;
  concept: string;
  mastery_score: number;
  questions_attempted: number;
  questions_correct: number;
  total_points_possible?: number;
  total_points_earned?: number;
  attempt_count: number;
  last_result?: MasteryLevel;
  last_practiced_at: string;
  lesson_id?: string | null;
}

export interface AdaptiveRecommendation {
  concept: string;
  masteryScore: number;
  masteryLevel: MasteryLevel;
  priority: RecommendationPriority;
  recommendationType: RecommendationType;
  title: string;
  reason: string;
  suggestedAction: string;
  questionsAttempted: number;
  questionsCorrect: number;
  attemptCount: number;
  lastPracticedAt: string;
  lessonId?: string | null;
}

export interface AdaptiveSummary {
  totalConcepts: number;
  weakConcepts: number;
  developingConcepts: number;
  proficientConcepts: number;
  masteredConcepts: number;
}

export interface AdaptiveRecommendationsResult {
  recommendations: AdaptiveRecommendation[];
  summary: AdaptiveSummary;
}

/**
 * Deterministic Adaptive Recommendation Engine.
 * Analyzes student concept mastery records and calculates prioritized learning recommendations.
 */
export function generateAdaptiveRecommendations(
  records: ConceptMasteryRecordInput[],
  limit: number = 5
): AdaptiveRecommendationsResult {
  let weakCount = 0;
  let developingCount = 0;
  let proficientCount = 0;
  let masteredCount = 0;

  const candidates: AdaptiveRecommendation[] = [];

  for (const record of records) {
    const level = getMasteryLevel(record.mastery_score);

    switch (level) {
      case 'weak':
        weakCount++;
        break;
      case 'developing':
        developingCount++;
        break;
      case 'proficient':
        proficientCount++;
        break;
      case 'mastered':
        masteredCount++;
        break;
    }

    // Do NOT include mastered concepts (score >= 85) in primary remediation recommendations
    if (level === 'mastered') {
      continue;
    }

    let priority: RecommendationPriority;
    let recommendationType: RecommendationType;
    let title: string;
    let reason: string;
    let suggestedAction: string;

    if (level === 'weak') {
      // 0–39%: Critical priority review
      priority = record.mastery_score < 20 ? 'critical' : 'high';
      recommendationType = 'review';
      title = `Priority Review: ${record.concept}`;
      reason = `Your recent assessment score for ${record.concept} is ${record.mastery_score}%, indicating this concept needs immediate reinforcement.`;
      suggestedAction = `Review ${record.concept} core study notes before attempting further lessons.`;
    } else if (level === 'developing') {
      // 40–69%: Medium priority reinforcement
      priority = 'medium';
      recommendationType = 'reinforce';
      title = `Reinforce Concept: ${record.concept}`;
      reason = `You have developing understanding of ${record.concept} (${record.mastery_score}%). A targeted practice session will build solid proficiency.`;
      suggestedAction = `Practice additional quiz questions focusing on ${record.concept}.`;
    } else {
      // 70–84%: Low priority practice
      priority = 'low';
      recommendationType = 'practice';
      title = `Mastery Practice: ${record.concept}`;
      reason = `You are near complete mastery of ${record.concept} (${record.mastery_score}%). One final review will push you to 100%.`;
      suggestedAction = `Perform a quick review of ${record.concept} to achieve complete mastery.`;
    }

    candidates.push({
      concept: record.concept,
      masteryScore: record.mastery_score,
      masteryLevel: level,
      priority,
      recommendationType,
      title,
      reason,
      suggestedAction,
      questionsAttempted: record.questions_attempted,
      questionsCorrect: record.questions_correct,
      attemptCount: record.attempt_count,
      lastPracticedAt: record.last_practiced_at,
      lessonId: record.lesson_id || null,
    });
  }

  // Deterministic Sorting:
  // 1. Lowest mastery score first
  // 2. Higher questions_attempted / attempt_count second (more evidence)
  // 3. Older last_practiced_at third
  candidates.sort((a, b) => {
    if (a.masteryScore !== b.masteryScore) {
      return a.masteryScore - b.masteryScore;
    }
    if (a.questionsAttempted !== b.questionsAttempted) {
      return b.questionsAttempted - a.questionsAttempted;
    }
    const timeA = new Date(a.lastPracticedAt).getTime() || 0;
    const timeB = new Date(b.lastPracticedAt).getTime() || 0;
    return timeA - timeB;
  });

  const finalRecommendations = candidates.slice(0, limit);

  return {
    recommendations: finalRecommendations,
    summary: {
      totalConcepts: records.length,
      weakConcepts: weakCount,
      developingConcepts: developingCount,
      proficientConcepts: proficientCount,
      masteredConcepts: masteredCount,
    },
  };
}
