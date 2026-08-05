import { adminClient } from '@/lib/supabase/admin';
import {
  getUserConceptRelationships,
  calculateConceptReadiness,
  detectRootKnowledgeGaps,
  normalizeGraphConcept,
  buildLearnerKnowledgeGraph,
  getLearningPathConcepts,
} from './knowledge-graph';
import { ConceptMasteryRecordInput } from './recommendations';

export interface AdaptiveNextTarget {
  rank: number;
  concept: string;
  masteryScore: number;
  readinessScore: number;
  learningPriorityScore: number;
  reason: string;
  action: 'practice' | 'review' | 'study';
  blocked: boolean;
  blockingPrerequisites: Array<{ concept: string; masteryScore: number }>;
  lessonId?: string | null;
}

export interface AdaptiveLearningPlanResult {
  nextTargets: AdaptiveNextTarget[];
  rootGaps: any[];
  blockedConcepts: any[];
  generatedAt: string;
}

/**
 * Real-time Adaptive Replanning Engine.
 * Dynamically computes prioritized next learning targets without mutating canonical course order.
 */
export async function generateAdaptiveLearningPlan({
  userId,
  learningPathId,
}: {
  userId: string;
  learningPathId?: string | null;
}): Promise<AdaptiveLearningPlanResult> {
  const generatedAt = new Date().toISOString();

  try {
    // 1. Fetch user concept mastery records
    let query = adminClient
      .from('user_concept_mastery')
      .select('*')
      .eq('user_id', userId);

    if (learningPathId) {
      query = query.eq('learning_path_id', learningPathId);
    } else {
      query = query.is('learning_path_id', null);
    }

    const { data: masteryRows } = await query;

    const masteryMap = new Map<string, number>();
    const recordsMap = new Map<string, ConceptMasteryRecordInput>();

    if (masteryRows) {
      for (const row of masteryRows) {
        const norm = normalizeGraphConcept(row.concept);
        masteryMap.set(norm, row.mastery_score);
        recordsMap.set(norm, {
          concept: row.concept,
          mastery_score: row.mastery_score,
          questions_attempted: row.questions_attempted || 0,
          questions_correct: row.questions_correct || 0,
          attempt_count: row.attempt_count || 0,
          last_practiced_at: row.last_practiced_at || '',
          lesson_id: row.lesson_id || null,
        });
      }
    }

    // 2. Load concept relationships & knowledge graph data
    const relationships = await getUserConceptRelationships(userId, learningPathId);
    const rootGaps = detectRootKnowledgeGaps({ masteryMap, relationships });
    const rootGapScoreMap = new Map<string, { score: number; count: number }>();

    for (const rg of rootGaps) {
      rootGapScoreMap.set(normalizeGraphConcept(rg.concept), {
        score: rg.rootGapScore,
        count: rg.blockingCount,
      });
    }

    // 3. Map downstream dependent count for each concept
    const downstreamCountMap = new Map<string, number>();
    for (const rel of relationships) {
      if (rel.relationshipType === 'prerequisite' || rel.relationshipType === 'builds_on') {
        const srcNorm = normalizeGraphConcept(rel.sourceConcept);
        downstreamCountMap.set(srcNorm, (downstreamCountMap.get(srcNorm) || 0) + 1);
      }
    }

    // 4. Gather candidate concepts from user mastery + relationships
    const candidateConceptsSet = new Set<string>();
    for (const [normC] of masteryMap.entries()) {
      candidateConceptsSet.add(normC);
    }
    for (const rel of relationships) {
      candidateConceptsSet.add(normalizeGraphConcept(rel.sourceConcept));
      candidateConceptsSet.add(normalizeGraphConcept(rel.targetConcept));
    }

    const candidateTargets: Array<Omit<AdaptiveNextTarget, 'rank'>> = [];

    for (const normConcept of candidateConceptsSet) {
      const record = recordsMap.get(normConcept);
      const masteryScore = record ? record.mastery_score : 0;
      const questionsAttempted = record ? record.questions_attempted : 0;
      const hasAssessedEvidence = questionsAttempted > 0;

      // Filter out fully mastered concepts (score >= 85)
      if (masteryScore >= 85) {
        continue;
      }

      // Calculate readiness & blocked status using knowledge graph
      const displayConcept =
        record?.concept ||
        relationships.find((r) => normalizeGraphConcept(r.sourceConcept) === normConcept)?.sourceConcept ||
        relationships.find((r) => normalizeGraphConcept(r.targetConcept) === normConcept)?.targetConcept ||
        normConcept;

      const readiness = calculateConceptReadiness({
        targetConcept: displayConcept,
        masteryMap,
        relationships,
      });

      // DETERMINISTIC LEARNING PRIORITY SCORE FORMULA:
      // - Weakness severity (30%): (100 - mastery) * (hasAssessedEvidence ? 1.0 : 0.20)
      // - Root-gap impact (25%): rootGapScore
      // - Readiness (15%): readinessScore
      // - Downstream impact (15%): min(100, downstreamCount * 25)
      // - Evidence confidence (10%): min(100, questionsAttempted * 20)
      // - Recency (5%): days since last practice
      const weaknessSeverity = (100 - masteryScore) * (hasAssessedEvidence ? 1.0 : 0.20);
      const rootGapData = rootGapScoreMap.get(normConcept);
      const rootGapImpact = rootGapData ? rootGapData.score : 0;
      const readinessVal = readiness.readinessScore >= 50 ? readiness.readinessScore : 0;
      const downstreamCount = downstreamCountMap.get(normConcept) || 0;
      const downstreamImpact = Math.min(100, downstreamCount * 25);
      const evidenceConfidence = Math.min(100, questionsAttempted * 20);

      const learningPriorityScore = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            0.30 * weaknessSeverity +
              0.25 * rootGapImpact +
              0.15 * readinessVal +
              0.15 * downstreamImpact +
              0.10 * evidenceConfidence
          )
        )
      );

      // Generate transparent learner-friendly reason & recommended action
      let reason = '';
      let action: 'practice' | 'review' | 'study' = 'practice';

      if (readiness.blocked && readiness.blockingPrerequisites.length > 0) {
        const topPrereq = readiness.blockingPrerequisites[0];
        reason = `Strengthen prerequisite ${topPrereq.concept} (${topPrereq.masteryScore}% mastery) before continuing.`;
        action = 'review';
      } else if (rootGapImpact > 50) {
        reason = `Strengthening this core prerequisite may unlock ${downstreamCount} downstream concept${downstreamCount !== 1 ? 's' : ''}.`;
        action = 'practice';
      } else if (hasAssessedEvidence && masteryScore < 40) {
        reason = `Priority review needed to reinforce demonstrated weakness (${masteryScore}% mastery).`;
        action = 'review';
      } else if (hasAssessedEvidence && masteryScore < 70) {
        reason = `Targeted practice recommended to build developing proficiency (${masteryScore}%).`;
        action = 'practice';
      } else {
        reason = `Study this topic to establish a strong mastery baseline.`;
        action = 'study';
      }

      candidateTargets.push({
        concept: displayConcept,
        masteryScore,
        readinessScore: readiness.readinessScore,
        learningPriorityScore,
        reason,
        action,
        blocked: readiness.blocked,
        blockingPrerequisites: readiness.blockingPrerequisites.map((bp) => ({
          concept: bp.concept,
          masteryScore: bp.masteryScore,
        })),
        lessonId: record?.lesson_id || null,
      });
    }

    // Sort candidate targets by learningPriorityScore descending
    candidateTargets.sort((a, b) => b.learningPriorityScore - a.learningPriorityScore);

    // Take top 3-5 targets and assign rank 1..N
    const nextTargets: AdaptiveNextTarget[] = candidateTargets.slice(0, 5).map((target, idx) => ({
      ...target,
      rank: idx + 1,
    }));

    const graphData = await buildLearnerKnowledgeGraph(userId, learningPathId);

    return {
      nextTargets,
      rootGaps: graphData.rootGaps,
      blockedConcepts: graphData.blockedConcepts,
      generatedAt,
    };
  } catch (err) {
    console.error('[LEARNING PLAN] Error generating adaptive learning plan:', err);
    return {
      nextTargets: [],
      rootGaps: [],
      blockedConcepts: [],
      generatedAt,
    };
  }
}
