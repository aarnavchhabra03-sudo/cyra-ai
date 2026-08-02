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
          error: 'Authentication required to generate resource plans.',
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
    // 3. VERIFY LESSON AUTHORIZATION & FETCH LESSON CONTEXT
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
      console.error('[GENERATE RESOURCE PLAN] LESSON NOT FOUND:', lessonErr);
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
          error: 'You are not authorized to generate resource plans for this lesson.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    // 4. CALL AI PROVIDER TO SYNTHESIZE RESOURCE DISCOVERY PLAN
    console.log('[GENERATE RESOURCE PLAN] Generating AI Resource Discovery Plan for lesson:', lessonRecord.title);

    const provider = getAIProvider();

    const derivedDesc = (lessonRecord as any).description || (lessonRecord.content ? lessonRecord.content.split('\n')[0].replace(/^#+\s*/, '') : '');

    const aiResponse = await provider.generateResourcePlan({
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

      return NextResponse.json(
        {
          success: false,
          error: aiResponse.error || 'Failed to generate resource discovery plan from AI provider.',
          code: 'AI_GENERATION_FAILED',
        },
        { status: 500 }
      );
    }

    // 5. STAGE 11.4 MANDATE: DO NOT WRITE TO DATABASE YET
    // Return generated plan in client response without writing unverified URLs to public.learning_resources
    return NextResponse.json({
      success: true,
      resources: aiResponse.data.resources,
      lessonId,
      provider: aiResponse.provider,
    });
  } catch (error: any) {
    console.error('Unhandled resource plan generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred during resource plan generation.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
