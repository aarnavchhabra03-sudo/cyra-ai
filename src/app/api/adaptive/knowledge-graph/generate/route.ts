import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateLearningPathKnowledgeGraph } from '@/lib/adaptive/graph-generation';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to generate knowledge graph.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const user = authData.user;
    const body = await request.json().catch(() => ({}));
    const { learningPathId } = body || {};

    if (!learningPathId || typeof learningPathId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'learningPathId must be a non-empty string.',
          code: 'INVALID_INPUT',
        },
        { status: 400 }
      );
    }

    const result = await generateLearningPathKnowledgeGraph({
      learningPathId,
      userId: user.id,
    });

    if (!result.generated && result.error) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: 'GENERATION_FAILED',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        conceptCount: result.conceptCount,
        relationshipCount: result.relationshipCount,
        generated: result.generated,
      },
    });
  } catch (error: any) {
    console.error('[KNOWLEDGE GRAPH GENERATE API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during knowledge graph generation.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
