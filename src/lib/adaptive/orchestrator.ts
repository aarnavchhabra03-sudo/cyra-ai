import { adminClient } from '@/lib/supabase/admin';
import {
  getUserConceptRelationships,
  calculateConceptReadiness,
  detectRootKnowledgeGaps,
  normalizeGraphConcept,
  buildLearnerKnowledgeGraph,
} from './knowledge-graph';
import { generateAdaptiveLearningPlan } from './learning-plan';
import { generateAdaptiveRecommendations, ConceptMasteryRecordInput } from './recommendations';
import { getRelevantTutorMemories, TutorMemoryItem } from '@/lib/tutor/memory';

export type NextBestActionType =
  | 'continue_lesson'
  | 'review_lesson'
  | 'practice_concept'
  | 'repair_prerequisite'
  | 'take_quiz'
  | 'ask_tutor'
  | 'revisit_notes'
  | 'challenge_practice';

export interface SecondaryAction {
  action: NextBestActionType;
  concept: string | null;
  lessonId?: string | null;
  reason: string;
}

export interface NextBestAction {
  action: NextBestActionType;
  concept: string | null;
  lessonId: string | null;
  priorityScore: number;
  reasonCode: string;
  reason: string;
  secondaryActions: SecondaryAction[];
}

export interface LearnerStateSnapshot {
  userId: string;
  learningPathId?: string | null;
  currentLessonId?: string | null;
  currentLessonTitle?: string | null;
  mastery: Array<{
    concept: string;
    masteryScore: number;
    questionsAttempted: number;
    questionsCorrect: number;
    lastResult: string;
    lessonId?: string | null;
  }>;
  recommendations: any[];
  adaptivePlan: any[];
  rootGaps: Array<{ concept: string; rootGapScore: number; blockingCount: number }>;
  blockedConcepts: Array<{
    concept: string;
    readinessScore: number;
    blockingPrerequisites: Array<{ concept: string; masteryScore: number }>;
  }>;
  recentQuizAttempts: Array<{ quizId: string; lessonId?: string; percentage: number; completedAt: string }>;
  recentPracticeAttempts: Array<{
    concept: string;
    percentage: number;
    masteryBefore: number;
    masteryAfter: number;
    completedAt: string;
  }>;
  tutorMemories: TutorMemoryItem[];
  curriculumProgress: number;
  graphAvailable: boolean;
  hasActiveAssessment: boolean;
}

/**
 * Builds a bounded learner state snapshot from database records.
 */
export async function buildLearnerStateSnapshot({
  userId,
  learningPathId,
  currentLessonId,
}: {
  userId: string;
  learningPathId?: string | null;
  currentLessonId?: string | null;
}): Promise<LearnerStateSnapshot> {
  const snapshot: LearnerStateSnapshot = {
    userId,
    learningPathId: learningPathId || null,
    currentLessonId: currentLessonId || null,
    mastery: [],
    recommendations: [],
    adaptivePlan: [],
    rootGaps: [],
    blockedConcepts: [],
    recentQuizAttempts: [],
    recentPracticeAttempts: [],
    tutorMemories: [],
    curriculumProgress: 0,
    graphAvailable: false,
    hasActiveAssessment: false,
  };

  try {
    // 1. Load Concept Mastery
    const { data: masteryRows } = await adminClient
      .from('user_concept_mastery')
      .select('*')
      .eq('user_id', userId);

    const masteryMap = new Map<string, number>();

    if (masteryRows && masteryRows.length > 0) {
      snapshot.mastery = masteryRows.map((r) => {
        masteryMap.set(normalizeGraphConcept(r.concept), r.mastery_score);
        return {
          concept: r.concept,
          masteryScore: r.mastery_score,
          questionsAttempted: r.questions_attempted || 0,
          questionsCorrect: r.questions_correct || 0,
          lastResult: r.last_result || 'weak',
          lessonId: r.lesson_id || null,
        };
      });
    }

    // 2. Load Relationships & Knowledge Graph
    const relationships = await getUserConceptRelationships(userId);
    snapshot.graphAvailable = Array.isArray(relationships) && relationships.length > 0;

    if (snapshot.graphAvailable) {
      const graphData = await buildLearnerKnowledgeGraph(userId);
      snapshot.rootGaps = graphData.rootGaps.map((rg) => ({
        concept: rg.concept,
        rootGapScore: rg.rootGapScore,
        blockingCount: rg.blockingCount,
      }));
      snapshot.blockedConcepts = graphData.blockedConcepts.map((bc) => ({
        concept: bc.concept,
        readinessScore: bc.readinessScore,
        blockingPrerequisites: bc.blockingPrerequisites.map((bp) => ({
          concept: bp.concept,
          masteryScore: bp.masteryScore,
        })),
      }));
    }

    // 3. Load Recommendations & Learning Plan
    const recordsInput: ConceptMasteryRecordInput[] = snapshot.mastery.map((m) => ({
      concept: m.concept,
      mastery_score: m.masteryScore,
      questions_attempted: m.questionsAttempted,
      questions_correct: m.questionsCorrect,
      attempt_count: 1,
      last_practiced_at: new Date().toISOString(),
      lesson_id: m.lessonId,
    }));

    const recsResult = generateAdaptiveRecommendations(recordsInput, 5, relationships);
    snapshot.recommendations = recsResult.recommendations;

    const planResult = await generateAdaptiveLearningPlan({ userId, learningPathId });
    snapshot.adaptivePlan = planResult.nextTargets;

    // 4. Load Recent Quiz Attempts
    const { data: quizAtts } = await adminClient
      .from('quiz_attempts')
      .select('quiz_id, lesson_id, percentage, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (quizAtts) {
      snapshot.recentQuizAttempts = quizAtts.map((qa) => ({
        quizId: qa.quiz_id,
        lessonId: qa.lesson_id,
        percentage: qa.percentage,
        completedAt: qa.completed_at,
      }));
    }

    // 5. Load Recent Practice Attempts
    const { data: practiceAtts } = await adminClient
      .from('adaptive_practice_attempts')
      .select(`
        percentage,
        mastery_before,
        mastery_after,
        completed_at,
        adaptive_practice_sessions!inner (
          concept
        )
      `)
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (practiceAtts) {
      snapshot.recentPracticeAttempts = practiceAtts.map((pa: any) => ({
        concept: pa.adaptive_practice_sessions?.concept || 'Practice',
        percentage: pa.percentage,
        masteryBefore: pa.mastery_before,
        masteryAfter: pa.mastery_after,
        completedAt: pa.completed_at,
      }));
    }

    // 6. Check Active Assessment Status
    const { data: activeSession } = await adminClient
      .from('adaptive_practice_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (activeSession) {
      snapshot.hasActiveAssessment = true;
    }

    // 7. Load Tutor Memories
    snapshot.tutorMemories = await getRelevantTutorMemories({
      userId,
      targetConcept: snapshot.mastery[0]?.concept || 'General Concept',
      conceptList: snapshot.mastery.map((m) => m.concept),
    });
  } catch (err) {
    console.error('[ORCHESTRATOR] Error building learner state snapshot:', err);
  }

  return snapshot;
}

/**
 * Deterministic Learning State Orchestrator & Next-Best-Action Engine.
 * Evaluates learner state snapshot signals and outputs the authoritative Next Best Action.
 */
export function determineNextBestAction(snapshot: LearnerStateSnapshot): NextBestAction {
  // Precedence Level 0: ACTIVE ASSESSMENT SECURITY SHIELD
  if (snapshot.hasActiveAssessment) {
    return {
      action: 'ask_tutor',
      concept: snapshot.mastery[0]?.concept || null,
      lessonId: snapshot.currentLessonId || null,
      priorityScore: 99,
      reasonCode: 'ACTIVE_ASSESSMENT_SHIELD',
      reason: 'You have an active assessment in progress. Ask CYRA Tutor for Socratic hints or conceptual guidance.',
      secondaryActions: [
        { action: 'revisit_notes', concept: snapshot.mastery[0]?.concept || null, reason: 'Review lesson notes for underlying concepts.' },
      ],
    };
  }

  // Precedence Level 1: CRITICAL PREREQUISITE BLOCK
  if (snapshot.blockedConcepts.length > 0) {
    const topBlocked = snapshot.blockedConcepts[0];
    if (topBlocked.blockingPrerequisites.length > 0) {
      const topPrereq = topBlocked.blockingPrerequisites[0];
      const prereqLessonId = snapshot.mastery.find(
        (m) => normalizeGraphConcept(m.concept) === normalizeGraphConcept(topPrereq.concept)
      )?.lessonId || snapshot.currentLessonId || null;

      return {
        action: 'repair_prerequisite',
        concept: topPrereq.concept,
        lessonId: prereqLessonId,
        priorityScore: 94,
        reasonCode: 'BLOCKING_PREREQUISITE',
        reason: `Strengthening ${topPrereq.concept} (${topPrereq.masteryScore}% mastery) first will unlock ${topBlocked.concept}.`,
        secondaryActions: [
          { action: 'ask_tutor', concept: topPrereq.concept, reason: `Ask CYRA Tutor for a beginner explanation of ${topPrereq.concept}.` },
          { action: 'revisit_notes', concept: topPrereq.concept, reason: `Review study notes for ${topPrereq.concept}.` },
        ],
      };
    }
  }

  // Precedence Level 2: ANTI-LOOP / REPEATED FAILURE DETECTION
  // Check if any concept has >= 2 recent practice attempts with score < 60% or improvement < 10 points
  const recentPracticeByConcept = new Map<string, number[]>();
  for (const pa of snapshot.recentPracticeAttempts) {
    const norm = normalizeGraphConcept(pa.concept);
    const scores = recentPracticeByConcept.get(norm) || [];
    scores.push(pa.percentage);
    recentPracticeByConcept.set(norm, scores);
  }

  for (const [normC, scores] of recentPracticeByConcept.entries()) {
    if (scores.length >= 2 && scores[0] < 60 && scores[1] < 60) {
      const origConcept = snapshot.mastery.find((m) => normalizeGraphConcept(m.concept) === normC)?.concept || normC;
      const lessonId = snapshot.mastery.find((m) => normalizeGraphConcept(m.concept) === normC)?.lessonId || null;

      return {
        action: 'ask_tutor',
        concept: origConcept,
        lessonId,
        priorityScore: 90,
        reasonCode: 'REPEATED_FAILURE',
        reason: `CYRA recommends a guided explanation before another practice attempt because ${origConcept} has remained challenging across several attempts.`,
        secondaryActions: [
          { action: 'review_lesson', concept: origConcept, reason: `Review core study notes for ${origConcept}.` },
          { action: 'revisit_notes', concept: origConcept, reason: `Revisit key concepts in study guide.` },
        ],
      };
    }
  }

  // Precedence Level 3: DEMONSTRATED WEAKNESS (< 40% mastery with assessed evidence)
  const demonstratedWeakness = snapshot.mastery
    .filter((m) => m.masteryScore < 40 && m.questionsAttempted > 0)
    .sort((a, b) => a.masteryScore - b.masteryScore)[0];

  if (demonstratedWeakness) {
    return {
      action: 'practice_concept',
      concept: demonstratedWeakness.concept,
      lessonId: demonstratedWeakness.lessonId || snapshot.currentLessonId || null,
      priorityScore: 82,
      reasonCode: 'DEMONSTRATED_WEAKNESS',
      reason: `A targeted practice session will build solid mastery in ${demonstratedWeakness.concept} (${demonstratedWeakness.masteryScore}%).`,
      secondaryActions: [
        { action: 'review_lesson', concept: demonstratedWeakness.concept, reason: `Review core study notes for ${demonstratedWeakness.concept}.` },
        { action: 'ask_tutor', concept: demonstratedWeakness.concept, reason: `Ask CYRA Tutor for a breakdown of ${demonstratedWeakness.concept}.` },
      ],
    };
  }

  // Precedence Level 4: ACTIVE MISCONCEPTION
  const activeMisconception = snapshot.tutorMemories.find(
    (m) => m.memoryType === 'misconception' && !m.resolvedAt && (m.reliabilityScore || 0) >= 65
  );

  if (activeMisconception) {
    const concept = activeMisconception.concept;
    const lessonId = snapshot.mastery.find((m) => normalizeGraphConcept(m.concept) === normalizeGraphConcept(concept))?.lessonId || null;

    return {
      action: 'ask_tutor',
      concept,
      lessonId,
      priorityScore: 78,
      reasonCode: 'ACTIVE_MISCONCEPTION',
      reason: `Review ${concept} with CYRA Tutor to address a recorded misconception.`,
      secondaryActions: [
        { action: 'review_lesson', concept, reason: `Review study notes for ${concept}.` },
        { action: 'practice_concept', concept, reason: `Perform a short practice quiz on ${concept}.` },
      ],
    };
  }

  // Precedence Level 5: READY FOR ASSESSMENT
  if (snapshot.currentLessonId) {
    const hasRecentPassingQuiz = snapshot.recentQuizAttempts.some(
      (qa) => qa.lessonId === snapshot.currentLessonId && qa.percentage >= 60
    );

    if (!hasRecentPassingQuiz) {
      return {
        action: 'take_quiz',
        concept: snapshot.currentLessonTitle || null,
        lessonId: snapshot.currentLessonId,
        priorityScore: 72,
        reasonCode: 'READY_FOR_ASSESSMENT',
        reason: `You are ready to test your knowledge. Take the lesson quiz to verify complete understanding.`,
        secondaryActions: [
          { action: 'revisit_notes', concept: snapshot.currentLessonTitle || null, reason: `Quickly review lesson study notes before taking quiz.` },
          { action: 'ask_tutor', concept: snapshot.currentLessonTitle || null, reason: `Ask CYRA Tutor for a pre-quiz review.` },
        ],
      };
    }
  }

  // Precedence Level 6: PROFICIENT / CHALLENGE PRACTICE
  const proficientConcept = snapshot.mastery
    .filter((m) => m.masteryScore >= 85 && m.questionsAttempted > 0)
    .sort((a, b) => b.masteryScore - a.masteryScore)[0];

  if (proficientConcept && snapshot.mastery.every((m) => m.masteryScore >= 70)) {
    return {
      action: 'challenge_practice',
      concept: proficientConcept.concept,
      lessonId: proficientConcept.lessonId || null,
      priorityScore: 45,
      reasonCode: 'MASTERY_STABLE',
      reason: `You have strong mastery across all concepts. Attempt an advanced challenge practice to solidify ${proficientConcept.concept}.`,
      secondaryActions: [
        { action: 'continue_lesson', concept: null, reason: `Proceed to next curriculum module.` },
      ],
    };
  }

  // Precedence Level 7: CURRICULUM CONTINUATION (DEFAULT)
  return {
    action: 'continue_lesson',
    concept: snapshot.currentLessonTitle || null,
    lessonId: snapshot.currentLessonId || null,
    priorityScore: 60,
    reasonCode: 'NEXT_CURRICULUM_STEP',
    reason: `Proceed with your next curriculum lesson.`,
    secondaryActions: [
      { action: 'revisit_notes', concept: snapshot.currentLessonTitle || null, reason: `Review current lesson study notes.` },
      { action: 'ask_tutor', concept: snapshot.currentLessonTitle || null, reason: `Ask CYRA Tutor any questions about this lesson.` },
    ],
  };
}
