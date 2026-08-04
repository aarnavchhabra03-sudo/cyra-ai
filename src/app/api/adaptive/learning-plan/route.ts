import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAdaptiveLearningPlan } from '@/lib/adaptive/learning-plan';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to access adaptive learning plan.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const user = authData.user;
    const { searchParams } = new URL(request.url);
    const learningPathId = searchParams.get('learningPathId');

    const plan = await generateAdaptiveLearningPlan({
      userId: user.id,
      learningPathId,
    });

    return NextResponse.json({
      success: true,
      data: {
        nextTargets: plan.nextTargets,
        rootGaps: plan.rootGaps,
        blockedConcepts: plan.blockedConcepts,
        generatedAt: plan.generatedAt,
      },
    });
  } catch (error: any) {
    console.error('[LEARNING PLAN API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while generating learning plan.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
