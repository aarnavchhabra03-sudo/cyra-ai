-- ============================================================
-- CYRA AI — STAGE 12.9 CLOSED-LOOP LEARNING INTELLIGENCE MIGRATION
-- ============================================================

-- 1. LEARNING INTERVENTIONS TABLE
CREATE TABLE IF NOT EXISTS public.learning_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learning_path_id UUID NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  lesson_id UUID NULL REFERENCES public.lessons(id) ON DELETE CASCADE,

  concept TEXT NOT NULL,

  intervention_type TEXT NOT NULL CHECK (
    intervention_type IN (
      'tutor_explanation',
      'tutor_analogy',
      'tutor_step_by_step',
      'tutor_socratic',
      'targeted_practice',
      'prerequisite_repair',
      'study_notes_review',
      'quiz',
      'challenge_practice'
    )
  ),

  strategy TEXT NULL,
  trigger_reason TEXT NULL,

  mastery_before INTEGER NOT NULL DEFAULT 0,
  mastery_after INTEGER NULL,
  mastery_delta INTEGER NULL,

  score INTEGER NULL,
  effectiveness_score INTEGER NULL,
  successful BOOLEAN NULL,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDEXES FOR EFFICIENT RETRIEVAL
CREATE INDEX IF NOT EXISTS idx_learning_interventions_user_concept 
  ON public.learning_interventions(user_id, concept);

CREATE INDEX IF NOT EXISTS idx_learning_interventions_user_type 
  ON public.learning_interventions(user_id, intervention_type);

-- 3. ROW LEVEL SECURITY
ALTER TABLE public.learning_interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their own interventions" ON public.learning_interventions;
CREATE POLICY "Users view their own interventions" ON public.learning_interventions
  FOR SELECT USING (auth.uid() = user_id);

-- 4. POSTGREST SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
