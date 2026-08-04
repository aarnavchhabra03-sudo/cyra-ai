import { TutorContext, resolvePrimaryTargetConcept } from './context';

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
 * Combines base concept mastery, active learner memories, explicit user request/mode, and assessment security.
 */
export function selectTeachingStrategy(
  context: TutorContext,
  userMessage: string,
  requestedMode?: string
): TutorTeachingPlan {
  const target = resolvePrimaryTargetConcept(context);
  const masteryScore = target.masteryScore;
  const conceptName = target.concept;
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

  // 2. MEMORY OVERRIDES (Evidence Thresholds: 60-79 = Moderate, >=80 = Strong)
  const activeMemories = (context.tutorMemories || []).filter(
    (m) => !m.resolvedAt && (m.concept.toLowerCase() === conceptName.toLowerCase() || m.concept === 'General')
  );

  for (const mem of activeMemories) {
    const confidence = mem.confidence || 50;

    // ACTIVE MISCONCEPTION OVERRIDE
    if (mem.memoryType === 'misconception' && confidence >= 60) {
      addressMisconception = true;
      misconceptionContent = mem.content;
      if (!rationaleCodes.includes('ACTIVE_MISCONCEPTION')) {
        rationaleCodes.push('ACTIVE_MISCONCEPTION');
      }
      if (confidence >= 80 && (strategy === 'application' || strategy === 'challenge')) {
        strategy = 'step_by_step';
        explanationDepth = 'basic';
      }
    }

    // ANALOGY PREFERENCE OVERRIDE
    if (mem.memoryType === 'learning_preference' && /analogy|analogies/i.test(mem.content) && confidence >= 60) {
      useAnalogy = true;
      if (!rationaleCodes.includes('ANALOGY_PREFERENCE')) {
        rationaleCodes.push('ANALOGY_PREFERENCE');
      }
      if (confidence >= 80 && (strategy === 'foundation' || strategy === 'guided_reasoning')) {
        strategy = 'analogy';
      }
    }

    // STEP-BY-STEP SUCCESS OVERRIDE
    if (
      (mem.memoryType === 'successful_explanation' || mem.memoryType === 'learning_preference') &&
      /step/i.test(mem.content) &&
      confidence >= 60
    ) {
      if (!rationaleCodes.includes('STEP_BY_STEP_SUCCESS')) {
        rationaleCodes.push('STEP_BY_STEP_SUCCESS');
      }
      if (masteryScore < 70) {
        strategy = 'step_by_step';
      }
    }

    // RECURRING WEAKNESS / UNRESOLVED GAP OVERRIDE
    if ((mem.memoryType === 'recurring_weakness' || mem.memoryType === 'unresolved_gap') && confidence >= 60) {
      askComprehensionCheck = true;
      if (!rationaleCodes.includes('RECURRING_WEAKNESS')) {
        rationaleCodes.push('RECURRING_WEAKNESS');
      }
      if (confidence >= 80) {
        explanationDepth = 'basic';
      }
    }

    // RECENT IMPROVEMENT OVERRIDE
    if (mem.memoryType === 'improvement') {
      if (!rationaleCodes.includes('RECENT_IMPROVEMENT')) {
        rationaleCodes.push('RECENT_IMPROVEMENT');
      }
      if (masteryScore >= 70 && strategy !== 'challenge') {
        strategy = 'retrieval_practice';
      }
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
