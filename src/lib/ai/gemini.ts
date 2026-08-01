import { GoogleGenAI } from '@google/genai';
import { AIProvider, AIGenerateOptions, AIResponse } from './types';

export const GEMINI_MODEL = 'gemini-2.0-flash-lite';

export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;

  async generateContent(options: AIGenerateOptions): Promise<AIResponse> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: 'GEMINI_API_KEY is not configured in environment variables.',
        code: 'MISSING_API_KEY',
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: options.prompt,
      });

      const text = response.text?.trim();

      if (!text) {
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'Received empty response from Gemini API.',
          code: 'MALFORMED_RESPONSE',
        };
      }

      return {
        success: true,
        message: text,
        provider: 'gemini',
        model: GEMINI_MODEL,
      };
    } catch (error: any) {
      const errString = typeof error === 'string' ? error : JSON.stringify(error) + (error?.message || '');
      const isQuota = error?.status === 429 || errString.includes('RESOURCE_EXHAUSTED');

      if (isQuota) {
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'Gemini API quota exceeded',
          code: 'QUOTA_EXCEEDED',
        };
      }

      return {
        success: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: error?.message || 'Failed to communicate with Gemini API.',
        code: 'PROVIDER_ERROR',
      };
    }
  }
}
