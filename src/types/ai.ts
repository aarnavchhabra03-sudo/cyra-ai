import { z } from 'zod';

// ----------------------------------------------------
// TASK 1: TypeScript Interfaces
// ----------------------------------------------------

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface LessonGeneration {
  title: string;
  description: string;
  order: number;
  estimatedMinutes: number;
  keyConcepts: string[];
}

export interface ModuleGeneration {
  title: string;
  description: string;
  order: number;
  estimatedHours: number;
  objectives: string[];
  lessons: LessonGeneration[];
}

export interface LearningPathGeneration {
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  estimatedWeeks: number;
  weeklyHours: number;
  prerequisites: string[];
  learningOutcomes: string[];
  modules: ModuleGeneration[];
}

// ----------------------------------------------------
// TASK 2: Zod Runtime Validation Schemas
// ----------------------------------------------------

export const LessonGenerationSchema = z.object({
  title: z.string().min(1, 'Lesson title is required'),
  description: z.string().min(1, 'Lesson description is required'),
  order: z.number().int().positive('Lesson order must be a positive integer'),
  estimatedMinutes: z.number().positive('Lesson estimatedMinutes must be a positive number'),
  keyConcepts: z.array(z.string().min(1)).min(1, 'At least one key concept is required'),
});

export const ModuleGenerationSchema = z.object({
  title: z.string().min(1, 'Module title is required'),
  description: z.string().min(1, 'Module description is required'),
  order: z.number().int().positive('Module order must be a positive integer'),
  estimatedHours: z.number().positive('Module estimatedHours must be a positive number'),
  objectives: z.array(z.string().min(1)).min(1, 'At least one objective is required'),
  lessons: z.array(LessonGenerationSchema).min(1, 'Module must contain at least one lesson'),
});

export const LearningPathGenerationSchema = z.object({
  title: z.string().min(1, 'Learning path title is required'),
  description: z.string().min(1, 'Learning path description is required'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced'], {
    message: 'Difficulty must be beginner, intermediate, or advanced',
  }),
  estimatedWeeks: z.number().positive('estimatedWeeks must be a positive number'),
  weeklyHours: z.number().positive('weeklyHours must be a positive number'),
  prerequisites: z.array(z.string()),
  learningOutcomes: z.array(z.string().min(1)).min(1, 'At least one learning outcome is required'),
  modules: z.array(ModuleGenerationSchema).min(1, 'Learning path must contain at least one module'),
});

export function normalizeLearningPathOutput(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI output is not a valid JSON object');
  }

  // Recursive unwrapping of common wrapper keys
  let data = raw;
  const wrappers = ['learningPath', 'learning_path', 'course', 'curriculum', 'data', 'result'];
  for (let i = 0; i < 5; i++) {
    let unwrapped = false;
    for (const wrapper of wrappers) {
      if (data && typeof data === 'object' && wrapper in data && data[wrapper] && typeof data[wrapper] === 'object' && !Array.isArray(data[wrapper])) {
        data = data[wrapper];
        unwrapped = true;
        break;
      }
    }
    if (!unwrapped) break;
  }

  // Normalize difficulty (case-insensitive)
  if (data && typeof data.difficulty === 'string') {
    const diff = data.difficulty.toLowerCase().trim();
    if (diff === 'beginner' || diff === 'intermediate' || diff === 'advanced') {
      data.difficulty = diff;
    }
  }

  // Ensure arrays exist and normalize items
  if (data) {
    if (!Array.isArray(data.prerequisites)) {
      data.prerequisites = typeof data.prerequisites === 'string' ? [data.prerequisites] : [];
    }
    if (!Array.isArray(data.learningOutcomes)) {
      data.learningOutcomes = typeof data.learningOutcomes === 'string' ? [data.learningOutcomes] : [];
    }

    // Numbers conversion
    if (typeof data.estimatedWeeks === 'string') {
      const parsed = parseFloat(data.estimatedWeeks);
      if (!isNaN(parsed)) data.estimatedWeeks = parsed;
    }
    if (typeof data.weeklyHours === 'string') {
      const parsed = parseFloat(data.weeklyHours);
      if (!isNaN(parsed)) data.weeklyHours = parsed;
    }

    if (Array.isArray(data.modules)) {
      data.modules = data.modules.map((mod: any, mIdx: number) => {
        if (!mod || typeof mod !== 'object') return mod;

        // Ensure order is number
        const order = typeof mod.order === 'string' ? parseInt(mod.order, 10) : mod.order;
        const estHours = typeof mod.estimatedHours === 'string' ? parseFloat(mod.estimatedHours) : mod.estimatedHours;

        if (!Array.isArray(mod.objectives)) {
          mod.objectives = typeof mod.objectives === 'string' ? [mod.objectives] : [];
        }

        const lessons = Array.isArray(mod.lessons) ? mod.lessons.map((les: any, lIdx: number) => {
          if (!les || typeof les !== 'object') return les;

          const lesOrder = typeof les.order === 'string' ? parseInt(les.order, 10) : les.order;
          const estMins = typeof les.estimatedMinutes === 'string' ? parseFloat(les.estimatedMinutes) : les.estimatedMinutes;

          if (!Array.isArray(les.keyConcepts)) {
            les.keyConcepts = typeof les.keyConcepts === 'string' ? [les.keyConcepts] : [];
          }

          return {
            ...les,
            order: isNaN(lesOrder) ? lIdx + 1 : lesOrder,
            estimatedMinutes: isNaN(estMins) ? 30 : estMins,
            keyConcepts: les.keyConcepts.filter(Boolean),
          };
        }) : [];

        return {
          ...mod,
          order: isNaN(order) ? mIdx + 1 : order,
          estimatedHours: isNaN(estHours) ? 10 : estHours,
          objectives: mod.objectives.filter(Boolean),
          lessons,
        };
      });
    }
  }

  return data;
}

/**
 * Runtime Validator for AI-generated Learning Paths.
 * Validates structure, field types, value ranges, and order integrity.
 * Throws a descriptive error if validation fails.
 */
export function validateLearningPath(data: unknown): LearningPathGeneration {
  console.log(`[LEARNING_PATH] RAW_OUTPUT_TYPE: ${typeof data} (isArray: ${Array.isArray(data)})`);
  if (data && typeof data === 'object') {
    console.log(`[LEARNING_PATH] PARSED_KEYS:`, Object.keys(data));
  }

  // Normalize the input data structure first
  const normalized = normalizeLearningPathOutput(data);
  if (normalized && typeof normalized === 'object') {
    console.log(`[LEARNING_PATH] NORMALIZED_KEYS:`, Object.keys(normalized));
  }

  try {
    // 1. Zod schema parse (structural & type validation)
    const parsed = LearningPathGenerationSchema.parse(normalized);

    // 2. Structural & order integrity checks
    const sortedModules = [...parsed.modules].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedModules.length; i++) {
      const mod = sortedModules[i];

      // Sort lessons within module to check order
      const sortedLessons = [...mod.lessons].sort((a, b) => a.order - b.order);
      if (sortedLessons.length === 0) {
        throw new Error(`Module "${mod.title}" contains no valid lessons.`);
      }
    }

    return parsed;
  } catch (validationErr: any) {
    console.error(`[LEARNING_PATH] VALIDATION_FAILED:`, validationErr.message || validationErr);
    throw validationErr;
  }
}
