import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  AIGenerateOptions,
  AIResponse,
  AILearningPathResponse,
  GenerateLearningPathOptions,
  GenerateStudyNotesOptions,
  AIStudyNotesResponse,
  GenerateResourcePlanOptions,
  AIResourcePlanResponse,
  GenerateQuizOptions,
  AIQuizResponse
} from './types';
import { validateLearningPath, LearningPathGeneration } from '@/types/ai';
import { validateStudyNotes, validateResourcePlan, validateQuizData } from './groq';

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
        contents: `Generate a personalized learning path JSON for topic "${options.topic}" (Difficulty: ${options.experienceLevel}, Goal: ${options.goal}, Minutes/day: ${options.minutesPerDay}).
You MUST respond strictly with a valid JSON object matching this exact schema structure:
{
  "title": "Learning path title",
  "description": "Engaging description",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimatedWeeks": 4,
  "weeklyHours": 5,
  "prerequisites": ["Prereq 1"],
  "learningOutcomes": ["Outcome 1"],
  "modules": [
    {
      "title": "Module Title",
      "description": "Module description",
      "order": 1,
      "estimatedHours": 10,
      "objectives": ["Objective 1"],
      "lessons": [
        {
          "title": "Lesson Title",
          "description": "Lesson description",
          "order": 1,
          "estimatedMinutes": 45,
          "keyConcepts": ["Concept 1"]
        }
      ]
    }
  ]
}`,
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

  async generateStudyNotes(
    options: GenerateStudyNotesOptions
  ): Promise<AIStudyNotesResponse> {
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
        contents: `Generate structured study notes JSON for lesson "${options.lessonTitle}" in course "${options.courseTitle || ''}" (${options.moduleTitle || ''}). Include JSON object with keys: overview (string), explanation (string), key_concepts (array of strings), examples (array of strings), important_points (array of strings), quick_revision (string).`,
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
      if (!validateStudyNotes(parsed)) {
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'AI response failed study notes validation.',
          code: 'VALIDATION_ERROR',
        };
      }

      return {
        success: true,
        data: parsed,
        provider: 'gemini',
        model: GEMINI_MODEL,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: error?.message || 'Gemini study notes generation failed.',
        code: 'PROVIDER_ERROR',
      };
    }
  }

  async generateResourcePlan(
    options: GenerateResourcePlanOptions
  ): Promise<AIResourcePlanResponse> {
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
        contents: `Generate structured resource discovery plan JSON for lesson "${options.lessonTitle}" in course "${options.courseTitle || ''}". Include JSON object with key "resources" containing array of objects with keys: title, resource_type, source, description, duration, difficulty, is_recommended, search_query.`,
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
      if (!validateResourcePlan(parsed)) {
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'AI response failed resource plan validation.',
          code: 'VALIDATION_ERROR',
        };
      }

      return {
        success: true,
        data: parsed,
        provider: 'gemini',
        model: GEMINI_MODEL,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: error?.message || 'Gemini resource plan generation failed.',
        code: 'PROVIDER_ERROR',
      };
    }
  }

  async generateQuiz(
    options: GenerateQuizOptions
  ): Promise<AIQuizResponse> {
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
        contents: `Generate a 5-question quiz JSON for lesson "${options.lessonTitle}" in course "${options.courseTitle || ''}". Include JSON with "quiz" (title, description, difficulty, estimated_minutes, passing_score) and "questions" (array of 5 objects with question_order, question_type, question_text, options [{id, text}], correct_answer {option_id}, explanation, concept, difficulty, points).`,
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
      if (!validateQuizData(parsed)) {
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'AI response failed quiz validation.',
          code: 'VALIDATION_ERROR',
        };
      }

      return {
        success: true,
        data: parsed,
        provider: 'gemini',
        model: GEMINI_MODEL,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: error?.message || 'Gemini quiz generation failed.',
        code: 'PROVIDER_ERROR',
      };
    }
  }
}
