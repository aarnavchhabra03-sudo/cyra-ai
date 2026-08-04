-- ============================================================
-- CYRA AI — STAGE 12.8C ACTIVE ASSESSMENT LIFECYCLE MIGRATION
-- ============================================================

-- 1. UPDATE STATUS CHECK CONSTRAINT TO ALLOW 'abandoned' AND 'expired'
ALTER TABLE public.adaptive_practice_sessions 
  DROP CONSTRAINT IF EXISTS adaptive_practice_sessions_status_check;

ALTER TABLE public.adaptive_practice_sessions 
  ADD CONSTRAINT adaptive_practice_sessions_status_check 
  CHECK (status IN ('active', 'completed', 'abandoned', 'expired'));

-- 2. INDEX FOR EFFICIENT ACTIVE SESSION QUERIES
CREATE INDEX IF NOT EXISTS idx_adaptive_practice_sessions_user_status 
  ON public.adaptive_practice_sessions(user_id, status);

-- 3. CLEANUP STALE ACTIVE SESSIONS
UPDATE public.adaptive_practice_sessions
SET status = 'expired'
WHERE status = 'active' AND created_at < NOW() - INTERVAL '30 minutes';

-- 4. POSTGREST SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
