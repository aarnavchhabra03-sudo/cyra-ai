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

/**
 * Runtime Validator for AI-generated Learning Paths.
 * Validates structure, field types, value ranges, and order integrity.
 * Throws a descriptive error if validation fails.
 */
export function validateLearningPath(data: unknown): LearningPathGeneration {
  // 1. Zod schema parse (structural & type validation)
  const parsed = LearningPathGenerationSchema.parse(data);

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
}
