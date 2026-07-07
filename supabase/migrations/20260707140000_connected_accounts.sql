-- =========================================================================
-- Connected Accounts — first-class multi-account / multi-platform.
--
-- Decouples "connect" from "calibrate". A connected account = a real profile
-- you own (platform, handle) → powers analytics AND is the raw material for a
-- calibrated audience. Flat list + per-account switcher (NOT grouped-under-a-brand).
--
-- The bug this fixes: account_snapshots was keyed UNIQUE(user_id, snapshot_date)
-- — one row per user per day. A single creator with TikTok + Instagram COLLIDES
-- (second same-day snapshot overwrites the first; platform+handle were payload,
-- not part of the key). This migration makes (account_id) the discriminator:
--   account_snapshots  UNIQUE(user_id, snapshot_date) → UNIQUE(account_id, snapshot_date)
--   account_posts      UNIQUE(user_id, platform, post_id) → UNIQUE(account_id, post_id)
--
-- Relationships:
--   user → 1..N connected_accounts (across platforms)
--   connected_account → 0..N audiences (audiences.source_account_id, nullable)
--   connected_account → its own snapshot + post series (account_id FK, cascade)
--
-- Backfill (data is single-account per user today, so this is lossless):
--   1. one connected_accounts row per distinct (user_id, platform, handle) seen
--      across account_snapshots ∪ account_posts
--   2. is_primary = the latest-snapshot handle per user (matches the OLD cron's
--      "latest handle per user" behaviour → zero behaviour change for existing users)
--   3. stamp account_id onto every existing snapshot + post
--   4. personal audiences → the user's primary connected account (a personal
--      audience IS "calibrated from my own account"); targets stay null
--   5. flip the uniques to account-scoped + enforce account_id NOT NULL
-- =========================================================================

-- ── (1) connected_accounts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform           text        NOT NULL DEFAULT 'tiktok'
                       CHECK (platform IN ('tiktok','instagram','youtube')),
  -- the owner's @handle (no leading '@', lowercased)
  handle             text        NOT NULL,
  display_name       text,
  is_primary         boolean     NOT NULL DEFAULT false,
  -- producer-agnostic capture seam: 'scrape' today, 'oauth' later (Composio etc.)
  connection_method  text        NOT NULL DEFAULT 'scrape'
                       CHECK (connection_method IN ('scrape','oauth')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_synced_at     timestamptz,
  -- one connected account per (user × platform × handle)
  UNIQUE (user_id, platform, handle)
);

COMMENT ON TABLE public.connected_accounts IS
  'First-class connected social account (platform, handle) the user owns. Powers per-account analytics (account_snapshots.account_id) and is the source for calibrated audiences (audiences.source_account_id). Flat list + per-account switcher. connection_method is the producer seam (scrape now, oauth later).';
COMMENT ON COLUMN public.connected_accounts.is_primary IS
  'Exactly one primary per user (enforced by a partial unique index). The default analytics view and what /start reads. First connected account auto-primary.';

-- exactly one is_primary=true per user (nullable/false rows are unconstrained)
CREATE UNIQUE INDEX IF NOT EXISTS connected_accounts_one_primary_idx
  ON public.connected_accounts (user_id) WHERE is_primary;
-- listConnectedAccounts reads a user's accounts
CREATE INDEX IF NOT EXISTS connected_accounts_user_idx
  ON public.connected_accounts (user_id, created_at);

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connected_accounts_all_own ON public.connected_accounts;
CREATE POLICY connected_accounts_all_own ON public.connected_accounts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── (2) additive FK columns (nullable during backfill) ─────────────────────────
ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS account_id uuid
    REFERENCES public.connected_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.account_posts
  ADD COLUMN IF NOT EXISTS account_id uuid
    REFERENCES public.connected_accounts(id) ON DELETE CASCADE;
-- audiences: nullable source (customs/presets have none) — orphan gracefully on delete
ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS source_account_id uuid
    REFERENCES public.connected_accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.audiences.source_account_id IS
  'Nullable FK → connected_accounts. The connected account this audience was calibrated from. NULL for custom/preset/General audiences. ON DELETE SET NULL: deleting the account orphans the audience gracefully (frozen personas kept, live link dropped).';

-- ── (3) backfill connected_accounts from existing snapshot/post identities ──────
INSERT INTO public.connected_accounts (user_id, platform, handle, display_name, connection_method)
SELECT s.user_id, s.platform, s.handle, s.handle, 'scrape'
FROM (
  SELECT user_id, platform, handle FROM public.account_snapshots
  UNION
  SELECT user_id, platform, handle FROM public.account_posts
) s
ON CONFLICT (user_id, platform, handle) DO NOTHING;

-- (3a) is_primary = the latest-snapshot handle per user (matches the old cron)
WITH latest AS (
  SELECT DISTINCT ON (user_id) user_id, platform, handle
  FROM public.account_snapshots
  ORDER BY user_id, snapshot_date DESC, created_at DESC
)
UPDATE public.connected_accounts ca
SET is_primary = true
FROM latest l
WHERE ca.user_id = l.user_id AND ca.platform = l.platform AND ca.handle = l.handle;

-- (3b) users with posts but no snapshots → make their earliest account primary
UPDATE public.connected_accounts ca
SET is_primary = true
WHERE ca.id IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.connected_accounts
  WHERE user_id NOT IN (
    SELECT user_id FROM public.connected_accounts WHERE is_primary
  )
  ORDER BY user_id, created_at ASC
);

-- ── (4) stamp account_id onto existing rows ────────────────────────────────────
UPDATE public.account_snapshots s
SET account_id = ca.id
FROM public.connected_accounts ca
WHERE ca.user_id = s.user_id AND ca.platform = s.platform AND ca.handle = s.handle;

UPDATE public.account_posts p
SET account_id = ca.id
FROM public.connected_accounts ca
WHERE ca.user_id = p.user_id AND ca.platform = p.platform AND ca.handle = p.handle;

-- personal audiences = "calibrated from my own account" → link to the user's primary.
-- (No handle is persisted on audiences today; targets/customs stay null — best-effort.)
UPDATE public.audiences a
SET source_account_id = ca.id
FROM public.connected_accounts ca
WHERE ca.user_id = a.user_id AND ca.is_primary
  AND a.type = 'personal'
  AND a.is_general = false AND a.is_preset = false
  AND a.source_account_id IS NULL;

-- ── (5) flip uniques to account-scoped + enforce NOT NULL ──────────────────────
-- Every existing snapshot/post now has an account_id (its identity was the seed),
-- so NOT NULL is safe. New writes MUST supply account_id (repo + cron updated).
ALTER TABLE public.account_snapshots ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.account_snapshots
  DROP CONSTRAINT IF EXISTS account_snapshots_user_id_snapshot_date_key;
ALTER TABLE public.account_snapshots
  ADD CONSTRAINT account_snapshots_account_date_key UNIQUE (account_id, snapshot_date);

ALTER TABLE public.account_posts ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.account_posts
  DROP CONSTRAINT IF EXISTS account_posts_user_id_platform_post_id_key;
ALTER TABLE public.account_posts
  ADD CONSTRAINT account_posts_account_post_key UNIQUE (account_id, post_id);

-- ── indexes for the new account-scoped read paths ──────────────────────────────
CREATE INDEX IF NOT EXISTS account_snapshots_account_date_idx
  ON public.account_snapshots (account_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS account_posts_account_posted_idx
  ON public.account_posts (account_id, posted_at DESC);
