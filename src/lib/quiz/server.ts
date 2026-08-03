import { createClient } from '@/lib/supabase/server';
import { 
  QuizRecord, 
  SafeQuizQuestion, 
  QuizAttemptRecord, 
  QuizQuestionRecord 
} from '@/types/quiz';

/**
 * Server-side function to retrieve Quiz metadata for a specific lesson.
 * Verifies that the requesting user owns the underlying learning path.
 */
export async function getQuizForLesson(lessonId: string): Promise<QuizRecord | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Query quiz joined with lesson -> module -> learning_path to check user_id
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      *,
      lessons!inner (
        modules!inner (
          learning_paths!inner (
            user_id
          )
        )
      )
    `)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const parentPath = (data as any).lessons?.modules?.learning_paths;
  if (!parentPath || parentPath.user_id !== user.id) {
    return null; // Authorization failed
  }

  // Strip join relational data and return clean QuizRecord
  const { lessons, ...quizRecord } = data as any;
  return quizRecord as QuizRecord;
}

/**
 * Server-side function to retrieve BROWSER-SAFE questions for a quiz.
 * CRITICAL SECURITY GUARANTEE: This function strips `correct_answer` and `explanation`
 * before returning questions to the client.
 */
export async function getSafeQuizQuestions(quizId: string): Promise<SafeQuizQuestion[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  // Try RPC first if created, or server query projecting safe fields
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_safe_quiz_questions', {
    p_quiz_id: quizId
  });

  if (!rpcErr && rpcData) {
    return rpcData as SafeQuizQuestion[];
  }

  // Fallback server projection: SELECT ONLY safe non-privileged columns
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, quiz_id, question_order, question_type, question_text, options, concept, difficulty, points')
    .eq('quiz_id', quizId)
    .order('question_order', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as SafeQuizQuestion[];
}

/**
 * Server-side foundation stub: Start a new quiz attempt.
 */
export async function startQuizAttempt(
  quizId: string, 
  lessonId: string
): Promise<QuizAttemptRecord | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({
      user_id: user.id,
      quiz_id: quizId,
      lesson_id: lessonId,
      score: 0,
      percentage: 0,
      total_questions: 0,
      correct_answers: 0,
      passed: false,
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      xp_awarded: 0,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[QUIZ SERVER] Error starting attempt:', error);
    return null;
  }

  return data as QuizAttemptRecord;
}
