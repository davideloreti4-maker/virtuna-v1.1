-- Competitor Intelligence Schema
-- Shared competitor profiles linked to users via junction table (deduplication model)
-- Metric counters use BIGINT (viral creators exceed MAX_INT)
-- Status fields use TEXT + CHECK (not ENUM) for flexibility
-- RLS uses (SELECT auth.uid()) pattern for 94%+ performance improvement

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPETITOR PROFILES (shared, deduplicated)
-- =====================================================
CREATE TABLE competitor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_handle TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  -- Metric counters (BIGINT for viral creators)
  follower_count BIGINT DEFAULT 0,
  following_count BIGINT DEFAULT 0,
  heart_count BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  -- Scraping state
  last_scraped_at TIMESTAMPTZ,
  scrape_status TEXT DEFAULT 'pending' CHECK (scrape_status IN ('pending', 'scraping', 'success', 'failed')),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USER-COMPETITOR JUNCTION TABLE (deduplication)
-- =====================================================
CREATE TABLE user_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, competitor_id)
);

-- =====================================================
-- COMPETITOR SNAPSHOTS (daily time-series, append-only)
-- =====================================================
CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  follower_count BIGINT NOT NULL,
  following_count BIGINT NOT NULL,
  heart_count BIGINT NOT NULL,
  video_count INTEGER NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- One snapshot per competitor per day
  UNIQUE(competitor_id, snapshot_date)
);

-- =====================================================
-- COMPETITOR VIDEOS
-- =====================================================
CREATE TABLE competitor_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  platform_video_id TEXT NOT NULL,
  video_url TEXT,
  caption TEXT,
  -- Engagement metrics (BIGINT for viral videos)
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,
  -- Metadata
  hashtags TEXT[] DEFAULT '{}',
  duration_seconds INTEGER,
  posted_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One record per video per competitor
  UNIQUE(competitor_id, platform_video_id)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_user_competitors_user_id ON user_competitors(user_id);
CREATE INDEX idx_user_competitors_competitor_id ON user_competitors(competitor_id);
CREATE INDEX idx_competitor_snapshots_competitor_id ON competitor_snapshots(competitor_id);
CREATE INDEX idx_competitor_snapshots_date ON competitor_snapshots(snapshot_date);
CREATE INDEX idx_competitor_videos_competitor_id ON competitor_videos(competitor_id);
CREATE INDEX idx_competitor_videos_posted_at ON competitor_videos(posted_at DESC);
CREATE INDEX idx_competitor_profiles_scrape_status ON competitor_profiles(scrape_status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE competitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_videos ENABLE ROW LEVEL SECURITY;

-- user_competitors: users can only see/manage their own links
CREATE POLICY "Users can view own competitor links"
  ON user_competitors FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can add competitor links"
  ON user_competitors FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can remove own competitor links"
  ON user_competitors FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- competitor_profiles: visible if user tracks the competitor
CREATE POLICY "Users can view tracked competitors"
  ON competitor_profiles FOR SELECT
  TO authenticated
  USING (id IN (SELECT competitor_id FROM user_competitors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Authenticated users can create competitor profiles"
  ON competitor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- competitor_snapshots: visible if user tracks the competitor
CREATE POLICY "Users can view tracked competitor snapshots"
  ON competitor_snapshots FOR SELECT
  TO authenticated
  USING (competitor_id IN (SELECT competitor_id FROM user_competitors WHERE user_id = (SELECT auth.uid())));

-- competitor_videos: visible if user tracks the competitor
CREATE POLICY "Users can view tracked competitor videos"
  ON competitor_videos FOR SELECT
  TO authenticated
  USING (competitor_id IN (SELECT competitor_id FROM user_competitors WHERE user_id = (SELECT auth.uid())));

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER set_competitor_profiles_updated_at
  BEFORE UPDATE ON competitor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_competitor_videos_updated_at
  BEFORE UPDATE ON competitor_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
