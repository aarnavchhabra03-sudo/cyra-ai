import { validateLearningPath } from '../src/types/ai';

async function runStage12_9bTests() {
  console.log('============================================================');
  console.log('CYRA AI — STAGE 12.9B CURRICULUM SCHEMA CONTRACT UNIT TESTS');
  console.log('============================================================\n');

  // Helper for positive assertion
  const assertPasses = (name: string, data: any) => {
    try {
      const res = validateLearningPath(data);
      console.log(`✅ PASS: ${name} (curriculum title: "${res.title}")`);
    } catch (err: any) {
      console.error(`❌ FAIL: ${name} - Unexpected validation error:`, err.message || err);
    }
  };

  // Helper for negative assertion
  const assertFails = (name: string, data: any) => {
    try {
      validateLearningPath(data);
      console.error(`❌ FAIL: ${name} - Expected validation to fail but it succeeded.`);
    } catch (err: any) {
      console.log(`✅ PASS: ${name} (Expected failure: ${err.message || err})`);
    }
  };

  // 1. Valid direct object
  const validDirect = {
    title: 'Cellular Biology Basics',
    description: 'Learn the fundamentals of cells, organelles, and respiration.',
    difficulty: 'beginner',
    estimatedWeeks: 4,
    weeklyHours: 5,
    prerequisites: ['Basic biology concepts'],
    learningOutcomes: ['Understand structure of cells', 'Identify organelles'],
    modules: [
      {
        title: 'Module 1: Introduction to Cell Structure',
        description: 'Explore the cell wall, membrane, and cytoplasm.',
        order: 1,
        estimatedHours: 8,
        objectives: ['Identify outer structures of eukaryotic cells'],
        lessons: [
          {
            title: 'Definition of a Cell',
            description: 'Overview of standard eukaryotic and prokaryotic cells.',
            order: 1,
            estimatedMinutes: 45,
            keyConcepts: ['Cell Type', 'Eukaryote'],
          },
        ],
      },
    ],
  };

  console.log('--- Test A: Valid Direct Object ---');
  assertPasses('Valid Direct Object', validDirect);
  console.log('');

  // 2. Valid wrapper { learningPath: {...} }
  console.log('--- Test B: Valid learningPath wrapper ---');
  assertPasses('Wrapper Unwrapping', { learningPath: validDirect });
  console.log('');

  // 3. String normalization / difficulty lowercase conversion
  console.log('--- Test C: Normalization and casing conversion ---');
  const casingMixed = {
    ...validDirect,
    difficulty: 'BEGINNER',
    estimatedWeeks: '4', // string input conversion
    weeklyHours: '5',
    modules: [
      {
        ...validDirect.modules[0],
        order: '1',
        estimatedHours: '8',
        lessons: [
          {
            ...validDirect.modules[0].lessons[0],
            order: '1',
            estimatedMinutes: '45',
          },
        ],
      },
    ],
  };
  assertPasses('Casing and Number Type Normalization', casingMixed);
  console.log('');

  // 4. Missing required fields
  console.log('--- Test D: Missing title field ---');
  const missingTitle = { ...validDirect, title: undefined };
  assertFails('Missing Title Rejected', missingTitle);
  console.log('');

  // 5. Wrong difficulty enum
  console.log('--- Test E: Invalid difficulty enum value ---');
  const invalidDifficulty = { ...validDirect, difficulty: 'expert' };
  assertFails('Invalid Difficulty Rejected', invalidDifficulty);
  console.log('');

  // 6. Missing modules
  console.log('--- Test F: Empty modules list ---');
  const emptyModules = { ...validDirect, modules: [] };
  assertFails('Empty Modules List Rejected', emptyModules);
  console.log('');

  console.log('============================================================');
  console.log('ALL CURRICULUM SCHEMA CONTRACT TESTS COMPLETED!');
  console.log('============================================================');
}

runStage12_9bTests().catch(console.error);
