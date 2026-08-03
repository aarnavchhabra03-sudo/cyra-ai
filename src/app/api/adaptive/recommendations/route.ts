import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAdaptiveRecommendations, ConceptMasteryRecordInput } from '@/lib/adaptive/recommendations';

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

    // 3. Concept to Lesson mapping lookup (if quiz_questions exist in DB)
    if (records.length > 0) {
      try {
        const conceptsList = records.map((r) => r.concept);
        const { data: questionMatches } = await supabase
          .from('quiz_questions')
          .select('concept, quizzes!inner(lesson_id)')
          .in('concept', conceptsList);

        if (questionMatches && questionMatches.length > 0) {
          const conceptToLessonMap = new Map<string, string>();
          for (const qm of questionMatches as any[]) {
            const lessonId = qm.quizzes?.lesson_id;
            if (qm.concept && lessonId && !conceptToLessonMap.has(qm.concept)) {
              conceptToLessonMap.set(qm.concept, lessonId);
            }
          }

          for (const rec of records) {
            rec.lesson_id = conceptToLessonMap.get(rec.concept) || null;
          }
        }
      } catch (lookupErr) {
        console.warn('[ADAPTIVE RECS] Concept-to-lesson lookup skipped:', lookupErr);
      }
    }

    // 4. Run deterministic recommendation engine
    const result = generateAdaptiveRecommendations(records, 5);

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
