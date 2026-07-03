-- =========================================================================
-- Own-account daily metric snapshots — the time-series behind the /start stat-row.
--
-- Mirrors competitor_snapshots (same cumulative counters) but keyed to the OWNER
-- (auth.users) instead of a shared competitor_profiles row, with own-rows RLS.
-- The /start stat-row derives Followers / New followers / Likes / Posts + their
-- L7D deltas and sparklines from this series. A single scrape gives point-in-time
-- values; day-over-day deltas + sparks accumulate as the daily cron appends rows.
--
-- Producers: (1) calibration capture — one snapshot the moment a personal audience
-- calibrates (from the scrape reveal); (2) the refresh-account-snapshots cron —
-- a daily append per connected account. UNIQUE(user_id, snapshot_date) => one row
-- per user per day (upsert-idempotent), same shape as competitor_snapshots.
--
-- following_count is NULLABLE: the calibration reveal payload omits it, so the
-- capture path leaves it null and the daily cron (full profile scrape) fills it.
-- We never surface a fabricated 0 — the stat-row only reads follower/heart/video.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.account_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        text        NOT NULL DEFAULT 'tiktok'
                    CHECK (platform IN ('tiktok','instagram','youtube')),
  -- the creator's OWN @handle (no leading '@', lowercased) — drives the cron re-scrape
  handle          text        NOT NULL,
  -- cumulative counters (BIGINT — viral creators exceed MAX_INT)
  follower_count  bigint      NOT NULL,
  following_count bigint,                          -- nullable (see header)
  heart_count     bigint      NOT NULL,
  video_count     integer     NOT NULL,
  snapshot_date   date        NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- one snapshot per user per day (upsert target)
  UNIQUE (user_id, snapshot_date)
);

COMMENT ON TABLE public.account_snapshots IS
  'Own-account daily metric time-series (the /start stat-row source). Mirrors competitor_snapshots but owner-keyed with own-rows RLS. Producers: calibration capture + refresh-account-snapshots cron.';

COMMENT ON COLUMN public.account_snapshots.following_count IS
  'Nullable — the calibration reveal omits it; the daily cron (full profile scrape) fills it. Never surfaced as a fabricated 0.';

-- ── RLS (own rows only — mirrors tracked_accounts / saved_all_own) ──────────────
ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_snapshots_all_own ON public.account_snapshots;
CREATE POLICY account_snapshots_all_own ON public.account_snapshots
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS account_snapshots_user_date_idx
  ON public.account_snapshots (user_id, snapshot_date DESC);
