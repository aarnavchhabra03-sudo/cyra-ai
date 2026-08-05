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
import {
  validateLearningPath,
  LearningPathGeneration,
  validateStudyNotesObject,
  validateResourcePlanObject,
  validateQuizDataObject,
  ResourcePlanSchema,
  normalizeResourcePlanOutput,
  LearningPathGenerationSchema,
  normalizeLearningPathOutput,
  StudyNotesSchema,
  normalizeStudyNotesOutput,
  GeneratedQuizSchema,
  normalizeQuizOutput
} from '@/types/ai';
import { validateQuizData } from './groq';

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

      let parsed: any;
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch (err) {
        console.error('Failed to parse Learning Path JSON:', rawText);
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'AI returned malformed non-JSON output.',
          code: 'INVALID_JSON',
        };
      }

      // First validation attempt
      const normalized = normalizeLearningPathOutput(parsed);
      const firstParseResult = LearningPathGenerationSchema.safeParse(normalized);

      let finalParsed = parsed;

      if (!firstParseResult.success) {
        console.warn('[GEMINI LEARNING PATH] First validation failed. Running repair retry...', firstParseResult.error.message);
        
        // Repair Prompt
        const repairPrompt = `The previous JSON response did not satisfy the LearningPath schema.
Validation errors:
${JSON.stringify(firstParseResult.error.format(), null, 2)}

Original invalid JSON output:
${JSON.stringify(parsed, null, 2)}

Repair this JSON to satisfy the LearningPath schema.
Do not change valid semantic content.
Return JSON only.`;

        try {
          const repairResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: repairPrompt,
          });
          const repairRawText = repairResponse.text?.trim();
          if (repairRawText) {
            finalParsed = JSON.parse(repairRawText.replace(/```json|```/g, '').trim());
          }
        } catch (repairErr: any) {
          console.error('[GEMINI LEARNING PATH] Repair attempt failed:', repairErr.message);
        }
      }

      try {
        const validated = validateLearningPath(finalParsed);
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
          error: error?.message || 'Gemini learning path validation failed.',
          code: 'VALIDATION_ERROR',
        };
      }
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
        contents: `Generate structured study notes JSON for lesson "${options.lessonTitle}" in course "${options.courseTitle || ''}" (${options.moduleTitle || ''}).
You MUST respond strictly with a valid JSON object matching this exact schema:
{
  "overview": "Clear 2-3 sentence overview introducing the lesson topic.",
  "explanation": "Detailed conceptual explanation including key components, architecture, and principles.",
  "key_concepts": ["Concept Name 1", "Concept Name 2"],
  "examples": ["Practical example 1 illustrating the concept", "Real-world analogy or implementation"],
  "important_points": ["Critical takeaway or fact 1", "Common misconception to watch out for"],
  "quick_revision": "A bulleted or paragraph summary for fast review before assessments."
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

      let parsed: any;
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch (err) {
        console.error('Failed to parse Study Notes JSON:', rawText);
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'AI returned malformed non-JSON output.',
          code: 'INVALID_JSON',
        };
      }

      // First validation attempt
      const normalized = normalizeStudyNotesOutput(parsed);
      const firstParseResult = StudyNotesSchema.safeParse(normalized);

      let finalParsed = parsed;

      if (!firstParseResult.success) {
        console.warn('[GEMINI STUDY NOTES] First validation failed. Running repair retry...', firstParseResult.error.message);
        
        // Repair Prompt
        const repairPrompt = `The previous JSON response did not satisfy the StudyNotes schema.
Validation errors:
${JSON.stringify(firstParseResult.error.format(), null, 2)}

Original invalid JSON output:
${JSON.stringify(parsed, null, 2)}

Repair this JSON to satisfy the StudyNotes schema.
Do not change valid semantic content.
Return JSON only.`;

        try {
          const repairResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: repairPrompt,
          });
          const repairRawText = repairResponse.text?.trim();
          if (repairRawText) {
            finalParsed = JSON.parse(repairRawText.replace(/```json|```/g, '').trim());
          }
        } catch (repairErr: any) {
          console.error('[GEMINI STUDY NOTES] Repair attempt failed:', repairErr.message);
        }
      }

      try {
        const validatedNotes = validateStudyNotesObject(finalParsed);
        return {
          success: true,
          data: validatedNotes,
          provider: 'gemini',
          model: GEMINI_MODEL,
        };
      } catch (validationErr: any) {
        console.error('Study notes validation error:', validationErr);
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: validationErr.message || 'AI response failed study notes validation.',
          code: 'VALIDATION_ERROR',
        };
      }
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

      const userPrompt = `You are CYRA AI, an expert educational resource curator.
Your mission is to generate a high-quality, balanced Resource Discovery Plan for:
Course: "${options.courseTitle || 'General Course'}" (${options.experienceLevel || 'beginner'} level)
Module: "${options.moduleTitle || 'General Module'}"
Lesson Title: "${options.lessonTitle}"
Lesson Description / Context: "${options.lessonDescription || options.lessonContent || 'Core fundamentals'}"

You MUST respond strictly with a valid JSON object matching this exact schema:
{
  "resources": [
    {
      "title": "Clear, informative title for this external resource",
      "resource_type": "article" | "documentation" | "textbook" | "video" | "practice" | "reference",
      "source": "Expected site or organization source e.g. Khan Academy, MDN Web Docs, YouTube",
      "description": "Engaging, thorough description of what the resource contains and why it helps",
      "duration": "e.g. 10 mins, 45 mins, 2 hours",
      "difficulty": "beginner" | "intermediate" | "advanced",
      "is_recommended": true | false,
      "search_query": "specific, topic-targeted search phrase used to discover this resource"
    }
  ]
}

CRITICAL REQUIREMENT:
- Every resource object in the "resources" array MUST contain a "search_query" field.
- The "search_query" must be a meaningful, topic-specific discovery phrase useful for web search APIs (e.g., "data communication components sender receiver channel tutorial" instead of just "tutorial" or matching the title exactly).
- "search_query" must NOT be empty or null.
- "is_recommended" should be true for the top 1-2 resources that are most critical.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: userPrompt,
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

      let parsed: any;
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch (err) {
        console.error('Failed to parse Resource Plan JSON:', rawText);
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'AI returned malformed non-JSON output.',
          code: 'INVALID_JSON',
        };
      }

      // First validation attempt
      const normalized = normalizeResourcePlanOutput(parsed);
      const firstParseResult = ResourcePlanSchema.safeParse(normalized);

      let finalParsed = parsed;

      if (!firstParseResult.success) {
        console.warn('[GEMINI RESOURCE PLAN] First validation failed. Running repair retry...', firstParseResult.error.message);
        
        // Repair Prompt
        const repairPrompt = `The previous JSON response did not satisfy the ResourcePlan schema.
Validation errors:
${JSON.stringify(firstParseResult.error.format(), null, 2)}

Original invalid JSON output:
${JSON.stringify(parsed, null, 2)}

Repair this JSON to satisfy the ResourcePlan schema.
Do not change valid semantic content.
Populate every required search_query with a meaningful discovery query based on that resource.
Return JSON only.`;

        try {
          const repairResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: repairPrompt,
          });
          const repairRawText = repairResponse.text?.trim();
          if (repairRawText) {
            finalParsed = JSON.parse(repairRawText.replace(/```json|```/g, '').trim());
          }
        } catch (repairErr: any) {
          console.error('[GEMINI RESOURCE PLAN] Repair attempt failed:', repairErr.message);
        }
      }

      try {
        const validatedPlan = validateResourcePlanObject(finalParsed);
        return {
          success: true,
          data: validatedPlan,
          provider: 'gemini',
          model: GEMINI_MODEL,
        };
      } catch (validationErr: any) {
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: validationErr.message || 'AI response failed resource plan validation.',
          code: 'VALIDATION_ERROR',
        };
      }
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

      let parsed: any;
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch (err) {
        console.error('Failed to parse Quiz JSON:', rawText);
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: 'AI returned malformed non-JSON output.',
          code: 'INVALID_JSON',
        };
      }

      // First validation attempt
      const normalized = normalizeQuizOutput(parsed);
      const firstParseResult = GeneratedQuizSchema.safeParse(normalized);

      let finalParsed = parsed;

      if (!firstParseResult.success) {
        console.warn('[GEMINI QUIZ] First validation failed. Running repair retry...', firstParseResult.error.message);
        
        // Repair Prompt
        const repairPrompt = `The previous JSON response did not satisfy the Quiz schema.
Validation errors:
${JSON.stringify(firstParseResult.error.format(), null, 2)}

Original invalid JSON output:
${JSON.stringify(parsed, null, 2)}

Repair this JSON to satisfy the Quiz schema.
Do not change valid semantic content.
Return JSON only.`;

        try {
          const repairResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: repairPrompt,
          });
          const repairRawText = repairResponse.text?.trim();
          if (repairRawText) {
            finalParsed = JSON.parse(repairRawText.replace(/```json|```/g, '').trim());
          }
        } catch (repairErr: any) {
          console.error('[GEMINI QUIZ] Repair attempt failed:', repairErr.message);
        }
      }

      try {
        const validatedQuiz = validateQuizDataObject(finalParsed);
        return {
          success: true,
          data: validatedQuiz,
          provider: 'gemini',
          model: GEMINI_MODEL,
        };
      } catch (validationErr: any) {
        return {
          success: false,
          provider: 'gemini',
          model: GEMINI_MODEL,
          error: validationErr.message || 'AI response failed quiz validation.',
          code: 'VALIDATION_ERROR',
        };
      }
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
