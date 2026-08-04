-- ============================================================
-- CYRA AI — STAGE 12.6 CONTEXT-AWARE AI TUTOR MIGRATION
-- ============================================================

-- 1. AI TUTOR CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.ai_tutor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'AI Tutor Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AI TUTOR MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.ai_tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_tutor_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR HIGH-PERFORMANCE CONVERSATION LOOKUPS
CREATE INDEX IF NOT EXISTS idx_ai_tutor_conversations_user ON public.ai_tutor_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_conversations_lesson ON public.ai_tutor_conversations(lesson_id);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_conversation ON public.ai_tutor_messages(conversation_id);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.ai_tutor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_messages ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (USERS CAN READ ONLY THEIR OWN CONVERSATIONS AND MESSAGES)
DROP POLICY IF EXISTS "Users view their own conversations" ON public.ai_tutor_conversations;
CREATE POLICY "Users view their own conversations" ON public.ai_tutor_conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view their own tutor messages" ON public.ai_tutor_messages;
CREATE POLICY "Users view their own tutor messages" ON public.ai_tutor_messages
  FOR SELECT USING (
    auth.uid() = (
      SELECT user_id FROM public.ai_tutor_conversations WHERE id = conversation_id
    )
  );

-- RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
