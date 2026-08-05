-- ============================================================
-- CYRA AI — STAGE 12.9B CRITICAL COURSE ISOLATION MIGRATION
-- ============================================================

-- 1. ADD learning_path_id TO user_concept_mastery
ALTER TABLE public.user_concept_mastery
  ADD COLUMN IF NOT EXISTS learning_path_id UUID NULL
    REFERENCES public.learning_paths(id) ON DELETE CASCADE;

-- Replace unique constraint for user_concept_mastery
ALTER TABLE public.user_concept_mastery
  DROP CONSTRAINT IF EXISTS unique_user_concept;

-- Create unique index to handle nullable learning_path_id cleanly
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_concept_mastery_path
  ON public.user_concept_mastery(user_id, concept, learning_path_id)
  WHERE learning_path_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_concept_mastery_null_path
  ON public.user_concept_mastery(user_id, concept)
  WHERE learning_path_id IS NULL;

-- 2. ADD learning_path_id TO ai_tutor_memories
ALTER TABLE public.ai_tutor_memories
  ADD COLUMN IF NOT EXISTS learning_path_id UUID NULL
    REFERENCES public.learning_paths(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_tutor_memories_user_path
  ON public.ai_tutor_memories(user_id, learning_path_id);

-- 3. ADD learning_path_id TO ai_tutor_conversations
ALTER TABLE public.ai_tutor_conversations
  ADD COLUMN IF NOT EXISTS learning_path_id UUID NULL
    REFERENCES public.learning_paths(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_tutor_conversations_user_path
  ON public.ai_tutor_conversations(user_id, learning_path_id);

-- 4. DETERMINISTIC BACKFILL MIGRATION
-- Backfill ai_tutor_memories
UPDATE public.ai_tutor_memories m
SET learning_path_id = (
  SELECT modules.learning_path_id
  FROM public.lessons
  JOIN public.modules ON lessons.module_id = modules.id
  WHERE lessons.id = m.source_lesson_id
)
WHERE m.learning_path_id IS NULL AND m.source_lesson_id IS NOT NULL;

-- Backfill ai_tutor_conversations
UPDATE public.ai_tutor_conversations c
SET learning_path_id = (
  SELECT modules.learning_path_id
  FROM public.lessons
  JOIN public.modules ON lessons.module_id = modules.id
  WHERE lessons.id = c.lesson_id
)
WHERE c.learning_path_id IS NULL AND c.lesson_id IS NOT NULL;

-- Backfill user_concept_mastery based on concept association with lessons of a path
-- If a concept belongs to a lesson (via study_notes key_concepts or quiz_questions concept), assign that path
UPDATE public.user_concept_mastery ucm
SET learning_path_id = COALESCE(
  (
    SELECT modules.learning_path_id
    FROM public.quiz_questions qq
    JOIN public.quizzes q ON qq.quiz_id = q.id
    JOIN public.lessons l ON q.lesson_id = l.id
    JOIN public.modules ON l.module_id = modules.id
    WHERE qq.concept = ucm.concept
    LIMIT 1
  ),
  (
    SELECT modules.learning_path_id
    FROM public.adaptive_practice_sessions aps
    JOIN public.lessons l ON aps.lesson_id = l.id
    JOIN public.modules ON l.module_id = modules.id
    WHERE aps.concept = ucm.concept
    LIMIT 1
  )
)
WHERE ucm.learning_path_id IS NULL;

-- 5. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
