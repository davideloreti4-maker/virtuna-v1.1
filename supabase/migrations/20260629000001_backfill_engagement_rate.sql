-- =========================================================================
-- Discover Feed Phase 2.1 — backfill engagement_rate on the existing corpus.
--
-- Phase 1.1 added engagement_rate but only the per-channel ingest populates it;
-- the trending corpus (cron/webhook rows) predates it and is NULL. The feed
-- filters/sorts by engagement_rate DB-side (plain WHERE/ORDER), so the Trending
-- tab needs it populated too. This is the exact, deterministic definition the
-- ingest helper uses: (likes + comments + shares) / views.
--
-- One-time + idempotent (only touches NULL rows with real views). New webhook
-- rows compute it at insert from this migration forward (webhooks/apify route).
-- =========================================================================

UPDATE public.scraped_videos
SET engagement_rate =
  (COALESCE(likes, 0) + COALESCE(comments, 0) + COALESCE(shares, 0))::numeric / views
WHERE engagement_rate IS NULL
  AND views IS NOT NULL
  AND views > 0;
