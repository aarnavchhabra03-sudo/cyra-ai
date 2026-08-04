-- ============================================================
-- CYRA AI — STAGE 12.9A CLOSED-LOOP ATTRIBUTION FIX MIGRATION
-- ============================================================

-- 1. ADD DETERMINISTIC SOURCE IDENTIFIERS TO LEARNING INTERVENTIONS
ALTER TABLE public.learning_interventions
  ADD COLUMN IF NOT EXISTS source_practice_session_id UUID NULL 
    REFERENCES public.adaptive_practice_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_quiz_attempt_id UUID NULL 
    REFERENCES public.quiz_attempts(id) ON DELETE CASCADE;

-- 2. INDEXES FOR FAST DETERMINISTIC LOOKUP
CREATE INDEX IF NOT EXISTS idx_learning_interventions_source_practice 
  ON public.learning_interventions(source_practice_session_id);

CREATE INDEX IF NOT EXISTS idx_learning_interventions_source_quiz 
  ON public.learning_interventions(source_quiz_attempt_id);

-- 3. ENFORCE UNIQUE INTERVENTION PER PRACTICE SESSION TO PREVENT DUPLICATES
CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_interventions_source_practice
  ON public.learning_interventions(source_practice_session_id)
  WHERE source_practice_session_id IS NOT NULL;

-- 4. POSTGREST SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
