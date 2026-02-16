-- Add trial tracking columns to user_subscriptions
ALTER TABLE user_subscriptions ADD COLUMN is_trial BOOLEAN DEFAULT FALSE;
ALTER TABLE user_subscriptions ADD COLUMN trial_ends_at TIMESTAMPTZ;
