-- Training Corpus Schema (Phase 1, D-01..06)
-- System-wide table (no user_id) — service-role writes, public read denied by default.
-- Mirrors macro structure of scraped_videos (content_intelligence.sql) — BIGINT counters,
-- TEXT[] hashtags, JSONB metadata. corpus_version partitions snapshots per D-12.
--
-- KNOWN GAP (per user decision 2026-05-11): completion_pct is NOT captured from Apify
-- scrapes (Apify TikTok actors do not expose actual completion %). Column exists for
-- forward compatibility with the in-product outcome scraper (deferred milestone).
-- CORPUS-04 satisfaction: column exists; data populated when in-product scraper lands.
-- This gap is also documented in .planning/research/v2.1-baseline.md (Plan G).

-- =====================================================
-- SHARED TRIGGER FUNCTION (idempotent reuse)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRAINING CORPUS (D-01..06, D-12, D-14)
-- =====================================================
CREATE TABLE training_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scrape provenance
  platform TEXT NOT NULL DEFAULT 'tiktok',
  platform_video_id TEXT NOT NULL,
  video_url TEXT,
  creator_handle TEXT,
  posted_at TIMESTAMPTZ,                          -- D-04 (7-day age filter at scrape time)
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- Engagement outcomes (BIGINT — viral exceeds INT_MAX, per competitor_tables.sql:3 rationale)
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,
  duration_seconds INTEGER,
  completion_pct NUMERIC(5,2),                    -- NULL until in-product scraper lands (see header gap note)

  -- Creator outcome context (RESEARCH §A.3)
  follower_count BIGINT,                          -- nullable — clockworks profile-scraper not always called
  follower_tier TEXT
    CHECK (follower_tier IS NULL OR follower_tier IN ('nano', 'micro', 'mid', 'large', 'mega')),

  -- Content for engine input
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  sound_name TEXT,

  -- Corpus labeling
  corpus_version TEXT NOT NULL,                   -- D-12: pilot.YYYY-MM-DD / full.YYYY-MM-DD
  niche TEXT NOT NULL
    CHECK (niche IN ('beauty', 'fitness', 'edu', 'comedy', 'lifestyle')),  -- D-03
  bucket TEXT NOT NULL
    CHECK (bucket IN ('viral', 'average', 'under')),                       -- D-14 three-class
  bucket_target TEXT
    CHECK (bucket_target IS NULL OR bucket_target IN ('viral', 'average', 'under')),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(corpus_version, platform_video_id)       -- same video can appear across versions
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_training_corpus_version_niche ON training_corpus(corpus_version, niche);
CREATE INDEX idx_training_corpus_version_bucket ON training_corpus(corpus_version, bucket);
CREATE INDEX idx_training_corpus_posted_at ON training_corpus(posted_at DESC);
CREATE INDEX idx_training_corpus_creator ON training_corpus(creator_handle);  -- D-05 dedupe

-- =====================================================
-- ROW LEVEL SECURITY (system-wide, service-role only)
-- =====================================================
ALTER TABLE training_corpus ENABLE ROW LEVEL SECURITY;
-- No policies created → all non-service-role access denied by default.
-- Service role bypasses RLS via createServiceClient(). System-wide table, never user-scoped.

-- =====================================================
-- TRIGGER
-- =====================================================
CREATE TRIGGER training_corpus_updated_at
  BEFORE UPDATE ON training_corpus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
