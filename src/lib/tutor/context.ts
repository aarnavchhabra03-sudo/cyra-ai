import { adminClient } from '@/lib/supabase/admin';
import { generateAdaptiveRecommendations, ConceptMasteryRecordInput } from '@/lib/adaptive/recommendations';

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
}

/**
 * Bounded, server-only context builder for CYRA's Context-Aware AI Tutor.
 * Assembles student mastery intelligence, recent quiz mistakes, practice history, and lesson materials.
 */
export async function buildTutorContext({
  userId,
  lessonId,
}: {
  userId: string;
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
  };

  try {
    // 1. FETCH USER CONCEPT MASTERY
    const { data: masteryRows } = await adminClient
      .from('user_concept_mastery')
      .select('*')
      .eq('user_id', userId)
      .order('mastery_score', { ascending: true });

    if (masteryRows && masteryRows.length > 0) {
      const records: ConceptMasteryRecordInput[] = masteryRows.map((r) => ({
        concept: r.concept,
        mastery_score: r.mastery_score,
        questions_attempted: r.questions_attempted,
        questions_correct: r.questions_correct,
        attempt_count: r.attempt_count,
        last_result: r.last_result,
        last_practiced_at: r.last_practiced_at,
      }));

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
    if (lessonId) {
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
        .eq('id', lessonId)
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
      const { data: recentAttempts } = await adminClient
        .from('quiz_attempts')
        .select('id')
        .eq('user_id', userId)
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
      const { data: practiceAttempts } = await adminClient
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

    // 5. CHECK ACTIVE ASSESSMENT STATUS
    if (lessonId) {
      const { data: activePractice } = await adminClient
        .from('adaptive_practice_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .eq('status', 'active')
        .maybeSingle();

      if (activePractice) {
        context.hasActiveAssessment = true;
      }
    }
  } catch (err) {
    console.error('[TUTOR CONTEXT] Error building tutor context:', err);
  }

  return context;
}
