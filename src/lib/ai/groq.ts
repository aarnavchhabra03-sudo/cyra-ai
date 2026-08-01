import Groq from 'groq-sdk';
import { AIProvider, AIGenerateOptions, AIResponse, AILearningPathResponse, GenerateLearningPathOptions } from './types';
import { validateLearningPath, LearningPathGeneration } from '@/types/ai';

// Centralized Groq model definition
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

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

==================================================
1. EXPERIENCE LEVEL STRUCTURAL RULES
==================================================
- "beginner":
  * Assume little/no prior knowledge.
  * Start with fundamental terminology, core mental models, and prerequisites before advanced topics.
  * Avoid unexplained technical jargon. Progress gradually with clear conceptual examples.
  * Prioritize foundational understanding over optimization or complex theory.

- "intermediate":
  * Assume understanding of basics. Skip elementary introductions.
  * Briefly review essential prerequisites, then rapidly move into deeper concepts and relationships.
  * Emphasize practical applications, problem-solving patterns, and implementation trade-offs.

- "advanced":
  * Skip basic introductory lessons entirely.
  * Focus on architecture, internal mechanisms, low-level mechanics, design decisions, and system trade-offs.
  * Include performance optimization, edge cases, debugging, real-world engineering challenges, and systems thinking.

==================================================
2. GOAL-BASED ARCHITECTURE RULES
==================================================
- "General Learning":
  * 60% conceptual understanding, 25% practical application, 15% review.
  * Comprehensive, logical coverage of the subject without specializing too heavily.

- "Exam Preparation":
  * Prioritize fundamental definitions, core formulas/theorems, commonly examined topics, conceptual differences, and practice.
  * Later modules MUST be structured specifically around: Revision, Important Exam Concepts, Practice Questions, and Mock Exam Prep.
  * Avoid spending time on industry-specific tool configurations unless academically relevant.

- "Interview Preparation":
  * Prioritize high-frequency interview questions, conceptual comparisons (e.g. Process vs Thread), "Why" trade-offs, scenario reasoning, and common misconceptions.
  * Lessons MUST prepare learners to EXPLAIN concepts clearly and communicate technical trade-offs.
  * Later modules MUST include Interview Practice, Technical Communication, and Mock Problem Solving.

- "Build a Project":
  * Structure curriculum progressively: Fundamentals → Core Concepts → Implementation Skills → System Components → Integration → Project Milestones → Final Project.
  * Lessons MUST result in something being built, implemented, tested, or integrated. Avoid passive theory overload.

- "Career Development":
  * Prioritize industry-standard tools, production practices, architectural patterns, debugging, performance tuning, and real-world workflows.
  * Connect every theoretical concept directly to how senior professionals apply it in production.

==================================================
3. DAILY STUDY TIME & PACING
==================================================
- 15 min/day: 5-15 minute bite-sized lessons. Avoid grouping difficult concepts into single lessons.
- 30 min/day: 10-25 minute focused lessons (1-2 lessons per session).
- 45-60 min/day: 15-40 minute lessons with deeper practical exercises.
- 90 min/day: 20-50 minute lessons, deep implementation tasks, and hands-on milestones.
- Adjust lesson sizes, exercise frequency, and estimated minutes to fit the daily study time.

==================================================
4. TARGET DATE CONSTRAINTS
==================================================
- If targetDate exists: Calculate deadline constraints relative to minutesPerDay. If time is tight, prune optional material, focus strictly on high-value core concepts, compress review, and prioritize goal alignment.
- If no targetDate: Build a balanced, steady-paced curriculum.

==================================================
5. TOPIC-AWARE CUSTOMIZATION
==================================================
- Programming / CS: Emphasize code structure, algorithms, architecture, debugging, and implementation.
- Mathematics / Hard Sciences: Emphasize definitions, worked problems, proofs, formulas, and practice sets.
- Theoretical CS: Balance formal proofs, algorithmic reasoning, complexity, and mental models.
- Humanities / Social Sciences: Emphasize historical context, theoretical frameworks, critical analysis, and synthesis.
- Languages: Emphasize grammar rules, vocabulary, listening/reading comprehension, and conversational fluency.

==================================================
6. CURRICULUM QUALITY & INTEGRITY
==================================================
- Generate 5 to 9 modules total.
- Each module MUST contain between 3 to 6 lessons.
- All 'order' fields must start at 1 and increment sequentially.
- Ensure all numeric values (estimatedWeeks, weeklyHours, estimatedHours, estimatedMinutes) are positive integers.
- Perform an internal quality self-check to ensure changing goal or level produces a DRAMATICALLY DIFFERENT curriculum structure.`;

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

      const userPrompt = `Synthesize a highly customized learning path for the following user parameters:

1. Topic: "${options.topic}"
2. Target Experience Level: ${options.experienceLevel}
3. Primary Learning Goal: ${options.goal}
4. Daily Study Commitment: ${options.minutesPerDay} minutes/day
5. Target Completion Date: ${options.targetDate || 'None (Flexible pacing)'}

IMPORTANT ARCHITECTURAL INSTRUCTIONS:
- Tailor module names, lesson titles, descriptions, key concepts, and exercise types specifically for ${options.experienceLevel} level learners pursuing ${options.goal}.
- Structure the lesson durations (estimatedMinutes) to align with ${options.minutesPerDay} minutes/day.
- If Goal is Exam Preparation: Include dedicated Revision and Exam Practice modules.
- If Goal is Interview Preparation: Include technical explanation practice, conceptual comparison lessons, and scenario questions.
- If Goal is Build a Project: Include practical implementation milestones, integration tasks, and final project build modules.

Generate the complete JSON response strictly adhering to the specified schema.`;

      const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_CURRICULUM_ARCHITECT_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 3800,
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
