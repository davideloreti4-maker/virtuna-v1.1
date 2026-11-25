-- =========================================================================
-- You (spec docs/superpowers/specs/2026-11-24-you-design.md §6; plan
-- docs/superpowers/plans/2026-11-24-you.md, Task 1).
--
-- Five facts a creator writes about themselves on the You page, one set per
-- creator. Additive only: five nullable text columns, each with its length
-- limit. No data is moved or rewritten and no access rule changes (the row is
-- already readable and writable only by its owner). Nothing reads the columns
-- while NEXT_PUBLIC_NEW_LOOK is off.
--
-- Applied ALONE, by hand, with the owner's word. The repository's
-- 20260619000100_creator_profile_writing_voice_sample.sql was never applied to
-- the live database and is not part of this change.
--
-- writing_voice_description holds a DESCRIPTION of how the creator sounds,
-- never a pasted post (an example line in the voice slot gets copied,
-- measured 2026-08-12).
--
-- Undo:
--   ALTER TABLE public.creator_profiles
--     DROP COLUMN about, DROP COLUMN sells, DROP COLUMN writing_voice_description,
--     DROP COLUMN can_film, DROP COLUMN never_do;
-- =========================================================================

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS about text NULL,
  ADD COLUMN IF NOT EXISTS sells text NULL,
  ADD COLUMN IF NOT EXISTS writing_voice_description text NULL,
  ADD COLUMN IF NOT EXISTS can_film text NULL,
  ADD COLUMN IF NOT EXISTS never_do text NULL;

-- Each limit is added once: a second run of this file changes nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_about_length' AND conrelid = 'public.creator_profiles'::regclass) THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_about_length CHECK (char_length(about) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_sells_length' AND conrelid = 'public.creator_profiles'::regclass) THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_sells_length CHECK (char_length(sells) <= 300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_writing_voice_description_length' AND conrelid = 'public.creator_profiles'::regclass) THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_writing_voice_description_length CHECK (char_length(writing_voice_description) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_can_film_length' AND conrelid = 'public.creator_profiles'::regclass) THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_can_film_length CHECK (char_length(can_film) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_never_do_length' AND conrelid = 'public.creator_profiles'::regclass) THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_never_do_length CHECK (char_length(never_do) <= 300);
  END IF;
END $$;

COMMENT ON COLUMN public.creator_profiles.about IS 'You: who the creator is, in their words (<= 200). Read by the writers under the new look only.';
COMMENT ON COLUMN public.creator_profiles.sells IS 'You: what the creator sells, in their words (<= 300).';
COMMENT ON COLUMN public.creator_profiles.writing_voice_description IS 'You: a DESCRIPTION of how the creator sounds (<= 200), never a pasted post.';
COMMENT ON COLUMN public.creator_profiles.can_film IS 'You: what the creator can film (<= 200).';
COMMENT ON COLUMN public.creator_profiles.never_do IS 'You: what the creator never does (<= 300). Written into every prompt as a rule.';
