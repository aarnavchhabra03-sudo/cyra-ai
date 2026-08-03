-- ============================================================
-- CYRA AI — SAFE REPAIR MIGRATION FOR STAGE 12 QUIZ SYSTEM
-- ============================================================

-- 1. CREATE MISSING TABLE: public.quizzes
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

-- 2. CREATE MISSING TABLE: public.quiz_questions (NO DIRECT SELECT POLICY TO PROTECT correct_answer)
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

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert questions for their quizzes" ON public.quiz_questions;
CREATE POLICY "Users can insert questions for their quizzes"
  ON public.quiz_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      JOIN public.lessons ON quizzes.lesson_id = lessons.id
      JOIN public.modules ON lessons.module_id = modules.id
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE quizzes.id = quiz_questions.quiz_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- 3. BROWSER-SAFE RPC FUNCTION FOR FETCHING QUESTIONS (SECURE & OWNERSHIP VERIFIED)
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
) SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
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

REVOKE ALL ON FUNCTION public.get_safe_quiz_questions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_safe_quiz_questions(UUID) TO authenticated;

-- 4. SAFELY EXTEND EXISTING TABLE: public.quiz_attempts
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

-- 5. CREATE MISSING TABLE: public.quiz_answers
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

-- 6. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
