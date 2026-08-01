import { GoogleGenAI } from '@google/genai';
import { AIProvider, AIGenerateOptions, AIResponse, AILearningPathResponse, GenerateLearningPathOptions } from './types';
import { validateLearningPath, LearningPathGeneration } from '@/types/ai';

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

  async generateLearningPath(
    options: GenerateLearningPathOptions
  ): Promise<AILearningPathResponse> {
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
        contents: `Generate a personalized learning path JSON for topic "${options.topic}" (Difficulty: ${options.experienceLevel}, Goal: ${options.goal}, Minutes/day: ${options.minutesPerDay}). Include title, description, difficulty, estimatedWeeks, weeklyHours, prerequisites, learningOutcomes, modules (with title, description, order, estimatedHours, objectives, lessons).`,
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'Empty response from Gemini.',
          code: 'EMPTY_RESPONSE',
        };
      }

      const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      const validated = validateLearningPath(parsed);

      return {
        success: true,
        data: validated,
        provider: 'gemini',
        model: GEMINI_MODEL,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: error?.message || 'Gemini learning path generation failed.',
        code: 'PROVIDER_ERROR',
      };
    }
  }
}
