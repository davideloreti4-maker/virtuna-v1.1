-- Pinned threads (2026-07-28).
--
-- Applied to the remote FIRST, via the SQL-editor path (mcp apply_migration), and
-- recorded there as version 20260728091759. This file exists so the local ledger
-- matches: applying it out of band and not committing it would have widened the
-- local/remote drift that already makes `supabase db push` unsafe on this project
-- (48 local-only / 41 remote-only migrations — a push would recreate `threads`).
--
-- Both statements are IF NOT EXISTS, so re-running this against the remote that
-- already has it is a no-op.
--
-- Additive and nullable: NULL = not pinned, timestamp = when it was pinned.
-- A timestamp rather than a boolean so pinned threads can hold a stable order
-- among themselves (most recently pinned first) without a second column.
alter table public.threads
  add column if not exists pinned_at timestamptz;

-- The sidebar lists open threads pinned-first, then by recency. Partial index:
-- only pinned rows are ever scanned by it, so it stays tiny.
--
-- NOTE for the query side: order by pinned_at desc NULLS LAST. Postgres puts
-- NULLs FIRST on a DESC order by default, which would float every UNPINNED thread
-- above the pinned ones (see listOpenThreads, nullsFirst: false).
create index if not exists threads_user_pinned_idx
  on public.threads (user_id, pinned_at desc)
  where pinned_at is not null;
