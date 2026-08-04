import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildLearnerStateSnapshot, determineNextBestAction } from '@/lib/adaptive/orchestrator';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to access next-best-action intelligence.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const user = authData.user;
    const { searchParams } = new URL(request.url);
    const learningPathId = searchParams.get('learningPathId');
    const lessonId = searchParams.get('lessonId');

    const snapshot = await buildLearnerStateSnapshot({
      userId: user.id,
      learningPathId,
      currentLessonId: lessonId,
    });

    const nextBestAction = determineNextBestAction(snapshot);

    const hasCriticalWeakness = snapshot.mastery.some((m) => m.masteryScore < 40 && m.questionsAttempted > 0);
    const hasBlockedConcept = snapshot.blockedConcepts.length > 0;

    return NextResponse.json({
      success: true,
      data: {
        nextBestAction,
        state: {
          graphAvailable: snapshot.graphAvailable,
          hasCriticalWeakness,
          hasBlockedConcept,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[NEXT ACTION API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while calculating next best action.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
