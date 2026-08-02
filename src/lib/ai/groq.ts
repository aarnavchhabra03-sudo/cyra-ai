import Groq from 'groq-sdk';
import {
  AIProvider,
  AIGenerateOptions,
  AIResponse,
  AILearningPathResponse,
  GenerateLearningPathOptions,
  GenerateStudyNotesOptions,
  AIStudyNotesResponse,
  StudyNotesData
} from './types';
import { validateLearningPath, LearningPathGeneration } from '@/types/ai';

// Centralized Groq model definition
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

export function validateStudyNotes(data: any): data is StudyNotesData {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.overview !== 'string' || !data.overview.trim()) return false;
  if (typeof data.explanation !== 'string' || !data.explanation.trim()) return false;
  if (typeof data.quick_revision !== 'string' || !data.quick_revision.trim()) return false;
  if (!Array.isArray(data.key_concepts) || data.key_concepts.length === 0) return false;
  if (!Array.isArray(data.examples)) return false;
  if (!Array.isArray(data.important_points) || data.important_points.length === 0) return false;

  return true;
}

const SYSTEM_CURRICULUM_ARCHITECT_INSTRUCTION = `You are CYRA AI, an elite curriculum architect and master educator.
Your sole mission is to synthesize deeply tailored, highly personalized, and structurally distinct learning paths.

CRITICAL MANDATE:
The curriculum MUST change SIGNIFICANTLY in structure, module selection, lesson depth, exercise type, and pacing based on the user's experience level, learning goal, daily study commitment, target date, and subject category.

==================================================
JSON RESPONSE SCHEMA (STRICT REQUIREMENT)
==================================================
You MUST respond strictly with a valid raw JSON object (NO markdown codeblock wrappers like \`\`\`json):

{
  "title": "Clear, compelling, highly customized title for the learning path",
  "description": "Comprehensive 2-3 sentence overview explaining how this curriculum specifically achieves the user's unique experience level and learning goal",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimatedWeeks": number (positive integer),
  "weeklyHours": number (positive integer),
  "prerequisites": ["List of prerequisite concepts or skills matching user's starting point"],
  "learningOutcomes": ["Key measurable skill outcomes the student will master"],
  "modules": [
    {
      "title": "Module 1: Title",
      "description": "Module overview focusing on target objectives and goal alignment",
      "order": 1,
      "estimatedHours": number (positive integer),
      "objectives": ["Specific module learning objectives"],
      "lessons": [
        {
          "title": "Lesson 1.1: Title",
          "description": "Detailed lesson summary and scope",
          "order": 1,
          "estimatedMinutes": number (positive integer),
          "keyConcepts": ["Key concept 1", "Key concept 2"]
        }
      ]
    }
  ]
}
`;

const SYSTEM_STUDY_NOTES_INSTRUCTION = `You are CYRA AI, a master educator and academic study notes synthesizer.
Your mission is to generate a comprehensive, highly structured, beginner-friendly study guide for a specific lesson topic.

CRITICAL MANDATE:
You MUST respond strictly with a valid raw JSON object matching this exact schema (NO markdown codeblock wrappers like \`\`\`json):

{
  "overview": "Clear 2-3 sentence introduction explaining what this topic is and why it matters.",
  "explanation": "Detailed, comprehensive, beginner-friendly explanation covering core principles, architecture, and step-by-step logic. Use clear paragraphs and thorough educational explanations.",
  "key_concepts": [
    "3 to 7 key conceptual terms or definitions"
  ],
  "examples": [
    "2 to 5 clear practical examples, code snippets, or real-world scenarios demonstrating the topic"
  ],
  "important_points": [
    "3 to 7 high-value exam, interview, or technical revision points"
  ],
  "quick_revision": "A compact 2-4 sentence summary for rapid pre-exam review."
}
`;

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

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

      if (options.systemInstruction) {
        messages.push({ role: 'system', content: options.systemInstruction });
      }

      messages.push({ role: 'user', content: options.prompt });

      const completion = await groq.chat.completions.create({
        messages,
        model: GROQ_MODEL,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      });

      const choice = completion.choices[0];
      const messageContent = choice?.message?.content?.trim();

      if (!messageContent) {
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
        message: messageContent,
        provider: 'groq',
        model: GROQ_MODEL,
      };
    } catch (error: any) {
      console.error('Groq API error:', error);

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

      if (status === 401) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Invalid Groq API Key.',
          code: 'INVALID_API_KEY',
        };
      }

      return {
        success: false,
        provider: 'groq',
        model: GROQ_MODEL,
        error: error?.message || 'Failed to communicate with Groq API.',
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

      const userPrompt = `Synthesize a personalized learning path for:
Topic: "${options.topic}"
Experience Level: ${options.experienceLevel}
Goal: ${options.goal}
Daily Study Commitment: ${options.minutesPerDay} minutes/day
${options.targetDate ? `Target Completion Date: ${options.targetDate}` : ''}

Generate a complete, structured curriculum JSON matching the system schema strictly.`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_CURRICULUM_ARCHITECT_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const rawContent = completion.choices[0]?.message?.content?.trim();

      if (!rawContent) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Empty response returned from Groq AI API.',
          code: 'EMPTY_RESPONSE',
        };
      }

      const cleanJson = rawContent
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.error('Failed to parse AI JSON:', rawContent);
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'AI returned malformed non-JSON output.',
          code: 'INVALID_JSON',
        };
      }

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

  async generateStudyNotes(
    options: GenerateStudyNotesOptions
  ): Promise<AIStudyNotesResponse> {
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

      const userPrompt = `Synthesize comprehensive AI study notes for:
Course: "${options.courseTitle || 'Computer Science'}" (Level: ${options.experienceLevel || 'beginner'})
Module: "${options.moduleTitle || 'General Module'}"
Lesson Title: "${options.lessonTitle}"
Lesson Description / Scope: "${options.lessonDescription || options.lessonContent || 'Core fundamentals'}"

Generate structured study notes strictly adhering to the JSON schema.`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_STUDY_NOTES_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        model: GROQ_MODEL,
        temperature: 0.6,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const rawContent = completion.choices[0]?.message?.content?.trim();

      if (!rawContent) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'Empty response returned from Groq AI API.',
          code: 'EMPTY_RESPONSE',
        };
      }

      const cleanJson = rawContent
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.error('Failed to parse Study Notes JSON:', rawContent);
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'AI returned malformed non-JSON output.',
          code: 'INVALID_JSON',
        };
      }

      if (!validateStudyNotes(parsedJson)) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'AI response failed study notes schema validation.',
          code: 'VALIDATION_ERROR',
        };
      }

      return {
        success: true,
        data: parsedJson,
        provider: 'groq',
        model: GROQ_MODEL,
      };
    } catch (error: any) {
      const status = error?.status || error?.statusCode;
      if (status === 429) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'AI provider rate limit reached.',
          code: 'RATE_LIMIT_EXCEEDED',
        };
      }

      return {
        success: false,
        provider: 'groq',
        model: GROQ_MODEL,
        error: error?.message || 'Failed to generate study notes.',
        code: 'PROVIDER_ERROR',
      };
    }
  }
}
