export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  xp: number;
  current_streak: number;
  longest_streak: number;
  created_at?: string;
  updated_at?: string;
}

export interface LearningPath {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  minutes_per_day: number;
  status: 'active' | 'completed' | 'archived';
  progress: number; // 0 to 100
  created_at?: string;
  updated_at?: string;
}

export interface ModuleRecord {
  id: string;
  learning_path_id: string;
  title: string;
  description?: string | null;
  module_order: number;
  order_index?: number;
  status: 'completed' | 'in_progress' | 'locked';
  progress?: number;
  created_at?: string;
}

export interface LessonRecord {
  id: string;
  module_id: string;
  title: string;
  description?: string | null;
  content?: string | null;
  estimated_minutes: number;
  lesson_order: number;
  order_index?: number;
  status: 'completed' | 'in_progress' | 'locked';
  created_at?: string;
}

export interface DailyTaskRecord {
  id: string;
  user_id: string;
  learning_path_id?: string | null;
  title: string;
  xp_reward: number;
  completed: boolean;
  category: 'quiz' | 'reading' | 'tutor' | 'research';
  due_date: string;
  created_at?: string;
}

export interface QuizAttemptRecord {
  id: string;
  user_id: string;
  quiz_id?: string | null;
  lesson_id?: string | null;
  score: number;
  percentage?: number;
  total_questions: number;
  correct_answers?: number;
  passed?: boolean;
  started_at?: string;
  completed_at?: string | null;
  duration_seconds?: number;
  xp_awarded?: number;
  created_at?: string;
}

export interface UserProgressRecord {
  id: string;
  user_id: string;
  lesson_id: string;
  completed_at?: string;
}

export * from './quiz';
