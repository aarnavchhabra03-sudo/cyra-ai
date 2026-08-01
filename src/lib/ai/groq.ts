import Groq from 'groq-sdk';
import { AIProvider, AIGenerateOptions, AIResponse } from './types';

// Centralized Groq model definition
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

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
}
