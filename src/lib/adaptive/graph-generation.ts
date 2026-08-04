import { adminClient } from '@/lib/supabase/admin';
import { getAIProvider } from '@/lib/ai/provider';
import { ConceptRelationship, normalizeGraphConcept, saveConceptRelationships } from './knowledge-graph';

export interface ConceptRegistryItem {
  normalizedName: string;
  displayName: string;
  lessonId: string;
  moduleId: string;
}

export interface GraphGenerationResult {
  conceptCount: number;
  relationshipCount: number;
  generated: boolean;
  error?: string;
}

/**
 * Builds a deterministic concept registry for a learning path from actual course database records.
 */
export async function buildLearningPathConceptRegistry(
  learningPathId: string,
  userId: string
): Promise<{ registry: Map<string, ConceptRegistryItem>; courseTitle: string }> {
  const registry = new Map<string, ConceptRegistryItem>();
  let courseTitle = 'Coursework';

  // 1. Verify learning path ownership
  const { data: pathRecord, error: pathErr } = await adminClient
    .from('learning_paths')
    .select('id, title, user_id')
    .eq('id', learningPathId)
    .single();

  if (pathErr || !pathRecord || pathRecord.user_id !== userId) {
    throw new Error('Unauthorized or invalid learning path ID.');
  }

  courseTitle = pathRecord.title;

  // 2. Fetch modules, lessons, and study notes belonging to this learning path
  const { data: modulesData, error: modErr } = await adminClient
    .from('modules')
    .select(`
      id,
      title,
      lessons (
        id,
        title,
        study_notes (
          key_concepts
        )
      )
    `)
    .eq('learning_path_id', learningPathId);

  if (modErr || !modulesData) {
    return { registry, courseTitle };
  }

  for (const mod of modulesData) {
    const lessons = (mod as any).lessons || [];
    for (const les of lessons) {
      const notes = Array.isArray(les.study_notes) ? les.study_notes[0] : les.study_notes;
      const keyConcepts: string[] = Array.isArray(notes?.key_concepts) ? notes.key_concepts : [];

      // Add lesson title as a concept
      if (les.title) {
        const normTitle = normalizeGraphConcept(les.title);
        if (normTitle && !registry.has(normTitle)) {
          registry.set(normTitle, {
            normalizedName: normTitle,
            displayName: les.title.trim(),
            lessonId: les.id,
            moduleId: mod.id,
          });
        }
      }

      // Add key concepts
      for (const kc of keyConcepts) {
        if (!kc || typeof kc !== 'string') continue;
        const normKc = normalizeGraphConcept(kc);
        if (normKc && !registry.has(normKc)) {
          registry.set(normKc, {
            normalizedName: normKc,
            displayName: kc.trim(),
            lessonId: les.id,
            moduleId: mod.id,
          });
        }
      }
    }
  }

  return { registry, courseTitle };
}

/**
 * Server-only pipeline to dynamically generate, validate, and persist concept relationships for ANY learning path.
 */
export async function generateLearningPathKnowledgeGraph({
  learningPathId,
  userId,
}: {
  learningPathId: string;
  userId: string;
}): Promise<GraphGenerationResult> {
  try {
    // 1. Build strict concept registry from actual course materials
    const { registry, courseTitle } = await buildLearningPathConceptRegistry(learningPathId, userId);
    const conceptList = Array.from(registry.values()).map((c) => c.displayName);

    if (conceptList.length < 2) {
      return {
        conceptCount: conceptList.length,
        relationshipCount: 0,
        generated: false,
        error: 'At least 2 concepts required to generate relationships.',
      };
    }

    // 2. Request AI proposal using AI Provider
    console.log(`[GRAPH GENERATION] Proposing concept graph for "${courseTitle}" (${conceptList.length} concepts)`);
    const provider = getAIProvider();

    const promptText = `
You are an expert curriculum architecture AI. Analyze the following concepts from the course "${courseTitle}":
${JSON.stringify(conceptList, null, 2)}

PROPOSE PREREQUISITE AND EDUCATIONAL RELATIONSHIPS BETWEEN THESE CONCEPTS.

RULES:
1. Only propose relationships between concepts explicitly listed above. DO NOT invent outside concepts.
2. Supported relationshipType values: "prerequisite", "related", "builds_on", "application_of".
3. Assign strength between 0 and 100 (default 80-90 for essential prerequisites).
4. Do NOT create self-loops (sourceConcept === targetConcept).

Output MUST be strict JSON in this format:
{
  "relationships": [
    {
      "sourceConcept": "Prerequisite Concept Name",
      "targetConcept": "Dependent Concept Name",
      "relationshipType": "prerequisite",
      "strength": 85
    }
  ]
}
`;

    const aiResult = await provider.generateStudyNotes({
      courseTitle,
      moduleTitle: 'Knowledge Graph Synthesis',
      lessonTitle: 'Concept Relationships',
      lessonContent: promptText,
    });

    if (!aiResult.success || !aiResult.data) {
      console.warn('[GRAPH GENERATION] AI call failed:', aiResult.error);
      return {
        conceptCount: conceptList.length,
        relationshipCount: 0,
        generated: false,
        error: 'AI proposal step failed.',
      };
    }

    // 3. Parse JSON relationships safely
    let proposedEdges: any[] = [];
    const textOutput = aiResult.data.overview || '';
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.relationships)) {
          proposedEdges = parsed.relationships;
        }
      } catch (pErr) {
        console.warn('[GRAPH GENERATION] JSON parse error from AI proposal:', pErr);
      }
    }

    // 4. Strict Validation against Concept Registry & Ownership
    const validTypes = new Set(['prerequisite', 'related', 'builds_on', 'application_of']);
    const validatedRelationships: ConceptRelationship[] = [];

    for (const edge of proposedEdges) {
      const srcName = String(edge.sourceConcept || '').trim();
      const tgtName = String(edge.targetConcept || '').trim();
      const normSrc = normalizeGraphConcept(srcName);
      const normTgt = normalizeGraphConcept(tgtName);

      // Rejection Rule 1: Must exist in concept registry (rejects hallucinated concepts!)
      if (!registry.has(normSrc) || !registry.has(normTgt)) {
        console.warn(`[GRAPH GENERATION] REJECTED edge with unregistered/hallucinated concept: "${srcName}" -> "${tgtName}"`);
        continue;
      }

      // Rejection Rule 2: No self-loops
      if (normSrc === normTgt) {
        continue;
      }

      // Rejection Rule 3: Valid relationship type
      const relType = String(edge.relationshipType || 'prerequisite').toLowerCase();
      if (!validTypes.has(relType)) {
        continue;
      }

      const srcRegistry = registry.get(normSrc)!;
      const tgtRegistry = registry.get(normTgt)!;

      // Strength bounded 0-100
      const strength = Math.min(100, Math.max(0, parseInt(String(edge.strength), 10) || 80));

      validatedRelationships.push({
        sourceConcept: srcRegistry.displayName,
        targetConcept: tgtRegistry.displayName,
        relationshipType: relType as any,
        strength,
        sourceLessonId: srcRegistry.lessonId,
        targetLessonId: tgtRegistry.lessonId,
      });
    }

    // 5. Persist validated relationships (Idempotent upsert)
    if (validatedRelationships.length > 0) {
      await saveConceptRelationships({
        userId,
        relationships: validatedRelationships,
      });
    }

    console.log(`[GRAPH GENERATION] Successfully generated & persisted ${validatedRelationships.length} validated concept relationships for "${courseTitle}".`);

    return {
      conceptCount: conceptList.length,
      relationshipCount: validatedRelationships.length,
      generated: true,
    };
  } catch (err: any) {
    console.error('[GRAPH GENERATION] Pipeline exception:', err);
    return {
      conceptCount: 0,
      relationshipCount: 0,
      generated: false,
      error: err.message || 'Pipeline failed.',
    };
  }
}
