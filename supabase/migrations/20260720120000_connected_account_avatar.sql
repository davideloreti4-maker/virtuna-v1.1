-- Connected accounts: persist the profile avatar (2026-07-20)
--
-- The scrape has always carried it — `bundle.profile.avatarUrl` reaches
-- `calibration.ts` and is then dropped on the floor, so /audience/[id] rendered a
-- creator's account with no face on it.
--
-- Stored as the RE-HOSTED public URL, never the source: TikTok/IG avatar URLs are
-- signed and 403 within days (the same ephemeral-URL problem that `rehostCover`
-- exists for). `rehostAvatar` copies the bytes into the public `avatars` bucket and
-- returns a permanent URL; the column holds that. NULL means we hold no image and
-- the UI falls back to the handle's initial — it never renders a broken <img>.
--
-- Additive and nullable: existing rows keep working and backfill on their next
-- calibrate/sync.

alter table public.connected_accounts
  add column if not exists avatar_url text;

comment on column public.connected_accounts.avatar_url is
  'Permanent public URL of the account avatar, re-hosted into the `avatars` bucket by rehostAvatar(). Never the platform CDN URL — those are signed and expire. NULL = no image held.';
