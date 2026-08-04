import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { generateAdaptiveRecommendations, ConceptMasteryRecordInput } from '@/lib/adaptive/recommendations';
import { getUserConceptRelationships } from '@/lib/adaptive/knowledge-graph';

export async function GET() {
  try {
    // 1. Authenticate user session via Supabase server client
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to access adaptive recommendations.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const user = authData.user;

    // 2. Query ONLY authenticated user's rows from user_concept_mastery (enforced by RLS)
    const { data: masteryRows, error: dbError } = await supabase
      .from('user_concept_mastery')
      .select('*')
      .order('mastery_score', { ascending: true });

    if (dbError) {
      console.error('[ADAPTIVE RECS] Database query error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve concept mastery records.',
          code: 'DB_QUERY_FAILED',
        },
        { status: 500 }
      );
    }

    const records: ConceptMasteryRecordInput[] = (masteryRows || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      concept: row.concept,
      mastery_score: row.mastery_score,
      questions_attempted: row.questions_attempted,
      questions_correct: row.questions_correct,
      total_points_possible: row.total_points_possible,
      total_points_earned: row.total_points_earned,
      attempt_count: row.attempt_count,
      last_result: row.last_result,
      last_practiced_at: row.last_practiced_at,
    }));

    // 3. SECURE CONCEPT -> LESSON RESOLUTION
    if (records.length > 0) {
      try {
        const conceptsList = Array.from(new Set(records.map((r) => r.concept)));

        // Query quiz_questions with adminClient to bypass table-level RLS hiding quiz_questions rows,
        // while strictly validating learning_paths.user_id = user.id in memory.
        const { data: questionMatches, error: matchErr } = await adminClient
          .from('quiz_questions')
          .select(`
            concept,
            created_at,
            quiz_id,
            quizzes!inner (
              id,
              lesson_id,
              created_at,
              lessons!inner (
                id,
                module_id,
                modules!inner (
                  id,
                  learning_path_id,
                  learning_paths!inner (
                    id,
                    user_id
                  )
                )
              )
            )
          `)
          .in('concept', conceptsList);

        if (matchErr) {
          console.error('[ADAPTIVE] Error querying question matches:', matchErr);
        } else if (questionMatches && questionMatches.length > 0) {
          // Fetch user's recent quiz attempts for deterministic ties
          const { data: userAttempts } = await adminClient
            .from('quiz_attempts')
            .select('quiz_id, lesson_id, completed_at')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false });

          const attemptRecencyMap = new Map<string, number>();
          if (userAttempts) {
            userAttempts.forEach((att, idx) => {
              if (att.quiz_id && !attemptRecencyMap.has(att.quiz_id)) {
                // Higher score for more recent attempt
                attemptRecencyMap.set(att.quiz_id, userAttempts.length - idx);
              }
            });
          }

          // Map concepts to candidates
          const conceptCandidatesMap = new Map<string, Array<{
            lessonId: string;
            quizId: string;
            quizCreatedAt: string;
            attemptRecency: number;
          }>>();

          for (const qm of questionMatches as any[]) {
            const concept = qm.concept;
            const quiz = qm.quizzes;
            const parentUser = quiz?.lessons?.modules?.learning_paths?.user_id;

            // STRICT OWNERSHIP VERIFICATION: Must belong to authenticated user
            if (parentUser !== user.id || !quiz?.lesson_id) {
              continue;
            }

            const candidates = conceptCandidatesMap.get(concept) || [];
            candidates.push({
              lessonId: quiz.lesson_id,
              quizId: quiz.id,
              quizCreatedAt: quiz.created_at || qm.created_at || '',
              attemptRecency: attemptRecencyMap.get(quiz.id) || 0,
            });
            conceptCandidatesMap.set(concept, candidates);
          }

          // Resolve best lessonId for each concept deterministically
          const resolvedMap = new Map<string, string>();

          for (const concept of conceptsList) {
            const candidates = conceptCandidatesMap.get(concept) || [];
            if (candidates.length > 0) {
              candidates.sort((a, b) => {
                if (a.attemptRecency !== b.attemptRecency) {
                  return b.attemptRecency - a.attemptRecency;
                }
                const timeA = new Date(a.quizCreatedAt).getTime() || 0;
                const timeB = new Date(b.quizCreatedAt).getTime() || 0;
                return timeB - timeA;
              });

              const bestLessonId = candidates[0].lessonId;
              resolvedMap.set(concept, bestLessonId);
            }
          }

          for (const rec of records) {
            rec.lesson_id = resolvedMap.get(rec.concept) || null;
          }
        }
      } catch (lookupErr) {
        console.error('[ADAPTIVE] Concept-to-lesson lookup error:', lookupErr);
      }
    }

    // 4. Load concept relationships & run deterministic recommendation engine with knowledge graph
    const relationships = await getUserConceptRelationships(user.id);
    const result = generateAdaptiveRecommendations(records, 5, relationships);

    return NextResponse.json({
      success: true,
      data: {
        recommendations: result.recommendations,
        summary: result.summary,
      },
    });
  } catch (error: any) {
    console.error('[ADAPTIVE RECS] Server error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred while building recommendations.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
