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
} else {
  console.error('.env.local not found at:', envLocalPath);
}

async function main() {
  const { adminClient } = await import('../src/lib/supabase/admin');

  const { data, error } = await adminClient
    .from('ai_tutor_memories')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Error selecting column:', error.message);
  } else {
    console.log('Successfully selected, data:', data);
  }

  // Attempt to select learning_path_id
  const { data: lpData, error: lpError } = await adminClient
    .from('ai_tutor_memories')
    .select('id, learning_path_id')
    .limit(1);

  if (lpError) {
    console.log('Column learning_path_id does NOT exist:', lpError.message);
  } else {
    console.log('Column learning_path_id EXISTS:', lpData);
  }
}

main().catch(console.error);
