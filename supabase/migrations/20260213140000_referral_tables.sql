-- =====================================================
-- REFERRAL CODES (one per user)
-- =====================================================
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referral_codes_user_id ON referral_codes(user_id);

-- =====================================================
-- REFERRAL CLICKS (track when links are clicked)
-- =====================================================
CREATE TABLE referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL REFERENCES referral_codes(code) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  referrer_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  UNIQUE(referred_user_id, referral_code)
);

CREATE INDEX idx_referral_clicks_referral_code ON referral_clicks(referral_code);
CREATE INDEX idx_referral_clicks_referrer_user_id ON referral_clicks(referrer_user_id);
CREATE INDEX idx_referral_clicks_clicked_at ON referral_clicks(clicked_at DESC);

-- =====================================================
-- REFERRAL CONVERSIONS (track when referred users purchase)
-- =====================================================
CREATE TABLE referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  referral_code TEXT NOT NULL REFERENCES referral_codes(code) ON DELETE CASCADE,
  whop_membership_id TEXT NOT NULL,
  bonus_cents INTEGER NOT NULL,
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_referral_conversions_referrer_user_id ON referral_conversions(referrer_user_id);
CREATE INDEX idx_referral_conversions_referred_user_id ON referral_conversions(referred_user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral code"
  ON referral_codes FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own referral code"
  ON referral_codes FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view clicks on their codes"
  ON referral_clicks FOR SELECT
  USING (referrer_user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view their conversions"
  ON referral_conversions FOR SELECT
  USING (referrer_user_id = (SELECT auth.uid()));

-- =====================================================
-- EXTEND wallet_transactions CHECK constraints for referral types
-- =====================================================
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('deal_payment', 'affiliate_commission', 'referral_bonus', 'withdrawal', 'adjustment'));

ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_reference_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_reference_type_check
  CHECK (reference_type IN ('deal_enrollment', 'affiliate_conversion', 'referral_conversion', 'manual'));

-- =====================================================
-- WALLET BALANCE TRIGGER (atomic balance calculation)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_balance_after()
RETURNS TRIGGER AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT COALESCE(balance_after_cents, 0)
  INTO current_balance
  FROM wallet_transactions
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;

  NEW.balance_after_cents := current_balance + NEW.amount_cents;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_balance_after
  BEFORE INSERT ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_balance_after();
