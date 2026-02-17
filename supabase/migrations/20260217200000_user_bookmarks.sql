-- Migration: user_bookmarks table
-- Stores video bookmarks per user, replacing localStorage approach

CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

-- Index for fast lookups by user
CREATE INDEX idx_user_bookmarks_user ON user_bookmarks(user_id, created_at DESC);

-- RLS: users can only manage their own bookmarks
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bookmarks"
  ON user_bookmarks FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own bookmarks"
  ON user_bookmarks FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own bookmarks"
  ON user_bookmarks FOR DELETE
  USING (user_id = (SELECT auth.uid()));
