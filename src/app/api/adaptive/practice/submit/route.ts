import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { gradeQuizSubmission, SubmittedAnswerItem } from '@/lib/quiz/grading';
import { updateUserConceptMastery } from '@/lib/quiz/mastery';

export async function POST(request: Request) {
  // 1. Authenticate user session
  let user;
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to submit practice session.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
    user = authData.user;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify authentication session.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  }

  // 2. Parse & Validate request body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid JSON payload.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const { sessionId, answers, durationSeconds = 0 } = body || {};

  if (!sessionId || typeof sessionId !== 'string' || !Array.isArray(answers)) {
    return NextResponse.json(
      {
        success: false,
        error: 'sessionId (string) and answers (array) are required.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const parsedDuration = Math.max(0, parseInt(String(durationSeconds), 10) || 0);

  try {
    // 3. RETRIEVE PRACTICE SESSION & VERIFY OWNERSHIP
    const { data: sessionRecord, error: sessionErr } = await adminClient
      .from('adaptive_practice_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !sessionRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'Target practice session was not found.',
          code: 'SESSION_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (sessionRecord.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You are not authorized to submit this practice session.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    // IDEMPOTENCY CHECK: If already completed, return existing attempt to prevent double updates
    if (sessionRecord.status === 'completed') {
      const { data: existingAttempt } = await adminClient
        .from('adaptive_practice_attempts')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existingAttempt) {
        return NextResponse.json({
          success: true,
          idempotent: true,
          data: {
            attemptId: existingAttempt.id,
            sessionId: sessionId,
            concept: sessionRecord.concept,
            score: existingAttempt.score,
            percentage: existingAttempt.percentage,
            passed: existingAttempt.passed,
            masteryBefore: existingAttempt.mastery_before,
            masteryAfter: existingAttempt.mastery_after,
            masteryChange: existingAttempt.mastery_after - existingAttempt.mastery_before,
            durationSeconds: existingAttempt.duration_seconds,
            results: [],
          },
        });
      }
    }

    // 4. FETCH ANSWER KEY SERVER-SIDE FROM ADAPTIVE PRACTICE QUESTIONS
    const { data: dbQuestions, error: dbQErr } = await adminClient
      .from('adaptive_practice_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true });

    if (dbQErr || !dbQuestions || dbQuestions.length === 0) {
      console.error('[PRACTICE SUBMIT] Failed to fetch practice questions:', dbQErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Practice questions not found for grading.',
          code: 'QUESTIONS_NOT_FOUND',
        },
        { status: 500 }
      );
    }

    // 5. PERFORM SERVER-SIDE DETERMINISTIC GRADING
    const summary = gradeQuizSubmission(
      dbQuestions,
      answers,
      70, // 70% passing threshold
      false
    );

    // 6. UPDATE CONCEPT MASTERY USING STAGE 12.4 ENGINE
    const masteryBefore = sessionRecord.mastery_before || 0;
    
    // Update mastery via updateUserConceptMastery
    await updateUserConceptMastery(user.id, summary.results, false);

    // Fetch new mastery score after update
    const { data: updatedMasteryRow } = await adminClient
      .from('user_concept_mastery')
      .select('mastery_score')
      .eq('user_id', user.id)
      .eq('concept', sessionRecord.concept)
      .single();

    const masteryAfter = updatedMasteryRow?.mastery_score ?? masteryBefore;
    const masteryChange = masteryAfter - masteryBefore;

    // 7. MARK PRACTICE SESSION COMPLETED
    await adminClient
      .from('adaptive_practice_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // 8. PERSIST PRACTICE ATTEMPT RECORD
    const { data: attemptRecord, error: attemptErr } = await adminClient
      .from('adaptive_practice_attempts')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        score: summary.earnedPoints,
        percentage: summary.percentage,
        passed: summary.passed,
        mastery_before: masteryBefore,
        mastery_after: masteryAfter,
        duration_seconds: parsedDuration,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptErr || !attemptRecord) {
      console.error('[PRACTICE SUBMIT] Error inserting practice attempt:', attemptErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to record practice attempt in database.',
          code: 'DB_ATTEMPT_FAILED',
        },
        { status: 500 }
      );
    }

    // 9. PERSIST ITEMIZED PRACTICE ANSWERS IN BATCH
    const answerRows = summary.results.map((r) => ({
      attempt_id: attemptRecord.id,
      question_id: r.questionId,
      selected_answer: r.selectedAnswer,
      is_correct: r.isCorrect,
      points_earned: r.pointsEarned,
    }));

    await adminClient.from('adaptive_practice_answers').insert(answerRows);

    console.log(`[PRACTICE SUBMIT] SUCCESS: User ${user.id} practiced "${sessionRecord.concept}" (${summary.percentage}%), Mastery: ${masteryBefore}% -> ${masteryAfter}% (${masteryChange >= 0 ? '+' : ''}${masteryChange}%)`);

    // 10. RETURN SAFE RESULTS RESPONSE
    return NextResponse.json({
      success: true,
      data: {
        attemptId: attemptRecord.id,
        sessionId: sessionId,
        concept: sessionRecord.concept,
        score: summary.earnedPoints,
        percentage: summary.percentage,
        passed: summary.passed,
        masteryBefore: masteryBefore,
        masteryAfter: masteryAfter,
        masteryChange: masteryChange,
        durationSeconds: parsedDuration,
        results: summary.results,
      },
    });
  } catch (error: any) {
    console.error('[PRACTICE SUBMIT] Server error during submission:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred during practice submission.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
