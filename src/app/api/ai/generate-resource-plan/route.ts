import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/ai/provider';
import { searchTavily, sanitizeUrl, extractDomain } from '@/lib/search/tavily';

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
      console.log('[GENERATE RESOURCES] DB CACHE HIT: Returning saved resources for lesson:', lessonId);
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
      console.error('[GENERATE RESOURCES] LESSON NOT FOUND:', lessonErr);
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

    // 5. STEP A — CALL AI PROVIDER TO SYNTHESIZE RESOURCE DISCOVERY PLAN
    console.log('[GENERATE RESOURCES] Lesson:', lessonRecord.title);

    const provider = getAIProvider();

    const derivedDesc = (lessonRecord as any).description || (lessonRecord.content ? lessonRecord.content.split('\n')[0].replace(/^#+\s*/, '') : '');

    const aiResponse = await provider.generateResourcePlan({
      courseTitle: parentPath.title,
      moduleTitle: parentModule.title,
      lessonTitle: lessonRecord.title,
      lessonDescription: derivedDesc,
      lessonContent: lessonRecord.content || '',
      experienceLevel: parentPath.experience_level || 'beginner',
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
          error: aiResponse.error || 'Failed to generate resource discovery plan from AI provider.',
          code: 'AI_GENERATION_FAILED',
        },
        { status: 500 }
      );
    }

    const aiPlanItems = aiResponse.data.resources;
    console.log(`[GENERATE RESOURCES] AI generated ${aiPlanItems.length} resource recommendations.`);

    // 6. STEP B — DISCOVER VERIFIED LIVE URLS VIA TAVILY SEARCH
    const verifiedResourcesToInsert: any[] = [];
    const usedUrls = new Set<string>();

    let totalSearches = 0;
    let candidateCount = 0;
    let rejectedCount = 0;

    for (const item of aiPlanItems) {
      const query = item.search_query || `${lessonRecord.title} ${item.title}`;
      totalSearches++;

      const tavilyResults = await searchTavily(query, 5);
      candidateCount += tavilyResults.length;

      let matchedResult = null;
      let validUrl = null;

      for (const res of tavilyResults) {
        const sanitized = sanitizeUrl(res.url);
        if (!sanitized) {
          rejectedCount++;
          continue;
        }

        if (usedUrls.has(sanitized)) {
          rejectedCount++;
          continue;
        }

        // Found a valid, non-duplicate http/https URL
        validUrl = sanitized;
        matchedResult = res;
        break;
      }

      if (validUrl && matchedResult) {
        usedUrls.add(validUrl);

        const sourceDomain = item.source || extractDomain(validUrl);

        verifiedResourcesToInsert.push({
          lesson_id: lessonId,
          title: item.title || matchedResult.title,
          resource_type: (item.resource_type || 'article').toLowerCase(),
          url: validUrl,
          source: sourceDomain,
          description: item.description || matchedResult.content?.slice(0, 200) || '',
          duration: item.duration || null,
          difficulty: (item.difficulty || 'beginner').toLowerCase(),
          is_recommended: !!item.is_recommended,
        });
      } else {
        console.warn(`[GENERATE RESOURCES] No valid search result found for query: "${query}"`);
      }
    }

    console.log(`[GENERATE RESOURCES] LOGS:
    - Lesson: "${lessonRecord.title}"
    - AI Recommendations: ${aiPlanItems.length}
    - Tavily Searches: ${totalSearches}
    - Candidates Found: ${candidateCount}
    - Candidates Rejected: ${rejectedCount}
    - Verified & Ready to Persist: ${verifiedResourcesToInsert.length}`);

    if (verifiedResourcesToInsert.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not find verified live web resources for this lesson. Please try again.',
          code: 'NO_VALID_RESOURCES',
        },
        { status: 500 }
      );
    }

    // 7. STEP C — PERSIST VERIFIED RESOURCES INTO PUBLIC.LEARNING_RESOURCES
    const { data: insertedRows, error: insertErr } = await supabase
      .from('learning_resources')
      .insert(verifiedResourcesToInsert)
      .select('*');

    if (insertErr) {
      console.error('[GENERATE RESOURCES] DB INSERT ERROR:', insertErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save verified learning resources to database.',
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
    console.error('Unhandled resource plan generation error:', error);
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
