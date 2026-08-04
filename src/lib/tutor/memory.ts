import { adminClient } from '@/lib/supabase/admin';
import { getAIProvider } from '@/lib/ai/provider';

export type MemoryType =
  | 'misconception'
  | 'recurring_weakness'
  | 'learning_preference'
  | 'successful_explanation'
  | 'improvement'
  | 'unresolved_gap';

export interface TutorMemoryItem {
  id?: string;
  concept: string;
  memoryType: MemoryType;
  content: string;
  confidence: number;
  occurrenceCount: number;
  lastObservedAt?: string;
  resolvedAt?: string | null;
}

export interface MemoryCandidate {
  concept: string;
  memoryType: MemoryType;
  content: string;
  confidence: number;
}

/**
 * Automatically marks weaknesses/misconceptions as resolved when concept mastery reaches >= 85%.
 */
export async function autoResolveMasteredMemories(userId: string): Promise<void> {
  try {
    const { data: masteredRows } = await adminClient
      .from('user_concept_mastery')
      .select('concept')
      .eq('user_id', userId)
      .gte('mastery_score', 85);

    if (masteredRows && masteredRows.length > 0) {
      const masteredConcepts = masteredRows.map((r) => r.concept);
      await adminClient
        .from('ai_tutor_memories')
        .update({
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .in('concept', masteredConcepts)
        .is('resolved_at', null)
        .in('memory_type', ['misconception', 'recurring_weakness', 'unresolved_gap']);
    }
  } catch (err) {
    console.warn('[TUTOR MEMORY] Auto-resolution check error:', err);
  }
}

/**
 * Retrieves bounded, prioritized tutor memories relevant to the current user and lesson concepts.
 * Max 8 memories, content truncated to 200 chars each.
 */
export async function getRelevantTutorMemories({
  userId,
  conceptList = [],
  lessonId,
}: {
  userId: string;
  conceptList?: string[];
  lessonId?: string | null;
}): Promise<TutorMemoryItem[]> {
  try {
    // 1. Auto-resolve memories for concepts that have reached >= 85% mastery
    await autoResolveMasteredMemories(userId);

    // 2. Fetch active (unresolved) and recently resolved memories for user
    const { data: rawMemories, error } = await adminClient
      .from('ai_tutor_memories')
      .select('*')
      .eq('user_id', userId)
      .order('last_observed_at', { ascending: false })
      .limit(30);

    if (error || !rawMemories || rawMemories.length === 0) {
      return [];
    }

    const conceptSet = new Set(conceptList.map((c) => c.toLowerCase()));

    // 3. Rank memories based on relevance, resolution status, occurrence count, and confidence
    const ranked = rawMemories.map((m) => {
      let score = 0;

      // Concept match bonus
      if (m.concept && conceptSet.has(m.concept.toLowerCase())) {
        score += 50;
      }

      // Unresolved bonus
      if (!m.resolved_at) {
        score += 30;
      }

      // High confidence & occurrence count bonus
      score += Math.min(20, m.occurrence_count * 5);
      score += Math.min(20, Math.round(m.confidence / 5));

      return { memory: m, score };
    });

    // Sort descending by score
    ranked.sort((a, b) => b.score - a.score);

    // Take top 8 bounded memories
    return ranked.slice(0, 8).map(({ memory: m }) => ({
      id: m.id,
      concept: m.concept || 'General',
      memoryType: m.memory_type as MemoryType,
      content: (m.content || '').slice(0, 200),
      confidence: m.confidence,
      occurrenceCount: m.occurrence_count,
      lastObservedAt: m.last_observed_at,
      resolvedAt: m.resolved_at,
    }));
  } catch (err) {
    console.error('[TUTOR MEMORY] Error fetching relevant memories:', err);
    return [];
  }
}

/**
 * Extracts durable educational memory candidates from a tutor interaction.
 */
export async function extractTutorMemoryCandidates({
  userMessage,
  assistantResponse,
  targetConcept,
}: {
  userMessage: string;
  assistantResponse: string;
  targetConcept?: string;
}): Promise<MemoryCandidate[]> {
  const trimmedUser = userMessage.trim().toLowerCase();

  // Skip trivial inputs (greetings, short responses, basic menu clicks)
  if (
    trimmedUser.length < 12 ||
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|got it|sure)$/i.test(trimmedUser)
  ) {
    return [];
  }

  try {
    const provider = getAIProvider();
    const prompt = `Analyze this educational dialogue between a student and an AI Tutor.
Target Concept: "${targetConcept || 'General'}"
Student Message: "${userMessage}"
Tutor Response: "${assistantResponse.slice(0, 400)}"

Did this interaction reveal any DURABLE EDUCATIONAL OBSERVATION worth remembering about the student?
Valid Memory Types:
- misconception (student revealed a specific conceptual misunderstanding)
- recurring_weakness (student needed repeated help or expressed confusion on a concept)
- learning_preference (student responded particularly well to analogies, step-by-step breakdowns, or simple visuals)
- successful_explanation (an explanation type that successfully resolved confusion)
- improvement (student demonstrated clear mastery or resolved a previous difficulty)
- unresolved_gap (student still has an open unanswered question or gap)

Return JSON ONLY in this format:
{
  "hasObservation": true/false,
  "memories": [
    {
      "concept": "${targetConcept || 'General'}",
      "memoryType": "misconception" | "recurring_weakness" | "learning_preference" | "successful_explanation" | "improvement" | "unresolved_gap",
      "content": "Short summary under 150 characters",
      "confidence": 60 to 90
    }
  ]
}
If no durable educational observation exists, return {"hasObservation": false, "memories": []}.`;

    const res = await provider.generateContent({
      prompt,
      systemInstruction: 'You are an educational observation analyzer. Output valid JSON only without markdown formatting.',
      temperature: 0.2,
      maxTokens: 300,
    });

    if (!res.success || !res.message) return [];

    let cleaned = res.message.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json?\s*/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);
    if (parsed.hasObservation && Array.isArray(parsed.memories)) {
      const validTypes: Set<string> = new Set([
        'misconception',
        'recurring_weakness',
        'learning_preference',
        'successful_explanation',
        'improvement',
        'unresolved_gap',
      ]);

      return parsed.memories
        .filter(
          (m: any) =>
            m &&
            typeof m.concept === 'string' &&
            validTypes.has(m.memoryType) &&
            typeof m.content === 'string' &&
            m.content.trim().length > 5
        )
        .map((m: any) => ({
          concept: m.concept.trim(),
          memoryType: m.memoryType as MemoryType,
          content: m.content.trim().slice(0, 200),
          confidence: Math.min(100, Math.max(10, parseInt(m.confidence, 10) || 60)),
        }));
    }
  } catch (err) {
    console.warn('[TUTOR MEMORY] Extraction error (non-critical):', err);
  }

  return [];
}

/**
 * Deduplicates and persists extracted memory candidates into public.ai_tutor_memories.
 */
export async function persistTutorMemories({
  userId,
  conversationId,
  lessonId,
  memories,
}: {
  userId: string;
  conversationId?: string | null;
  lessonId?: string | null;
  memories: MemoryCandidate[];
}): Promise<void> {
  if (!memories || memories.length === 0) return;

  for (const item of memories) {
    try {
      // Look up existing memory for (userId, concept, memoryType)
      const { data: existing } = await adminClient
        .from('ai_tutor_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('concept', item.concept)
        .eq('memory_type', item.memoryType)
        .is('resolved_at', null)
        .maybeSingle();

      const now = new Date().toISOString();

      if (existing) {
        // DEDUPLICATION & REINFORCEMENT: Update count, boost confidence (+15), refresh timestamp & content
        const newCount = (existing.occurrence_count || 1) + 1;
        const newConfidence = Math.min(100, (existing.confidence || 50) + 15);

        await adminClient
          .from('ai_tutor_memories')
          .update({
            occurrence_count: newCount,
            confidence: newConfidence,
            content: item.content.slice(0, 200),
            last_observed_at: now,
            updated_at: now,
          })
          .eq('id', existing.id);

        console.log(`[TUTOR MEMORY] REINFORCED: "${item.concept}" (${item.memoryType}) count: ${newCount}, confidence: ${newConfidence}%`);
      } else {
        // NEW MEMORY INSERTION
        await adminClient.from('ai_tutor_memories').insert({
          user_id: userId,
          concept: item.concept,
          memory_type: item.memoryType,
          content: item.content.slice(0, 200),
          confidence: Math.min(100, Math.max(10, item.confidence)),
          source_conversation_id: conversationId || null,
          source_lesson_id: lessonId || null,
          occurrence_count: 1,
          first_observed_at: now,
          last_observed_at: now,
        });

        console.log(`[TUTOR MEMORY] CREATED NEW MEMORY: "${item.concept}" (${item.memoryType}): "${item.content}"`);
      }
    } catch (dbErr) {
      console.error('[TUTOR MEMORY] Database persistence error:', dbErr);
    }
  }
}
