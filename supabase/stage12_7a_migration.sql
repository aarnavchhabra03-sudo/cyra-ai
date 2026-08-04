-- ============================================================
-- CYRA AI — STAGE 12.7A PERSISTENT TUTOR MEMORY MIGRATION
-- ============================================================

-- 1. AI TUTOR MEMORIES TABLE
CREATE TABLE IF NOT EXISTS public.ai_tutor_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  concept TEXT NOT NULL DEFAULT 'General',
  memory_type TEXT NOT NULL CHECK (
    memory_type IN (
      'misconception',
      'recurring_weakness',
      'learning_preference',
      'successful_explanation',
      'improvement',
      'unresolved_gap'
    )
  ),
  content TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  source_conversation_id UUID REFERENCES public.ai_tutor_conversations(id) ON DELETE SET NULL,
  source_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES & CONSTRAINTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_tutor_memories_user ON public.ai_tutor_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_memories_concept ON public.ai_tutor_memories(concept);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_memories_type ON public.ai_tutor_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_memories_user_observed ON public.ai_tutor_memories(user_id, last_observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_memories_user_concept_type ON public.ai_tutor_memories(user_id, concept, memory_type);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.ai_tutor_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their own memories" ON public.ai_tutor_memories;
CREATE POLICY "Users view their own memories" ON public.ai_tutor_memories
  FOR SELECT USING (auth.uid() = user_id);

-- All memory inserts/updates occur via server-side API (adminClient) after user authentication.

-- ============================================================
-- 4. POSTGREST SCHEMA RELOAD
-- ============================================================

NOTIFY pgrst, 'reload schema';
