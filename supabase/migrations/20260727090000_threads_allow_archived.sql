-- =========================================================================
-- threads.type: allow 'archived' — close the drift that made "Delete thread"
-- impossible (F-021, docs/AUDIT-E2E-2026-07-26.md)
--
-- `archiveThread` (src/lib/threads/threads.ts) has always implemented the sidebar's
-- "Delete thread" as a REVERSIBLE archive: flip type 'open' → 'archived' so the row
-- drops out of listOpenThreads/getOpenThread (both filter type='open') without
-- deleting the conversation or cascading its messages.
--
-- The DB never learned about it. The original table (20260617000000_threads_messages.sql:30)
-- declared:
--     type text NOT NULL CHECK (type IN ('grounded', 'open'))
-- and no later migration widened it, so EVERY archive hit Postgres 23514
-- (`threads_type_check`) — a guaranteed 500 on every delete, for every user, since
-- the feature shipped. Reproduced 2026-07-27 against the live DB with the service
-- client. The code's archive concept simply never landed in the schema.
--
-- Widening a CHECK is additive and safe: no data rewrite, no row is invalidated
-- (live distribution at write time: 129 'open', 0 'grounded', 0 'archived'), and the
-- table is small so the brief ACCESS EXCLUSIVE lock is not a concern.
--
-- Idempotent: DROP ... IF EXISTS then re-ADD, so a re-run converges on the same
-- constraint rather than erroring on a duplicate name.
--
-- Reversible: re-narrow to ('grounded','open') — safe only while no 'archived' rows
-- exist, since the re-narrowed CHECK would reject them:
--     ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_type_check;
--     ALTER TABLE public.threads ADD CONSTRAINT threads_type_check
--       CHECK (type IN ('grounded', 'open'));
-- =========================================================================

ALTER TABLE public.threads
  DROP CONSTRAINT IF EXISTS threads_type_check;

ALTER TABLE public.threads
  ADD CONSTRAINT threads_type_check
  CHECK (type IN ('grounded', 'open', 'archived'));

COMMENT ON COLUMN public.threads.type IS
  'grounded = points at a Reading via reading_id · open = a live chat thread (the sidebar list) · archived = removed from the sidebar by the user, conversation preserved and reversible (archiveThread).';
