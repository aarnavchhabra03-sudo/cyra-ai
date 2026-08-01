import { LearningPathGeneration } from '@/types/ai';

export type AIProviderName = 'groq' | 'gemini';

export interface AIGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
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
  generateLearningPath(
    prompt: string,
    context?: { experienceLevel?: string; minutesPerDay?: number }
  ): Promise<AILearningPathResponse>;
}
