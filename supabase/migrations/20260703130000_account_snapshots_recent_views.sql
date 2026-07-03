-- =========================================================================
-- Add recent_views to account_snapshots — the /start stat-row's 5th ("Views") tile.
--
-- recent_views = sum of public view counts across the creator's posts published in
-- the trailing window (RECENT_WINDOW_DAYS in refresh-account-snapshots). Unlike the
-- follower / heart / video counters, TikTok exposes NO account-level "Views" total,
-- so the only honest account-views figure is this per-post sum. It therefore lands
-- via the daily cron's VIDEO scrape (scrapeVideos), not the profile scrape.
--
-- NULLABLE by design (three-valued honesty spine):
--   NULL  → not captured (pre-migration rows; the calibration-capture path, which has
--           no video sum; a day the video scrape failed) → the Views tile is OMITTED.
--   0     → captured, genuinely no in-window posts → a real "0 views" (honest).
--   > 0   → the real windowed sum.
-- buildAccountStats reads the latest NON-NULL value and omits the Views tile entirely
-- when none exists — real, or omit; never a fabricated number.
-- =========================================================================

ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS recent_views bigint;

COMMENT ON COLUMN public.account_snapshots.recent_views IS
  'Sum of public views across posts in the trailing window (daily cron video scrape). NULL = not captured (Views tile omitted); 0 = real no-recent-posts; >0 = real sum. TikTok has no account-level views total, so this per-post sum is the only honest account-views figure.';
