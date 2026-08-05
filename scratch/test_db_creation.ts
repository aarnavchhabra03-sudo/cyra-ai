import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        process.env[key] = value;
      }
    }
  }
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase/admin');

  // Let's get the first user to use as target user_id
  const { data: users, error: userErr } = await adminClient.from('profiles').select('id').limit(1);
  if (userErr || !users || users.length === 0) {
    console.error('Failed to get test user:', userErr);
    return;
  }
  const userId = users[0].id;
  console.log('Using userId:', userId);

  // Let's get a learning path id
  const { data: paths, error: pathErr } = await adminClient.from('learning_paths').select('id').limit(1);
  if (pathErr || !paths || paths.length === 0) {
    console.error('Failed to get test learning path:', pathErr);
    return;
  }
  const learningPathId = paths[0].id;
  console.log('Using learningPathId:', learningPathId);

  // Let's try inserting into ai_tutor_conversations
  const { data: newConv, error: convErr } = await adminClient
    .from('ai_tutor_conversations')
    .insert({
      user_id: userId,
      learning_path_id: learningPathId,
      title: 'Test Conversation Creation',
    })
    .select()
    .maybeSingle();

  if (convErr) {
    console.error('CONVERSATION INSERT FAILED:', convErr);
  } else {
    console.log('CONVERSATION INSERT SUCCEEDED:', newConv);
    // Delete the test conversation
    if (newConv) {
      await adminClient.from('ai_tutor_conversations').delete().eq('id', newConv.id);
      console.log('Cleaned up test conversation');
    }
  }
}

main().catch(console.error);
