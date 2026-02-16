-- Add onboarding tracking columns to creator_profiles
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'connect',
  ADD COLUMN IF NOT EXISTS primary_goal TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
