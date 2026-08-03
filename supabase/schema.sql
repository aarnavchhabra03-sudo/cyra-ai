-- ============================================================
-- CYRA AI — SUPABASE DATABASE SCHEMA
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'CYRA Scholar'),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. LEARNING PATHS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  minutes_per_day INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own learning paths" ON public.learning_paths;
CREATE POLICY "Users can manage their own learning paths"
  ON public.learning_paths FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. MODULES TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  module_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('completed', 'in_progress', 'locked')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view modules of their learning paths" ON public.modules;
CREATE POLICY "Users can view modules of their learning paths"
  ON public.modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE learning_paths.id = modules.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage modules of their learning paths" ON public.modules;
CREATE POLICY "Users can manage modules of their learning paths"
  ON public.modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE learning_paths.id = modules.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. LESSONS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  estimated_minutes INTEGER DEFAULT 15,
  lesson_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('completed', 'in_progress', 'locked')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view lessons of their learning paths" ON public.lessons;
CREATE POLICY "Users can view lessons of their learning paths"
  ON public.lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE modules.id = lessons.module_id
      AND learning_paths.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage lessons of their learning paths" ON public.lessons;
CREATE POLICY "Users can manage lessons of their learning paths"
  ON public.lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE modules.id = lessons.module_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 5. DAILY TASKS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learning_path_id UUID REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 50,
  completed BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'quiz' CHECK (category IN ('quiz', 'reading', 'tutor', 'research')),
  due_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own daily tasks" ON public.daily_tasks;
CREATE POLICY "Users can manage their own daily tasks"
  ON public.daily_tasks FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. STUDY NOTES TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  overview TEXT NOT NULL,
  explanation TEXT NOT NULL,
  key_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  important_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  quick_revision TEXT NOT NULL,
  raw_markdown TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view study notes of their learning paths" ON public.study_notes;
CREATE POLICY "Users can view study notes of their learning paths"
  ON public.study_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.modules ON lessons.module_id = modules.id
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE lessons.id = study_notes.lesson_id
      AND learning_paths.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert study notes for their learning paths" ON public.study_notes;
CREATE POLICY "Users can insert study notes for their learning paths"
  ON public.study_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.modules ON lessons.module_id = modules.id
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE lessons.id = study_notes.lesson_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 7. LEARNING RESOURCES TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT,
  description TEXT,
  duration TEXT,
  difficulty TEXT,
  is_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view resources for their learning paths" ON public.learning_resources;
CREATE POLICY "Users can view resources for their learning paths"
  ON public.learning_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.modules ON lessons.module_id = modules.id
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE lessons.id = learning_resources.lesson_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 8. USER PROGRESS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own progress" ON public.user_progress;
CREATE POLICY "Users can manage their own progress"
  ON public.user_progress FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 9. STAGE 12.1 — AI QUIZ & ASSESSMENT ENGINE SCHEMA
-- ------------------------------------------------------------

-- A. QUIZZES TABLE
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  question_count INTEGER NOT NULL DEFAULT 5,
  estimated_minutes INTEGER DEFAULT 5,
  passing_score INTEGER DEFAULT 70,
  version INTEGER DEFAULT 1,
  generation_status TEXT DEFAULT 'ready' CHECK (generation_status IN ('generating', 'ready', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_lesson_id ON public.quizzes(lesson_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_lesson_version ON public.quizzes(lesson_id, version);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view quizzes for their learning paths" ON public.quizzes;
CREATE POLICY "Users can view quizzes for their learning paths"
  ON public.quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.modules ON lessons.module_id = modules.id
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE lessons.id = quizzes.lesson_id
      AND learning_paths.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert quizzes for their learning paths" ON public.quizzes;
CREATE POLICY "Users can insert quizzes for their learning paths"
  ON public.quizzes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.modules ON lessons.module_id = modules.id
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE lessons.id = quizzes.lesson_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- B. QUIZ QUESTIONS TABLE (NO DIRECT CLIENT SELECT POLICY TO PROTECT correct_answer)
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'multiple_select', 'fill_blank', 'short_answer', 'code', 'matching')),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL, -- SERVER-SIDE SECURE ONLY
  explanation TEXT NOT NULL,
  concept TEXT,
  difficulty TEXT,
  points INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_quiz_question_order UNIQUE (quiz_id, question_order)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);

-- Enable RLS without creating a SELECT policy.
-- This ensures standard browser client queries (e.g., supabase.from('quiz_questions')) cannot leak correct_answer.
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- C. BROWSER-SAFE RPC FUNCTION FOR FETCHING QUESTIONS (SECURE & OWNERSHIP VERIFIED)
CREATE OR REPLACE FUNCTION public.get_safe_quiz_questions(p_quiz_id UUID)
RETURNS TABLE (
  id UUID,
  quiz_id UUID,
  question_order INT,
  question_type TEXT,
  question_text TEXT,
  options JSONB,
  concept TEXT,
  difficulty TEXT,
  points INT
) SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  -- Verify ownership: requesting user must own the learning_path containing this quiz
  IF NOT EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.lessons l ON q.lesson_id = l.id
    JOIN public.modules m ON l.module_id = m.id
    JOIN public.learning_paths lp ON m.learning_path_id = lp.id
    WHERE q.id = p_quiz_id
    AND lp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not own the learning path for this quiz.';
  END IF;

  RETURN QUERY
  SELECT
    qq.id,
    qq.quiz_id,
    qq.question_order,
    qq.question_type,
    qq.question_text,
    qq.options,
    qq.concept,
    qq.difficulty,
    qq.points
  FROM public.quiz_questions qq
  WHERE qq.quiz_id = p_quiz_id
  ORDER BY qq.question_order ASC;
END;
$$;

-- D. EXTEND QUIZ ATTEMPTS TABLE (SAFELY ALTER EXISTING TABLE ONLY)
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS percentage INTEGER DEFAULT 0;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS correct_answers INTEGER DEFAULT 0;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT false;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS xp_awarded INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lesson_id ON public.quiz_attempts(lesson_id);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can manage their own quiz attempts"
  ON public.quiz_attempts FOR ALL
  USING (auth.uid() = user_id);

-- E. QUIZ ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected_answer JSONB,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON public.quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON public.quiz_answers(question_id);

ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage answers for their attempts" ON public.quiz_answers;
CREATE POLICY "Users can manage answers for their attempts"
  ON public.quiz_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts
      WHERE quiz_attempts.id = quiz_answers.attempt_id
      AND quiz_attempts.user_id = auth.uid()
    )
  );
