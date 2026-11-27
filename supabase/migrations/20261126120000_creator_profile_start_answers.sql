-- =========================================================================
-- Start answers (funnel part 1, /start).
--
-- The new fields of the funnel: what the videos are about (niche, and
-- whether it was typed or is to be worked out from the TikTok account),
-- whether the creator ticked the box for tips and trial emails, and the
-- fields the later parts write: the guide's step and dismissal, the trial
-- reminder and the left-without-paying email stamps.
--
-- Reused, NOT touched here: where they post goes to target_platforms
-- (text[], 20260517210000), the goal to primary_goal (text, 20260213000000,
-- screen 4 asks its own set), the name to display_name (text,
-- 20260202000000).
--
-- Additive only: nullable columns and two with defaults. No data is moved or
-- rewritten and no access rule changes (the row is readable and writable only
-- by its owner, the policies of 20260202000000_v16_schema.sql). Nothing reads
-- these columns while NEXT_PUBLIC_NEW_LOOK is off.
--
-- niche: up to 60 characters when typed (checked in the app); up to 120 in
-- the database, for a niche the audience build words (part 2).
-- guide_step: 0 = not started, 1-4 = coach card shown, 5 = done.
--
-- Applied ALONE, by hand, with the owner's word.
--
-- Undo:
--   ALTER TABLE public.creator_profiles
--     DROP COLUMN niche, DROP COLUMN niche_source, DROP COLUMN email_consent,
--     DROP COLUMN guide_step, DROP COLUMN guide_dismissed_at,
--     DROP COLUMN trial_reminder_sent_at, DROP COLUMN paywall_left_email_at;
-- =========================================================================

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS niche text NULL,
  ADD COLUMN IF NOT EXISTS niche_source text NULL,
  ADD COLUMN IF NOT EXISTS email_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guide_step smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guide_dismissed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS paywall_left_email_at timestamptz NULL;

-- Each check is added once: a second run of this file changes nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_niche_length' AND conrelid = 'public.creator_profiles'::regclass) THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_niche_length CHECK (char_length(niche) BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_niche_source_known' AND conrelid = 'public.creator_profiles'::regclass) THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_niche_source_known CHECK (niche_source IN ('typed', 'account'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_guide_step_range' AND conrelid = 'public.creator_profiles'::regclass) THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_guide_step_range CHECK (guide_step BETWEEN 0 AND 5);
  END IF;
END $$;

COMMENT ON COLUMN public.creator_profiles.niche IS '/start: what the videos are about, in the creator''s words (typed 2-60), or worded by the audience build.';
COMMENT ON COLUMN public.creator_profiles.niche_source IS '/start: "typed" or "account" (worked out from the TikTok account).';
COMMENT ON COLUMN public.creator_profiles.email_consent IS '/start: ticked "Email me tips and reminders about my trial" (unticked by default). Gates the non-transactional email only.';
COMMENT ON COLUMN public.creator_profiles.guide_step IS 'Guided first look: 0 not started, 1-4 coach card shown, 5 done.';
COMMENT ON COLUMN public.creator_profiles.guide_dismissed_at IS 'Guided first look: when the creator closed the guide.';
COMMENT ON COLUMN public.creator_profiles.trial_reminder_sent_at IS 'Email: when the day-5 trial reminder went out (idempotency).';
COMMENT ON COLUMN public.creator_profiles.paywall_left_email_at IS 'Email: when the left-without-paying email went out (idempotency).';
