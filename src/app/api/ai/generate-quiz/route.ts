import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { getAIProvider } from '@/lib/ai/provider';
import { getSafeQuizQuestions } from '@/lib/quiz/server';

export async function POST(request: Request) {
  // 1. Authenticate user session
  let supabase;
  let user;
  try {
    supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to generate quizzes.',
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

  const { lessonId } = body || {};
  if (!lessonId || typeof lessonId !== 'string') {
    return NextResponse.json(
      {
        success: false,
        error: 'lessonId is required and must be a valid string.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  try {
    // 3. DB CACHE CHECK: Valid ONLY if quiz status is 'ready' AND questions.length > 0
    const { data: existingQuiz, error: fetchErr } = await supabase
      .from('quizzes')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('version', 1)
      .maybeSingle();

    if (!fetchErr && existingQuiz && existingQuiz.generation_status === 'ready') {
      const safeQuestions = await getSafeQuizQuestions(existingQuiz.id);

      if (safeQuestions && safeQuestions.length > 0) {
        console.log(`[GENERATE QUIZ] DB CACHE HIT: Reusing existing quiz (${existingQuiz.id}) with ${safeQuestions.length} questions for lesson:`, lessonId);
        return NextResponse.json({
          success: true,
          cached: true,
          data: {
            quiz: existingQuiz,
            questions: safeQuestions,
          },
        });
      } else {
        console.warn(`[GENERATE QUIZ] Invalid cached quiz detected (${existingQuiz.id}) - 0 valid questions found. Cleaning up orphaned record...`);
        // Privileged cleanup of orphaned 0-question quiz record
        await adminClient.from('quizzes').delete().eq('id', existingQuiz.id);
      }
    }

    // 4. VERIFY AUTHORIZATION & FETCH LESSON CONTEXT
    const { data: lessonRecord, error: lessonErr } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        content,
        estimated_minutes,
        module_id,
        modules!inner (
          id,
          title,
          description,
          learning_path_id,
          learning_paths!inner (
            id,
            title,
            goal,
            experience_level,
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
      .single();

    if (lessonErr || !lessonRecord) {
      console.error('[GENERATE QUIZ] LESSON NOT FOUND:', lessonErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Requested lesson was not found.',
          code: 'LESSON_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const parentModule = (lessonRecord as any).modules;
    const parentPath = parentModule?.learning_paths;

    if (!parentPath || parentPath.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You are not authorized to generate a quiz for this lesson.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    // 5. ASSEMBLE CONTEXT & CALL AI PROVIDER
    console.log(`[GENERATE QUIZ] Generating AI quiz for lesson: "${lessonRecord.title}"`);
    const provider = getAIProvider();

    const studyNotes = Array.isArray(lessonRecord.study_notes)
      ? lessonRecord.study_notes[0]
      : lessonRecord.study_notes;

    const derivedDesc = studyNotes?.overview || (lessonRecord.content ? lessonRecord.content.split('\n')[0].replace(/^#+\s*/, '') : '');
    const keyConcepts = studyNotes?.key_concepts || [];

    const aiResponse = await provider.generateQuiz({
      courseTitle: parentPath.title,
      moduleTitle: parentModule.title,
      lessonTitle: lessonRecord.title,
      lessonDescription: derivedDesc,
      lessonContent: lessonRecord.content || '',
      keyConcepts: Array.isArray(keyConcepts) ? keyConcepts : [],
      experienceLevel: parentPath.experience_level || 'beginner',
    });

    if (!aiResponse.success || !aiResponse.data) {
      if (aiResponse.code === 'RATE_LIMIT_EXCEEDED' || aiResponse.code === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          {
            success: false,
            error: 'AI provider is busy. Please wait a moment and try again.',
            code: 'AI_RATE_LIMIT',
          },
          { status: 429 }
        );
      }

      if (aiResponse.code === 'VALIDATION_ERROR') {
        console.error('[GENERATE QUIZ] Validation failed during AI response generation:', aiResponse.error);
        return NextResponse.json(
          {
            success: false,
            error: "CYRA couldn't generate a valid quiz. Please try again.",
            code: 'VALIDATION_ERROR',
          },
          { status: 422 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate quiz from AI provider.',
          code: 'AI_GENERATION_FAILED',
        },
        { status: 500 }
      );
    }

    const generatedData = aiResponse.data;
    console.log(`[GENERATE QUIZ] AI generated ${generatedData.questions.length} questions for "${generatedData.quiz.title}"`);

    // 6. RERUN DUPLICATE CHECK TO AVOID CONCURRENT INSERTIONS
    const { data: recheckQuiz } = await supabase
      .from('quizzes')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('version', 1)
      .maybeSingle();

    if (recheckQuiz && recheckQuiz.generation_status === 'ready') {
      const recheckSafeQuestions = await getSafeQuizQuestions(recheckQuiz.id);
      if (recheckSafeQuestions && recheckSafeQuestions.length > 0) {
        return NextResponse.json({
          success: true,
          cached: true,
          data: {
            quiz: recheckQuiz,
            questions: recheckSafeQuestions,
          },
        });
      } else {
        console.warn(`[GENERATE QUIZ] Invalid concurrent cached quiz detected (${recheckQuiz.id}) - 0 valid questions found. Cleaning up...`);
        await adminClient.from('quizzes').delete().eq('id', recheckQuiz.id);
      }
    }

    // 7. INSERT QUIZZES ROW VIA ADMIN CLIENT (PRIVILEGED SERVER WRITE)
    const { data: insertedQuiz, error: quizInsertErr } = await adminClient
      .from('quizzes')
      .insert({
        lesson_id: lessonId,
        title: generatedData.quiz.title,
        description: generatedData.quiz.description,
        difficulty: generatedData.quiz.difficulty || 'beginner',
        question_count: generatedData.questions.length,
        estimated_minutes: generatedData.quiz.estimated_minutes || 5,
        passing_score: generatedData.quiz.passing_score || 70,
        version: 1,
        generation_status: 'ready',
      })
      .select('*')
      .single();

    if (quizInsertErr || !insertedQuiz) {
      console.error('[GENERATE QUIZ] Error inserting quiz record:', quizInsertErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to persist quiz record to database.',
          code: 'DB_SAVE_FAILED',
        },
        { status: 500 }
      );
    }

    // 8. INSERT QUIZ_QUESTIONS ROWS VIA ADMIN CLIENT (PRIVILEGED SERVER WRITE)
    const questionRows = generatedData.questions.map(q => ({
      quiz_id: insertedQuiz.id,
      question_order: q.question_order,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      concept: q.concept || null,
      difficulty: q.difficulty || insertedQuiz.difficulty,
      points: q.points || 1,
    }));

    console.log(
      "[QUESTION ROWS]",
      JSON.stringify(questionRows, null, 2)
    );

    const { error: questionsInsertErr } = await adminClient
      .from('quiz_questions')
      .insert(questionRows);

    if (questionsInsertErr) {
      console.error('[GENERATE QUIZ] Error inserting quiz questions:', questionsInsertErr);
      // Clean up orphaned quiz row if questions failed to insert via adminClient
      await adminClient.from('quizzes').delete().eq('id', insertedQuiz.id);

      return NextResponse.json(
        {
          success: false,
          error: questionsInsertErr.message,
          details: questionsInsertErr.details,
          hint: questionsInsertErr.hint,
          code: questionsInsertErr.code,
        },
        { status: 500 }
      );
    }

    console.log(`[GENERATE QUIZ] SUCCESS: Persisted quiz ${insertedQuiz.id} with ${questionRows.length} questions.`);

    // 9. FETCH BROWSER-SAFE QUESTIONS (OMITTING correct_answer)
    const safeQuestions = await getSafeQuizQuestions(insertedQuiz.id);

    return NextResponse.json({
      success: true,
      cached: false,
      data: {
        quiz: insertedQuiz,
        questions: safeQuestions,
      },
    });
  } catch (error: any) {
    console.error('[GENERATE QUIZ] Server error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred during quiz generation.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
