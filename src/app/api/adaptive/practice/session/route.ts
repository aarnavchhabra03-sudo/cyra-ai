import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    // 1. Authenticate user session
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to access practice session.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
    const user = authData.user;

    // 2. Parse & Validate request parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'sessionId query parameter is required.',
          code: 'INVALID_INPUT',
        },
        { status: 400 }
      );
    }

    // 3. RETRIEVE PRACTICE SESSION & VERIFY OWNERSHIP FIRST
    const { data: sessionRecord, error: sessionErr } = await adminClient
      .from('adaptive_practice_sessions')
      .select('id, user_id, lesson_id, concept, mastery_before, status')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !sessionRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'Practice session not found.',
          code: 'SESSION_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // STRICT OWNERSHIP VERIFICATION BEFORE RETURNING QUESTIONS
    if (sessionRecord.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You are not authorized to view this practice session.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    // 4. RETRIEVE SAFE PRE-SUBMISSION QUESTIONS (EXCLUDING correct_answer AND explanation)
    const { data: questions, error: qErr } = await adminClient
      .from('adaptive_practice_questions')
      .select('id, question_order, question_type, question_text, options, concept, difficulty, points')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true });

    if (qErr || !questions || questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve questions for practice session.',
          code: 'QUESTIONS_NOT_FOUND',
        },
        { status: 500 }
      );
    }

    // 5. RETURN SAFE SESSION & QUESTION PAYLOAD
    return NextResponse.json({
      success: true,
      data: {
        sessionId: sessionRecord.id,
        concept: sessionRecord.concept,
        masteryBefore: sessionRecord.mastery_before,
        status: sessionRecord.status,
        questions,
      },
    });
  } catch (error: any) {
    console.error('[PRACTICE SESSION API] Server error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred while retrieving practice session.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
