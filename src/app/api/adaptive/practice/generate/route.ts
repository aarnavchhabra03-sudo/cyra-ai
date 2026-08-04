import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { getAIProvider } from '@/lib/ai/provider';
import { getUserConceptRelationships, calculateConceptReadiness, normalizeGraphConcept } from '@/lib/adaptive/knowledge-graph';
import { closeUserActiveAssessments } from '@/lib/adaptive/assessment-lifecycle';

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
          error: 'Authentication required to generate practice session.',
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

  const { concept, lessonId } = body || {};

  if (!concept || typeof concept !== 'string' || !lessonId || typeof lessonId !== 'string') {
    return NextResponse.json(
      {
        success: false,
        error: 'Both concept and lessonId must be non-empty strings.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  try {
    // 3. VERIFY LESSON OWNERSHIP: Ensure lesson belongs to authenticated user's learning path
    const { data: lessonRecord, error: lessonErr } = await adminClient
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
      console.error('[PRACTICE GENERATE] Lesson not found:', lessonErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Target lesson record was not found.',
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
          error: 'You are not authorized to access this lesson context.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    // 4. RETRIEVE ALL USER CONCEPT MASTERY & KNOWLEDGE GRAPH RELATIONSHIPS
    const { data: allMasteryRows } = await adminClient
      .from('user_concept_mastery')
      .select('concept, mastery_score')
      .eq('user_id', user.id);

    const masteryMap = new Map<string, number>();
    if (allMasteryRows) {
      for (const row of allMasteryRows) {
        masteryMap.set(normalizeGraphConcept(row.concept), row.mastery_score);
      }
    }

    const relationships = await getUserConceptRelationships(user.id);

    // 5. EVALUATE PREREQUISITE READINESS & BLOCKED STATUS
    const readiness = calculateConceptReadiness({
      targetConcept: concept,
      masteryMap,
      relationships,
    });

    let targetConceptToPractice = concept;
    let redirectedToPrerequisite = false;
    let redirectionReason: string | undefined = undefined;

    if (readiness.blocked && readiness.blockingPrerequisites.length > 0) {
      const topPrereq = readiness.blockingPrerequisites[0];
      targetConceptToPractice = topPrereq.concept;
      redirectedToPrerequisite = true;
      redirectionReason = `Your current ${topPrereq.concept} mastery is ${topPrereq.masteryScore}%. Strengthening this prerequisite first will ensure success in ${concept}.`;

      console.log(`[PRACTICE GENERATE] BLOCKED CONCEPT DETECTED! Redirecting practice from "${concept}" to prerequisite "${targetConceptToPractice}"`);
    }

    const masteryBefore = masteryMap.get(normalizeGraphConcept(targetConceptToPractice)) || 0;

    // Determine targeted question difficulty based on current mastery of targetConceptToPractice
    let targetDifficulty = 'beginner';
    if (masteryBefore >= 70) {
      targetDifficulty = 'advanced';
    } else if (masteryBefore >= 40) {
      targetDifficulty = 'intermediate';
    }

    // 6. CALL AI PROVIDER TO GENERATE TARGETED QUESTIONS
    console.log(`[PRACTICE GENERATE] Generating targeted practice for concept "${targetConceptToPractice}" (mastery: ${masteryBefore}%)`);
    const provider = getAIProvider();

    const studyNotes = Array.isArray(lessonRecord.study_notes)
      ? lessonRecord.study_notes[0]
      : lessonRecord.study_notes;

    const lessonDesc = studyNotes?.overview || (lessonRecord.content ? lessonRecord.content.split('\n')[0].replace(/^#+\s*/, '') : '');

    const aiResponse = await provider.generateQuiz({
      courseTitle: parentPath.title,
      moduleTitle: parentModule.title,
      lessonTitle: lessonRecord.title,
      lessonDescription: lessonDesc,
      lessonContent: lessonRecord.content || '',
      keyConcepts: [targetConceptToPractice],
      experienceLevel: targetDifficulty,
    });

    if (!aiResponse.success || !aiResponse.data || !aiResponse.data.questions || aiResponse.data.questions.length === 0) {
      console.error('[PRACTICE GENERATE] AI generation failed:', aiResponse.error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate targeted practice questions from AI provider.',
          code: 'AI_GENERATION_FAILED',
        },
        { status: 502 }
      );
    }

    // Take top 5 questions from AI response
    const rawQuestions = aiResponse.data.questions.slice(0, 5);

    // Close any previous active sessions for user before starting a new one
    try {
      await closeUserActiveAssessments(user.id);
    } catch (cErr) {
      console.warn('[PRACTICE GENERATE] Error closing previous active sessions:', cErr);
    }

    // 7. PERSIST PRACTICE SESSION IN DATABASE
    const { data: sessionRecord, error: sessionErr } = await adminClient
      .from('adaptive_practice_sessions')
      .insert({
        user_id: user.id,
        lesson_id: lessonId,
        concept: targetConceptToPractice,
        mastery_before: masteryBefore,
        status: 'active',
      })
      .select()
      .single();

    if (sessionErr || !sessionRecord) {
      console.error('[PRACTICE GENERATE] Error inserting practice session:', sessionErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create practice session in database.',
          code: 'DB_SESSION_FAILED',
        },
        { status: 500 }
      );
    }

    // 8. PERSIST PRACTICE QUESTIONS IN BATCH
    const questionRows = rawQuestions.map((q, idx) => ({
      session_id: sessionRecord.id,
      question_order: idx + 1,
      question_type: q.question_type || 'multiple_choice',
      question_text: q.question_text,
      options: q.options || [],
      correct_answer: q.correct_answer || { option_id: 'A' },
      explanation: q.explanation || '',
      concept: targetConceptToPractice,
      difficulty: q.difficulty || targetDifficulty,
      points: q.points || 1,
    }));

    const { data: insertedQuestions, error: qErr } = await adminClient
      .from('adaptive_practice_questions')
      .insert(questionRows)
      .select('id, question_order, question_type, question_text, options, concept, difficulty, points');

    if (qErr || !insertedQuestions || insertedQuestions.length === 0) {
      console.error('[PRACTICE GENERATE] Error inserting practice questions:', qErr);
      await adminClient.from('adaptive_practice_sessions').delete().eq('id', sessionRecord.id);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to persist practice questions.',
          code: 'DB_QUESTIONS_FAILED',
        },
        { status: 500 }
      );
    }

    // 9. RETURN SAFE PAYLOAD WITH PREREQUISITE REDIRECTION METADATA
    return NextResponse.json({
      success: true,
      data: {
        sessionId: sessionRecord.id,
        concept: targetConceptToPractice,
        requestedConcept: concept,
        redirectedToPrerequisite,
        redirectionReason,
        masteryBefore: masteryBefore,
        questionCount: insertedQuestions.length,
        questions: insertedQuestions,
      },
    });
  } catch (error: any) {
    console.error('[PRACTICE GENERATE] Server error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred during practice generation.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
