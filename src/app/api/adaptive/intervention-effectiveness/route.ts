import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInterventionEffectiveness } from '@/lib/adaptive/intervention-tracking';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to view intervention effectiveness.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const user = authData.user;
    const { searchParams } = new URL(request.url);
    const concept = searchParams.get('concept');

    const report = await getInterventionEffectiveness(user.id, concept);

    return NextResponse.json({
      success: true,
      data: {
        totalCompletedInterventions: report.totalCompletedInterventions,
        averageMasteryGain: report.averageMasteryGain,
        mostEffectiveStrategy: report.mostEffectiveStrategy,
        recentOutcomes: report.recentOutcomes,
      },
    });
  } catch (error: any) {
    console.error('[INTERVENTION EFFECTIVENESS API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while calculating intervention effectiveness.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
