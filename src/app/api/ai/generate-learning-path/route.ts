import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/ai/provider';
import { DifficultyLevel } from '@/types/ai';

export async function POST(request: Request) {
  // 1. Authenticate user via Supabase SSR
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to generate a learning path.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify user authentication session.',
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

  const { topic, experienceLevel, goal, minutesPerDay, targetDate } = body || {};

  // Input validation rules
  const validLevels: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

  if (
    !topic ||
    typeof topic !== 'string' ||
    topic.trim().length < 2 ||
    topic.trim().length > 200
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Topic must be between 2 and 200 characters long.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  if (!experienceLevel || !validLevels.includes(experienceLevel as DifficultyLevel)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Experience level must be beginner, intermediate, or advanced.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  if (!goal || typeof goal !== 'string' || goal.trim().length < 2) {
    return NextResponse.json(
      {
        success: false,
        error: 'Goal must be a valid non-empty string.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  if (
    typeof minutesPerDay !== 'number' ||
    isNaN(minutesPerDay) ||
    minutesPerDay < 5 ||
    minutesPerDay > 480
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Daily study minutes must be between 5 and 480 minutes.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  // 3. Call AI Provider for Structured Generation
  try {
    const provider = getAIProvider();

    const aiResponse = await provider.generateLearningPath({
      topic: topic.trim(),
      experienceLevel: experienceLevel as DifficultyLevel,
      goal: goal.trim(),
      minutesPerDay,
      targetDate: typeof targetDate === 'string' ? targetDate : undefined,
    });

    if (!aiResponse.success || !aiResponse.data) {
      const code = aiResponse.code;

      if (code === 'RATE_LIMIT_EXCEEDED') {
        return NextResponse.json(
          {
            success: false,
            error: 'AI service rate limit reached. Please try again in a few moments.',
            code: 'AI_RATE_LIMIT',
          },
          { status: 429 }
        );
      }

      if (code === 'MISSING_API_KEY' || code === 'INVALID_API_KEY') {
        return NextResponse.json(
          {
            success: false,
            error: 'AI provider service is currently unavailable.',
            code: 'AI_PROVIDER_UNAVAILABLE',
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: aiResponse.error || 'Failed to generate a valid learning path curriculum.',
          code: 'AI_GENERATION_FAILED',
        },
        { status: 500 }
      );
    }

    // Return validated learning path to frontend
    return NextResponse.json({
      success: true,
      data: aiResponse.data,
      provider: aiResponse.provider,
    });
  } catch (error: any) {
    console.error('Unhandled learning path generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred during learning path generation.',
        code: 'AI_GENERATION_FAILED',
      },
      { status: 500 }
    );
  }
}
