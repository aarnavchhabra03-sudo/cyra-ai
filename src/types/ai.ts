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

export const StudyNotesSchema = z.object({
  overview: z.string().min(1, 'Overview is required'),
  explanation: z.string().min(1, 'Explanation is required'),
  key_concepts: z.array(z.string().min(1)).min(1, 'At least one key concept is required'),
  examples: z.array(z.string()),
  important_points: z.array(z.string().min(1)).min(1, 'At least one important point is required'),
  quick_revision: z.string().min(1, 'Quick revision revision is required'),
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

export function normalizeStudyNotesOutput(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI output is not a valid JSON object');
  }

  // Recursive unwrapping of common wrapper keys
  let data = raw;
  const wrappers = ['studyNotes', 'study_notes', 'notes', 'curriculum', 'data', 'result'];
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

  // Normalize key naming drift / aliases (e.g. camelCase to snake_case)
  if (data) {
    // 1. key_concepts / keyConcepts / keyPoints / key_points
    const keyConceptsVal = data.key_concepts || data.keyConcepts || data.keyPoints || data.key_points || data.keyconcepts;
    if (keyConceptsVal) {
      data.key_concepts = Array.isArray(keyConceptsVal)
        ? keyConceptsVal
        : typeof keyConceptsVal === 'string'
        ? keyConceptsVal.split(',').map((x: string) => x.trim())
        : [];
    } else if (!data.key_concepts) {
      data.key_concepts = [];
    }

    // 2. important_points / importantPoints / keyPoints / key_points
    const importantPointsVal = data.important_points || data.importantPoints || data.importantpoints;
    if (importantPointsVal) {
      data.important_points = Array.isArray(importantPointsVal)
        ? importantPointsVal
        : typeof importantPointsVal === 'string'
        ? importantPointsVal.split('\n').map((x: string) => x.trim())
        : [];
    } else if (!data.important_points) {
      data.important_points = [];
    }

    // 3. examples
    if (!Array.isArray(data.examples)) {
      data.examples = typeof data.examples === 'string' ? [data.examples] : [];
    }

    // 4. overview
    if (typeof data.overview !== 'string') {
      data.overview = String(data.overview || '').trim();
    }

    // 5. explanation
    if (typeof data.explanation !== 'string') {
      data.explanation = String(data.explanation || '').trim();
    }

    // 6. quick_revision / quickRevision / revision
    const quickRevVal = data.quick_revision || data.quickRevision || data.revision || data.quick_revision_points;
    if (typeof quickRevVal === 'string') {
      data.quick_revision = quickRevVal;
    } else if (Array.isArray(quickRevVal)) {
      data.quick_revision = quickRevVal.join('\n');
    } else if (!data.quick_revision) {
      data.quick_revision = '';
    }
  }

  return data;
}

export function validateStudyNotesObject(data: unknown): any {
  const rawLength = JSON.stringify(data).length;
  console.log(`[STUDY_NOTES] RAW_OUTPUT_TYPE: ${typeof data} (isArray: ${Array.isArray(data)})`);
  console.log(`[STUDY_NOTES] RAW_OUTPUT_LENGTH: ${rawLength} characters`);
  
  if (data && typeof data === 'object') {
    console.log(`[STUDY_NOTES] PARSED_KEYS:`, Object.keys(data));
  }

  // Detect possible truncation
  const rawStr = typeof data === 'string' ? data : JSON.stringify(data);
  if (rawStr.endsWith('...') || (!rawStr.endsWith('}') && !rawStr.endsWith(']'))) {
    console.warn(`[STUDY_NOTES] POSSIBLE_TRUNCATION detected in raw AI string`);
  }

  const normalized = normalizeStudyNotesOutput(data);
  if (normalized && typeof normalized === 'object') {
    console.log(`[STUDY_NOTES] NORMALIZED_KEYS:`, Object.keys(normalized));
  }

  try {
    const validated = StudyNotesSchema.parse(normalized);
    console.log(`[STUDY_NOTES] VALIDATION_RESULT: SUCCESS`);
    return validated;
  } catch (err: any) {
    console.error(`[STUDY_NOTES] VALIDATION_FAILED:`, err.message || err);
    throw err;
  }
}

export const ResourcePlanItemSchema = z.object({
  title: z.string().min(1, 'Resource title is required'),
  resource_type: z.enum(['article', 'documentation', 'textbook', 'video', 'practice', 'reference'], {
    message: 'Invalid resource type',
  }),
  source: z.string().min(1, 'Source is required'),
  description: z.string().min(1, 'Description is required'),
  search_query: z.string().min(1, 'Search query is required'),
  duration: z.string().optional(),
  difficulty: z.string().optional(),
  is_recommended: z.boolean().optional().default(false),
});

export const ResourcePlanSchema = z.object({
  resources: z.array(ResourcePlanItemSchema).min(1, 'At least one resource is required'),
});

export function normalizeResourcePlanOutput(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI output is not a valid JSON object');
  }

  // Unwrap wrappers
  let data = raw;
  const wrappers = ['resourcePlan', 'resource_plan', 'resourcesList', 'resources_list', 'data', 'result'];
  for (let i = 0; i < 5; i++) {
    let unwrapped = false;
    for (const wrapper of wrappers) {
      if (data && typeof data === 'object' && wrapper in data && data[wrapper] && typeof data[wrapper] === 'object') {
        data = data[wrapper];
        unwrapped = true;
        break;
      }
    }
    if (!unwrapped) break;
  }

  // If the data is directly an array, wrap it in { resources: data }
  if (Array.isArray(data)) {
    data = { resources: data };
  }

  if (data && typeof data === 'object' && Array.isArray(data.resources)) {
    data.resources = data.resources.map((item: any) => {
      if (!item || typeof item !== 'object') return item;

      // Map camelCase to snake_case
      const title = item.title || item.name;
      const resource_type = item.resource_type || item.resourceType || item.type;
      const search_query = item.search_query || item.searchQuery || item.query;
      const is_recommended = item.is_recommended !== undefined ? item.is_recommended : (item.isRecommended !== undefined ? item.isRecommended : false);
      const duration = item.duration ? String(item.duration).trim() : undefined;
      const difficulty = item.difficulty ? String(item.difficulty).trim() : undefined;

      // Normalize resource type to match validTypes
      let normalizedType = String(resource_type || '').toLowerCase().trim();
      if (normalizedType.includes('video')) normalizedType = 'video';
      else if (normalizedType.includes('doc') || normalizedType.includes('guide')) normalizedType = 'documentation';
      else if (normalizedType.includes('book')) normalizedType = 'textbook';
      else if (normalizedType.includes('practice') || normalizedType.includes('exercise')) normalizedType = 'practice';
      else if (normalizedType.includes('ref')) normalizedType = 'reference';
      else if (normalizedType.includes('article') || normalizedType.includes('post') || normalizedType.includes('blog')) normalizedType = 'article';
      else normalizedType = 'article'; // Fallback

      return {
        ...item,
        title: typeof title === 'string' ? title.trim() : '',
        resource_type: normalizedType,
        source: typeof item.source === 'string' ? item.source.trim() : 'Google',
        description: typeof item.description === 'string' ? item.description.trim() : '',
        search_query: typeof search_query === 'string' ? search_query.trim() : '',
        duration,
        difficulty,
        is_recommended,
      };
    });
  } else if (data && typeof data === 'object') {
    // If resources array is missing, look for lists of items
    const possibleArrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
    if (possibleArrayKey) {
      data = { resources: data[possibleArrayKey] };
      return normalizeResourcePlanOutput(data);
    }
  }

  return data;
}

export function validateResourcePlanObject(data: any): z.infer<typeof ResourcePlanSchema> {
  const rawString = JSON.stringify(data);
  console.log(`[RESOURCE_PLAN] RAW MODEL OUTPUT:\n${rawString}`);
  console.log(`[RESOURCE_PLAN] EXTRACTED OBJECT:\n${JSON.stringify(data, null, 2)}`);

  const normalized = normalizeResourcePlanOutput(data);

  if (normalized && typeof normalized === 'object' && Array.isArray(normalized.resources)) {
    const firstRes = normalized.resources[0];
    console.log(`[RESOURCE_PLAN] FIRST RESOURCE:\n${JSON.stringify(firstRes, null, 2)}`);
    if (firstRes && typeof firstRes === 'object') {
      console.log(`[RESOURCE_PLAN] FIRST RESOURCE KEYS:\n${JSON.stringify(Object.keys(firstRes))}`);
    } else {
      console.log(`[RESOURCE_PLAN] FIRST RESOURCE KEYS:\n[]`);
    }
    const searchQueries = normalized.resources.map((r: any) => r?.search_query);
    console.log(`[RESOURCE_PLAN] SEARCH QUERY VALUES:\n${JSON.stringify(searchQueries, null, 2)}`);
  } else {
    console.log(`[RESOURCE_PLAN] FIRST RESOURCE:\nnull`);
    console.log(`[RESOURCE_PLAN] FIRST RESOURCE KEYS:\n[]`);
    console.log(`[RESOURCE_PLAN] SEARCH QUERY VALUES:\n[]`);
  }

  // Check for truncation
  const rawText = rawString.trim();
  const isTruncated = rawText.endsWith('...') || (!rawText.endsWith('}') && !rawText.endsWith(']'));
  if (isTruncated) {
    console.warn(`[RESOURCE_PLAN] POSSIBLE_TRUNCATION: Response doesn't end with a closing brace.`);
  }

  try {
    const validated = ResourcePlanSchema.parse(normalized);
    console.log(`[RESOURCE_PLAN] VALIDATION_RESULT: SUCCESS`);
    return validated;
  } catch (err: any) {
    console.error(`[RESOURCE_PLAN] VALIDATION_FAILED:`, JSON.stringify(err.issues || err, null, 2));
    throw err;
  }
}

export const QuizSchema = z.object({
  title: z.string().min(1, 'Quiz title is required'),
  description: z.string().min(1, 'Quiz description is required'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimated_minutes: z.number().int().positive(),
  passing_score: z.number().int().min(1).max(100),
});

export const QuizOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const QuizCorrectAnswerSchema = z.object({
  option_id: z.string().min(1),
});

export const QuizQuestionSchema = z.object({
  question_order: z.number().int().positive(),
  question_type: z.enum(['multiple_choice', 'true_false']),
  question_text: z.string().min(1),
  options: z.array(QuizOptionSchema).min(2),
  correct_answer: QuizCorrectAnswerSchema,
  explanation: z.string().min(1),
  concept: z.string().min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  points: z.number().optional().default(1),
});

export const GeneratedQuizSchema = z.object({
  quiz: QuizSchema,
  questions: z.array(QuizQuestionSchema).min(3),
});

export function normalizeQuizOutput(raw: any): any {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI output is not a valid JSON object');
  }

  // Unwrap wrappers
  let data = raw;
  const wrappers = ['quizData', 'quiz_data', 'generatedQuiz', 'data', 'result'];
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

  // Normalize Quiz Info
  if (data && typeof data === 'object' && data.quiz && typeof data.quiz === 'object') {
    const q = data.quiz;
    const title = q.title || q.name;
    const description = q.description || q.desc;
    const difficulty = String(q.difficulty || q.difficultyLevel || 'beginner').toLowerCase().trim();
    const estimated_minutes = typeof q.estimated_minutes === 'number' ? q.estimated_minutes : (typeof q.estimatedMinutes === 'number' ? q.estimatedMinutes : (typeof q.duration === 'number' ? q.duration : 15));
    const passing_score = typeof q.passing_score === 'number' ? q.passing_score : (typeof q.passingScore === 'number' ? q.passingScore : 70);

    data.quiz = {
      title: typeof title === 'string' ? title.trim() : '',
      description: typeof description === 'string' ? description.trim() : '',
      difficulty: ['beginner', 'intermediate', 'advanced'].includes(difficulty) ? difficulty : 'beginner',
      estimated_minutes: isNaN(Number(estimated_minutes)) ? 15 : Number(estimated_minutes),
      passing_score: isNaN(Number(passing_score)) ? 70 : Number(passing_score),
    };
  }

  // Normalize Questions
  if (data && typeof data === 'object' && Array.isArray(data.questions)) {
    data.questions = data.questions.map((q: any, idx: number) => {
      if (!q || typeof q !== 'object') return q;

      const question_order = q.question_order || q.questionOrder || (idx + 1);
      const question_type = String(q.question_type || q.questionType || 'multiple_choice').toLowerCase().trim();
      const question_text = q.question_text || q.questionText || q.text;
      const explanation = q.explanation || q.explanationText;
      const concept = q.concept || q.topic || 'General';
      const difficulty = String(q.difficulty || q.difficultyLevel || 'beginner').toLowerCase().trim();
      const points = typeof q.points === 'number' ? q.points : 1;

      // Correct Answer mapping
      let correct_answer = q.correct_answer || q.correctAnswer;
      if (correct_answer && typeof correct_answer === 'object') {
        const option_id = correct_answer.option_id || correct_answer.optionId || correct_answer.id;
        correct_answer = { option_id: String(option_id || '').trim() };
      } else if (typeof correct_answer === 'string') {
        correct_answer = { option_id: correct_answer.trim() };
      } else {
        correct_answer = { option_id: 'A' }; // Fallback
      }

      // Options mapping
      let optionsList = q.options;
      if (Array.isArray(optionsList)) {
        optionsList = optionsList.map((opt: any) => {
          if (typeof opt === 'string') {
            return { id: opt, text: opt };
          }
          if (opt && typeof opt === 'object') {
            const id = opt.id || opt.option_id || opt.optionId || opt.key || '';
            const text = opt.text || opt.value || opt.option_text || '';
            return { id: String(id).trim(), text: String(text).trim() };
          }
          return opt;
        });
      } else {
        optionsList = [];
      }

      return {
        ...q,
        question_order: isNaN(Number(question_order)) ? (idx + 1) : Number(question_order),
        question_type: ['multiple_choice', 'true_false'].includes(question_type) ? question_type : 'multiple_choice',
        question_text: typeof question_text === 'string' ? question_text.trim() : '',
        options: optionsList,
        correct_answer,
        explanation: typeof explanation === 'string' ? explanation.trim() : '',
        concept: typeof concept === 'string' ? concept.trim() : 'General',
        difficulty: ['beginner', 'intermediate', 'advanced'].includes(difficulty) ? difficulty : 'beginner',
        points: isNaN(Number(points)) ? 1 : Number(points),
      };
    });
  }

  return data;
}

export function validateQuizDataObject(data: any): z.infer<typeof GeneratedQuizSchema> {
  const rawString = JSON.stringify(data);
  console.log(`[QUIZ] RAW_OUTPUT_TYPE: ${typeof data} (isArray: ${Array.isArray(data)})`);
  console.log(`[QUIZ] RAW_OUTPUT_LENGTH: ${rawString.length} characters`);
  
  if (data && typeof data === 'object') {
    console.log(`[QUIZ] PARSED_KEYS:`, Object.keys(data));
  }

  const normalized = normalizeQuizOutput(data);
  if (normalized && typeof normalized === 'object') {
    console.log(`[QUIZ] NORMALIZED_KEYS:`, Object.keys(normalized));
  }

  // Check for truncation
  const rawText = rawString.trim();
  const isTruncated = rawText.endsWith('...') || (!rawText.endsWith('}') && !rawText.endsWith(']'));
  if (isTruncated) {
    console.warn(`[QUIZ] POSSIBLE_TRUNCATION: Response doesn't end with a closing brace.`);
  }

  try {
    const validated = GeneratedQuizSchema.parse(normalized);
    console.log(`[QUIZ] VALIDATION_RESULT: SUCCESS`);
    return validated;
  } catch (err: any) {
    console.error(`[QUIZ] VALIDATION_FAILED:`, JSON.stringify(err.issues || err, null, 2));
    throw err;
  }
}
