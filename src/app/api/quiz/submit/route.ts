import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { gradeQuizSubmission, SubmittedAnswerItem } from '@/lib/quiz/grading';
import { LearningInsights, updateUserConceptMastery } from '@/lib/quiz/mastery';
import { closeUserActiveAssessments } from '@/lib/adaptive/assessment-lifecycle';
import { correlateAssessmentEvidence } from '@/lib/adaptive/intervention-tracking';

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
          error: 'Authentication required to submit quiz.',
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
        error: 'Invalid JSON request payload.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const { quizId, answers, durationSeconds = 0 } = body || {};

  if (!quizId || typeof quizId !== 'string') {
    return NextResponse.json(
      {
        success: false,
        error: 'quizId is required and must be a string.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(answers)) {
    return NextResponse.json(
      {
        success: false,
        error: 'answers must be an array.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const parsedDuration = Math.max(0, parseInt(String(durationSeconds), 10) || 0);

  // Validate duplicate question IDs in answers payload
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
    // 3. VERIFY QUIZ OWNERSHIP: User must own the learning_path containing this quiz
    const { data: quizRecord, error: quizErr } = await adminClient
      .from('quizzes')
      .select(`
        id,
        lesson_id,
        passing_score,
        question_count,
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
      `)
      .eq('id', quizId)
      .single();

    if (quizErr || !quizRecord) {
      console.error('[QUIZ SUBMIT] Quiz not found:', quizErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Target quiz record was not found.',
          code: 'QUIZ_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const parentPath = (quizRecord as any).lessons?.modules?.learning_paths;
    if (!parentPath || parentPath.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You are not authorized to submit an attempt for this quiz.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    // 4. FETCH ANSWER KEY SERVER-SIDE VIA ADMIN CLIENT (PRIVILEGED READ)
    const { data: dbQuestions, error: dbQErr } = await adminClient
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('question_order', { ascending: true });

    if (dbQErr || !dbQuestions || dbQuestions.length === 0) {
      console.error('[QUIZ SUBMIT] Failed to retrieve quiz answer key:', dbQErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve quiz questions for grading.',
          code: 'QUESTIONS_NOT_FOUND',
        },
        { status: 500 }
      );
    }

    // Verify all submitted question IDs belong to this quiz
    const validQuestionIds = new Set(dbQuestions.map(q => q.id));
    for (const qId of seenQuestionIds) {
      if (!validQuestionIds.has(qId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Submitted questionId ${qId} does not belong to quiz ${quizId}.`,
            code: 'INVALID_QUESTION_FOR_QUIZ',
          },
          { status: 400 }
        );
      }
    }

    // 5. CHECK PREVIOUS PASS FOR IDEMPOTENT XP & MASTERY AWARDING
    const { data: prevPassedAttempt } = await adminClient
      .from('quiz_attempts')
      .select('id')
      .eq('user_id', user.id)
      .eq('quiz_id', quizId)
      .eq('passed', true)
      .maybeSingle();

    const hasPassedPreviously = !!prevPassedAttempt;

    // 6. PERFORM DETERMINISTIC SERVER-SIDE GRADING
    const summary = gradeQuizSubmission(
      dbQuestions,
      answers,
      quizRecord.passing_score || 70,
      hasPassedPreviously
    );

    // 7. PERSIST ATTEMPT RECORD
    const { data: attemptRecord, error: attemptErr } = await adminClient
      .from('quiz_attempts')
      .insert({
        user_id: user.id,
        quiz_id: quizId,
        lesson_id: quizRecord.lesson_id,
        score: summary.earnedPoints,
        percentage: summary.percentage,
        total_questions: summary.totalQuestions,
        correct_answers: summary.correctAnswers,
        passed: summary.passed,
        started_at: new Date(Date.now() - parsedDuration * 1000).toISOString(),
        completed_at: new Date().toISOString(),
        duration_seconds: parsedDuration,
        xp_awarded: summary.xpAwarded,
      })
      .select()
      .single();

    if (attemptErr || !attemptRecord) {
      console.error('[QUIZ SUBMIT] Error persisting quiz attempt:', attemptErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to record quiz attempt in database.',
          code: 'DB_ATTEMPT_FAILED',
        },
        { status: 500 }
      );
    }

    // 8. PERSIST QUIZ ANSWERS IN BATCH
    const answerRows = summary.results.map((r) => ({
      attempt_id: attemptRecord.id,
      question_id: r.questionId,
      selected_answer: r.selectedAnswer,
      is_correct: r.isCorrect,
      points_earned: r.pointsEarned,
    }));

    const { error: answersErr } = await adminClient
      .from('quiz_answers')
      .insert(answerRows);

    if (answersErr) {
      console.error('[QUIZ SUBMIT] Error inserting quiz answers:', answersErr);
      // Clean up orphaned attempt if answer insertion fails
      await adminClient.from('quiz_attempts').delete().eq('id', attemptRecord.id);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to record itemized quiz answers.',
          code: 'DB_ANSWERS_FAILED',
        },
        { status: 500 }
      );
    }

    // 9. UPDATE USER PROFILE XP IF XP AWARDED > 0
    if (summary.xpAwarded > 0) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('xp')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        await adminClient
          .from('profiles')
          .update({ xp: (profile.xp || 0) + summary.xpAwarded })
          .eq('id', user.id);
      }
    }

    // 10. UPDATE USER CONCEPT MASTERY & GENERATE ADAPTIVE INSIGHTS
    let learningInsights: LearningInsights = {
      strongestConcepts: [],
      weakConcepts: [],
      recommendations: [],
    };

    try {
      learningInsights = await updateUserConceptMastery(
        user.id,
        summary.results,
        hasPassedPreviously
      );
    } catch (masteryErr) {
      console.error('[QUIZ SUBMIT] Mastery calculation error (attempt preserved):', masteryErr);
    }

    // Correlate intervention evidence for weak/strong concepts updated in this quiz
    try {
      const topWeak = learningInsights.weakConcepts[0];
      const targetC = topWeak ? topWeak.concept : 'General Quiz Topic';
      const newMastery = topWeak ? topWeak.score : 50;
      await correlateAssessmentEvidence({
        userId: user.id,
        concept: targetC,
        lessonId: quizRecord.lesson_id,
        newMasteryScore: newMastery,
        score: summary.percentage,
      });
    } catch (corrErr) {
      console.warn('[QUIZ SUBMIT] Evidence correlation warning:', corrErr);
    }

    // 11. CLOSE ANY ACTIVE ASSESSMENTS FOR USER
    try {
      await closeUserActiveAssessments(user.id, quizRecord.lesson_id);
    } catch (closeErr) {
      console.warn('[QUIZ SUBMIT] Error closing active assessments:', closeErr);
    }

    console.log(`[QUIZ SUBMIT] SUCCESS: User ${user.id} scored ${summary.percentage}% (${summary.passed ? 'PASSED' : 'FAILED'}), XP: +${summary.xpAwarded}`);

    // 12. RETURN SAFE FINALIZED RESULTS RESPONSE WITH LEARNING INSIGHTS
    return NextResponse.json({
      success: true,
      data: {
        attemptId: attemptRecord.id,
        percentage: summary.percentage,
        correctAnswers: summary.correctAnswers,
        totalQuestions: summary.totalQuestions,
        earnedPoints: summary.earnedPoints,
        totalPossiblePoints: summary.totalPossiblePoints,
        passed: summary.passed,
        xpAwarded: summary.xpAwarded,
        durationSeconds: parsedDuration,
        results: summary.results,
        learningInsights,
      },
    });
  } catch (error: any) {
    console.error('[QUIZ SUBMIT] Server error during submission:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred during quiz grading.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
