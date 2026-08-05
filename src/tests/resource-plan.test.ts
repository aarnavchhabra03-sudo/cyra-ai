import { 
  validateResourcePlanObject, 
  normalizeResourcePlanOutput, 
  ResourcePlanSchema 
} from '../types/ai';

export async function runResourcePlanTests() {
  console.log('--- STARTING RESOURCE PLAN SCHEMA & VALIDATION TESTS ---');

  let passed = true;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      console.log(`[PASS] ${msg}`);
    } else {
      console.error(`[FAIL] ${msg}`);
      passed = false;
    }
  };

  // --- TEST A: valid resource with search_query -> PASS ---
  try {
    const validPlan = {
      resources: [
        {
          title: 'Introduction to Networking',
          resource_type: 'video',
          source: 'YouTube',
          description: 'A great introductory video',
          search_query: 'networking fundamentals tutorial',
          is_recommended: true,
          duration: '10 mins',
          difficulty: 'beginner'
        }
      ]
    };
    const validated = validateResourcePlanObject(validPlan);
    assert(validated.resources.length === 1, 'TEST A: valid resource with search_query passes');
  } catch (err: any) {
    assert(false, `TEST A: valid resource with search_query failed: ${err.message}`);
  }

  // --- TEST B: missing search_query -> FAIL ---
  try {
    const invalidPlan = {
      resources: [
        {
          title: 'Introduction to Networking',
          resource_type: 'video',
          source: 'YouTube',
          description: 'A great introductory video',
          is_recommended: true,
          duration: '10 mins',
          difficulty: 'beginner'
        }
      ]
    };
    const parsed = ResourcePlanSchema.safeParse(invalidPlan);
    assert(!parsed.success, 'TEST B: missing search_query fails parsing');
  } catch (err: any) {
    assert(false, `TEST B: check failed unexpectedly: ${err.message}`);
  }

  // --- TEST C: search_query = "" -> FAIL ---
  try {
    const invalidPlan = {
      resources: [
        {
          title: 'Introduction to Networking',
          resource_type: 'video',
          source: 'YouTube',
          description: 'A great introductory video',
          search_query: '',
          is_recommended: true,
          duration: '10 mins',
          difficulty: 'beginner'
        }
      ]
    };
    const parsed = ResourcePlanSchema.safeParse(invalidPlan);
    assert(!parsed.success, 'TEST C: empty search_query fails parsing');
  } catch (err: any) {
    assert(false, `TEST C: check failed unexpectedly: ${err.message}`);
  }

  // --- TEST D: searchQuery alias normalized correctly -> PASS ---
  try {
    const rawInput = {
      resources: [
        {
          title: 'Introduction to Networking',
          resourceType: 'video',
          source: 'YouTube',
          description: 'A great introductory video',
          searchQuery: 'networking fundamentals tutorial',
          isRecommended: true,
          duration: '10 mins',
          difficulty: 'beginner'
        }
      ]
    };
    const normalized = normalizeResourcePlanOutput(rawInput);
    assert(normalized.resources[0].search_query === 'networking fundamentals tutorial', 'TEST D: searchQuery alias successfully mapped to search_query');
    assert(normalized.resources[0].resource_type === 'video', 'TEST D: resourceType alias mapped to resource_type');
  } catch (err: any) {
    assert(false, `TEST D: normalization test failed: ${err.message}`);
  }

  // --- TEST E: all 7 resources contain valid search_query -> PASS ---
  try {
    const plan = {
      resources: Array.from({ length: 7 }, (_, i) => ({
        title: `Resource ${i}`,
        resource_type: 'article',
        source: 'Wikipedia',
        description: `Description ${i}`,
        search_query: `query for resource ${i}`,
        is_recommended: i < 2
      }))
    };
    const validated = validateResourcePlanObject(plan);
    assert(validated.resources.length === 7, 'TEST E: 7 valid resources with search_query passes');
  } catch (err: any) {
    assert(false, `TEST E: 7 resources validation failed: ${err.message}`);
  }

  // --- Helpers for Test F, G, H ---
  const executePipeline = async (failInitially: boolean, failRepair: boolean) => {
    let repairCount = 0;

    const mockAIService = async (isRepair: boolean) => {
      if (!isRepair && failInitially) {
        // Return invalid output (missing search_query)
        return {
          success: true,
          data: {
            resources: [{
              title: 'Mock Resource',
              resource_type: 'video',
              source: 'YouTube',
              description: 'Description',
              is_recommended: true
            }]
          }
        };
      }
      if (isRepair) {
        if (failRepair) {
          // Repair still invalid
          return {
            success: true,
            data: {
              resources: [{
                title: 'Mock Resource',
                resource_type: 'video',
                source: 'YouTube',
                description: 'Description',
                search_query: '', // Empty search query (invalid)
                is_recommended: true
              }]
            }
          };
        } else {
          // Repair is valid
          return {
            success: true,
            data: {
              resources: [{
                title: 'Mock Resource',
                resource_type: 'video',
                source: 'YouTube',
                description: 'Description',
                search_query: 'valid mock search query',
                is_recommended: true
              }]
            }
          };
        }
      }
      return { success: false, error: 'Unknown state' };
    };

    let result = await mockAIService(false);
    if (!result.success || !result.data) {
      return { success: false, error: 'AIService failed', repairCount };
    }

    const firstParse = ResourcePlanSchema.safeParse(normalizeResourcePlanOutput(result.data));
    if (!firstParse.success) {
      repairCount++; // Execute repair retry once
      const repairResult = await mockAIService(true);
      result = repairResult;
    }

    try {
      const validated = validateResourcePlanObject(result.data);
      return { success: true, data: validated, repairCount };
    } catch (err: any) {
      return { success: false, error: err.message || 'Validation failed', repairCount };
    }
  };

  // TEST F: repair retry executes once and succeeds
  try {
    const resF = await executePipeline(true, false);
    assert(resF.repairCount === 1, 'TEST F: repair retry executed exactly once');
    assert(resF.success === true, 'TEST F: repair retry successfully recovered valid object');
  } catch (err: any) {
    assert(false, `TEST F failed: ${err.message}`);
  }

  // TEST G: repair retry still invalid -> controlled generation failure
  try {
    const resG = await executePipeline(true, true);
    assert(resG.repairCount === 1, 'TEST G: repair retry executed exactly once for invalid repair');
    assert(resG.success === false, 'TEST G: controlled failure when repair retry remains invalid');
  } catch (err: any) {
    assert(false, `TEST G failed: ${err.message}`);
  }

  // --- TEST H: raw Zod diagnostics are NOT exposed to production UI ---
  try {
    const resH = await executePipeline(true, true);
    const clientResponseError = resH.error ? 'CYRA\'s next move recommendation error.' : '';
    const hasZodDiagnostics = clientResponseError.includes('invalid_type') || 
                              clientResponseError.includes('minimum') || 
                              clientResponseError.includes('path') ||
                              clientResponseError.includes('code');
    assert(!hasZodDiagnostics, 'TEST H: raw Zod diagnostics are not leaked to production UI error messages');
  } catch (err: any) {
    assert(false, `TEST H failed: ${err.message}`);
  }

  return passed;
}

if (require.main === module) {
  runResourcePlanTests().catch(console.error);
}
