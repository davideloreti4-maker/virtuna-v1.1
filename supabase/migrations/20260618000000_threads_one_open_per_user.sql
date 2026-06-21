-- =========================================================================
-- threads — one open thread per user: consolidation + unique index (04-03)
-- =========================================================================
-- Fixes the root cause of two live defects:
--   1. Every tool generation (ideas, hooks, /develop) landed in a DIFFERENT
--      open thread because createOpenThreadLazy() had no unique constraint to
--      collide on — the 23505 recovery path never fired for open threads.
--   2. getOpenThread() used .maybeSingle(), which throws PGRST116 when >1 row
--      matches — causing GET /api/threads/open to return 500 on reload.
--
-- This migration is idempotent (safe to re-run):
--
-- Step 1 — DATA CONSOLIDATION
--   For each user_id with >1 open thread (type='open' AND reading_id IS NULL):
--     - Pick canonical thread = MIN(created_at) — oldest survives.
--     - Repoint messages.thread_id from all duplicate open threads to the
--       canonical thread (preserves message ordering by created_at).
--     - Delete the now-empty duplicate open threads.
--
-- Step 2 — CONSTRAINT
--   Partial UNIQUE index: at most one open thread (reading_id IS NULL) per
--   user_id. The createOpenThreadLazy() get-or-create idempotency contract
--   relies on this index to produce a 23505 unique_violation on concurrent
--   first-opens, which the function catches and re-selects.
--
-- IMPORTANT: consolidation MUST run before index creation — the index creation
-- would fail with a duplicate-key error if dupes remain in the table.
-- =========================================================================

-- ── Step 1: Consolidate duplicate open threads ─────────────────────────────

-- For every user_id that has more than one open thread, repoint the messages
-- of all duplicates (non-canonical) to the canonical (oldest) thread, then
-- delete the emptied duplicates.

DO $$
DECLARE
  v_user_id  uuid;
  v_canon_id uuid;
BEGIN
  -- Iterate over users that have >1 open thread.
  FOR v_user_id IN
    SELECT user_id
      FROM public.threads
     WHERE type = 'open'
       AND reading_id IS NULL
     GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    -- Canonical thread = oldest (MIN created_at). If multiple rows share the
    -- same created_at, MIN(id) is the tiebreaker (deterministic UUID sort).
    SELECT id INTO v_canon_id
      FROM public.threads
     WHERE user_id     = v_user_id
       AND type        = 'open'
       AND reading_id  IS NULL
     ORDER BY created_at ASC, id ASC
     LIMIT 1;

    -- Repoint messages from duplicate open threads to the canonical thread.
    UPDATE public.messages
       SET thread_id = v_canon_id
     WHERE thread_id IN (
       SELECT id
         FROM public.threads
        WHERE user_id     = v_user_id
          AND type        = 'open'
          AND reading_id  IS NULL
          AND id          <> v_canon_id
     );

    -- Delete now-empty duplicate open threads.
    DELETE FROM public.threads
     WHERE user_id     = v_user_id
       AND type        = 'open'
       AND reading_id  IS NULL
       AND id          <> v_canon_id;
  END LOOP;
END;
$$;

-- ── Step 2: Unique partial index ───────────────────────────────────────────

-- Enforces the one-open-thread-per-user invariant that createOpenThreadLazy()
-- relies on for idempotent get-or-create: a second concurrent insert for the
-- same user_id will collide on this index and raise unique_violation (23505),
-- which createOpenThreadLazy() catches and resolves via getOpenThread().
-- We cannot use ON CONFLICT because PostgREST cannot reference a partial
-- index predicate in its conflict arbiter without emitting 42P10.

CREATE UNIQUE INDEX IF NOT EXISTS threads_open_user_unique_idx
  ON public.threads (user_id)
  WHERE type = 'open' AND reading_id IS NULL;

COMMENT ON INDEX public.threads_open_user_unique_idx IS
  'Enforces one open thread (type=''open'', reading_id IS NULL) per user_id. '
  'Required by createOpenThreadLazy() for idempotent get-or-create: a concurrent '
  'insert for the same user raises unique_violation (23505), which the function '
  'catches and resolves by re-selecting the existing row (CR-01 ownership-scoped). '
  'Added by migration 20260618000000_threads_one_open_per_user.sql (04-03 gap-closure).';
