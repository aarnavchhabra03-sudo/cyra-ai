import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LearningPathGeneration } from '@/types/ai';

export async function POST(request: Request) {
  // 1. Authenticate user using Supabase SSR client
  let user: any = null;
  let supabase: any = null;

  try {
    supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
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

  // 2. Parse payload from request
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

  if (!curriculum || !curriculum.title || !Array.isArray(curriculum.modules)) {
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

  // 3. Step A: Insert Learning Path into Supabase (user_id strictly from server-side authenticated user)
  let learningPathId: string;
  try {
    const { data: pathRecord, error: pathError } = await supabase
      .from('learning_paths')
      .insert({
        user_id: user.id, // Strictly enforced server-side
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
      console.error('Error inserting learning_path record:', pathError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create learning path in database.',
          code: 'SAVE_FAILED',
        },
        { status: 500 }
      );
    }

    learningPathId = pathRecord.id;
  } catch (err: any) {
    console.error('Learning path insertion exception:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Database error creating learning path.',
        code: 'SAVE_FAILED',
      },
      { status: 500 }
    );
  }

  // 4. Step B: Insert Modules for the created Learning Path
  try {
    const modulesToInsert = pathCurriculum.modules.map((mod, index) => ({
      learning_path_id: learningPathId,
      title: mod.title,
      description: mod.description,
      order_index: mod.order || index + 1,
      status: index === 0 ? 'in_progress' : 'locked',
      progress: 0,
    }));

    const { data: insertedModules, error: modulesError } = await supabase
      .from('modules')
      .insert(modulesToInsert)
      .select('id, order_index');

    if (modulesError || !insertedModules || insertedModules.length === 0) {
      console.error('Error inserting modules records:', modulesError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create curriculum modules in database.',
          code: 'SAVE_FAILED',
        },
        { status: 500 }
      );
    }

    // Map inserted module IDs by order_index
    const moduleMapByOrder = new Map<number, string>();
    insertedModules.forEach((m: { id: string; order_index: number }) => {
      moduleMapByOrder.set(m.order_index, m.id);
    });

    // 5. Step C: Insert Lessons for each Module
    const lessonsToInsert: any[] = [];

    pathCurriculum.modules.forEach((mod) => {
      const parentModuleId = moduleMapByOrder.get(mod.order);
      if (parentModuleId && Array.isArray(mod.lessons)) {
        mod.lessons.forEach((lesson, lIndex) => {
          lessonsToInsert.push({
            module_id: parentModuleId,
            title: lesson.title,
            description: lesson.description,
            estimated_minutes: lesson.estimatedMinutes || 15,
            order_index: lesson.order || lIndex + 1,
            status: mod.order === 1 && lIndex === 0 ? 'in_progress' : 'locked',
          });
        });
      }
    });

    if (lessonsToInsert.length > 0) {
      const { error: lessonsError } = await supabase
        .from('lessons')
        .insert(lessonsToInsert);

      if (lessonsError) {
        console.error('Error inserting lessons records:', lessonsError);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to save curriculum lessons.',
            code: 'SAVE_FAILED',
          },
          { status: 500 }
        );
      }
    }

    // 6. Return Success Response with created learningPathId
    return NextResponse.json({
      success: true,
      learningPathId,
    });
  } catch (err: any) {
    console.error('Error saving curriculum modules/lessons:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected database error occurred while saving modules.',
        code: 'SAVE_FAILED',
      },
      { status: 500 }
    );
  }
}
