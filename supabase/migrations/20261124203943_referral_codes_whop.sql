-- =========================================================================
-- Earn, step B (plan docs/superpowers/plans/2026-11-24-earn.md, "Step B: Whop";
-- controller rulings 11 to 17).
--
-- Two columns on the existing table referral_codes, for a creator who enrolled
-- as an affiliate at Whop (the payment partner, which tracks a referred sale
-- and pays the referrer itself):
--   whop_username      the username Whop answered for the affiliate; it is the
--                      affiliate_code a referred buyer's checkout carries.
--   whop_affiliate_id  Whop's id of the affiliate (aff_...), to read what the
--                      creator has earned.
-- Both null until the creator enrols on Earn; each holds only its form (the
-- code checks the same patterns, src/lib/earn/earn.ts).
--
-- Additive only: no data is moved and no access rule changes. The server
-- writes both columns through the service role, for the session's own id.
-- Nothing reads the columns while NEXT_PUBLIC_NEW_LOOK is off, except the
-- checkout, which reads a referrer's whop_username with any look (ruling 29).
--
-- Safe to run twice: every add is guarded. Applied on its own, with the
-- owner's word (2026-11-24, ruling 11).
--
-- Undo:
--   ALTER TABLE public.referral_codes
--     DROP COLUMN IF EXISTS whop_username, DROP COLUMN IF EXISTS whop_affiliate_id;
-- =========================================================================

alter table public.referral_codes
  add column if not exists whop_username text,
  add column if not exists whop_affiliate_id text;

-- Each check is added once: a second run of this file changes nothing.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'referral_codes_whop_username_form' and conrelid = 'public.referral_codes'::regclass) then
    alter table public.referral_codes add constraint referral_codes_whop_username_form check (whop_username ~ '^[A-Za-z0-9._-]{1,64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referral_codes_whop_affiliate_id_form' and conrelid = 'public.referral_codes'::regclass) then
    alter table public.referral_codes add constraint referral_codes_whop_affiliate_id_form check (whop_affiliate_id ~ '^aff_[A-Za-z0-9]{1,64}$');
  end if;
end $$;

comment on column public.referral_codes.whop_username is 'Earn: the Whop username of the creator''s affiliate (as Whop answered it); the affiliate_code of a referred checkout. Written by the server only.';
comment on column public.referral_codes.whop_affiliate_id is 'Earn: Whop''s id of the creator''s affiliate (aff_...), to read what they earned. Written by the server only.';
