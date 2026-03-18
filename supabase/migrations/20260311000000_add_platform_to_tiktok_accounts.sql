-- Add platform column to support Instagram alongside TikTok
ALTER TABLE tiktok_accounts
  ADD COLUMN platform TEXT NOT NULL DEFAULT 'tiktok';

-- Update unique constraint to include platform (same handle allowed on different platforms)
ALTER TABLE tiktok_accounts
  DROP CONSTRAINT tiktok_accounts_user_id_handle_key;

ALTER TABLE tiktok_accounts
  ADD CONSTRAINT tiktok_accounts_user_id_handle_platform_key
    UNIQUE(user_id, handle, platform);
