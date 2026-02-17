-- affiliate_links table for brand deals data integrity
-- Tracks user-scoped affiliate links with click/conversion/earnings metrics

CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  url TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  clicks INT NOT NULL DEFAULT 0,
  conversions INT NOT NULL DEFAULT 0,
  earnings_cents INT NOT NULL DEFAULT 0,
  commission_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user-scoped queries
CREATE INDEX idx_affiliate_links_user_id ON affiliate_links(user_id);
CREATE INDEX idx_affiliate_links_short_code ON affiliate_links(short_code);

-- Enable RLS
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;

-- Users can read their own affiliate links
CREATE POLICY "Users can view own affiliate links"
  ON affiliate_links FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own affiliate links
CREATE POLICY "Users can create own affiliate links"
  ON affiliate_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own affiliate links
CREATE POLICY "Users can update own affiliate links"
  ON affiliate_links FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own affiliate links
CREATE POLICY "Users can delete own affiliate links"
  ON affiliate_links FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_affiliate_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_affiliate_links_updated_at
  BEFORE UPDATE ON affiliate_links
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_links_updated_at();
