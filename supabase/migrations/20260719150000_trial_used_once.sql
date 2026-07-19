-- ONE TRIAL PER ACCOUNT — the stamp that survives everything.
--
-- The trial WINDOW (trial_started_at / trial_ends_at) is mutable state: the webhook nulls it
-- when a full-price plan is granted, so "has this account ever used a $1 trial" cannot be
-- answered from it. A customer could trial Creator, cancel, buy Pro later (window nulled),
-- cancel again — and the checkout would happily sell them a second $1 trial.
--
-- `trial_used_at` is HISTORY, not state: stamped once by the webhook the first time a trial
-- window is opened, never cleared by anything. The checkout route reads it and quietly
-- resolves a repeat "trial" purchase to the full-price SKU (the Whop embed shows the real
-- price before any charge — never an undercharge, never a surprise).
--
-- Safe on a live DB: nullable ADD COLUMN, no backfill needed (nobody has ever trialed —
-- Whop plans do not exist yet).

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

COMMENT ON COLUMN user_subscriptions.trial_used_at IS
  'When this account FIRST opened a $1 trial window. Write-once history (webhook), never cleared — the one-trial-per-account guard reads it (api/whop/checkout). Distinct from trial_started_at, which is current-window STATE and is nulled on full-price grants.';
