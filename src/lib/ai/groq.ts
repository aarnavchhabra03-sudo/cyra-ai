import Groq from 'groq-sdk';
import { AIProvider, AIGenerateOptions, AIResponse, AILearningPathResponse, GenerateLearningPathOptions } from './types';
import { validateLearningPath, LearningPathGeneration } from '@/types/ai';

// Centralized Groq model definition
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_CURRICULUM_ARCHITECT_INSTRUCTION = `You are CYRA AI, an elite curriculum architect and AI tutor.
Your role is to design highly tailored, realistic, and high-impact learning paths.

You MUST respond strictly with a valid JSON object matching this schema:

{
  "title": "Clear, compelling title for the personalized learning path",
  "description": "2-3 sentence overview explaining how this curriculum achieves the user's specific learning goal",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimatedWeeks": number (positive integer, e.g. 4),
  "weeklyHours": number (positive integer, e.g. 5),
  "prerequisites": ["List of essential prerequisite knowledge or skills"],
  "learningOutcomes": ["Key measurable skill outcomes the student will master"],
  "modules": [
    {
      "title": "Module 1: Title",
      "description": "Module overview focusing on target objectives",
      "order": 1,
      "estimatedHours": number (positive integer),
      "objectives": ["Specific module learning objectives"],
      "lessons": [
        {
          "title": "Lesson 1.1: Title",
          "description": "Lesson summary and scope",
          "order": 1,
          "estimatedMinutes": number (positive integer),
          "keyConcepts": ["Key concept 1", "Key concept 2"]
        }
      ]
    }
  ]
}

PERSONALIZATION & GOAL ORIENTATION RULES:
1. If Goal is "Exam Preparation": Emphasize core syllabus coverage, fundamental principles, revision checkpoints, and problem-solving mastery.
2. If Goal is "Interview Preparation": Emphasize high-frequency interview questions, system design/algorithmic reasoning, trade-off analysis, and technical communication.
3. If Goal is "Build a Project": Emphasize hands-on building, architecture design, practical implementation milestones, and real-world deployment.
4. If Goal is "Career Development": Emphasize industry-standard practices, production-ready tools, workflow efficiency, and career-relevant technical skills.
5. If Goal is "General Learning": Balance conceptual depth with practical understanding.

EXPERIENCE LEVEL RULES:
- "beginner": Start with foundational concepts, clear prerequisites, and gentle learning curve.
- "intermediate": Skip elementary basics; focus on practical patterns, architecture, and intermediate techniques.
- "advanced": Deep-dive into internal mechanisms, performance optimization, edge cases, and advanced design principles.

CURRICULUM QUALITY CONSTRAINTS:
1. Aim for 4 to 8 modules total.
2. Each module MUST contain between 3 to 6 lessons.
3. Return ONLY valid raw JSON. Do NOT wrap output in \`\`\`json markdown blocks.
4. All 'order' fields must start at 1 and increment sequentially.
5. All time estimations (weeks, hours, minutes) must be positive integers matching the user's available daily time.`;

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
    options: GenerateLearningPathOptions
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

      const userPrompt = `Learning Topic: "${options.topic}"
Experience Level: ${options.experienceLevel}
Primary Goal: ${options.goal}
Daily Study Commitment: ${options.minutesPerDay} minutes/day
${options.targetDate ? `Target Completion Date: ${options.targetDate}` : ''}

Synthesize a custom learning path JSON adhering to the specified schema.`;

      const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_CURRICULUM_ARCHITECT_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 3500,
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
