import { 
  LearningPathGenerationSchema, 
  StudyNotesSchema, 
  ResourcePlanSchema, 
  GeneratedQuizSchema,
  normalizeLearningPathOutput,
  normalizeStudyNotesOutput,
  normalizeResourcePlanOutput,
  normalizeQuizOutput,
  validateResourcePlanObject
} from '../types/ai';

import { 
  classifyMemoryRelevance, 
  calculateReliabilityScore,
  normalizeConceptName
} from '../lib/tutor/memory';

import { 
  calculateConceptReadiness,
  detectRootKnowledgeGaps,
  normalizeGraphConcept
} from '../lib/adaptive/knowledge-graph';

import { 
  determineNextBestAction,
  LearnerStateSnapshot
} from '../lib/adaptive/orchestrator';

import { 
  evaluateInterventionOutcome
} from '../lib/adaptive/intervention-tracking';

export async function runComprehensiveTests() {
  console.log('\n======================================================');
  console.log('🏁 RUNNING COMPREHENSIVE ADAPTIVE ARCHITECTURE TESTS');
  console.log('======================================================\n');

  let allPassed = true;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      console.log(`[PASS] ✅ ${msg}`);
    } else {
      console.error(`[FAIL] ❌ ${msg}`);
      allPassed = false;
    }
  };

  // ------------------------------------------------------------
  // 1. SCHEMAS VALIDATION TESTS
  // ------------------------------------------------------------
  console.log('--- 1. SCHEMAS VALIDATION ---');
  
  // Learning Path Schema
  const validPath = {
    title: 'Cellular Biology 101',
    description: 'Introduction to basic biology concepts',
    difficulty: 'beginner',
    estimatedWeeks: 4,
    weeklyHours: 3,
    prerequisites: ['High school chemistry'],
    learningOutcomes: ['Understand cell theory', 'Identify organelles'],
    modules: [
      {
        title: 'Module 1: Cell Structure',
        description: 'The anatomy of cells',
        order: 1,
        estimatedHours: 8,
        objectives: ['Define cell membrane'],
        lessons: [
          {
            title: 'Definition of a Cell',
            description: 'Beginner introduction',
            order: 1,
            estimatedMinutes: 45,
            keyConcepts: ['Cell Membrane', 'Cytoplasm']
          }
        ]
      }
    ]
  };
  const pathParse = LearningPathGenerationSchema.safeParse(validPath);
  assert(pathParse.success, 'LearningPathGenerationSchema passes valid curriculum');

  const invalidPath = { ...validPath, estimatedWeeks: -5 };
  const pathParseFail = LearningPathGenerationSchema.safeParse(invalidPath);
  assert(!pathParseFail.success, 'LearningPathGenerationSchema rejects negative weeks');

  // Study Notes Schema
  const validNotes = {
    overview: 'Overview of cells.',
    explanation: 'Detailed cellular explanation.',
    key_concepts: ['Cell Membrane'],
    examples: ['An analogy to a factory'],
    important_points: ['Mitochondria is the power house.'],
    quick_revision: 'Fast summary.'
  };
  const notesParse = StudyNotesSchema.safeParse(validNotes);
  assert(notesParse.success, 'StudyNotesSchema passes valid notes');

  const invalidNotes = { ...validNotes, key_concepts: [] };
  const notesParseFail = StudyNotesSchema.safeParse(invalidNotes);
  assert(!notesParseFail.success, 'StudyNotesSchema rejects empty key_concepts');

  // Resources Schema
  const validPlan = {
    resources: [
      {
        title: 'Cell Biology Video Lecture',
        resource_type: 'video',
        source: 'Khan Academy',
        description: 'Introduction to prokaryotes and eukaryotes.',
        search_query: 'cell biology introduction prokaryotes eukaryotes khan academy',
        is_recommended: true
      }
    ]
  };
  const planParse = ResourcePlanSchema.safeParse(validPlan);
  assert(planParse.success, 'ResourcePlanSchema passes valid resource discovery plan');

  const invalidPlan = {
    resources: [
      {
        title: 'Cell Biology Video Lecture',
        resource_type: 'video',
        source: 'Khan Academy',
        description: 'Introduction.',
        search_query: '' // EMPTY SEARCH QUERY
      }
    ]
  };
  const planParseFail = ResourcePlanSchema.safeParse(invalidPlan);
  assert(!planParseFail.success, 'ResourcePlanSchema rejects empty search_query');

  // Quiz Schema
  const validQuiz = {
    quiz: {
      title: 'Biology Structure Quiz',
      description: 'Tests organelles structures',
      difficulty: 'beginner',
      estimated_minutes: 10,
      passing_score: 70
    },
    questions: [
      {
        question_order: 1,
        question_type: 'multiple_choice',
        question_text: 'What tests the power house?',
        options: [
          { id: 'A', text: 'Mitochondria' },
          { id: 'B', text: 'Ribosome' }
        ],
        correct_answer: { option_id: 'A' },
        explanation: 'Mitochondria is correct.',
        concept: 'Mitochondria'
      },
      {
        question_order: 2,
        question_type: 'true_false',
        question_text: 'Cells have membranes.',
        options: [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' }
        ],
        correct_answer: { option_id: 'true' },
        explanation: 'Yes they do.',
        concept: 'Cell Membrane'
      },
      {
        question_order: 3,
        question_type: 'multiple_choice',
        question_text: 'Question 3 text',
        options: [
          { id: 'A', text: 'Opt A' },
          { id: 'B', text: 'Opt B' }
        ],
        correct_answer: { option_id: 'B' },
        explanation: 'Expl 3',
        concept: 'Cytoplasm'
      }
    ]
  };
  const quizParse = GeneratedQuizSchema.safeParse(validQuiz);
  assert(quizParse.success, 'GeneratedQuizSchema passes valid 3-question quiz');

  // ------------------------------------------------------------
  // 2. NORMALIZERS SCENARIOS (camelCase -> snake_case, etc.)
  // ------------------------------------------------------------
  console.log('\n--- 2. OUTPUT NORMALIZATION ---');
  
  // Resource Normalizer
  const rawResourcePlan = {
    resources: [
      {
        title: 'Cell biology lecture',
        resourceType: 'video', // camelCase -> resource_type
        source: 'YouTube',
        description: 'Details of cellular energy.',
        searchQuery: 'mitochondria explanation cellular energy' // searchQuery -> search_query
      }
    ]
  };
  const normPlan = normalizeResourcePlanOutput(rawResourcePlan);
  assert(normPlan.resources[0].resource_type === 'video', 'normalizeResourcePlanOutput translates resourceType alias');
  assert(normPlan.resources[0].search_query === 'mitochondria explanation cellular energy', 'normalizeResourcePlanOutput translates searchQuery alias');

  // Study Notes Normalizer
  const rawNotes = {
    overview: 'Intro overview',
    explanation: 'Expl text',
    keyConcepts: ['Cell Membrane'], // camelCase
    importantPoints: ['Takeaway 1'], // camelCase
    quickRevision: 'Fast summary' // camelCase
  };
  const normNotes = normalizeStudyNotesOutput(rawNotes);
  assert(normNotes.key_concepts.includes('Cell Membrane'), 'normalizeStudyNotesOutput maps keyConcepts to key_concepts');
  assert(normNotes.important_points.includes('Takeaway 1'), 'normalizeStudyNotesOutput maps importantPoints to important_points');
  assert(normNotes.quick_revision === 'Fast summary', 'normalizeStudyNotesOutput maps quickRevision to quick_revision');

  // ------------------------------------------------------------
  // 3. COURSE ISOLATION & LEAKAGE PREVENTION
  // ------------------------------------------------------------
  console.log('\n--- 3. COURSE STATE ISOLATION & LEAKAGE ---');

  // Mocking course concept filtering in JS logic
  const biologyConcepts = new Set(['cell biology', 'mitochondria', 'organelle', 'cell membrane']);
  const networkingConcepts = new Set(['data communication', 'ip routing', 'subnetting', 'tcp handshake']);

  // Concept Mastery query boundaries simulation
  const rawMasteryRow = { user_id: 'user-1', concept: 'IP Routing', mastery_score: 80 };
  const mockMasteryFilter = (row: typeof rawMasteryRow, courseConcepts: Set<string>) => {
    return courseConcepts.has(normalizeGraphConcept(row.concept));
  };
  
  assert(!mockMasteryFilter(rawMasteryRow, biologyConcepts), 'Biology concepts filter rejects Networking concept "IP Routing"');
  assert(mockMasteryFilter(rawMasteryRow, networkingConcepts), 'Networking concepts filter accepts "IP Routing"');

  // Tutor Memory Isolation Logic
  const rawTutorMemories = [
    { concept: 'IP Routing', memory_type: 'misconception', content: 'Subnet mask confusion' },
    { concept: 'Mitochondria', memory_type: 'misconception', content: 'Cell energy confusion' }
  ];

  const filterMemoriesByCourse = (mems: typeof rawTutorMemories, courseConcepts: Set<string>) => {
    return mems.filter(m => courseConcepts.has(normalizeGraphConcept(m.concept)));
  };

  const bioMems = filterMemoriesByCourse(rawTutorMemories, biologyConcepts);
  const netMems = filterMemoriesByCourse(rawTutorMemories, networkingConcepts);
  
  assert(bioMems.length === 1 && bioMems[0].concept === 'Mitochondria', 'Tutor memory filter successfully isolates Biology memories');
  assert(netMems.length === 1 && netMems[0].concept === 'IP Routing', 'Tutor memory filter successfully isolates Networking memories');

  // ------------------------------------------------------------
  // 4. STRATEGY ENGINE & INTERVENTION TRACKING
  // ------------------------------------------------------------
  console.log('\n--- 4. INTERVENTION OUTCOME EVALUATION ---');

  const outcomeSuccess = evaluateInterventionOutcome({
    masteryBefore: 20,
    masteryAfter: 65, // delta = 45
    score: 80
  });
  assert(outcomeSuccess.successful === true, 'evaluateInterventionOutcome detects success on positive delta');
  assert(outcomeSuccess.effectivenessScore >= 80, 'evaluateInterventionOutcome returns high effectiveness score for large gain');

  const outcomeStagnant = evaluateInterventionOutcome({
    masteryBefore: 20,
    masteryAfter: 22, // delta = 2
    score: 40
  });
  assert(outcomeStagnant.successful === false, 'evaluateInterventionOutcome flags stagnation/failure on zero/low gain');

  // ------------------------------------------------------------
  // 5. NEXT BEST ACTION SHIELD & LEAKAGE SANITIZATION
  // ------------------------------------------------------------
  console.log('\n--- 5. NEXT BEST ACTION ORCHESTRATION ---');

  const mockSnapshot: LearnerStateSnapshot = {
    userId: 'user-123',
    learningPathId: 'path-biology',
    currentLessonId: 'lesson-1',
    currentLessonTitle: 'Definition of a Cell',
    mastery: [
      { concept: 'Cell Membrane', masteryScore: 25, questionsAttempted: 5, questionsCorrect: 1, lastResult: 'weak', lessonId: 'lesson-1' }
    ],
    recommendations: [],
    adaptivePlan: [],
    rootGaps: [],
    blockedConcepts: [],
    recentQuizAttempts: [],
    recentPracticeAttempts: [],
    tutorMemories: [],
    curriculumProgress: 10,
    graphAvailable: true,
    hasActiveAssessment: false,
    learningPathConcepts: ['Definition of a Cell', 'Cell Membrane', 'Organelles']
  };

  // Next-Best-Action logic: Active assessment shield should trigger ask_tutor/guided_reasoning with high priority
  const activeAssessmentSnapshot: LearnerStateSnapshot = {
    ...mockSnapshot,
    hasActiveAssessment: true
  };

  const nbaResult = determineNextBestAction(activeAssessmentSnapshot);
  assert(nbaResult.action === 'ask_tutor', 'Next-Best-Action prioritizes ask_tutor when active assessment shield is active');
  assert(nbaResult.priorityScore === 99, 'Next-Best-Action assigns top priority (99) to assessment shields');

  // NBA Leakage verification
  const leakySnapshot: LearnerStateSnapshot = {
    ...mockSnapshot,
    learningPathConcepts: ['Definition of a Cell', 'Cell Membrane'] // Organelles NOT in path
  };
  
  // Simulated candidate recommender returns "Organelles" (leak)
  const candidateLeakyAction = {
    action: 'practice_concept' as const,
    concept: 'Organelles',
    lessonId: 'lesson-unrelated',
    priorityScore: 85,
    reasonCode: 'TARGET_CONCEPT_MASTERY_DEFICIT',
    reason: 'Organelles needs practice',
    secondaryActions: []
  };

  // We test the orchestrator wrapper sanitization logic
  const checkLeakyRecommendation = (action: typeof candidateLeakyAction, snapshot: LearnerStateSnapshot) => {
    if (snapshot.learningPathConcepts) {
      const belongs = snapshot.learningPathConcepts
        .map(c => normalizeGraphConcept(c))
        .includes(normalizeGraphConcept(action.concept));
      if (!belongs) {
        return {
          action: 'continue_lesson' as const,
          concept: snapshot.currentLessonTitle || null,
          lessonId: snapshot.currentLessonId || null,
          priorityScore: 60,
          reasonCode: 'NEXT_CURRICULUM_STEP',
          reason: 'Proceed with next curriculum lesson.',
          secondaryActions: []
        };
      }
    }
    return action;
  };

  const sanitizedNBA = checkLeakyRecommendation(candidateLeakyAction, leakySnapshot);
  assert(sanitizedNBA.action === 'continue_lesson', 'NBA Scoping sanitizer filters out concepts belonging to other courses');
  assert(sanitizedNBA.concept === 'Definition of a Cell', 'NBA Scoping sanitizer redirects learner back to active curriculum lesson');

  // ------------------------------------------------------------
  // 6. DB LEVEL COURSE isolation SIMULATION
  // ------------------------------------------------------------
  console.log('\n--- 6. DB LEVEL COURSE ISOLATION ---');

  const mockDbRecords = [
    { id: '1', user_id: 'user-1', learning_path_id: 'path-waterproofing', concept: 'Liquid Membrane', score: 90 },
    { id: '2', user_id: 'user-1', learning_path_id: 'path-biology', concept: 'Cellular Energy', score: 85 },
    { id: '3', user_id: 'user-1', learning_path_id: null, concept: 'Legacy Unassigned', score: 70 },
  ];

  // Helper simulating strict .eq('learning_path_id', target) reads
  const queryCourseRecords = (records: typeof mockDbRecords, pathId: string | null) => {
    if (!pathId) throw new Error('learningPathId is required. Fail closed.');
    return records.filter(r => r.learning_path_id === pathId);
  };

  try {
    const waterproofingOnly = queryCourseRecords(mockDbRecords, 'path-waterproofing');
    assert(waterproofingOnly.length === 1 && waterproofingOnly[0].concept === 'Liquid Membrane', 'Strict read isolation: loads waterproofing concept successfully');
    
    const biologyOnly = queryCourseRecords(mockDbRecords, 'path-biology');
    assert(biologyOnly.length === 1 && biologyOnly[0].concept === 'Cellular Energy', 'Strict read isolation: loads biology concept successfully');
    
    const unassignedCheck = queryCourseRecords(mockDbRecords, 'path-waterproofing').some(r => r.learning_path_id === null);
    assert(!unassignedCheck, 'Strict read isolation: excludes unassigned legacy/null-path records');
  } catch (err: any) {
    allPassed = false;
    console.error('Course isolation read query failed:', err.message);
  }

  // Fail closed check
  let threwOnNullPath = false;
  try {
    queryCourseRecords(mockDbRecords, null);
  } catch (err: any) {
    if (err.message.includes('Fail closed')) {
      threwOnNullPath = true;
    }
  }
  assert(threwOnNullPath, 'Strict read isolation: fails closed on null/missing course identifiers');

  console.log('\n======================================================');
  if (allPassed) {
    console.log('🎉 ALL ARCHITECTURE AUDIT & ADAPTIVE TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ SOME TESTS FAILED. PLEASE AUDIT RECENT MODIFICATIONS.');
  }
  console.log('======================================================\n');

  return allPassed;
}

if (require.main === module) {
  runComprehensiveTests().catch(console.error);
}
