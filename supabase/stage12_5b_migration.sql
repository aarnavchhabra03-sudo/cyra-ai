-- ============================================================
-- CYRA AI — STAGE 12.5B ADAPTIVE TARGETED PRACTICE MIGRATION
-- ============================================================

-- 1. ADAPTIVE PRACTICE SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.adaptive_practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  mastery_before INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 2. ADAPTIVE PRACTICE QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.adaptive_practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.adaptive_practice_sessions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL DEFAULT 1,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  concept TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ADAPTIVE PRACTICE ATTEMPTS TABLE (WITH UNIQUE session_id CONSTRAINT FOR IDEMPOTENCY)
CREATE TABLE IF NOT EXISTS public.adaptive_practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.adaptive_practice_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  mastery_before INTEGER NOT NULL DEFAULT 0,
  mastery_after INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ADAPTIVE PRACTICE ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.adaptive_practice_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.adaptive_practice_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.adaptive_practice_questions(id) ON DELETE CASCADE,
  selected_answer JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_adaptive_practice_sessions_user ON public.adaptive_practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_practice_questions_session ON public.adaptive_practice_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_practice_attempts_session ON public.adaptive_practice_attempts(session_id);

-- RLS POLICIES
ALTER TABLE public.adaptive_practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_practice_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_practice_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_practice_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their own practice sessions" ON public.adaptive_practice_sessions;
CREATE POLICY "Users view their own practice sessions" ON public.adaptive_practice_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view their own practice attempts" ON public.adaptive_practice_attempts;
CREATE POLICY "Users view their own practice attempts" ON public.adaptive_practice_attempts
  FOR SELECT USING (auth.uid() = user_id);

-- RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
