-- ============================================================
-- CYRA AI — STAGE 12.4 CONCEPT MASTERY MIGRATION
-- ============================================================

-- 1. CREATE TABLE: public.user_concept_mastery
CREATE TABLE IF NOT EXISTS public.user_concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  mastery_score INTEGER NOT NULL DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  total_points_possible INTEGER NOT NULL DEFAULT 0,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_result TEXT CHECK (last_result IN ('weak', 'developing', 'proficient', 'mastered')),
  last_practiced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_concept UNIQUE (user_id, concept)
);

-- 2. CREATE INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_user_concept_mastery_user_id ON public.user_concept_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_user_concept_mastery_concept ON public.user_concept_mastery(concept);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.user_concept_mastery ENABLE ROW LEVEL SECURITY;

-- 4. CREATE RLS POLICIES (USERS CAN READ ONLY THEIR OWN CONCEPT MASTERY)
DROP POLICY IF EXISTS "Users can view their own concept mastery" ON public.user_concept_mastery;
CREATE POLICY "Users can view their own concept mastery"
  ON public.user_concept_mastery FOR SELECT
  USING (auth.uid() = user_id);

-- Note: No client-side INSERT/UPDATE policies are defined on user_concept_mastery.
-- Writes are strictly controlled via server-side adminClient in POST /api/quiz/submit.

-- 5. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
