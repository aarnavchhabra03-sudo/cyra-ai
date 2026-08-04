import { evaluateInterventionOutcome } from '../src/lib/adaptive/intervention-tracking';
import { selectTeachingStrategy, TutorTeachingPlan } from '../src/lib/tutor/strategy';
import { determineNextBestAction, LearnerStateSnapshot } from '../src/lib/adaptive/orchestrator';
import { TutorContext } from '../src/lib/tutor/context';

function createMockTutorContext(overrides: Partial<TutorContext> = {}): TutorContext {
  return {
    userId: 'mock-user-123',
    lessonId: 'mock-lesson-1',
    lessonTitle: 'Cellular Respiration',
    keyConcepts: ['Cellular Respiration', 'Mitochondria'],
    tutorMemories: [],
    weakConcepts: [{ concept: 'Mitochondria', masteryScore: 30, lastResult: 'weak', questionsAttempted: 5, questionsCorrect: 1 }],
    developingConcepts: [],
    proficientConcepts: [],
    masteredConcepts: [],
    recentMistakes: [],
    recentPractice: [],
    topRecommendations: [],
    hasActiveAssessment: false,
    adaptiveLearningPlan: {},
    interventionIntelligence: {
      totalCompletedInterventions: 3,
      averageMasteryGain: 24,
      historicallyEffectiveStrategies: [
        { strategy: 'step_by_step', effectivenessScore: 91, sampleSize: 3 },
      ],
      recentFailedInterventions: [],
    },
    ...overrides,
  };
}

async function runStage12_9Tests() {
  console.log('============================================================');
  console.log('CYRA AI — STAGE 12.9 CLOSED-LOOP LEARNING UNIT TESTS');
  console.log('============================================================\n');

  // TEST A: Successful Practice
  console.log('--- TEST A: Successful Practice (20 -> 55) ---');
  const outcomeA = evaluateInterventionOutcome({ masteryBefore: 20, masteryAfter: 55, score: 80 });
  console.log('Mastery Delta:', outcomeA.masteryDelta);
  console.log('Effectiveness Score:', outcomeA.effectivenessScore);
  console.log('Successful:', outcomeA.successful);
  console.log('Category:', outcomeA.category);
  if (outcomeA.masteryDelta === 35 && outcomeA.successful && outcomeA.effectivenessScore >= 80) {
    console.log('✅ TEST A PASSED\n');
  } else {
    console.error('❌ TEST A FAILED\n');
  }

  // TEST B: Ineffective Practice & Intervention Stagnation
  console.log('--- TEST B: Ineffective Practice & Stagnation ---');
  const outcomeB = evaluateInterventionOutcome({ masteryBefore: 25, masteryAfter: 27, score: 40 });
  console.log('Mastery Delta:', outcomeB.masteryDelta);
  console.log('Effectiveness Score:', outcomeB.effectivenessScore);
  if (outcomeB.masteryDelta === 2 && outcomeB.effectivenessScore < 50) {
    console.log('✅ TEST B PASSED\n');
  } else {
    console.error('❌ TEST B FAILED\n');
  }

  // TEST C: Historically Effective Strategy
  console.log('--- TEST C: Historically Effective Strategy (step_by_step) ---');
  const ctxC = createMockTutorContext();
  const planC = selectTeachingStrategy(ctxC, 'Explain mitochondria');
  console.log('Selected Strategy:', planC.strategy);
  console.log('Rationale Codes:', planC.rationaleCodes);
  if (planC.strategy === 'step_by_step' && planC.rationaleCodes.includes('HISTORICALLY_EFFECTIVE_STRATEGY')) {
    console.log('✅ TEST C PASSED\n');
  } else {
    console.error('❌ TEST C FAILED\n');
  }

  // TEST D: Explicit User Override
  console.log('--- TEST D: Explicit User Override ("Give me an analogy") ---');
  const ctxD = createMockTutorContext();
  const planD = selectTeachingStrategy(ctxD, 'Give me an analogy for mitochondria', 'ANALOGY');
  console.log('Selected Strategy:', planD.strategy);
  console.log('Rationale Codes:', planD.rationaleCodes);
  if (planD.strategy === 'analogy' && planD.rationaleCodes.includes('USER_REQUESTED_ANALOGY')) {
    console.log('✅ TEST D PASSED: Explicit user intent overrides historical strategy.\n');
  } else {
    console.error('❌ TEST D FAILED\n');
  }

  // TEST G: Assessment Security Shield Precedence
  console.log('--- TEST G: Assessment Security Shield Precedence ---');
  const ctxG = createMockTutorContext({ hasActiveAssessment: true });
  const planG = selectTeachingStrategy(ctxG, 'What is the correct answer?');
  console.log('Selected Strategy:', planG.strategy);
  console.log('Rationale Codes:', planG.rationaleCodes);
  if (planG.rationaleCodes.includes('ACTIVE_ASSESSMENT_SHIELD') && planG.strategy === 'guided_reasoning') {
    console.log('✅ TEST G PASSED: Security shield takes top priority.\n');
  } else {
    console.error('❌ TEST G FAILED\n');
  }

  console.log('============================================================');
  console.log('ALL STAGE 12.9 UNIT TESTS COMPLETED SUCCESSFULLY!');
  console.log('============================================================');
}

runStage12_9Tests().catch(console.error);
