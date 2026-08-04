import { adminClient } from '@/lib/supabase/admin';
import { getAIProvider } from '@/lib/ai/provider';

export type MemoryType =
  | 'misconception'
  | 'recurring_weakness'
  | 'learning_preference'
  | 'successful_explanation'
  | 'improvement'
  | 'unresolved_gap';

export type MemoryRelevance = 'exact' | 'related' | 'prerequisite' | 'general' | 'irrelevant';

export interface TutorMemoryItem {
  id?: string;
  concept: string;
  memoryType: MemoryType;
  content: string;
  confidence: number;
  occurrenceCount: number;
  lastObservedAt?: string;
  resolvedAt?: string | null;
  relevance?: MemoryRelevance;
  reliabilityScore?: number;
}

export interface MemoryCandidate {
  concept: string;
  memoryType: MemoryType;
  content: string;
  confidence: number;
}

/**
 * Normalizes concept names for deterministic comparison
 */
export function normalizeConceptName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Deterministically classifies the relevance of a memory relative to a target concept.
 */
export function classifyMemoryRelevance({
  memoryConcept,
  memoryType,
  memoryContent,
  targetConcept,
  lessonConcepts = [],
}: {
  memoryConcept: string;
  memoryType: MemoryType;
  memoryContent: string;
  targetConcept: string;
  lessonConcepts?: string[];
}): MemoryRelevance {
  const normMem = normalizeConceptName(memoryConcept);
  const normTarget = normalizeConceptName(targetConcept);

  // 1. EXACT MATCH
  if (normMem && normTarget && normMem === normTarget) {
    return 'exact';
  }

  // 2. GENERAL LEARNING PREFERENCE (Global pedagogical preference)
  if (memoryType === 'learning_preference' && /analogy|analogies|step|visual|simple|bullet/i.test(memoryContent)) {
    return 'general';
  }

  // 3. RELATED MATCH (Word overlap or substring match)
  if (normMem && normTarget) {
    if (normMem.includes(normTarget) || normTarget.includes(normMem)) {
      return 'related';
    }
    const memWords = new Set(normMem.split(' ').filter((w) => w.length > 3));
    const targetWords = new Set(normTarget.split(' ').filter((w) => w.length > 3));
    const intersection = [...memWords].filter((w) => targetWords.has(w));
    if (intersection.length > 0) {
      return 'related';
    }
  }

  // 4. PREREQUISITE / LESSON CONTEXT MATCH
  const normLessonConcepts = new Set(lessonConcepts.map(normalizeConceptName));
  if (normMem && normLessonConcepts.has(normMem)) {
    return 'prerequisite';
  }

  // 5. IRRELEVANT (Concept-specific memory for a completely unrelated concept)
  return 'irrelevant';
}

/**
 * Calculates recency factor based on age of observation
 */
export function calculateRecencyFactor(lastObservedAt?: string): number {
  if (!lastObservedAt) return 0.5;
  const daysDiff = (Date.now() - new Date(lastObservedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff < 7) return 1.0;
  if (daysDiff < 30) return 0.85;
  if (daysDiff < 90) return 0.65;
  return 0.40;
}

/**
 * Calculates bounded reliability score (0-100) combining confidence, occurrence count, relevance, and recency decay.
 */
export function calculateReliabilityScore({
  confidence,
  occurrenceCount,
  relevance,
  lastObservedAt,
}: {
  confidence: number;
  occurrenceCount: number;
  relevance: MemoryRelevance;
  lastObservedAt?: string;
}): number {
  if (relevance === 'irrelevant') {
    return 0;
  }

  let relevanceWeight = 0;
  if (relevance === 'exact') relevanceWeight = 100;
  else if (relevance === 'related') relevanceWeight = 60;
  else if (relevance === 'prerequisite') relevanceWeight = 40;
  else if (relevance === 'general') relevanceWeight = 25;

  const recencyFactor = calculateRecencyFactor(lastObservedAt);
  const occurrenceFactor = Math.min(100, occurrenceCount * 25);

  const score =
    0.40 * Math.min(100, confidence) +
    0.20 * occurrenceFactor +
    0.30 * relevanceWeight +
    0.10 * (recencyFactor * 100);

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Automatically marks weaknesses/misconceptions as resolved when concept mastery reaches >= 85% with concept matching.
 */
export async function autoResolveMasteredMemories(userId: string): Promise<void> {
  try {
    const { data: masteredRows } = await adminClient
      .from('user_concept_mastery')
      .select('concept')
      .eq('user_id', userId)
      .gte('mastery_score', 85);

    if (masteredRows && masteredRows.length > 0) {
      const { data: activeMemories } = await adminClient
        .from('ai_tutor_memories')
        .select('id, concept')
        .eq('user_id', userId)
        .is('resolved_at', null)
        .in('memory_type', ['misconception', 'recurring_weakness', 'unresolved_gap']);

      if (activeMemories && activeMemories.length > 0) {
        const idsToResolve: string[] = [];

        for (const mem of activeMemories) {
          const normMem = normalizeConceptName(mem.concept);
          const isMastered = masteredRows.some(
            (mRow) => normalizeConceptName(mRow.concept) === normMem
          );
          if (isMastered) {
            idsToResolve.push(mem.id);
          }
        }

        if (idsToResolve.length > 0) {
          await adminClient
            .from('ai_tutor_memories')
            .update({
              resolved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .in('id', idsToResolve);

          console.log(`[TUTOR MEMORY] Auto-resolved ${idsToResolve.length} memories due to concept mastery >= 85%`);
        }
      }
    }
  } catch (err) {
    console.warn('[TUTOR MEMORY] Auto-resolution check error:', err);
  }
}

/**
 * Retrieves bounded, prioritized tutor memories relevant to the target concept and lesson.
 * Filters out irrelevant cross-concept leakage.
 */
export async function getRelevantTutorMemories({
  userId,
  targetConcept,
  conceptList = [],
  lessonId,
}: {
  userId: string;
  targetConcept: string;
  conceptList?: string[];
  lessonId?: string | null;
}): Promise<TutorMemoryItem[]> {
  try {
    // 1. Auto-resolve memories for concepts that have reached >= 85% mastery
    await autoResolveMasteredMemories(userId);

    // 2. Fetch active (unresolved) memories for user
    const { data: rawMemories, error } = await adminClient
      .from('ai_tutor_memories')
      .select('*')
      .eq('user_id', userId)
      .is('resolved_at', null)
      .order('last_observed_at', { ascending: false })
      .limit(30);

    if (error || !rawMemories || rawMemories.length === 0) {
      return [];
    }

    // 3. Classify relevance and compute reliability scores
    const evaluated: TutorMemoryItem[] = [];

    for (const m of rawMemories) {
      const relevance = classifyMemoryRelevance({
        memoryConcept: m.concept || 'General',
        memoryType: m.memory_type as MemoryType,
        memoryContent: m.content || '',
        targetConcept,
        lessonConcepts: conceptList,
      });

      // Filter out irrelevant cross-concept memory leakage
      if (relevance === 'irrelevant') {
        continue;
      }

      const reliabilityScore = calculateReliabilityScore({
        confidence: m.confidence,
        occurrenceCount: m.occurrence_count,
        relevance,
        lastObservedAt: m.last_observed_at,
      });

      // Minimum reliability threshold for context inclusion
      if (reliabilityScore >= 40) {
        evaluated.push({
          id: m.id,
          concept: m.concept || 'General',
          memoryType: m.memory_type as MemoryType,
          content: (m.content || '').slice(0, 200),
          confidence: m.confidence,
          occurrenceCount: m.occurrence_count,
          lastObservedAt: m.last_observed_at,
          resolvedAt: m.resolved_at,
          relevance,
          reliabilityScore,
        });
      }
    }

    // 4. Sort descending by reliability score
    evaluated.sort((a, b) => (b.reliabilityScore || 0) - (a.reliabilityScore || 0));

    // Bounded top 8 memories
    return evaluated.slice(0, 8);
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
 * Deduplicates, resolves contradictions, and persists extracted memory candidates into public.ai_tutor_memories.
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
      const normConcept = normalizeConceptName(item.concept);

      // CONTRADICTION HANDLING: If new memory is an improvement, resolve past active misconceptions/weaknesses on this concept
      if (item.memoryType === 'improvement' || item.memoryType === 'successful_explanation') {
        const { data: contradictoryMemories } = await adminClient
          .from('ai_tutor_memories')
          .select('id, concept')
          .eq('user_id', userId)
          .is('resolved_at', null)
          .in('memory_type', ['misconception', 'recurring_weakness', 'unresolved_gap']);

        if (contradictoryMemories && contradictoryMemories.length > 0) {
          const idsToResolve = contradictoryMemories
            .filter((cm) => normalizeConceptName(cm.concept) === normConcept)
            .map((cm) => cm.id);

          if (idsToResolve.length > 0) {
            await adminClient
              .from('ai_tutor_memories')
              .update({
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .in('id', idsToResolve);

            console.log(`[TUTOR MEMORY CONTRADICTION] Resolved ${idsToResolve.length} past misconceptions/weaknesses for "${item.concept}" due to new improvement evidence.`);
          }
        }
      }

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
        // DEDUPLICATION & REINFORCEMENT
        const newCount = (existing.occurrence_count || 1) + 1;
        const newConfidence = Math.min(100, (existing.confidence || 50) + 15);

        await adminClient
          .from('ai_tutor_memories')
          .update({
            occurrence_count: newCount,
            confidence: newConfidence,
            content: item.content.slice(0, 200),
            source_lesson_id: lessonId || existing.source_lesson_id || null,
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
