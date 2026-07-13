-- Trial pool (owner-locked 2026-07-13): a $1 / 3-day trial buys at most 5 Readings, on EVERY
-- plan — not the plan's monthly allowance. Without this cap, $1 would buy 150 Pro Readings
-- (~$22 of engine spend) or an unbounded number on Studio.
--
-- To enforce a pool we must know WHEN the trial runs and count Readings from its start.
-- `is_trial` and `trial_ends_at` already existed (20260213100000_add_trial_columns.sql) but
-- were never written or read by any code — dead columns. This adopts them rather than adding a
-- second, competing trial flag, and adds the one genuinely missing piece: when it began.
--
-- Additive and safe on a live DB: one new nullable column + an index. NULL trial_started_at =
-- "not a trial" (every existing row), which is exactly the pre-migration behaviour.

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

COMMENT ON COLUMN user_subscriptions.trial_started_at IS
  'When the $1 trial began. NULL = this subscription is not (and never was) a trial. Readings inside the trial are counted from this instant, NOT from the start of the calendar month.';

COMMENT ON COLUMN user_subscriptions.trial_ends_at IS
  'When the $1 trial converts to the plan price. While now() < trial_ends_at the Reading allowance is the trial pool (TRIAL.readings = 5) on every plan, including "unlimited" Studio.';

COMMENT ON COLUMN user_subscriptions.is_trial IS
  'Denormalised convenience flag for reporting — the TRUTH is the [trial_started_at, trial_ends_at) window, which is what the quota check reads.';

-- Finding an active trial is a hot-path read (every /api/analyze call), so index the window.
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_ends_at
  ON user_subscriptions (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;
