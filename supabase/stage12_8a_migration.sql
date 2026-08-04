-- ============================================================
-- CYRA AI — STAGE 12.8A LEARNER KNOWLEDGE GRAPH MIGRATION
-- ============================================================

-- 1. CONCEPT RELATIONSHIPS TABLE
CREATE TABLE IF NOT EXISTS public.concept_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_concept TEXT NOT NULL,
  target_concept TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (
    relationship_type IN ('prerequisite', 'related', 'builds_on', 'application_of')
  ),
  strength INTEGER NOT NULL DEFAULT 80 CHECK (strength >= 0 AND strength <= 100),
  source_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  target_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent self-referential loops
  CONSTRAINT chk_no_self_loop CHECK (source_concept <> target_concept)
);

-- ============================================================
-- 2. INDEXES & CONSTRAINTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_concept_relationships_user ON public.concept_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_concept_relationships_source ON public.concept_relationships(source_concept);
CREATE INDEX IF NOT EXISTS idx_concept_relationships_target ON public.concept_relationships(target_concept);
CREATE INDEX IF NOT EXISTS idx_concept_relationships_type ON public.concept_relationships(relationship_type);

-- Unique composite index to prevent duplicate edges
CREATE UNIQUE INDEX IF NOT EXISTS idx_concept_relationships_user_src_tgt 
  ON public.concept_relationships(user_id, source_concept, target_concept, relationship_type);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.concept_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their own concept relationships" ON public.concept_relationships;
CREATE POLICY "Users view their own concept relationships" ON public.concept_relationships
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 4. POSTGREST SCHEMA RELOAD
-- ============================================================

NOTIFY pgrst, 'reload schema';
