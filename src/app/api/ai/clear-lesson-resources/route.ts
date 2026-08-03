import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  let supabase;
  let user;
  try {
    supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    user = authData.user;
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Auth failed.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { lessonId } = body || {};
  if (!lessonId || typeof lessonId !== 'string') {
    return NextResponse.json({ success: false, error: 'lessonId is required.' }, { status: 400 });
  }

  try {
    // Verify lesson ownership
    const { data: lessonRecord, error: lessonErr } = await supabase
      .from('lessons')
      .select(`
        id,
        modules!inner (
          learning_paths!inner (
            user_id
          )
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonErr || !lessonRecord) {
      return NextResponse.json({ success: false, error: 'Lesson not found.' }, { status: 404 });
    }

    const parentPath = (lessonRecord as any).modules?.learning_paths;
    if (!parentPath || parentPath.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 });
    }

    // Delete resources ONLY for this specific lesson ID
    const { data: deleted, error: deleteErr } = await supabase
      .from('learning_resources')
      .delete()
      .eq('lesson_id', lessonId)
      .select('id');

    if (deleteErr) {
      console.error('[CLEAR RESOURCES] Delete error:', deleteErr);
      return NextResponse.json({ success: false, error: 'Failed to clear resources.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      clearedCount: deleted ? deleted.length : 0,
      lessonId,
    });
  } catch (error: any) {
    console.error('[CLEAR RESOURCES] Server error:', error);
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 });
  }
}
