import Groq from 'groq-sdk';
import {
  AIProvider,
  AIGenerateOptions,
  AIResponse,
  AILearningPathResponse,
  GenerateLearningPathOptions,
  GenerateStudyNotesOptions,
  AIStudyNotesResponse,
  StudyNotesData,
  GenerateResourcePlanOptions,
  AIResourcePlanResponse,
  ResourcePlanData,
  GenerateQuizOptions,
  AIQuizResponse,
  GeneratedQuizData
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

export function validateResourcePlan(data: any): data is ResourcePlanData {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.resources) || data.resources.length === 0) return false;

  const validTypes = ['article', 'documentation', 'textbook', 'video', 'practice', 'reference'];

  for (const item of data.resources) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.title !== 'string' || !item.title.trim()) return false;
    if (typeof item.resource_type !== 'string' || !validTypes.includes(item.resource_type.toLowerCase())) return false;
    if (typeof item.source !== 'string' || !item.source.trim()) return false;
    if (typeof item.description !== 'string' || !item.description.trim()) return false;
    if (typeof item.search_query !== 'string' || !item.search_query.trim()) return false;
  }

  return true;
}

export function validateQuizData(data: any): data is GeneratedQuizData {
  if (!data || typeof data !== 'object') return false;
  if (!data.quiz || typeof data.quiz !== 'object') return false;

  const { title, description, difficulty, estimated_minutes, passing_score } = data.quiz;
  if (typeof title !== 'string' || !title.trim()) return false;
  if (typeof description !== 'string' || !description.trim()) return false;
  if (!['beginner', 'intermediate', 'advanced'].includes(String(difficulty).toLowerCase())) return false;
  if (typeof estimated_minutes !== 'number' || estimated_minutes <= 0) return false;
  if (typeof passing_score !== 'number' || passing_score <= 0 || passing_score > 100) return false;

  if (!Array.isArray(data.questions) || data.questions.length < 5 || data.questions.length > 10) return false;

  const seenOrders = new Set<number>();

  for (const q of data.questions) {
    if (!q || typeof q !== 'object') return false;
    if (typeof q.question_order !== 'number' || seenOrders.has(q.question_order)) return false;
    seenOrders.add(q.question_order);

    const type = String(q.question_type).toLowerCase();
    if (!['multiple_choice', 'true_false'].includes(type)) return false;

    if (typeof q.question_text !== 'string' || !q.question_text.trim()) return false;
    if (typeof q.explanation !== 'string' || !q.explanation.trim()) return false;

    if (!Array.isArray(q.options) || q.options.length < 2) return false;

    const optionIds = q.options.map((opt: any) => opt?.id);
    for (const opt of q.options) {
      if (!opt || typeof opt !== 'object') return false;
      if (typeof opt.id !== 'string' || !opt.id.trim()) return false;
      if (typeof opt.text !== 'string' || !opt.text.trim()) return false;
    }

    if (!q.correct_answer || typeof q.correct_answer !== 'object') return false;
    const correctOptId = q.correct_answer.option_id;
    if (!correctOptId || !optionIds.includes(correctOptId)) return false;
  }

  return true;
}

const SYSTEM_CURRICULUM_ARCHITECT_INSTRUCTION = `You are CYRA AI, an elite curriculum architect and master educator.
Your sole mission is to synthesize deeply tailored, highly personalized, and structurally distinct learning paths.`;

const SYSTEM_STUDY_NOTES_INSTRUCTION = `You are CYRA AI, a master educator and academic study notes synthesizer.
Your mission is to generate a comprehensive, highly structured, beginner-friendly study guide for a specific lesson topic.`;

const SYSTEM_RESOURCE_PLANNER_INSTRUCTION = `You are CYRA AI, an expert educational resource curator.
Your mission is to generate a high-quality, balanced Resource Discovery Plan for a specific lesson topic.`;

const SYSTEM_QUIZ_ARCHITECT_INSTRUCTION = `You are CYRA AI, an expert academic assessment designer.
Your mission is to synthesize a high-quality, 5-to-8 question quiz strictly based on the lesson's core concepts, content, and learning goals.

CRITICAL MANDATE:
Mix question types across 'multiple_choice' (4 options with IDs "A", "B", "C", "D") and 'true_false' (2 options with IDs "true", "false").
Questions must cover definitions, core concepts, applications, misconceptions, and simple reasoning.
Never repeat the same concept across multiple questions.

You MUST respond strictly with a valid raw JSON object matching this exact schema (NO markdown codeblock wrappers like \`\`\`json):

{
  "quiz": {
    "title": "Compelling, clear title for this lesson quiz",
    "description": "2-3 sentence overview explaining what skills/concepts this quiz assesses",
    "difficulty": "beginner" | "intermediate" | "advanced",
    "estimated_minutes": 5,
    "passing_score": 70
  },
  "questions": [
    {
      "question_order": 1,
      "question_type": "multiple_choice",
      "question_text": "Clear, precise question statement",
      "options": [
        { "id": "A", "text": "First choice" },
        { "id": "B", "text": "Second choice" },
        { "id": "C", "text": "Third choice" },
        { "id": "D", "text": "Fourth choice" }
      ],
      "correct_answer": {
        "option_id": "B"
      },
      "explanation": "Thorough, educational explanation of why option B is correct and others are incorrect",
      "concept": "specific micro-concept tested e.g. array indexing",
      "difficulty": "beginner",
      "points": 1
    }
  ]
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

  async generateResourcePlan(
    options: GenerateResourcePlanOptions
  ): Promise<AIResourcePlanResponse> {
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

      const userPrompt = `Synthesize a Resource Discovery Plan for:
Course: "${options.courseTitle || 'General Course'}" (${options.experienceLevel || 'beginner'} level)
Module: "${options.moduleTitle || 'General Module'}"
Lesson Title: "${options.lessonTitle}"
Lesson Description / Context: "${options.lessonDescription || options.lessonContent || 'Core fundamentals'}"

Generate a balanced list of 5 to 7 resources strictly matching the JSON schema.`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_RESOURCE_PLANNER_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        model: GROQ_MODEL,
        temperature: 0.6,
        max_tokens: 2048,
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
        console.error('Failed to parse Resource Plan JSON:', rawContent);
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'AI returned malformed non-JSON output.',
          code: 'INVALID_JSON',
        };
      }

      if (!validateResourcePlan(parsedJson)) {
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'AI response failed resource plan schema validation.',
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
        error: error?.message || 'Failed to generate resource discovery plan.',
        code: 'PROVIDER_ERROR',
      };
    }
  }

  async generateQuiz(
    options: GenerateQuizOptions
  ): Promise<AIQuizResponse> {
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

      const userPrompt = `Synthesize a 5 to 8 question quiz for:
Course Title: "${options.courseTitle || 'General Course'}" (Level: ${options.experienceLevel || 'beginner'})
Module Title: "${options.moduleTitle || 'General Module'}"
Lesson Title: "${options.lessonTitle}"
Lesson Description / Scope: "${options.lessonDescription || options.lessonContent || 'Core fundamentals'}"
${options.keyConcepts ? `Key Concepts: ${options.keyConcepts.join(', ')}` : ''}

Generate a complete, structured Quiz JSON strictly adhering to the system schema.`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_QUIZ_ARCHITECT_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        model: GROQ_MODEL,
        temperature: 0.6,
        max_tokens: 3500,
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
        console.error('Failed to parse Quiz JSON:', rawContent);
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'AI returned malformed non-JSON output.',
          code: 'INVALID_JSON',
        };
      }

      if (!validateQuizData(parsedJson)) {
        console.error('[GROQ QUIZ] Validation failed for payload:', parsedJson);
        return {
          success: false,
          provider: 'groq',
          model: GROQ_MODEL,
          error: 'AI response failed quiz schema validation.',
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
        error: error?.message || 'Failed to generate quiz.',
        code: 'PROVIDER_ERROR',
      };
    }
  }
}
