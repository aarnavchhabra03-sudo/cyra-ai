import Groq from 'groq-sdk';
import { AIProvider, AIGenerateOptions, AIResponse, AILearningPathResponse } from './types';
import { validateLearningPath, LearningPathGeneration } from '@/types/ai';

// Centralized Groq model definition
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_LEARNING_PATH_INSTRUCTION = `You are CYRA AI, an expert educational curriculum architect.
Your task is to synthesize a structured, personalized learning path for the user's requested goal.

You MUST respond strictly with a valid JSON object adhering to this schema:

{
  "title": "Clear concise learning path title",
  "description": "Comprehensive summary of what this curriculum covers",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimatedWeeks": number (positive integer, e.g. 4),
  "weeklyHours": number (positive integer, e.g. 5),
  "prerequisites": ["List of prerequisite concepts or skills"],
  "learningOutcomes": ["Key skill outcomes the student will master"],
  "modules": [
    {
      "title": "Module 1: Title",
      "description": "Module description",
      "order": 1,
      "estimatedHours": number (positive integer),
      "objectives": ["Module learning objectives"],
      "lessons": [
        {
          "title": "Lesson 1.1: Title",
          "description": "Lesson summary",
          "order": 1,
          "estimatedMinutes": number (positive integer),
          "keyConcepts": ["Key concept 1", "Key concept 2"]
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. Return ONLY the JSON object. Do not include markdown codeblock wrappers like \`\`\`json.
2. Provide at least 3 distinct modules, and each module must contain at least 2 lessons.
3. Ensure 'order' fields start at 1 and increment sequentially.
4. Ensure all numerical fields (estimatedWeeks, weeklyHours, estimatedHours, estimatedMinutes) are positive numbers.
5. 'difficulty' MUST be one of: "beginner", "intermediate", or "advanced".`;

export class GroqProvider implements AIProvider {
  name = 'groq' as const;

  async generateContent(options: AIGenerateOptions): Promise<AIResponse> {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        provider: 'groq',
        model: GROQ_MODEL,
        error: 'GROQ_API_KEY is not configured in environment variables.',
        code: 'MISSING_API_KEY',
      };
    }

    try {
      const groq = new Groq({ apiKey });

      const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];

      if (options.systemInstruction) {
        messages.push({
          role: 'system',
          content: options.systemInstruction,
        });
      }

      messages.push({
        role: 'user',
        content: options.prompt,
      });

      const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
        response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      });

      const content = response.choices[0]?.message?.content?.trim();

      if (!content) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Received empty response from Groq API.',
          code: 'MALFORMED_RESPONSE',
        };
      }

      return {
        success: true,
        message: content,
        provider: 'groq',
        model: GROQ_MODEL,
      };
    } catch (error: any) {
      const errString = typeof error === 'string' ? error : JSON.stringify(error) + (error?.message || '');
      const status = error?.status || error?.statusCode;

      if (status === 401 || errString.includes('Invalid API Key') || errString.includes('unauthorized')) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Invalid Groq API Key.',
          code: 'INVALID_API_KEY',
        };
      }

      if (status === 429 || errString.includes('rate_limit') || errString.includes('Rate limit')) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Groq API rate limit exceeded.',
          code: 'RATE_LIMIT_EXCEEDED',
        };
      }

      console.error('GroqProvider generateContent error:', error?.message || error);

      return {
        success: false,
        provider: 'groq',
        model: GROQ_MODEL,
        error: error?.message || 'Failed to communicate with Groq AI provider.',
        code: 'PROVIDER_ERROR',
      };
    }
  }

  async generateLearningPath(
    prompt: string,
    context?: { experienceLevel?: string; minutesPerDay?: number }
  ): Promise<AILearningPathResponse> {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        provider: 'groq',
        model: GROQ_MODEL,
        error: 'GROQ_API_KEY is not configured in environment variables.',
        code: 'MISSING_API_KEY',
      };
    }

    try {
      const groq = new Groq({ apiKey });

      const userPrompt = `Learning Goal: "${prompt}"
Experience Level Preference: ${context?.experienceLevel || 'beginner'}
Daily Study Time Available: ${context?.minutesPerDay || 30} minutes per day

Synthesize a complete personalized learning path JSON object following the required schema.`;

      const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_LEARNING_PATH_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 3072,
        response_format: { type: 'json_object' },
      });

      const rawContent = response.choices[0]?.message?.content?.trim();

      if (!rawContent) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Received empty response from Groq AI provider.',
          code: 'EMPTY_RESPONSE',
        };
      }

      // Parse JSON output
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawContent);
      } catch (jsonErr) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Failed to parse JSON output from Groq LLM.',
          code: 'JSON_PARSE_ERROR',
        };
      }

      // Validate runtime schema with Zod
      try {
        const validatedPath: LearningPathGeneration = validateLearningPath(parsedJson);

        return {
          success: true,
          data: validatedPath,
          provider: 'groq',
          model: GROQ_MODEL,
        };
      } catch (validationErr: any) {
        console.error('Learning path validation error:', validationErr);
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: `AI output validation failed: ${validationErr.message}`,
          code: 'VALIDATION_ERROR',
        };
      }
    } catch (error: any) {
      const status = error?.status || error?.statusCode;
      if (status === 429) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Groq API rate limit exceeded.',
          code: 'RATE_LIMIT_EXCEEDED',
        };
      }

      return {
        success: false,
        provider: 'groq',
        model: GROQ_MODEL,
        error: error?.message || 'Failed to generate learning path.',
        code: 'PROVIDER_ERROR',
      };
    }
  }
}
