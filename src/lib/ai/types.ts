import { LearningPathGeneration, DifficultyLevel } from '@/types/ai';

export type AIProviderName = 'groq' | 'gemini';

export interface AIGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface GenerateLearningPathOptions {
  topic: string;
  experienceLevel: DifficultyLevel;
  goal: string;
  minutesPerDay: number;
  targetDate?: string;
}

export interface GenerateStudyNotesOptions {
  courseTitle?: string;
  moduleTitle?: string;
  lessonTitle: string;
  lessonDescription?: string;
  lessonContent?: string;
  experienceLevel?: string;
}

export interface StudyNotesData {
  overview: string;
  explanation: string;
  key_concepts: string[];
  examples: string[];
  important_points: string[];
  quick_revision: string;
}

export interface GenerateResourcePlanOptions {
  courseTitle?: string;
  moduleTitle?: string;
  lessonTitle: string;
  lessonDescription?: string;
  lessonContent?: string;
  experienceLevel?: string;
}

export interface ResourcePlanItem {
  title: string;
  resource_type: 'article' | 'documentation' | 'textbook' | 'video' | 'practice' | 'reference';
  source: string;
  description: string;
  duration?: string;
  difficulty?: string;
  is_recommended: boolean;
  search_query: string;
}

export interface ResourcePlanData {
  resources: ResourcePlanItem[];
}

export interface AIResponse {
  success: boolean;
  message?: string;
  provider: AIProviderName;
  model: string;
  error?: string;
  code?: string;
}

export interface AILearningPathResponse {
  success: boolean;
  data?: LearningPathGeneration;
  provider: AIProviderName;
  model: string;
  error?: string;
  code?: string;
}

export interface AIStudyNotesResponse {
  success: boolean;
  data?: StudyNotesData;
  provider: AIProviderName;
  model: string;
  error?: string;
  code?: string;
}

export interface AIResourcePlanResponse {
  success: boolean;
  data?: ResourcePlanData;
  provider: AIProviderName;
  model: string;
  error?: string;
  code?: string;
}

export interface AIProvider {
  name: AIProviderName;
  generateContent(options: AIGenerateOptions): Promise<AIResponse>;
  generateLearningPath(options: GenerateLearningPathOptions): Promise<AILearningPathResponse>;
  generateStudyNotes(options: GenerateStudyNotesOptions): Promise<AIStudyNotesResponse>;
  generateResourcePlan(options: GenerateResourcePlanOptions): Promise<AIResourcePlanResponse>;
}
