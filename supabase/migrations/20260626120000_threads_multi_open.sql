-- =========================================================================
-- threads — multi open thread per user (ChatGPT-style chat history)
-- =========================================================================
-- Reverses the one-open-thread-per-user invariant from migration
-- 20260618000000. The sidebar now lists every chat thread individually and
-- "New Thread" opens a fresh blank one (instead of re-using the single
-- immortal open thread), so a user must be able to own MANY open threads.
--
-- New model (no new columns — reuses threads.updated_at):
--   - ACTIVE thread = the user's most-recently-touched open thread
--     (type='open' AND reading_id IS NULL, ORDER BY updated_at DESC).
--   - "New Thread" inserts a fresh open thread → newest → active.
--   - Re-opening a thread touches updated_at = now() → newest → active.
--   - createOpenThreadLazy() now resolves the ACTIVE thread; the ~11 tool
--     routes that call it keep appending to whatever thread is active.
--
-- This migration is idempotent (safe to re-run).
-- =========================================================================

-- ── Step 1: Drop the one-open-per-user unique index ────────────────────────
-- It enforced exactly one open thread per user and made createOpenThreadLazy
-- collide (23505) on a second open. Multi-thread requires many open threads.

DROP INDEX IF EXISTS public.threads_open_user_unique_idx;

-- ── Step 2: Listing index ──────────────────────────────────────────────────
-- Supports the sidebar thread list + active-thread resolution: newest open
-- thread per user. Partial (open threads only) keeps it lean.

CREATE INDEX IF NOT EXISTS threads_user_open_updated_idx
  ON public.threads (user_id, updated_at DESC)
  WHERE type = 'open' AND reading_id IS NULL;

COMMENT ON INDEX public.threads_user_open_updated_idx IS
  'Lists a user''s open chat threads newest-first and resolves the ACTIVE thread '
  '(most-recently-touched open thread). Replaces threads_open_user_unique_idx, '
  'which enforced the retired one-open-thread-per-user invariant. '
  'Added by migration 20260626120000_threads_multi_open.sql.';
