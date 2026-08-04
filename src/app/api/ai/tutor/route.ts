import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { getAIProvider } from '@/lib/ai/provider';
import { buildTutorContext, resolvePrimaryTargetConcept } from '@/lib/tutor/context';
import { buildTutorSystemPrompt } from '@/lib/tutor/prompt';

export async function GET(request: Request) {
  console.log('[TUTOR] GET request received');

  // 1. Authenticate user session
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      console.warn('[TUTOR] Auth required for GET');
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to access tutor session.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    const user = authData.user;
    console.log('[TUTOR] authenticated user:', user.id);

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    const conversationId = searchParams.get('conversationId');

    // Validate ownership if lessonId is supplied
    if (lessonId) {
      const { data: lessonRecord } = await adminClient
        .from('lessons')
        .select('modules!inner(learning_paths!inner(user_id))')
        .eq('id', lessonId)
        .maybeSingle();

      const ownerId = (lessonRecord as any)?.modules?.learning_paths?.user_id;
      if (ownerId && ownerId !== user.id) {
        console.warn('[TUTOR] Unauthorized lesson context access');
        return NextResponse.json(
          {
            success: false,
            error: 'You are not authorized to view tutor context for this lesson.',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    }

    // Load or find active conversation
    let targetConvId = conversationId;
    if (!targetConvId && lessonId) {
      const { data: existingConv } = await adminClient
        .from('ai_tutor_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .order('updated_at', { ascending: false })
        .maybeSingle();

      if (existingConv) {
        targetConvId = existingConv.id;
      }
    }

    let messages: any[] = [];
    if (targetConvId) {
      const { data: dbMessages } = await adminClient
        .from('ai_tutor_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', targetConvId)
        .order('created_at', { ascending: true });

      messages = dbMessages || [];
    }

    // Build tutor context & resolve target concept
    const context = await buildTutorContext({ userId: user.id, lessonId });
    const target = resolvePrimaryTargetConcept(context);

    console.log('[TUTOR] context built, target concept:', target.concept, 'mastery:', target.masteryScore);

    return NextResponse.json({
      success: true,
      data: {
        conversationId: targetConvId || null,
        messages,
        context: {
          lessonTitle: context.lessonTitle || 'General Tutor',
          learningPathTitle: context.learningPathTitle,
          primaryWeakConcept: target.concept,
          primaryWeakConceptScore: target.masteryScore,
          primaryTargetConcept: target.concept,
          primaryTargetLevel: target.level,
          weakConcepts: context.weakConcepts,
          developingConcepts: context.developingConcepts,
          proficientConcepts: context.proficientConcepts,
          masteredConcepts: context.masteredConcepts,
          hasActiveAssessment: context.hasActiveAssessment,
        },
      },
    });
  } catch (error: any) {
    console.error('[TUTOR] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load tutor session.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  console.log('[TUTOR] POST request received');

  // 1. Authenticate user session
  let user;
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      console.warn('[TUTOR] Auth required for POST');
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required to speak with AI Tutor.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
    user = authData.user;
    console.log('[TUTOR] authenticated:', user.id);
  } catch (err) {
    console.error('[TUTOR] Auth exception:', err);
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
        error: 'Invalid JSON payload.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const { lessonId, conversationId, message, mode } = body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: 'message (string) is required.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  try {
    // 3. VERIFY LESSON OWNERSHIP IF LESSON ID IS SUPPLIED
    if (lessonId) {
      const { data: lessonRecord } = await adminClient
        .from('lessons')
        .select('modules!inner(learning_paths!inner(user_id))')
        .eq('id', lessonId)
        .maybeSingle();

      const ownerId = (lessonRecord as any)?.modules?.learning_paths?.user_id;
      if (ownerId && ownerId !== user.id) {
        console.warn('[TUTOR] Unauthorized lesson ownership access attempt by user:', user.id);
        return NextResponse.json(
          {
            success: false,
            error: 'You are not authorized to access tutor session for this lesson.',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    }
    console.log('[TUTOR] ownership verified');

    // 4. LOAD OR CREATE CONVERSATION RECORD
    let convId = conversationId;
    if (convId) {
      const { data: existingConv } = await adminClient
        .from('ai_tutor_conversations')
        .select('id, user_id')
        .eq('id', convId)
        .maybeSingle();

      if (!existingConv || existingConv.user_id !== user.id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Target conversation not found or access denied.',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    } else {
      // Create new conversation row
      const { data: newConv, error: convErr } = await adminClient
        .from('ai_tutor_conversations')
        .insert({
          user_id: user.id,
          lesson_id: lessonId || null,
          title: `Tutor Chat (${new Date().toLocaleDateString()})`,
        })
        .select()
        .single();

      if (convErr || !newConv) {
        console.error('[TUTOR] Error creating conversation:', convErr);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to initialize tutor conversation.',
            code: 'DB_CONVERSATION_FAILED',
          },
          { status: 500 }
        );
      }
      convId = newConv.id;
    }

    // 5. LOAD RECENT CONVERSATION MESSAGES (BOUNDED TO LAST 10 MESSAGES)
    const { data: pastMessages } = await adminClient
      .from('ai_tutor_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(10);

    const orderedHistory = (pastMessages || []).reverse();

    // 6. BUILD TUTOR CONTEXT, RESOLVE TARGET CONCEPT, & CONSTRUCT SYSTEM PROMPT
    const context = await buildTutorContext({ userId: user.id, lessonId });
    const target = resolvePrimaryTargetConcept(context);
    console.log('[TUTOR] context built, resolved target concept:', target.concept, 'mastery:', target.masteryScore, 'mode:', mode || 'default');

    const systemInstruction = buildTutorSystemPrompt(context, message, mode);

    // 7. FORMAT CONVERSATION PROMPT FOR AI PROVIDER
    let fullPrompt = `Below is the recent dialogue history with the student:\n\n`;
    for (const pastMsg of orderedHistory) {
      fullPrompt += `${pastMsg.role.toUpperCase()}: ${pastMsg.content}\n\n`;
    }

    if (mode) {
      fullPrompt += `[TEACHING MODE: ${mode} ON TARGET CONCEPT: "${target.concept}"]\n`;
    }

    fullPrompt += `STUDENT: ${message}\n\nASSISTANT:`;

    // 8. CALL AI PROVIDER
    console.log('[TUTOR] provider request started');
    const provider = getAIProvider();
    const aiRes = await provider.generateContent({
      prompt: fullPrompt,
      systemInstruction,
      temperature: 0.7,
      maxTokens: 1000,
    });

    console.log('[TUTOR] provider response received, success:', aiRes.success);

    const assistantResponseText = aiRes.message || 'I am sorry, I encountered an issue formulating a response. Please try asking your question again.';

    // 9. PERSIST USER MESSAGE & ASSISTANT RESPONSE
    await adminClient.from('ai_tutor_messages').insert([
      { conversation_id: convId, role: 'user', content: message },
      { conversation_id: convId, role: 'assistant', content: assistantResponseText },
    ]);

    // Update conversation timestamp
    await adminClient
      .from('ai_tutor_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);

    console.log('[TUTOR] conversation persisted successfully');

    // 10. RETURN SAFE RESPONSE PAYLOAD
    return NextResponse.json({
      success: true,
      data: {
        conversationId: convId,
        message: {
          role: 'assistant',
          content: assistantResponseText,
        },
        context: {
          lessonTitle: context.lessonTitle || 'General Tutor',
          primaryWeakConcept: target.concept,
          primaryWeakConceptScore: target.masteryScore,
          primaryTargetConcept: target.concept,
          primaryTargetLevel: target.level,
          hasActiveAssessment: context.hasActiveAssessment,
        },
      },
    });
  } catch (error: any) {
    console.error('[TUTOR] Server error during tutor processing:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while processing tutor response.',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
