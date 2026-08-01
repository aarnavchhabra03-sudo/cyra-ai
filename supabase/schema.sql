-- ============================================================
-- CYRA AI DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'CYRA Learner'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. LEARNING PATHS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  experience_level TEXT DEFAULT 'beginner',
  minutes_per_day INTEGER DEFAULT 30,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own learning paths" ON public.learning_paths;
CREATE POLICY "Users can view their own learning paths"
  ON public.learning_paths FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own learning paths" ON public.learning_paths;
CREATE POLICY "Users can insert their own learning paths"
  ON public.learning_paths FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own learning paths" ON public.learning_paths;
CREATE POLICY "Users can update their own learning paths"
  ON public.learning_paths FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own learning paths" ON public.learning_paths;
CREATE POLICY "Users can delete their own learning paths"
  ON public.learning_paths FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. MODULES TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'locked' CHECK (status IN ('completed', 'in_progress', 'locked')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage modules of their learning paths" ON public.modules;
DROP POLICY IF EXISTS "Users can view modules of their learning paths" ON public.modules;
DROP POLICY IF EXISTS "Users can insert modules for their learning paths" ON public.modules;
DROP POLICY IF EXISTS "Users can update modules of their learning paths" ON public.modules;
DROP POLICY IF EXISTS "Users can delete modules of their learning paths" ON public.modules;

CREATE POLICY "Users can view modules of their learning paths"
  ON public.modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE learning_paths.id = modules.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert modules for their learning paths"
  ON public.modules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE learning_paths.id = modules.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update modules of their learning paths"
  ON public.modules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE learning_paths.id = modules.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete modules of their learning paths"
  ON public.modules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE learning_paths.id = modules.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. LESSONS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  estimated_minutes INTEGER DEFAULT 15,
  order_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'locked' CHECK (status IN ('completed', 'in_progress', 'locked')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage lessons of their learning paths" ON public.lessons;
DROP POLICY IF EXISTS "Users can view lessons of their learning paths" ON public.lessons;
DROP POLICY IF EXISTS "Users can insert lessons for their learning paths" ON public.lessons;
DROP POLICY IF EXISTS "Users can update lessons of their learning paths" ON public.lessons;
DROP POLICY IF EXISTS "Users can delete lessons of their learning paths" ON public.lessons;

CREATE POLICY "Users can view lessons of their learning paths"
  ON public.lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE modules.id = lessons.module_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert lessons for their learning paths"
  ON public.lessons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE modules.id = lessons.module_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update lessons of their learning paths"
  ON public.lessons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE modules.id = lessons.module_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete lessons of their learning paths"
  ON public.lessons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.learning_paths ON modules.learning_path_id = learning_paths.id
      WHERE modules.id = lessons.module_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 5. DAILY TASKS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  learning_path_id UUID REFERENCES public.learning_paths(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 20,
  completed BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT 'reading' CHECK (category IN ('quiz', 'reading', 'tutor', 'research')),
  due_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own daily tasks" ON public.daily_tasks;
CREATE POLICY "Users can manage their own daily tasks"
  ON public.daily_tasks FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. QUIZ ATTEMPTS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can manage their own quiz attempts"
  ON public.quiz_attempts FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 7. USER PROGRESS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own progress" ON public.user_progress;
CREATE POLICY "Users can manage their own progress"
  ON public.user_progress FOR ALL
  USING (auth.uid() = user_id);
