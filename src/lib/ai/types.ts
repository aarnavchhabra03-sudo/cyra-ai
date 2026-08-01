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

export interface AIProvider {
  name: AIProviderName;
  generateContent(options: AIGenerateOptions): Promise<AIResponse>;
  generateLearningPath(options: GenerateLearningPathOptions): Promise<AILearningPathResponse>;
}
