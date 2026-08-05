import { adminClient } from '@/lib/supabase/admin';
import { generateAdaptiveRecommendations, ConceptMasteryRecordInput } from '@/lib/adaptive/recommendations';
import { getRelevantTutorMemories, TutorMemoryItem } from './memory';
import {
  getUserConceptRelationships,
  calculateConceptReadiness,
  detectRootKnowledgeGaps,
  normalizeGraphConcept,
  getLearningPathConcepts,
  getLearningPathLessons,
} from '@/lib/adaptive/knowledge-graph';
import { generateAdaptiveLearningPlan } from '@/lib/adaptive/learning-plan';
import { buildLearnerStateSnapshot, determineNextBestAction } from '@/lib/adaptive/orchestrator';
import { checkAndCleanupActiveAssessment } from '@/lib/adaptive/assessment-lifecycle';
import { getInterventionEffectiveness } from '@/lib/adaptive/intervention-tracking';

export interface ConceptMasteryItem {
  concept: string;
  masteryScore: number;
  lastResult: string;
  questionsAttempted: number;
  questionsCorrect: number;
}

export interface QuizMistakeItem {
  concept: string;
  questionText: string;
  userAnswer: string;
  explanation?: string;
}

export interface PracticeHistoryItem {
  concept: string;
  percentage: number;
  masteryBefore: number;
  masteryAfter: number;
  completedAt: string;
}

export interface PrimaryTargetConcept {
  concept: string;
  masteryScore: number;
  level: 'weak' | 'developing' | 'proficient' | 'mastered' | 'lesson_concept';
}

export interface TutorContext {
  userId: string;
  learningPathTitle?: string;
  moduleTitle?: string;
  lessonId?: string | null;
  lessonTitle?: string;
  lessonContent?: string;
  studyNotesOverview?: string;
  studyNotesExplanation?: string;
  keyConcepts?: string[];
  weakConcepts: ConceptMasteryItem[];
  developingConcepts: ConceptMasteryItem[];
  proficientConcepts: ConceptMasteryItem[];
  masteredConcepts: ConceptMasteryItem[];
  recentMistakes: QuizMistakeItem[];
  recentPractice: PracticeHistoryItem[];
  topRecommendations: string[];
  hasActiveAssessment: boolean;
  tutorMemories: TutorMemoryItem[];
  knowledgeGraphIntelligence?: {
    readinessScore: number;
    blocked: boolean;
    blockingPrerequisites: Array<{ concept: string; masteryScore: number; strength: number }>;
    rootGaps: Array<{ concept: string; rootGapScore: number; blockingCount: number }>;
  };
  adaptiveLearningPlan?: {
    recommendedNextTarget?: {
      concept: string;
      masteryScore: number;
      reason: string;
      action: string;
    };
    rootGap?: {
      concept: string;
      rootGapScore: number;
    };
    blockedConcept?: {
      concept: string;
      blockingPrerequisite: string;
    };
  };
  nextBestAction?: {
    action: string;
    concept: string | null;
    priorityScore: number;
    reasonCode: string;
    reason: string;
  };
  interventionIntelligence?: {
    totalCompletedInterventions: number;
    averageMasteryGain: number;
    historicallyEffectiveStrategies: Array<{
      strategy: string;
      effectivenessScore: number;
      sampleSize: number;
    }>;
    recentFailedInterventions: Array<{
      concept: string;
      intervention: string;
      masteryDelta: number;
    }>;
  };
}

/**
 * Resolves the primary target concept for intelligent quick actions based on fallback hierarchy:
 * 1. Weak Concept (< 40%) - lowest score first
 * 2. Developing Concept (40-69%) - lowest score first
 * 3. Proficient Concept (70-84%) - lowest score first
 * 4. Mastered Concept (85-100%) - lowest score first
 * 5. Key Lesson Concept or Lesson Title (if no mastery data exists yet)
 */
export function resolvePrimaryTargetConcept(context: TutorContext): PrimaryTargetConcept {
  if (context.weakConcepts.length > 0) {
    const sorted = [...context.weakConcepts].sort((a, b) => a.masteryScore - b.masteryScore);
    return { concept: sorted[0].concept, masteryScore: sorted[0].masteryScore, level: 'weak' };
  }
  if (context.developingConcepts.length > 0) {
    const sorted = [...context.developingConcepts].sort((a, b) => a.masteryScore - b.masteryScore);
    return { concept: sorted[0].concept, masteryScore: sorted[0].masteryScore, level: 'developing' };
  }
  if (context.proficientConcepts.length > 0) {
    const sorted = [...context.proficientConcepts].sort((a, b) => a.masteryScore - b.masteryScore);
    return { concept: sorted[0].concept, masteryScore: sorted[0].masteryScore, level: 'proficient' };
  }
  if (context.masteredConcepts.length > 0) {
    const sorted = [...context.masteredConcepts].sort((a, b) => a.masteryScore - b.masteryScore);
    return { concept: sorted[0].concept, masteryScore: sorted[0].masteryScore, level: 'mastered' };
  }

  // Fallback if no concept mastery rows exist yet in user_concept_mastery
  const fallbackConcept = context.keyConcepts?.[0] || context.lessonTitle || context.learningPathTitle || 'General Lesson Topic';
  return { concept: fallbackConcept, masteryScore: 0, level: 'lesson_concept' };
}

/**
 * Bounded, server-only context builder for CYRA's Context-Aware AI Tutor.
 * Assembles student mastery intelligence, recent quiz mistakes, practice history, lesson materials, tutor memories, and knowledge graph intelligence.
 */
export async function buildTutorContext({
  userId,
  learningPathId,
  lessonId,
}: {
  userId: string;
  learningPathId?: string | null;
  lessonId?: string | null;
}): Promise<TutorContext> {
  const context: TutorContext = {
    userId,
    lessonId: lessonId || null,
    weakConcepts: [],
    developingConcepts: [],
    proficientConcepts: [],
    masteredConcepts: [],
    recentMistakes: [],
    recentPractice: [],
    topRecommendations: [],
    hasActiveAssessment: false,
    tutorMemories: [],
  };

  try {
    // Resolve learningPathId from lessonId if not supplied
    let resolvedPathId = learningPathId || null;
    if (lessonId && !resolvedPathId) {
      const { data: lessonRec } = await adminClient
        .from('lessons')
        .select('modules!inner(learning_path_id)')
        .eq('id', lessonId)
        .maybeSingle();
      if (lessonRec) {
        resolvedPathId = (lessonRec as any).modules?.learning_path_id || null;
      }
    }

    if (!resolvedPathId) {
      throw new Error('Tutor context requires a resolved learningPathId');
    }

    // Fetch learning path title
    const { data: pathRec } = await adminClient
      .from('learning_paths')
      .select('title')
      .eq('id', resolvedPathId)
      .maybeSingle();
    if (pathRec) {
      context.learningPathTitle = pathRec.title;
    }

    // If lessonId is not provided, dynamically resolve the first lesson in this learning path
    let resolvedLessonId = lessonId || null;
    if (!resolvedLessonId) {
      const { data: firstLesson } = await adminClient
        .from('lessons')
        .select(`
          id,
          title,
          lesson_order,
          modules!inner(
            learning_path_id
          )
        `)
        .eq('modules.learning_path_id', resolvedPathId)
        .order('lesson_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstLesson) {
        resolvedLessonId = firstLesson.id;
        console.log(`[buildTutorContext] Resolved first lesson for course context: "${firstLesson.title}" (${firstLesson.id})`);
      }
    }

    if (resolvedLessonId) {
      context.lessonId = resolvedLessonId;
    }

    const lpLessons = await getLearningPathLessons(resolvedPathId);

    const masteryMap = new Map<string, number>();

    // 1. FETCH USER CONCEPT MASTERY
    const masteryQuery = adminClient
      .from('user_concept_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('learning_path_id', resolvedPathId);

    const { data: masteryRows } = await masteryQuery.order('mastery_score', { ascending: true });

    if (masteryRows && masteryRows.length > 0) {
      const records: ConceptMasteryRecordInput[] = masteryRows.map((r) => {
        masteryMap.set(normalizeGraphConcept(r.concept), r.mastery_score);
        return {
          concept: r.concept,
          mastery_score: r.mastery_score,
          questions_attempted: r.questions_attempted,
          questions_correct: r.questions_correct,
          attempt_count: r.attempt_count,
          last_result: r.last_result,
          last_practiced_at: r.last_practiced_at,
        };
      });

      // Group concepts by mastery level
      for (const r of masteryRows) {
        const item: ConceptMasteryItem = {
          concept: r.concept,
          masteryScore: r.mastery_score,
          lastResult: r.last_result || 'weak',
          questionsAttempted: r.questions_attempted,
          questionsCorrect: r.questions_correct,
        };

        if (r.mastery_score < 40) {
          context.weakConcepts.push(item);
        } else if (r.mastery_score < 70) {
          context.developingConcepts.push(item);
        } else if (r.mastery_score < 85) {
          context.proficientConcepts.push(item);
        } else {
          context.masteredConcepts.push(item);
        }
      }

      // Top recommendations
      const recsResult = generateAdaptiveRecommendations(records, 3);
      context.topRecommendations = recsResult.recommendations.map(
        (rec) => `${rec.concept} (${rec.masteryScore}%) - ${rec.suggestedAction}`
      );
    }

    // 2. FETCH LESSON CONTEXT IF LESSON ID IS PROVIDED
    if (resolvedLessonId) {
      const { data: lessonRecord } = await adminClient
        .from('lessons')
        .select(`
          id,
          title,
          content,
          module_id,
          modules!inner (
            id,
            title,
            learning_path_id,
            learning_paths!inner (
              id,
              title,
              user_id
            )
          ),
          study_notes (
            overview,
            explanation,
            key_concepts
          )
        `)
        .eq('id', resolvedLessonId)
        .maybeSingle();

      if (lessonRecord) {
        context.lessonTitle = lessonRecord.title;
        context.lessonContent = (lessonRecord.content || '').slice(0, 2000); // Bounded to 2000 chars

        const parentModule = (lessonRecord as any).modules;
        const parentPath = parentModule?.learning_paths;

        if (parentModule) context.moduleTitle = parentModule.title;
        if (parentPath) context.learningPathTitle = parentPath.title;

        const notes = Array.isArray(lessonRecord.study_notes)
          ? lessonRecord.study_notes[0]
          : lessonRecord.study_notes;

        if (notes) {
          context.studyNotesOverview = notes.overview;
          context.studyNotesExplanation = notes.explanation;
          context.keyConcepts = Array.isArray(notes.key_concepts) ? notes.key_concepts : [];
        }
      }
    }

    // 3. FETCH RECENT QUIZ MISTAKES (BOUNDED TO LAST 5 INCORRECT ANSWERS)
    try {
      let recentAttemptsQuery = adminClient
        .from('quiz_attempts')
        .select('id')
        .eq('user_id', userId);

      if (resolvedPathId && lpLessons) {
        if (lpLessons.length > 0) {
          recentAttemptsQuery = recentAttemptsQuery.in('lesson_id', lpLessons);
        } else {
          recentAttemptsQuery = recentAttemptsQuery.eq('lesson_id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const { data: recentAttempts } = await recentAttemptsQuery
        .order('completed_at', { ascending: false })
        .limit(3);

      if (recentAttempts && recentAttempts.length > 0) {
        const attemptIds = recentAttempts.map((a) => a.id);
        const { data: incorrectAnswers } = await adminClient
          .from('quiz_answers')
          .select(`
            selected_answer,
            question_id,
            quiz_questions!inner (
              question_text,
              concept,
              explanation
            )
          `)
          .in('attempt_id', attemptIds)
          .eq('is_correct', false)
          .limit(5);

        if (incorrectAnswers) {
          context.recentMistakes = incorrectAnswers.map((ans: any) => ({
            concept: ans.quiz_questions?.concept || 'General',
            questionText: ans.quiz_questions?.question_text || '',
            userAnswer: typeof ans.selected_answer === 'object' ? JSON.stringify(ans.selected_answer) : String(ans.selected_answer),
            explanation: ans.quiz_questions?.explanation,
          }));
        }
      }
    } catch (mistakeErr) {
      console.warn('[TUTOR CONTEXT] Error fetching recent quiz mistakes:', mistakeErr);
    }

    // 4. FETCH RECENT TARGETED PRACTICE HISTORY (BOUNDED TO 3)
    try {
      let practiceAttemptsQuery = adminClient
        .from('adaptive_practice_attempts')
        .select(`
          percentage,
          mastery_before,
          mastery_after,
          completed_at,
          adaptive_practice_sessions!inner (
            concept,
            lesson_id
          )
        `)
        .eq('user_id', userId);

      if (resolvedPathId && lpLessons) {
        if (lpLessons.length > 0) {
          practiceAttemptsQuery = practiceAttemptsQuery.in('adaptive_practice_sessions.lesson_id', lpLessons);
        } else {
          practiceAttemptsQuery = practiceAttemptsQuery.eq('adaptive_practice_sessions.lesson_id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const { data: practiceAttempts } = await practiceAttemptsQuery
        .order('completed_at', { ascending: false })
        .limit(3);

      if (practiceAttempts) {
        context.recentPractice = practiceAttempts.map((pa: any) => ({
          concept: pa.adaptive_practice_sessions?.concept || 'General Practice',
          percentage: pa.percentage,
          masteryBefore: pa.mastery_before,
          masteryAfter: pa.mastery_after,
          completedAt: pa.completed_at,
        }));
      }
    } catch (practiceErr) {
      console.warn('[TUTOR CONTEXT] Error fetching recent practice history:', practiceErr);
    }

    // 5. CHECK ACTIVE ASSESSMENT STATUS (RELIABLE ACTIVE PRACTICE SESSION DETECTION)
    try {
      context.hasActiveAssessment = await checkAndCleanupActiveAssessment(userId);
    } catch (activeErr) {
      console.warn('[TUTOR CONTEXT] Error checking active assessment status:', activeErr);
    }

    // 6. FETCH RELEVANT PERSISTENT TUTOR MEMORIES
    try {
      const target = resolvePrimaryTargetConcept(context);
      const allConcepts = [
        ...(context.keyConcepts || []),
        ...context.weakConcepts.map((c) => c.concept),
        ...context.developingConcepts.map((c) => c.concept),
      ];
      context.tutorMemories = await getRelevantTutorMemories({
        userId,
        targetConcept: target.concept,
        conceptList: allConcepts,
        lessonId,
        learningPathId: resolvedPathId,
      });
    } catch (memErr) {
      console.warn('[TUTOR CONTEXT] Error fetching tutor memories:', memErr);
    }

    // 7. BUILD KNOWLEDGE GRAPH INTELLIGENCE
    try {
      const target = resolvePrimaryTargetConcept(context);
      const relationships = await getUserConceptRelationships(userId, resolvedPathId);

      const readiness = calculateConceptReadiness({
        targetConcept: target.concept,
        masteryMap,
        relationships,
      });

      const rootGaps = detectRootKnowledgeGaps({
        masteryMap,
        relationships,
      });

      context.knowledgeGraphIntelligence = {
        readinessScore: readiness.readinessScore,
        blocked: readiness.blocked,
        blockingPrerequisites: readiness.blockingPrerequisites,
        rootGaps: rootGaps.map((rg) => ({
          concept: rg.concept,
          rootGapScore: rg.rootGapScore,
          blockingCount: rg.blockingCount,
        })),
      };
    } catch (kgErr) {
      console.warn('[TUTOR CONTEXT] Error calculating knowledge graph intelligence:', kgErr);
    }

    // 8. BUILD ADAPTIVE LEARNING PLAN SUMMARY
    try {
      const plan = await generateAdaptiveLearningPlan({ userId, learningPathId });
      if (plan.nextTargets.length > 0) {
        const topTarget = plan.nextTargets[0];
        const topRootGap = plan.rootGaps[0];
        const topBlocked = plan.blockedConcepts[0];

        context.adaptiveLearningPlan = {
          recommendedNextTarget: {
            concept: topTarget.concept,
            masteryScore: topTarget.masteryScore,
            reason: topTarget.reason,
            action: topTarget.action,
          },
          rootGap: topRootGap ? { concept: topRootGap.concept, rootGapScore: topRootGap.rootGapScore } : undefined,
          blockedConcept: topBlocked && topBlocked.blockingPrerequisites?.[0]
            ? { concept: topBlocked.concept, blockingPrerequisite: topBlocked.blockingPrerequisites[0].concept }
            : undefined,
        };
      }
    } catch (planErr) {
      console.warn('[TUTOR CONTEXT] Error calculating adaptive learning plan context:', planErr);
    }

    // 9. BUILD ORCHESTRATED NEXT BEST ACTION SUMMARY
    try {
      const snapshot = await buildLearnerStateSnapshot({ userId, currentLessonId: lessonId, learningPathId });
      const nba = determineNextBestAction(snapshot);
      context.nextBestAction = {
        action: nba.action,
        concept: nba.concept,
        priorityScore: nba.priorityScore,
        reasonCode: nba.reasonCode,
        reason: nba.reason,
      };
    } catch (nbaErr) {
      console.warn('[TUTOR CONTEXT] Error calculating next best action context:', nbaErr);
    }

    // 10. BUILD CLOSED-LOOP INTERVENTION INTELLIGENCE SUMMARY
    try {
      const effReport = await getInterventionEffectiveness(userId, null, learningPathId);
      context.interventionIntelligence = {
        totalCompletedInterventions: effReport.totalCompletedInterventions,
        averageMasteryGain: effReport.averageMasteryGain,
        historicallyEffectiveStrategies: effReport.strategyBreakdown.map((s) => ({
          strategy: s.strategy,
          effectivenessScore: s.effectivenessScore,
          sampleSize: s.sampleSize,
        })),
        recentFailedInterventions: effReport.recentOutcomes
          .filter((r) => r.masteryDelta < 5)
          .map((r) => ({
            concept: r.concept,
            intervention: r.interventionType,
            masteryDelta: r.masteryDelta,
          })),
      };
    } catch (iiErr) {
      console.warn('[TUTOR CONTEXT] Error calculating intervention intelligence context:', iiErr);
    }
  } catch (err) {
    console.error('[TUTOR CONTEXT] Error building tutor context:', err);
  }

  return context;
}
