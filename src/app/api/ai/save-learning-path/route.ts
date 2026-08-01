import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LearningPathGeneration } from '@/types/ai';

export async function POST(request: Request) {
  console.log('[save-learning-path] Starting persistence request...');

  // 1. Authenticate user using Supabase SSR client
  let user: any = null;
  let supabase: any = null;

  try {
    supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.warn('[save-learning-path] Authentication failed:', authError?.message || 'No user session');
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. Please sign in to save learning paths.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
    user = authUser;
    console.log(`[save-learning-path] Authenticated user ID: ${user.id}`);
  } catch (err: any) {
    console.error('[save-learning-path] Session verification error:', err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify authentication session.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  }

  // 2. Parse & Validate JSON Payload
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid JSON request body.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const { curriculum, experienceLevel, goal, minutesPerDay } = body || {};

  if (!curriculum || !curriculum.title || !Array.isArray(curriculum.modules) || curriculum.modules.length === 0) {
    console.warn('[save-learning-path] Invalid curriculum payload supplied');
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid curriculum data supplied.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const pathCurriculum = curriculum as LearningPathGeneration;
  console.log(`[save-learning-path] Curriculum title: "${pathCurriculum.title}" with ${pathCurriculum.modules.length} modules.`);

  // Helper cleanup function to prevent partial-save orphaned rows
  const cleanupPartialSave = async (pathId: string) => {
    console.warn(`[save-learning-path] Rolling back: deleting partially created learning_path ${pathId}...`);
    try {
      await supabase.from('learning_paths').delete().eq('id', pathId);
      console.log(`[save-learning-path] Successfully rolled back learning_path ${pathId}.`);
    } catch (cleanupErr) {
      console.error('[save-learning-path] Rollback cleanup failed:', cleanupErr);
    }
  };

  // 3. STEP A: Insert `learning_paths` record
  let learningPathId: string;
  try {
    const { data: pathRecord, error: pathError } = await supabase
      .from('learning_paths')
      .insert({
        user_id: user.id, // Enforced server-side
        title: pathCurriculum.title,
        goal: goal || 'General Learning',
        experience_level: experienceLevel || 'beginner',
        minutes_per_day: minutesPerDay || 30,
        status: 'active',
        progress: 0,
      })
      .select('id')
      .single();

    if (pathError || !pathRecord) {
      console.error(`[save-learning-path] ERROR in learning_paths insert: ${pathError?.code || 'UNKNOWN'} - ${pathError?.message || 'No record returned'}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create learning path in database.',
          code: 'PATH_SAVE_FAILED',
        },
        { status: 500 }
      );
    }

    learningPathId = pathRecord.id;
    console.log(`[save-learning-path] Successfully created learning_paths row with ID: ${learningPathId}`);
  } catch (err: any) {
    console.error('[save-learning-path] Exception during learning_paths insert:', err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: 'Database error creating learning path.',
        code: 'PATH_SAVE_FAILED',
      },
      { status: 500 }
    );
  }

  // 4. STEP B: Explicitly map & Insert `modules` records (using ONLY columns present in live schema)
  try {
    const modulesToInsert = pathCurriculum.modules.map((mod, index) => ({
      learning_path_id: learningPathId,
      title: mod.title,
      description: mod.description || '',
      module_order: mod.order || index + 1,
    }));

    console.log("[CYRA DEBUG] MODULE ROWS:", modulesToInsert);
    console.log("[CYRA DEBUG] MODULE COUNT:", modulesToInsert.length);

    const { data: insertedModules, error: modulesError } = await supabase
      .from('modules')
      .insert(modulesToInsert)
      .select('id, module_order, title');

    if (modulesError) {
      console.error("[CYRA DEBUG] MODULE INSERT ERROR:", {
        code: modulesError.code,
        message: modulesError.message,
        details: modulesError.details,
        hint: modulesError.hint
      });
    }

    if (modulesError || !insertedModules || insertedModules.length !== modulesToInsert.length) {
      console.error(`[save-learning-path] ERROR in modules insert: ${modulesError?.code || 'COUNT_MISMATCH'} - ${modulesError?.message || 'Failed to insert all modules'}`);
      await cleanupPartialSave(learningPathId);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save curriculum modules.',
          code: 'MODULE_SAVE_FAILED',
        },
        { status: 500 }
      );
    }

    console.log(`[save-learning-path] Successfully inserted ${insertedModules.length} modules.`);

    // 5. STEP C: Explicitly map & Insert `lessons` records for each module (using ONLY columns present in live schema)
    const lessonsToInsert: any[] = [];

    pathCurriculum.modules.forEach((mod) => {
      const insertedMod = insertedModules.find((m: any) => m.module_order === mod.order);
      if (insertedMod && Array.isArray(mod.lessons)) {
        mod.lessons.forEach((lesson, lIndex) => {
          lessonsToInsert.push({
            module_id: insertedMod.id,
            title: lesson.title,
            description: lesson.description || '',
            content: lesson.keyConcepts && lesson.keyConcepts.length > 0 ? `Key Concepts: ${lesson.keyConcepts.join(', ')}` : '',
            estimated_minutes: lesson.estimatedMinutes || 15,
            lesson_order: lesson.order || lIndex + 1,
          });
        });
      }
    });

    console.log(`[save-learning-path] Inserting ${lessonsToInsert.length} lesson records...`);

    if (lessonsToInsert.length > 0) {
      const { data: insertedLessons, error: lessonsError } = await supabase
        .from('lessons')
        .insert(lessonsToInsert)
        .select('id');

      if (lessonsError) {
        console.error("[CYRA DEBUG] LESSON INSERT ERROR:", {
          code: lessonsError.code,
          message: lessonsError.message,
          details: lessonsError.details,
          hint: lessonsError.hint
        });
      }

      if (lessonsError || !insertedLessons || insertedLessons.length !== lessonsToInsert.length) {
        console.error(`[save-learning-path] ERROR in lessons insert: ${lessonsError?.code || 'COUNT_MISMATCH'} - ${lessonsError?.message || 'Failed to insert all lessons'}`);
        await cleanupPartialSave(learningPathId);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to save curriculum lessons.',
            code: 'LESSON_SAVE_FAILED',
          },
          { status: 500 }
        );
      }

      console.log(`[save-learning-path] Successfully inserted ${insertedLessons.length} lessons.`);
    }

    // 6. Complete Success Verification
    console.log(`[save-learning-path] SUCCESS: Entire curriculum persisted (1 path, ${insertedModules.length} modules, ${lessonsToInsert.length} lessons).`);
    return NextResponse.json({
      success: true,
      learningPathId,
    });
  } catch (err: any) {
    console.error('[save-learning-path] Unexpected exception during module/lesson insert:', err?.message || err);
    await cleanupPartialSave(learningPathId);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected database error occurred during save.',
        code: 'SAVE_FAILED',
      },
      { status: 500 }
    );
  }
}
