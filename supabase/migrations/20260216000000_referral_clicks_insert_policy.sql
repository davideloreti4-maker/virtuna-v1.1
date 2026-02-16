-- Allow authenticated users to create referral click records
-- (during OAuth callback, the referred user inserts their own click)
CREATE POLICY "Authenticated users can create referral clicks"
  ON referral_clicks FOR INSERT
  TO authenticated
  WITH CHECK (referred_user_id = (SELECT auth.uid()));
