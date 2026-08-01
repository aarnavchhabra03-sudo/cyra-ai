import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Primary Flash model for high-efficiency AI text generation
const GEMINI_MODEL = 'gemini-2.0-flash-lite';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'GEMINI_API_KEY is not configured in server environment variables.',
        code: 'MISSING_API_KEY',
      },
      { status: 500 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'Reply with exactly: CYRA AI CONNECTED',
    });

    const text = response.text?.trim();

    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error: 'Received empty or malformed response from Gemini API.',
          code: 'MALFORMED_RESPONSE',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: text,
      model: GEMINI_MODEL,
    });
  } catch (error: any) {
    const errString = typeof error === 'string' ? error : JSON.stringify(error) + (error?.message || '');
    const isQuotaExceeded =
      error?.status === 429 ||
      errString.includes('RESOURCE_EXHAUSTED') ||
      errString.includes('Quota exceeded') ||
      errString.includes('429');

    if (isQuotaExceeded) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini API quota exceeded (limit of 0 on free tier / non-billing project)',
          code: 'QUOTA_EXCEEDED',
        },
        { status: 429 }
      );
    }

    console.error('Gemini API test endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to communicate with Gemini API.',
        code: 'GEMINI_ERROR',
      },
      { status: 500 }
    );
  }
}
