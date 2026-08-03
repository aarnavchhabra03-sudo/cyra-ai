export type QuizDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type QuizQuestionType = 
  | 'multiple_choice' 
  | 'true_false' 
  | 'multiple_select' 
  | 'fill_blank' 
  | 'short_answer' 
  | 'code' 
  | 'matching';

export type QuizGenerationStatus = 'generating' | 'ready' | 'failed';

export interface QuizOption {
  id: string; // e.g. "A", "B", "C", "D" or "true", "false"
  text: string;
}

export interface CorrectAnswerPayload {
  option_id?: string;
  option_ids?: string[];
  expected_text?: string;
}

export interface QuizRecord {
  id: string;
  lesson_id: string;
  title: string;
  description?: string | null;
  difficulty: QuizDifficulty;
  question_count: number;
  estimated_minutes: number;
  passing_score: number; // Percentage e.g. 70
  version: number;
  generation_status: QuizGenerationStatus;
  created_at?: string;
  updated_at?: string;
}

export interface QuizQuestionRecord {
  id: string;
  quiz_id: string;
  question_order: number;
  question_type: QuizQuestionType;
  question_text: string;
  options: QuizOption[];
  correct_answer: CorrectAnswerPayload; // SERVER-ONLY PRIVILEGED FIELD
  explanation: string;
  concept?: string | null;
  difficulty?: string | null;
  points: number;
  created_at?: string;
}

/**
 * BROWSER-SAFE QUESTION TYPE
 * Omits correct_answer and explanation to prevent client-side inspection / cheating.
 */
export interface SafeQuizQuestion {
  id: string;
  quiz_id: string;
  question_order: number;
  question_type: QuizQuestionType;
  question_text: string;
  options: QuizOption[];
  concept?: string | null;
  difficulty?: string | null;
  points: number;
}

export interface QuizAttemptRecord {
  id: string;
  user_id: string;
  quiz_id?: string | null;
  lesson_id?: string | null;
  score: number;
  percentage: number;
  total_questions: number;
  correct_answers: number;
  passed: boolean;
  started_at?: string;
  completed_at?: string | null;
  duration_seconds: number;
  xp_awarded: number;
  created_at?: string;
}

export interface QuizAnswerRecord {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: { option_id: string } | { option_ids: string[] } | { answer_text: string };
  is_correct?: boolean | null;
  points_earned: number;
  answered_at?: string;
}

export interface QuizGradingResult {
  attemptId: string;
  score: number;
  percentage: number;
  passed: boolean;
  xpAwarded: number;
  totalQuestions: number;
  correctCount: number;
  weakConcepts: string[];
}
