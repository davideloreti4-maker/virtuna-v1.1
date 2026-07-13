-- Pricing 2026-07-13 (owner-locked): three paid plans — Creator $49 / Pro $99 / Studio $499,
-- each startable for $1 for 3 days. "Creator" is the PUBLIC name of the existing `starter`
-- tier id: renaming the id would mean rewriting every persisted row and every gate for zero
-- user-visible gain, so the id stays and the display name lives in src/lib/pricing.ts.
--
-- This migration is ADDITIVE and safe on a live DB: it only widens the CHECK constraint so
-- the Whop webhook can write the new `studio` tier. No rows change; nothing is dropped.

ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_virtuna_tier_check;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_virtuna_tier_check
  CHECK (virtuna_tier IN ('free', 'starter', 'pro', 'studio'));

COMMENT ON COLUMN user_subscriptions.virtuna_tier IS
  'Persisted tier id: free | starter | pro | studio. NOT a display name — `starter` is sold as "Creator" (see src/lib/pricing.ts). `free` is the never-subscribed/lapsed state, not a plan.';
