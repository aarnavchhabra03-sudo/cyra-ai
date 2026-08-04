import { adminClient } from '@/lib/supabase/admin';

export const ACTIVE_ASSESSMENT_TIMEOUT_MINUTES = 30;

/**
 * Server-side helper to expire stale active practice sessions older than 30 minutes.
 */
export async function expireStalePracticeSessions(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const cutoffTime = new Date(Date.now() - ACTIVE_ASSESSMENT_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    await adminClient
      .from('adaptive_practice_sessions')
      .update({ status: 'expired' })
      .eq('user_id', userId)
      .eq('status', 'active')
      .lt('created_at', cutoffTime);
  } catch (err) {
    console.warn('[ASSESSMENT LIFECYCLE] Error expiring stale sessions:', err);
  }
}

/**
 * Closes/completes all active assessment records for a user.
 * Invoked upon quiz submission, practice submission, or when creating a new assessment.
 */
export async function closeUserActiveAssessments(
  userId: string,
  lessonId?: string | null
): Promise<void> {
  if (!userId) return;

  try {
    const nowIso = new Date().toISOString();

    let query = adminClient
      .from('adaptive_practice_sessions')
      .update({
        status: 'completed',
        completed_at: nowIso,
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (lessonId) {
      query = query.eq('lesson_id', lessonId);
    }

    await query;

    // Also close any remaining active sessions for user regardless of lesson
    await adminClient
      .from('adaptive_practice_sessions')
      .update({
        status: 'abandoned',
        completed_at: nowIso,
      })
      .eq('user_id', userId)
      .eq('status', 'active');

    console.log(`[ASSESSMENT LIFECYCLE] Closed all active assessment sessions for user: ${userId}`);
  } catch (err) {
    console.error('[ASSESSMENT LIFECYCLE] Error closing active assessments:', err);
  }
}

/**
 * Authoritative server-side active assessment state detector.
 * Expires stale sessions first, then returns true ONLY if a non-expired active assessment exists.
 */
export async function checkAndCleanupActiveAssessment(userId: string): Promise<boolean> {
  if (!userId) return false;

  try {
    // 1. Expire stale active sessions older than cutoff
    await expireStalePracticeSessions(userId);

    // 2. Query for non-expired active sessions created within time window
    const cutoffTime = new Date(Date.now() - ACTIVE_ASSESSMENT_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    const { data: activeSessions, error } = await adminClient
      .from('adaptive_practice_sessions')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !activeSessions || activeSessions.length === 0) {
      return false;
    }

    return true;
  } catch (err) {
    console.error('[ASSESSMENT LIFECYCLE] Error checking active assessment:', err);
    return false;
  }
}
