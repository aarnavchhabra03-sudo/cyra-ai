import { MasteryLevel, getMasteryLevel } from '@/lib/quiz/mastery';
import { ConceptRelationship, calculateConceptReadiness, normalizeGraphConcept } from '@/lib/adaptive/knowledge-graph';

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
  readinessScore?: number;
  blocked?: boolean;
  blockingPrerequisites?: Array<{ concept: string; masteryScore: number }>;
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
 * Deterministic Adaptive Recommendation Engine with Knowledge Graph Integration.
 * Analyzes student concept mastery records and knowledge graph relationships to calculate prioritized learning recommendations.
 */
export function generateAdaptiveRecommendations(
  records: ConceptMasteryRecordInput[],
  limit: number = 5,
  relationships: ConceptRelationship[] = []
): AdaptiveRecommendationsResult {
  let weakCount = 0;
  let developingCount = 0;
  let proficientCount = 0;
  let masteredCount = 0;

  // Build mastery map for readiness calculations
  const masteryMap = new Map<string, number>();
  for (const r of records) {
    masteryMap.set(normalizeGraphConcept(r.concept), r.mastery_score);
  }

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

    // Calculate concept readiness & blocked status using knowledge graph
    const readiness = calculateConceptReadiness({
      targetConcept: record.concept,
      masteryMap,
      relationships,
    });

    let priority: RecommendationPriority;
    let recommendationType: RecommendationType;
    let title: string;
    let reason: string;
    let suggestedAction: string;

    if (readiness.blocked && readiness.blockingPrerequisites.length > 0) {
      const topPrereq = readiness.blockingPrerequisites[0];
      priority = 'critical';
      recommendationType = 'review';
      title = `PREREQUISITE FIRST: ${topPrereq.concept}`;
      reason = `Before continuing ${record.concept}, strengthen ${topPrereq.concept}. Your current ${topPrereq.concept} mastery is ${topPrereq.masteryScore}%, and it is an important prerequisite.`;
      suggestedAction = `Strengthen prerequisite concept ${topPrereq.concept} before proceeding with ${record.concept}.`;
    } else if (level === 'weak') {
      priority = record.mastery_score < 20 ? 'critical' : 'high';
      recommendationType = 'review';
      title = `Priority Review: ${record.concept}`;
      reason = `Your recent assessment score for ${record.concept} is ${record.mastery_score}%, indicating this concept needs immediate reinforcement.`;
      suggestedAction = `Review ${record.concept} core study notes before attempting further lessons.`;
    } else if (level === 'developing') {
      priority = 'medium';
      recommendationType = 'reinforce';
      title = `Reinforce Concept: ${record.concept}`;
      reason = `You have developing understanding of ${record.concept} (${record.mastery_score}%). A targeted practice session will build solid proficiency.`;
      suggestedAction = `Practice additional quiz questions focusing on ${record.concept}.`;
    } else {
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
      readinessScore: readiness.readinessScore,
      blocked: readiness.blocked,
      blockingPrerequisites: readiness.blockingPrerequisites.map((bp) => ({
        concept: bp.concept,
        masteryScore: bp.masteryScore,
      })),
    });
  }

  // Deterministic Sorting:
  // 1. Blocked concepts or Root Prerequisite Gaps receive highest priority boost
  // 2. Lowest mastery score second
  // 3. Higher questions_attempted / attempt_count third
  candidates.sort((a, b) => {
    if (a.blocked !== b.blocked) {
      return a.blocked ? -1 : 1; // Blocked concepts boosted first
    }
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
