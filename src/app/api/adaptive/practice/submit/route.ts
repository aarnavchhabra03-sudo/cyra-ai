import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { gradeQuizSubmission, SubmittedAnswerItem } from '@/lib/quiz/grading';
import { updateUserConceptMastery } from '@/lib/quiz/mastery';
import { closeUserActiveAssessments } from '@/lib/adaptive/assessment-lifecycle';
import { correlateAssessmentEvidence } from '@/lib/adaptive/intervention-tracking';

export async function POST(request: Request) {
  console.log('[PRACTICE SUBMIT] request received');

  // 1. Authenticate user session
  let user;
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      console.warn('[PRACTICE SUBMIT] Auth failed:', authError);
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
    console.log('[PRACTICE SUBMIT] authenticated user:', user.id);
  } catch (err) {
    console.error('[PRACTICE SUBMIT] Auth exception:', err);
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
    console.warn('[PRACTICE SUBMIT] Invalid JSON payload');
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

  console.log('[PRACTICE SUBMIT] parsed payload for sessionId:', sessionId, 'answers count:', Array.isArray(answers) ? answers.length : 0);

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

  // Validate itemized answer structure
  const seenQuestionIds = new Set<string>();
  for (const item of answers as SubmittedAnswerItem[]) {
    if (!item || !item.questionId || typeof item.questionId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Each answer item must specify a valid string questionId.',
          code: 'INVALID_INPUT',
        },
        { status: 400 }
      );
    }
    if (seenQuestionIds.has(item.questionId)) {
      return NextResponse.json(
        {
          success: false,
          error: `Duplicate questionId detected in submission: ${item.questionId}`,
          code: 'DUPLICATE_QUESTION_ID',
        },
        { status: 400 }
      );
    }
    seenQuestionIds.add(item.questionId);
  }

  try {
    // 3. RETRIEVE PRACTICE SESSION & VERIFY OWNERSHIP FIRST
    const { data: sessionRecord, error: sessionErr } = await adminClient
      .from('adaptive_practice_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !sessionRecord) {
      console.warn('[PRACTICE SUBMIT] Session lookup failed:', sessionErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Target practice session was not found.',
          code: 'SESSION_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    console.log('[PRACTICE SUBMIT] session lookup success:', sessionRecord.id, 'status:', sessionRecord.status);

    if (sessionRecord.user_id !== user.id) {
      console.warn('[PRACTICE SUBMIT] Unauthorized session access attempt by user:', user.id);
      return NextResponse.json(
        {
          success: false,
          error: 'You are not authorized to submit this practice session.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    console.log('[PRACTICE SUBMIT] ownership verified for user:', user.id);

    // IDEMPOTENCY CHECK: If already completed, return existing attempt safely
    if (sessionRecord.status === 'completed') {
      console.log('[PRACTICE SUBMIT] Session already completed. Returning existing attempt record.');
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

    console.log('[PRACTICE SUBMIT] questions loaded:', dbQuestions.length);

    // VERIFY ALL SUBMITTED QUESTION IDS BELONG TO THIS SESSION
    const validQuestionIds = new Set(dbQuestions.map(q => q.id));
    for (const qId of seenQuestionIds) {
      if (!validQuestionIds.has(qId)) {
        console.warn(`[PRACTICE SUBMIT] Foreign questionId ${qId} rejected for session ${sessionId}`);
        return NextResponse.json(
          {
            success: false,
            error: `Submitted questionId ${qId} does not belong to session ${sessionId}.`,
            code: 'INVALID_QUESTION_FOR_SESSION',
          },
          { status: 400 }
        );
      }
    }

    // 5. PERFORM SERVER-SIDE DETERMINISTIC GRADING
    console.log('[PRACTICE SUBMIT] grading started');
    const summary = gradeQuizSubmission(
      dbQuestions,
      answers,
      70, // 70% passing threshold
      false
    );
    console.log('[PRACTICE SUBMIT] grading completed: score =', summary.earnedPoints, 'percentage =', summary.percentage);

    // 6. UPDATE CONCEPT MASTERY USING STAGE 12.4 ENGINE
    const masteryBefore = sessionRecord.mastery_before || 0;
    
    try {
      await updateUserConceptMastery(user.id, summary.results, false);
      console.log('[PRACTICE SUBMIT] mastery updated');
    } catch (mErr) {
      console.error('[PRACTICE SUBMIT] Mastery calculation error (attempt preserved):', mErr);
    }

    // Fetch new mastery score after update
    const { data: updatedMasteryRow } = await adminClient
      .from('user_concept_mastery')
      .select('mastery_score')
      .eq('user_id', user.id)
      .eq('concept', sessionRecord.concept)
      .maybeSingle();

    const masteryAfter = updatedMasteryRow?.mastery_score ?? masteryBefore;
    const masteryChange = masteryAfter - masteryBefore;

    // 7. MARK PRACTICE SESSION COMPLETED
    const now = new Date();
    const completedAtIso = now.toISOString();
    const startedAtIso = new Date(now.getTime() - parsedDuration * 1000).toISOString();

    await adminClient
      .from('adaptive_practice_sessions')
      .update({
        status: 'completed',
        completed_at: completedAtIso,
      })
      .eq('id', sessionId);

    // Correlate evidence for this practice session intervention (deterministic source matching)
    try {
      await correlateAssessmentEvidence({
        userId: user.id,
        concept: sessionRecord.concept,
        lessonId: sessionRecord.lesson_id,
        newMasteryScore: masteryAfter,
        score: summary.percentage,
        sourcePracticeSessionId: sessionId,
      });
    } catch (cErr) {
      console.warn('[PRACTICE SUBMIT] Evidence correlation warning:', cErr);
    }

    // Also close any remaining active sessions for user
    try {
      await closeUserActiveAssessments(user.id, sessionRecord.lesson_id);
    } catch (cErr) {
      console.warn('[PRACTICE SUBMIT] Error closing active assessments:', cErr);
    }

    console.log('[PRACTICE SUBMIT] session completed');

    // 8. PERSIST PRACTICE ATTEMPT RECORD WITH GUARANTEED started_at <= completed_at
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
        started_at: startedAtIso,
        completed_at: completedAtIso,
        duration_seconds: parsedDuration,
      })
      .select()
      .single();

    if (attemptErr || !attemptRecord) {
      console.error('[PRACTICE SUBMIT] Error inserting practice attempt:', attemptErr);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to record practice attempt in database: ${attemptErr?.message || 'Unknown DB error'}`,
          code: 'DB_ATTEMPT_FAILED',
        },
        { status: 500 }
      );
    }

    console.log('[PRACTICE SUBMIT] attempt inserted successfully:', attemptRecord.id);

    // 9. PERSIST ITEMIZED PRACTICE ANSWERS IN BATCH
    const answerRows = summary.results.map((r) => ({
      attempt_id: attemptRecord.id,
      question_id: r.questionId,
      selected_answer: r.selectedAnswer,
      is_correct: r.isCorrect,
      points_earned: r.pointsEarned,
    }));

    const { error: answersErr } = await adminClient
      .from('adaptive_practice_answers')
      .insert(answerRows);

    if (answersErr) {
      console.error('[PRACTICE SUBMIT] Error inserting practice answers:', answersErr);
    } else {
      console.log('[PRACTICE SUBMIT] answers inserted successfully');
    }

    console.log(`[PRACTICE SUBMIT] response returned: User ${user.id} practiced "${sessionRecord.concept}" (${summary.percentage}%), Mastery: ${masteryBefore}% -> ${masteryAfter}%`);

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
        error: error?.message || 'An unexpected server error occurred during practice submission.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
