-- ============================================================
-- CYRA AI — STAGE 12.6 CONTEXT-AWARE AI TUTOR MIGRATION
-- ============================================================

-- 1. AI TUTOR CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.ai_tutor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES public.profiles(id)
    ON DELETE CASCADE,

  lesson_id UUID
    REFERENCES public.lessons(id)
    ON DELETE CASCADE,

  title TEXT NOT NULL DEFAULT 'AI Tutor Conversation',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AI TUTOR MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.ai_tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL
    REFERENCES public.ai_tutor_conversations(id)
    ON DELETE CASCADE,

  role TEXT NOT NULL
    CHECK (role IN ('user', 'assistant')),

  content TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_tutor_conversations_user
  ON public.ai_tutor_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_conversations_lesson
  ON public.ai_tutor_conversations(lesson_id);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_conversations_user_lesson_updated
  ON public.ai_tutor_conversations(user_id, lesson_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_conversation
  ON public.ai_tutor_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_conversation_created
  ON public.ai_tutor_messages(conversation_id, created_at ASC);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.ai_tutor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. CONVERSATION READ POLICY
-- ============================================================

DROP POLICY IF EXISTS
  "Users view their own conversations"
ON public.ai_tutor_conversations;

CREATE POLICY
  "Users view their own conversations"
ON public.ai_tutor_conversations
FOR SELECT
USING (
  auth.uid() = user_id
);

-- ============================================================
-- 6. MESSAGE READ POLICY
-- ============================================================

DROP POLICY IF EXISTS
  "Users view their own tutor messages"
ON public.ai_tutor_messages;

CREATE POLICY
  "Users view their own tutor messages"
ON public.ai_tutor_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.ai_tutor_conversations c
    WHERE c.id = conversation_id
      AND c.user_id = auth.uid()
  )
);

-- No authenticated-client INSERT / UPDATE / DELETE policies.
-- Tutor conversation writes must occur through the secure
-- server-side Tutor API after authentication and ownership checks.

-- ============================================================
-- 7. POSTGREST SCHEMA RELOAD
-- ============================================================

NOTIFY pgrst, 'reload schema';
