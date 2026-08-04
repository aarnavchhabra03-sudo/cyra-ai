import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/ai/provider';

export async function POST(request: Request) {
  // 1. Authenticate user via Supabase SSR
  let supabase;
  let user;
  try {
    supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to access study notes.',
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
    // 3. STEP 1: QUERY EXISTING STUDY_NOTES FIRST (DB Cache check)
    const { data: existingNotes, error: fetchNotesErr } = await supabase
      .from('study_notes')
      .select('*')
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (existingNotes) {
      console.log('[GENERATE STUDY NOTES] CACHE HIT: Returning saved notes for lesson:', lessonId);
      return NextResponse.json({
        success: true,
        data: existingNotes,
        cached: true,
      });
    }

    // 4. STEP 2: VERIFY LESSON AUTHORIZATION & FETCH LESSON CONTEXT (select columns that exist in DB)
    const { data: lessonRecord, error: lessonErr } = await supabase
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
            goal,
            experience_level,
            user_id
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonErr || !lessonRecord) {
      console.error('[GENERATE STUDY NOTES] LESSON NOT FOUND:', lessonErr);
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
          error: 'You are not authorized to generate study notes for this lesson.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    // 5. STEP 3: CALL AI PROVIDER TO SYNTHESIZE STUDY NOTES
    console.log('[GENERATE STUDY NOTES] CACHE MISS: Generating AI study notes for lesson:', lessonRecord.title);

    const provider = getAIProvider();

    const derivedDesc = (lessonRecord as any).description || (lessonRecord.content ? lessonRecord.content.split('\n')[0].replace(/^#+\s*/, '') : '');

    const aiResponse = await provider.generateStudyNotes({
      courseTitle: parentPath.title,
      moduleTitle: parentModule.title,
      lessonTitle: lessonRecord.title,
      lessonDescription: derivedDesc,
      lessonContent: lessonRecord.content || '',
      experienceLevel: parentPath.experience_level || 'beginner',
    });

    if (!aiResponse.success || !aiResponse.data) {
      if (aiResponse.code === 'RATE_LIMIT_EXCEEDED' || aiResponse.code === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          {
            success: false,
            error: 'AI is temporarily busy. Please wait a moment and try again.',
            code: 'AI_RATE_LIMIT',
          },
          { status: 429 }
        );
      }

      if (aiResponse.code === 'VALIDATION_ERROR') {
        console.error('[GENERATE STUDY NOTES] Validation failed during AI response generation:', aiResponse.error);
        return NextResponse.json(
          {
            success: false,
            error: "CYRA couldn't generate valid study notes this time. Please try again.",
            code: 'VALIDATION_ERROR',
          },
          { status: 422 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: aiResponse.error || 'Failed to generate study notes from AI provider.',
          code: 'AI_GENERATION_FAILED',
        },
        { status: 500 }
      );
    }

    const notesData = aiResponse.data;

    // 6. STEP 4: SAVE VALIDATED NOTES INTO PUBLIC.STUDY_NOTES (SAFE UPSERT)
    const { data: savedRow, error: saveErr } = await supabase
      .from('study_notes')
      .upsert(
        {
          lesson_id: lessonId,
          overview: notesData.overview,
          explanation: notesData.explanation,
          key_concepts: notesData.key_concepts,
          examples: notesData.examples,
          important_points: notesData.important_points,
          quick_revision: notesData.quick_revision,
          raw_markdown: `${notesData.overview}\n\n${notesData.explanation}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'lesson_id' }
      )
      .select('*')
      .single();

    if (saveErr) {
      console.error('[GENERATE STUDY NOTES] DB UPSERT ERROR:', saveErr);

      // If race condition occurred, fetch the existing row created by parallel request
      const { data: fallbackNotes } = await supabase
        .from('study_notes')
        .select('*')
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (fallbackNotes) {
        return NextResponse.json({
          success: true,
          data: fallbackNotes,
          cached: true,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to persist generated study notes to database.',
          code: 'DB_SAVE_FAILED',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: savedRow,
      cached: false,
    });
  } catch (error: any) {
    console.error('Unhandled study notes generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred during study notes generation.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
