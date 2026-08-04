import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildLearnerKnowledgeGraph } from '@/lib/adaptive/knowledge-graph';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to access knowledge graph.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const user = authData.user;
    const graphData = await buildLearnerKnowledgeGraph(user.id);

    return NextResponse.json({
      success: true,
      data: {
        concepts: graphData.concepts,
        relationships: graphData.relationships,
        rootGaps: graphData.rootGaps,
        blockedConcepts: graphData.blockedConcepts,
      },
    });
  } catch (error: any) {
    console.error('[KNOWLEDGE GRAPH API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve learner knowledge graph.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
