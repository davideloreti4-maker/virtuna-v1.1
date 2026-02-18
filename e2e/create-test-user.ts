/**
 * Creates an E2E test user in Supabase with a completed onboarding profile.
 * Uses the service role key to bypass RLS.
 *
 * Usage: npx tsx e2e/create-test-user.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const TEST_EMAIL = 'e2e-test@virtuna.local';
const TEST_PASSWORD = 'e2e-test-password-2026';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers();
  const existingUser = existing?.users?.find(u => u.email === TEST_EMAIL);

  if (existingUser) {
    console.log(`Test user already exists: ${TEST_EMAIL} (${existingUser.id})`);

    // Ensure profile exists with onboarding completed
    await ensureProfile(supabase, existingUser.id);
    printEnvVars();
    return;
  }

  // Create user
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  }

  console.log(`Created test user: ${TEST_EMAIL} (${data.user.id})`);

  // Create profile with onboarding completed
  await ensureProfile(supabase, data.user.id);
  printEnvVars();
}

async function ensureProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: profile } = await supabase
    .from('creator_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    const { error } = await supabase
      .from('creator_profiles')
      .insert({
        user_id: userId,
        display_name: 'E2E Test User',
        onboarding_completed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to create profile:', error.message);
      // Non-fatal — the user might still work for basic tests
    } else {
      console.log('Created creator profile with onboarding completed');
    }
  } else {
    console.log('Profile already exists');
  }
}

function printEnvVars() {
  console.log('\nAdd to your shell or .env.local:');
  console.log(`  E2E_USER_EMAIL=${TEST_EMAIL}`);
  console.log(`  E2E_USER_PASSWORD=${TEST_PASSWORD}`);
}

main().catch(console.error);
