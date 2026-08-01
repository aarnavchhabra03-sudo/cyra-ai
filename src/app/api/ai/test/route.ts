import { NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';

export async function GET() {
  const provider = getAIProvider();

  try {
    const response = await provider.generateContent({
      prompt: 'Reply with exactly: CYRA AI CONNECTED',
      temperature: 0.1,
    });

    if (!response.success) {
      const statusCode = response.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 500;
      return NextResponse.json(
        {
          success: false,
          error: response.error || 'AI Provider returned an error.',
          provider: response.provider,
          code: response.code || 'AI_ERROR',
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      message: response.message,
      provider: response.provider,
    });
  } catch (error: any) {
    console.error('AI Test endpoint unhandled exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'An unexpected error occurred testing AI provider.',
        provider: provider.name,
        code: 'UNHANDLED_EXCEPTION',
      },
      { status: 500 }
    );
  }
}
