import { AIProvider, AIProviderName } from './types';
import { GroqProvider } from './groq';
import { GeminiProvider } from './gemini';

export function getAIProvider(overrideProvider?: AIProviderName): AIProvider {
  const activeProviderName = overrideProvider || (process.env.AI_PROVIDER as AIProviderName) || 'groq';

  if (activeProviderName === 'gemini') {
    return new GeminiProvider();
  }

  // Default active provider is Groq
  return new GroqProvider();
}

export * from './types';
export * from './groq';
export * from './gemini';
