import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/ai/provider';
import { searchTavily } from '@/lib/search/tavily';
import { 
  LessonContext, 
  EvaluatedCandidate, 
  evaluateCandidate, 
  calculateTitleSimilarity, 
  extractDomain, 
  MIN_RESOURCE_RELEVANCE_SCORE 
} from '@/lib/search/quality-engine';

export async function POST(request: Request) {
  // 1. Authenticate user via Supabase SSR
  let supabase;
  let user;
  try {
    supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to generate resource plans.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
    user = authData.user;
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify authentication session.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  }

  // 2. Parse & Validate request body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid JSON request payload.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const { lessonId } = body || {};

  if (!lessonId || typeof lessonId !== 'string') {
    return NextResponse.json(
      {
        success: false,
        error: 'lessonId is required and must be a valid string.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  try {
    // 3. CACHE CHECK: Query existing persisted learning_resources for selected lesson
    const { data: existingResources, error: fetchErr } = await supabase
      .from('learning_resources')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true });

    if (!fetchErr && existingResources && existingResources.length > 0) {
      console.log('[CYRA RESOURCE ENGINE] DB CACHE HIT: Returning saved resources for lesson:', lessonId);
      return NextResponse.json({
        success: true,
        data: existingResources,
        cached: true,
      });
    }

    // 4. VERIFY LESSON AUTHORIZATION & FETCH LESSON CONTEXT
    const { data: lessonRecord, error: lessonErr } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        content,
        module_id,
        modules!inner (
          id,
          title,
          learning_path_id,
          learning_paths!inner (
            id,
            title,
            goal,
            experience_level,
            user_id
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonErr || !lessonRecord) {
      console.error('[CYRA RESOURCE ENGINE] LESSON NOT FOUND:', lessonErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Requested lesson was not found.',
          code: 'LESSON_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const parentModule = (lessonRecord as any).modules;
    const parentPath = parentModule?.learning_paths;

    if (!parentPath || parentPath.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You are not authorized to generate resources for this lesson.',
          code: 'UNAUTHORIZED',
        },
        { status: 403 }
      );
    }

    // CONSTRUCT RICH LESSON CONTEXT OBJECT
    const derivedDesc = (lessonRecord as any).description || (lessonRecord.content ? lessonRecord.content.split('\n')[0].replace(/^#+\s*/, '') : '');

    const lessonContext: LessonContext = {
      courseTitle: parentPath.title,
      moduleTitle: parentModule.title,
      lessonTitle: lessonRecord.title,
      lessonDescription: derivedDesc,
      experienceLevel: parentPath.experience_level || 'beginner',
    };

    console.log(`[CYRA RESOURCE ENGINE] STAGE 11.6 LESSON CONTEXT:
    Course: "${lessonContext.courseTitle}"
    Module: "${lessonContext.moduleTitle}"
    Lesson: "${lessonContext.lessonTitle}"
    Level:  "${lessonContext.experienceLevel}"`);

    // 5. STEP A — CALL AI PROVIDER FOR TAILORED RESOURCE PLAN REQUIREMENTS
    const provider = getAIProvider();

    const aiResponse = await provider.generateResourcePlan({
      courseTitle: lessonContext.courseTitle,
      moduleTitle: lessonContext.moduleTitle,
      lessonTitle: lessonContext.lessonTitle,
      lessonDescription: lessonContext.lessonDescription,
      lessonContent: lessonRecord.content || '',
      experienceLevel: lessonContext.experienceLevel,
    });

    if (!aiResponse.success || !aiResponse.data) {
      if (aiResponse.code === 'RATE_LIMIT_EXCEEDED' || aiResponse.code === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          {
            success: false,
            error: 'AI is temporarily busy. Please wait a moment and try again.',
            code: 'AI_RATE_LIMIT',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: aiResponse.error || 'Failed to generate resource plan requirements from AI provider.',
          code: 'AI_GENERATION_FAILED',
        },
        { status: 500 }
      );
    }

    const aiPlanItems = aiResponse.data.resources;
    console.log(`[CYRA RESOURCE ENGINE] AI generated ${aiPlanItems.length} resource requirements.`);

    // 6. STEP B — COLLECT CANDIDATES & RUN HARD FILTERING + RELEVANCE SCORING
    const candidatePool: EvaluatedCandidate[] = [];
    let totalSearches = 0;
    let rawCandidateCount = 0;

    for (const item of aiPlanItems) {
      // Enrich search query with subject context
      const targetedQuery = `${lessonContext.courseTitle} ${lessonContext.lessonTitle} ${item.title} ${item.resource_type}`.trim();
      totalSearches++;

      const tavilyResults = await searchTavily(targetedQuery, 5);
      rawCandidateCount += tavilyResults.length;

      for (const candidate of tavilyResults) {
        const evaluation = evaluateCandidate(candidate, lessonContext, item);

        console.log(`[CYRA RESOURCE ENGINE CANDIDATE EVALUATION]:
        - Query:      "${targetedQuery}"
        - Candidate:  "${candidate.title}" (${candidate.url})
        - Score:      ${evaluation.score}/100 (Threshold: ${MIN_RESOURCE_RELEVANCE_SCORE})
        - Passed:     ${evaluation.passed ? 'YES ✅' : 'NO ❌'}
        - Reasons:    ${evaluation.reasons.join(' | ')}`);

        if (evaluation.passed) {
          candidatePool.push(evaluation);
        }
      }
    }

    // 7. STEP C — DEDUPLICATION, RELEVANCE SORTING, AND CATEGORY BALANCING
    // Sort passed candidates by relevance score descending
    candidatePool.sort((a, b) => b.score - a.score);

    const finalSelected: EvaluatedCandidate[] = [];
    const usedUrls = new Set<string>();
    const acceptedTitles: string[] = [];

    const categoryCounts = {
      reading: 0,
      video: 0,
      practice: 0,
    };

    for (const evalItem of candidatePool) {
      const url = evalItem.cleanUrl;
      const title = evalItem.candidate.title || evalItem.item.title;
      const type = (evalItem.item.resource_type || 'article').toLowerCase();

      // Check URL duplicate
      if (usedUrls.has(url)) {
        console.log(`[CYRA RESOURCE ENGINE] Rejecting duplicate URL: ${url}`);
        continue;
      }

      // Check title similarity with already accepted titles (> 0.75 similarity threshold)
      const isTitleDuplicate = acceptedTitles.some(accTitle => calculateTitleSimilarity(title, accTitle) > 0.75);
      if (isTitleDuplicate) {
        console.log(`[CYRA RESOURCE ENGINE] Rejecting near-duplicate title: "${title}"`);
        continue;
      }

      // Check category balance preference (quota soft limits: max 3 reading, max 2 video, max 2 practice)
      const catKey = ['article', 'documentation', 'textbook', 'reference'].includes(type) ? 'reading' : type === 'video' ? 'video' : 'practice';
      const maxLimit = catKey === 'reading' ? 3 : 2;

      if (categoryCounts[catKey] >= maxLimit) {
        console.log(`[CYRA RESOURCE ENGINE] Category "${catKey}" reached max soft limit (${maxLimit}). Skipping candidate.`);
        continue;
      }

      // Accept candidate into final learning pack
      usedUrls.add(url);
      acceptedTitles.push(title);
      categoryCounts[catKey]++;
      finalSelected.push(evalItem);
    }

    console.log(`[CYRA RESOURCE ENGINE] SELECTION STATS:
    - Raw Tavily Candidates Collected: ${rawCandidateCount}
    - Candidates Passing Threshold (>=${MIN_RESOURCE_RELEVANCE_SCORE}): ${candidatePool.length}
    - Final Unique & Balanced Candidates Selected: ${finalSelected.length}`);

    if (finalSelected.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No highly relevant, verified resources met CYRA quality standards for this lesson. Please try again.',
          code: 'NO_RELEVANT_RESOURCES',
        },
        { status: 500 }
      );
    }

    // 8. STEP D — MAP TO SUPABASE LEARNING_RESOURCES SCHEMA & ASSIGN RECOMMENDED STATUS
    // Top 1-2 candidates get is_recommended = true
    const resourcesToInsert = finalSelected.map((evalItem, index) => {
      const { candidate, item, cleanUrl, score } = evalItem;
      const domain = item.source || extractDomain(cleanUrl);

      return {
        lesson_id: lessonId,
        title: candidate.title || item.title,
        resource_type: (item.resource_type || 'article').toLowerCase(),
        url: cleanUrl,
        source: domain,
        description: item.description || candidate.content?.slice(0, 250) || '',
        duration: item.duration || null,
        difficulty: (item.difficulty || lessonContext.experienceLevel || 'beginner').toLowerCase(),
        is_recommended: index < 2, // Top 2 highest scoring items marked as recommended
      };
    });

    // 9. PERSIST VERIFIED & SCORED RESOURCES INTO PUBLIC.LEARNING_RESOURCES
    const { data: insertedRows, error: insertErr } = await supabase
      .from('learning_resources')
      .insert(resourcesToInsert)
      .select('*');

    if (insertErr) {
      console.error('[CYRA RESOURCE ENGINE] DB INSERT ERROR:', insertErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to persist verified resources to database.',
          code: 'DB_SAVE_FAILED',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: insertedRows,
      cached: false,
    });
  } catch (error: any) {
    console.error('[CYRA RESOURCE ENGINE] Unhandled server error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected server error occurred during resource discovery.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
