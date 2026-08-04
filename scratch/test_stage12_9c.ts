import { validateStudyNotesObject } from '../src/types/ai';

async function runStage12_9cTests() {
  console.log('============================================================');
  console.log('CYRA AI — STAGE 12.9C STUDY NOTES SCHEMA CONTRACT UNIT TESTS');
  console.log('============================================================\n');

  // Helper for positive assertion
  const assertPasses = (name: string, data: any) => {
    try {
      const res = validateStudyNotesObject(data);
      console.log(`✅ PASS: ${name} (key concepts count: ${res.key_concepts.length})`);
    } catch (err: any) {
      console.error(`❌ FAIL: ${name} - Unexpected validation error:`, err.message || err);
    }
  };

  // Helper for negative assertion
  const assertFails = (name: string, data: any) => {
    try {
      validateStudyNotesObject(data);
      console.error(`❌ FAIL: ${name} - Expected validation to fail but it succeeded.`);
    } catch (err: any) {
      console.log(`&amp;#9989; PASS: ${name} (Expected failure: ${err.message || err})`);
    }
  };

  const validDirect = {
    overview: 'This lesson covers the fundamentals of Data Communications and Networking.',
    explanation: 'Data communication refers to the exchange of data between a source and a receiver via form of transmission medium.',
    key_concepts: ['Data Communications', 'Transmission Medium', 'Protocol'],
    examples: ['Email transmission over SMTP', 'Web browser requesting page over HTTP'],
    important_points: ['Delivery, accuracy, timeliness, and jitter are crucial performance factors.'],
    quick_revision: 'Data communication exchanges data between devices using transmission media and protocols.',
  };

  // Test A: Valid direct StudyNotes object
  console.log('--- Test A: Valid Direct StudyNotes Object ---');
  assertPasses('Valid Direct Object', validDirect);
  console.log('');

  // Test B: Valid { studyNotes: {...} } wrapper
  console.log('--- Test B: Valid studyNotes wrapper ---');
  assertPasses('Wrapper Unwrapping', { studyNotes: validDirect });
  console.log('');

  // Test C: Alias normalization (camelCase keyConcepts, keyPoints, quickRevision)
  console.log('--- Test C: Alias and camelCase normalization ---');
  const camelCased = {
    overview: validDirect.overview,
    explanation: validDirect.explanation,
    keyConcepts: validDirect.key_concepts, // keyConcepts instead of key_concepts
    examples: validDirect.examples,
    importantPoints: validDirect.important_points, // importantPoints instead of important_points
    quickRevision: validDirect.quick_revision, // quickRevision instead of quick_revision
  };
  assertPasses('CamelCase and Alias Normalization', camelCased);
  console.log('');

  // Test E: Missing required top-level field
  console.log('--- Test E: Missing required field (explanation) ---');
  const missingExplanation = { ...validDirect, explanation: undefined };
  assertFails('Missing Explanation Rejected', missingExplanation);
  console.log('');

  // Test F: Empty array list validation
  console.log('--- Test F: Empty key concepts array rejected ---');
  const emptyKeyConcepts = { ...validDirect, key_concepts: [] };
  assertFails('Empty Key Concepts Array Rejected', emptyKeyConcepts);
  console.log('');

  console.log('============================================================');
  console.log('ALL STUDY NOTES SCHEMA CONTRACT TESTS COMPLETED!');
  console.log('============================================================');
}

runStage12_9cTests().catch(console.error);
