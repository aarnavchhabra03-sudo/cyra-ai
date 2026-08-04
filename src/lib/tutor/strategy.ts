import { TutorContext, resolvePrimaryTargetConcept } from './context';
import { normalizeConceptName } from './memory';

export type TeachingStrategy =
  | 'foundation'
  | 'analogy'
  | 'step_by_step'
  | 'guided_reasoning'
  | 'retrieval_practice'
  | 'application'
  | 'challenge';

export interface TutorTeachingPlan {
  strategy: TeachingStrategy;
  targetConcept: string | null;
  masteryScore: number | null;
  explanationDepth: 'basic' | 'moderate' | 'advanced';
  useAnalogy: boolean;
  askComprehensionCheck: boolean;
  addressMisconception: boolean;
  misconceptionContent?: string;
  rationaleCodes: string[];
}

/**
 * Deterministic Teaching Strategy Engine for CYRA AI Tutor.
 * Evaluates memory relevance and reliability scores (0-100) to prevent cross-concept memory leakage.
 */
export function selectTeachingStrategy(
  context: TutorContext,
  userMessage: string,
  requestedMode?: string
): TutorTeachingPlan {
  const target = resolvePrimaryTargetConcept(context);
  const masteryScore = target.masteryScore;
  const conceptName = target.concept;
  const normTargetConcept = normalizeConceptName(conceptName);
  const rationaleCodes: string[] = [];

  // Default values
  let strategy: TeachingStrategy = 'foundation';
  let explanationDepth: 'basic' | 'moderate' | 'advanced' = 'basic';
  let useAnalogy = false;
  let askComprehensionCheck = true;
  let addressMisconception = false;
  let misconceptionContent: string | undefined = undefined;

  // 1. BASE MASTERY RULES
  if (masteryScore < 40) {
    strategy = 'foundation';
    explanationDepth = 'basic';
    askComprehensionCheck = true;
    rationaleCodes.push('LOW_MASTERY');
  } else if (masteryScore < 70) {
    strategy = 'guided_reasoning';
    explanationDepth = 'moderate';
    askComprehensionCheck = true;
    rationaleCodes.push('DEVELOPING_MASTERY');
  } else if (masteryScore < 85) {
    strategy = 'application';
    explanationDepth = 'moderate';
    askComprehensionCheck = false;
    rationaleCodes.push('PROFICIENT_MASTERY');
  } else {
    strategy = 'challenge';
    explanationDepth = 'advanced';
    askComprehensionCheck = false;
    rationaleCodes.push('HIGH_MASTERY');
  }

  // 2. KNOWLEDGE GRAPH OVERRIDES
  const kg = context.knowledgeGraphIntelligence;
  if (kg) {
    if (kg.blocked) {
      if (!rationaleCodes.includes('BLOCKED_BY_PREREQUISITE')) {
        rationaleCodes.push('BLOCKED_BY_PREREQUISITE');
      }
      if (!rationaleCodes.includes('LOW_PREREQUISITE_READINESS')) {
        rationaleCodes.push('LOW_PREREQUISITE_READINESS');
      }
      if (strategy === 'application' || strategy === 'challenge') {
        strategy = 'guided_reasoning';
        explanationDepth = 'moderate';
      }
    }
    if (kg.rootGaps && kg.rootGaps.length > 0) {
      if (!rationaleCodes.includes('ROOT_KNOWLEDGE_GAP')) {
        rationaleCodes.push('ROOT_KNOWLEDGE_GAP');
      }
    }
  }

  // 3. MEMORY OVERRIDES (Using Relevance & Reliability Scores)
  // Strict check: Memories must be active AND relevant to the target concept (not irrelevant)
  const activeMemories = (context.tutorMemories || []).filter(
    (m) => !m.resolvedAt && m.relevance !== 'irrelevant'
  );

  for (const mem of activeMemories) {
    const reliability = mem.reliabilityScore || 0;
    const relevance = mem.relevance || 'irrelevant';

    // Ignore memories with reliability < 50
    if (reliability < 50 || relevance === 'irrelevant') {
      continue;
    }

    // ACTIVE MISCONCEPTION OVERRIDE (Requires exact or related concept match & reliability >= 65)
    if (mem.memoryType === 'misconception' && (relevance === 'exact' || relevance === 'related') && reliability >= 65) {
      addressMisconception = true;
      misconceptionContent = mem.content;
      if (!rationaleCodes.includes('ACTIVE_MISCONCEPTION')) {
        rationaleCodes.push('ACTIVE_MISCONCEPTION');
      }
      if (reliability >= 85 && (strategy === 'application' || strategy === 'challenge')) {
        strategy = 'step_by_step';
        explanationDepth = 'basic';
      }
    }

    // ANALOGY PREFERENCE OVERRIDE (Applies for general pedagogical preferences or exact/related match)
    if (
      mem.memoryType === 'learning_preference' &&
      /analogy|analogies/i.test(mem.content) &&
      (relevance === 'general' || relevance === 'exact' || relevance === 'related') &&
      reliability >= 50
    ) {
      useAnalogy = true;
      if (!rationaleCodes.includes('ANALOGY_PREFERENCE')) {
        rationaleCodes.push('ANALOGY_PREFERENCE');
      }
      if (reliability >= 85 && (strategy === 'foundation' || strategy === 'guided_reasoning')) {
        strategy = 'analogy';
      }
    }

    // STEP-BY-STEP SUCCESS OVERRIDE
    if (
      (mem.memoryType === 'successful_explanation' || mem.memoryType === 'learning_preference') &&
      /step/i.test(mem.content) &&
      reliability >= 65
    ) {
      if (!rationaleCodes.includes('STEP_BY_STEP_SUCCESS')) {
        rationaleCodes.push('STEP_BY_STEP_SUCCESS');
      }
      if (masteryScore < 70) {
        strategy = 'step_by_step';
      }
    }

    // RECURRING WEAKNESS / UNRESOLVED GAP OVERRIDE
    if (
      (mem.memoryType === 'recurring_weakness' || mem.memoryType === 'unresolved_gap') &&
      (relevance === 'exact' || relevance === 'related') &&
      reliability >= 65
    ) {
      askComprehensionCheck = true;
      if (!rationaleCodes.includes('RECURRING_WEAKNESS')) {
        rationaleCodes.push('RECURRING_WEAKNESS');
      }
      if (reliability >= 85) {
        explanationDepth = 'basic';
      }
    }

    // RECENT IMPROVEMENT OVERRIDE
    if (mem.memoryType === 'improvement' && (relevance === 'exact' || relevance === 'related') && reliability >= 65) {
      if (!rationaleCodes.includes('RECENT_IMPROVEMENT')) {
        rationaleCodes.push('RECENT_IMPROVEMENT');
      }
      if (masteryScore >= 70 && strategy !== 'challenge') {
        strategy = 'retrieval_practice';
      }
    }
  }

  // 3B. CLOSED-LOOP HISTORICAL EFFECTIVENESS FEEDBACK
  const effectiveStrat = context.interventionIntelligence?.historicallyEffectiveStrategies?.[0];
  if (effectiveStrat && effectiveStrat.sampleSize >= 2 && effectiveStrat.effectivenessScore >= 75) {
    if (effectiveStrat.strategy === 'step_by_step') {
      strategy = 'step_by_step';
      explanationDepth = 'basic';
    } else if (effectiveStrat.strategy === 'analogy' || effectiveStrat.strategy === 'tutor_analogy') {
      strategy = 'analogy';
      useAnalogy = true;
    } else if (effectiveStrat.strategy === 'tutor_socratic') {
      strategy = 'guided_reasoning';
    }
    if (!rationaleCodes.includes('HISTORICALLY_EFFECTIVE_STRATEGY')) {
      rationaleCodes.push('HISTORICALLY_EFFECTIVE_STRATEGY');
    }
  }

  // 3. EXPLICIT USER INTENT OVERRIDES (User Request > Memory > Defaults)
  const userMsgLower = userMessage.toLowerCase();

  if (requestedMode === 'SIMPLIFY' || /explain.*simply|simplify/i.test(userMsgLower)) {
    strategy = 'foundation';
    explanationDepth = 'basic';
    useAnalogy = true;
    askComprehensionCheck = true;
    rationaleCodes.push('USER_REQUESTED_SIMPLIFY');
  } else if (requestedMode === 'ANALOGY' || /give me an analogy|analogy/i.test(userMsgLower)) {
    strategy = 'analogy';
    useAnalogy = true;
    rationaleCodes.push('USER_REQUESTED_ANALOGY');
  } else if (requestedMode === 'QUIZ_ME' || /quiz me/i.test(userMsgLower)) {
    strategy = 'retrieval_practice';
    askComprehensionCheck = true;
    rationaleCodes.push('USER_REQUESTED_QUIZ');
  } else if (requestedMode === 'SOCRATIC' || /socratic/i.test(userMsgLower)) {
    strategy = 'guided_reasoning';
    askComprehensionCheck = true;
    rationaleCodes.push('USER_REQUESTED_SOCRATIC');
  } else if (/step by step|step-by-step/i.test(userMsgLower)) {
    strategy = 'step_by_step';
    explanationDepth = 'basic';
    rationaleCodes.push('USER_REQUESTED_STEP_BY_STEP');
  } else if (/harder|challenge|advanced/i.test(userMsgLower)) {
    strategy = 'challenge';
    explanationDepth = 'advanced';
    rationaleCodes.push('USER_REQUESTED_CHALLENGE');
  }

  // 4. SECURITY / ACTIVE ASSESSMENT PRECEDENCE (Highest Priority Security Shield)
  if (context.hasActiveAssessment) {
    strategy = 'guided_reasoning';
    askComprehensionCheck = true;
    if (!rationaleCodes.includes('ACTIVE_ASSESSMENT_SHIELD')) {
      rationaleCodes.push('ACTIVE_ASSESSMENT_SHIELD');
    }
  }

  return {
    strategy,
    targetConcept: conceptName,
    masteryScore,
    explanationDepth,
    useAnalogy,
    askComprehensionCheck,
    addressMisconception,
    misconceptionContent,
    rationaleCodes,
  };
}
