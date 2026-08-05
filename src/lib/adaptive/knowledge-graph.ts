import { adminClient } from '@/lib/supabase/admin';

export type RelationshipType = 'prerequisite' | 'related' | 'builds_on' | 'application_of';

export interface ConceptRelationship {
  id?: string;
  sourceConcept: string;
  targetConcept: string;
  relationshipType: RelationshipType;
  strength: number;
  sourceLessonId?: string | null;
  targetLessonId?: string | null;
}

export interface BlockingPrerequisite {
  concept: string;
  masteryScore: number;
  strength: number;
}

export interface ConceptReadiness {
  concept: string;
  masteryScore: number;
  readinessScore: number;
  blocked: boolean;
  blockingPrerequisites: BlockingPrerequisite[];
}

export interface RootKnowledgeGap {
  concept: string;
  masteryScore: number;
  rootGapScore: number;
  affectedDownstreamConcepts: Array<{ concept: string; masteryScore: number }>;
  blockingCount: number;
}

export interface KnowledgeGraphData {
  concepts: string[];
  relationships: ConceptRelationship[];
  rootGaps: RootKnowledgeGap[];
  blockedConcepts: ConceptReadiness[];
}

/**
 * Normalizes concept string for graph comparisons
 */
export function normalizeGraphConcept(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Helper to fetch all unique lesson IDs belonging to a learning path.
 */
export async function getLearningPathLessons(learningPathId: string): Promise<string[]> {
  if (!learningPathId) return [];
  try {
    const { data } = await adminClient
      .from('lessons')
      .select('id, modules!inner(learning_path_id)')
      .eq('modules.learning_path_id', learningPathId);
    return (data || []).map((r) => r.id);
  } catch (err) {
    console.error('[KNOWLEDGE GRAPH] Error in getLearningPathLessons:', err);
    return [];
  }
}

/**
 * Helper to fetch all unique concepts (lesson titles and key concepts) belonging to a learning path.
 */
export async function getLearningPathConcepts(learningPathId: string): Promise<Set<string>> {
  const concepts = new Set<string>();
  if (!learningPathId) return concepts;
  try {
    const { data } = await adminClient
      .from('lessons')
      .select(`
        title,
        modules!inner (
          learning_path_id
        ),
        study_notes (
          key_concepts
        )
      `)
      .eq('modules.learning_path_id', learningPathId);

    if (data) {
      for (const row of data as any[]) {
        if (row.title) {
          concepts.add(row.title.trim());
        }
        const notes = Array.isArray(row.study_notes) ? row.study_notes[0] : row.study_notes;
        if (notes && Array.isArray(notes.key_concepts)) {
          for (const kc of notes.key_concepts) {
            if (kc && typeof kc === 'string') {
              concepts.add(kc.trim());
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[KNOWLEDGE GRAPH] Error in getLearningPathConcepts:', err);
  }
  return concepts;
}

/**
 * Seeds default standard prerequisite relationships if no custom edges exist for user.
 */
export async function seedDefaultKnowledgeGraph(userId: string): Promise<void> {
  try {
    const { count } = await adminClient
      .from('concept_relationships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count !== null && count > 0) {
      return; // Already populated
    }

    const defaultEdges: Array<{
      source: string;
      target: string;
      type: RelationshipType;
      strength: number;
    }> = [
      { source: 'Definition of a Cell', target: 'Organelles and Cell Type', type: 'prerequisite', strength: 90 },
      { source: 'Importance of Cellular Biology', target: 'Definition of a Cell', type: 'related', strength: 70 },
      { source: 'Organelles and Cell Type', target: 'Cell Membrane Function', type: 'prerequisite', strength: 85 },
      { source: 'Organelles and Cell Type', target: 'Eukaryotic Cell Characteristics', type: 'prerequisite', strength: 80 },
      { source: 'Prokaryotic vs. Eukaryotic Cells', target: 'Eukaryotic Cell Characteristics', type: 'builds_on', strength: 85 },
      { source: 'Eukaryotic Cell Characteristics', target: 'Cellular Energy Production', type: 'prerequisite', strength: 90 },
      { source: 'Cellular Energy Production', target: 'Mitochondria', type: 'prerequisite', strength: 95 },
      { source: 'Mitochondria', target: 'Cellular Respiration', type: 'prerequisite', strength: 95 },
      { source: 'Cellular Respiration', target: 'ATP Production', type: 'application_of', strength: 90 },
    ];

    const toInsert = defaultEdges.map((e) => ({
      user_id: userId,
      source_concept: e.source,
      target_concept: e.target,
      relationship_type: e.type,
      strength: e.strength,
    }));

    await adminClient.from('concept_relationships').upsert(toInsert, {
      onConflict: 'user_id,source_concept,target_concept,relationship_type',
      ignoreDuplicates: true,
    });

    console.log(`[KNOWLEDGE GRAPH] Seeded ${defaultEdges.length} default prerequisite relationships for user:`, userId);
  } catch (err) {
    console.warn('[KNOWLEDGE GRAPH] Error seeding default relationships:', err);
  }
}

/**
 * Loads concept relationships for a user.
 * Returns empty array if no graph edges exist yet for user.
 */
export async function getUserConceptRelationships(
  userId: string,
  learningPathId?: string | null
): Promise<ConceptRelationship[]> {
  try {
    let query = adminClient
      .from('concept_relationships')
      .select('*')
      .eq('user_id', userId);

    if (learningPathId) {
      const lpConcepts = await getLearningPathConcepts(learningPathId);
      if (lpConcepts.size > 0) {
        query = query
          .in('source_concept', Array.from(lpConcepts))
          .in('target_concept', Array.from(lpConcepts));
      } else {
        return [];
      }
    }

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    return rows.map((r) => ({
      id: r.id,
      sourceConcept: r.source_concept,
      targetConcept: r.target_concept,
      relationshipType: r.relationship_type as RelationshipType,
      strength: r.strength,
      sourceLessonId: r.source_lesson_id,
      targetLessonId: r.target_lesson_id,
    }));
  } catch (err) {
    console.error('[KNOWLEDGE GRAPH] Error fetching relationships:', err);
    return [];
  }
}

/**
 * Calculates concept readiness score (0-100) and blocked status based on prerequisite mastery.
 */
export function calculateConceptReadiness({
  targetConcept,
  masteryMap,
  relationships,
}: {
  targetConcept: string;
  masteryMap: Map<string, number>;
  relationships: ConceptRelationship[];
}): ConceptReadiness {
  const normTarget = normalizeGraphConcept(targetConcept);
  const targetMastery = masteryMap.get(normTarget) ?? 0;

  // Find all direct prerequisites pointing to targetConcept
  // (where targetConcept is the target, and sourceConcept is the prerequisite)
  const prereqEdges = relationships.filter(
    (r) =>
      (r.relationshipType === 'prerequisite' || r.relationshipType === 'builds_on') &&
      normalizeGraphConcept(r.targetConcept) === normTarget
  );

  if (prereqEdges.length === 0) {
    return {
      concept: targetConcept,
      masteryScore: targetMastery,
      readinessScore: 100,
      blocked: false,
      blockingPrerequisites: [],
    };
  }

  let totalWeightedMastery = 0;
  let totalWeight = 0;
  const blockingPrerequisites: BlockingPrerequisite[] = [];

  for (const edge of prereqEdges) {
    const normSource = normalizeGraphConcept(edge.sourceConcept);
    const prereqMastery = masteryMap.get(normSource) ?? 0;
    const weight = edge.strength || 80;

    totalWeightedMastery += prereqMastery * weight;
    totalWeight += weight;

    // Prerequisite is blocking if prerequisite mastery < 40
    if (prereqMastery < 40) {
      blockingPrerequisites.push({
        concept: edge.sourceConcept,
        masteryScore: prereqMastery,
        strength: weight,
      });
    }
  }

  const readinessScore =
    totalWeight > 0
      ? Math.min(100, Math.max(0, Math.round(totalWeightedMastery / totalWeight)))
      : 100;

  // Blocked if readiness < 50 AND at least one significant prerequisite has mastery < 40
  const blocked = readinessScore < 50 && blockingPrerequisites.length > 0;

  return {
    concept: targetConcept,
    masteryScore: targetMastery,
    readinessScore,
    blocked,
    blockingPrerequisites,
  };
}

/**
 * Detects root knowledge gaps by analyzing downstream dependency impact and cycle-safe traversal.
 */
export function detectRootKnowledgeGaps({
  masteryMap,
  relationships,
}: {
  masteryMap: Map<string, number>;
  relationships: ConceptRelationship[];
}): RootKnowledgeGap[] {
  const rootGaps: RootKnowledgeGap[] = [];

  // Map concepts to their downstream dependents
  // sourceConcept -> list of targetConcepts that depend on it
  const dependentsMap = new Map<string, string[]>();

  for (const rel of relationships) {
    if (rel.relationshipType === 'prerequisite' || rel.relationshipType === 'builds_on') {
      const srcNorm = normalizeGraphConcept(rel.sourceConcept);
      const tgtNorm = rel.targetConcept;
      if (!dependentsMap.has(srcNorm)) {
        dependentsMap.set(srcNorm, []);
      }
      dependentsMap.get(srcNorm)!.push(tgtNorm);
    }
  }

  // Iterate over all concepts in mastery map that are weak (< 40%)
  for (const [normConcept, score] of masteryMap.entries()) {
    if (score < 40) {
      // Find downstream dependents using cycle-safe BFS traversal
      const affectedDownstream: Array<{ concept: string; masteryScore: number }> = [];
      const visited = new Set<string>();
      const queue: string[] = dependentsMap.get(normConcept) || [];

      while (queue.length > 0 && visited.size < 15) {
        const nextTarget = queue.shift()!;
        const nextNorm = normalizeGraphConcept(nextTarget);

        if (visited.has(nextNorm)) continue;
        visited.add(nextNorm);

        const targetScore = masteryMap.get(nextNorm) ?? 0;
        affectedDownstream.push({
          concept: nextTarget,
          masteryScore: targetScore,
        });

        // Add next-level downstream dependents
        const deeper = dependentsMap.get(nextNorm) || [];
        for (const d of deeper) {
          if (!visited.has(normalizeGraphConcept(d))) {
            queue.push(d);
          }
        }
      }

      const blockingCount = affectedDownstream.length;

      // Root Gap Score calculation: weakness severity + downstream impact
      const rootGapScore = Math.min(
        100,
        Math.max(0, Math.round((40 - score) * 1.5 + blockingCount * 20))
      );

      if (blockingCount > 0 || score < 25) {
        // Find original concept display name
        const displayConcept =
          relationships.find((r) => normalizeGraphConcept(r.sourceConcept) === normConcept)?.sourceConcept ||
          normConcept;

        rootGaps.push({
          concept: displayConcept,
          masteryScore: score,
          rootGapScore,
          affectedDownstreamConcepts: affectedDownstream,
          blockingCount,
        });
      }
    }
  }

  // Sort descending by rootGapScore
  rootGaps.sort((a, b) => b.rootGapScore - a.rootGapScore);

  return rootGaps;
}

/**
 * Builds complete Learner Knowledge Graph data structure for a user.
 */
export async function buildLearnerKnowledgeGraph(
  userId: string,
  learningPathId?: string | null
): Promise<KnowledgeGraphData> {
  try {
    const relationships = await getUserConceptRelationships(userId, learningPathId);

    // Fetch user concept mastery
    let query = adminClient
      .from('user_concept_mastery')
      .select('concept, mastery_score')
      .eq('user_id', userId);

    if (learningPathId) {
      query = query.eq('learning_path_id', learningPathId);
    } else {
      query = query.is('learning_path_id', null);
    }

    const { data: masteryRows } = await query;

    const masteryMap = new Map<string, number>();
    const allConceptsSet = new Set<string>();

    if (masteryRows) {
      for (const row of masteryRows) {
        const norm = normalizeGraphConcept(row.concept);
        masteryMap.set(norm, row.mastery_score);
        allConceptsSet.add(row.concept);
      }
    }

    for (const rel of relationships) {
      allConceptsSet.add(rel.sourceConcept);
      allConceptsSet.add(rel.targetConcept);
    }

    const concepts = Array.from(allConceptsSet);

    // Calculate readiness for all concepts
    const blockedConcepts: ConceptReadiness[] = [];
    for (const c of concepts) {
      const readiness = calculateConceptReadiness({
        targetConcept: c,
        masteryMap,
        relationships,
      });
      if (readiness.blocked) {
        blockedConcepts.push(readiness);
      }
    }

    // Detect root knowledge gaps
    const rootGaps = detectRootKnowledgeGaps({
      masteryMap,
      relationships,
    });

    return {
      concepts,
      relationships,
      rootGaps,
      blockedConcepts,
    };
  } catch (err) {
    console.error('[KNOWLEDGE GRAPH] Error building learner knowledge graph:', err);
    return {
      concepts: [],
      relationships: [],
      rootGaps: [],
      blockedConcepts: [],
    };
  }
}

/**
 * Server-side validated save for concept relationships.
 */
export async function saveConceptRelationships({
  userId,
  relationships,
}: {
  userId: string;
  relationships: ConceptRelationship[];
}): Promise<boolean> {
  if (!userId || !Array.isArray(relationships) || relationships.length === 0) {
    return false;
  }

  const validTypes = new Set(['prerequisite', 'related', 'builds_on', 'application_of']);
  const validatedToInsert: any[] = [];

  for (const rel of relationships) {
    const normSrc = normalizeGraphConcept(rel.sourceConcept);
    const normTgt = normalizeGraphConcept(rel.targetConcept);

    // Validation rules
    if (!normSrc || !normTgt || normSrc === normTgt) continue;
    if (!validTypes.has(rel.relationshipType)) continue;

    const strength = Math.min(100, Math.max(0, parseInt(String(rel.strength), 10) || 80));

    validatedToInsert.push({
      user_id: userId,
      source_concept: rel.sourceConcept.trim(),
      target_concept: rel.targetConcept.trim(),
      relationship_type: rel.relationshipType,
      strength,
      source_lesson_id: rel.sourceLessonId || null,
      target_lesson_id: rel.targetLessonId || null,
    });
  }

  if (validatedToInsert.length === 0) return false;

  try {
    const { error } = await adminClient.from('concept_relationships').upsert(validatedToInsert, {
      onConflict: 'user_id,source_concept,target_concept,relationship_type',
      ignoreDuplicates: true,
    });

    if (error) {
      console.error('[KNOWLEDGE GRAPH] Upsert error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[KNOWLEDGE GRAPH] Save exception:', err);
    return false;
  }
}
