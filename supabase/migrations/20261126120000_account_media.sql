-- =========================================================================
-- Account media — the connected account's profile picture + each archived
-- post's cover thumbnail.
--
-- Scraped TikTok/Instagram image URLs are short-lived SIGNED CDN URLs (TikTok
-- `x-expires`, IG `oe=`); they 403 within days. Both columns therefore hold OUR
-- Supabase Storage public URLs (buckets `avatars` / `covers`), rehosted at ingest
-- by src/lib/scraping/rehost-cover.ts — never the raw CDN URL. NULL = no picture
-- (rehost failed or never ran); the UI falls back to initials / a blank tile.
--
-- Additive only. RLS: both tables already carry own-rows FOR ALL policies
-- (connected_accounts_all_own, account_posts_all_own), which cover new columns;
-- no policy change needed.
-- =========================================================================

ALTER TABLE public.connected_accounts
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.connected_accounts.avatar_url IS
  'Profile picture of this social account, as OUR storage URL (public `avatars` bucket, key account/<platform>/<handle>), rehosted at connect + on the daily refresh. Never a raw TikTok/IG CDN URL (those expire). NULL = no picture yet.';

ALTER TABLE public.account_posts
  ADD COLUMN IF NOT EXISTS cover_url text;

COMMENT ON COLUMN public.account_posts.cover_url IS
  'Cover thumbnail of this post, as OUR storage URL (public `covers` bucket, key account/<platform>/<post_id>), rehosted when the post is upserted. Never a raw TikTok/IG CDN URL (those expire). NULL = rehost failed or the scrape carried no cover.';
