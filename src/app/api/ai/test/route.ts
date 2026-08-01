import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'GEMINI_API_KEY is not configured in server environment variables.',
      },
      { status: 500 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Reply with exactly: CYRA AI CONNECTED',
    });

    const text = response.text?.trim();

    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error: 'Received empty response from Gemini API.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: text,
    });
  } catch (error: any) {
    console.error('Gemini API test endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to communicate with Gemini API.',
      },
      { status: 500 }
    );
  }
}
