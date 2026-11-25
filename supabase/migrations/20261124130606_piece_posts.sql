-- =========================================================================
-- After posting, step 1 (spec docs/superpowers/specs/2026-11-24-after-posting-design.md §5;
-- plan docs/superpowers/plans/2026-11-24-after-posting.md, Task 1).
--
-- One new table, piece_posts: the TikTok post a creator linked to a piece they
-- simulated, what Maven said about the piece (copied once, when the link is
-- added), and the post's public numbers as they were read. One live post per
-- person, chat and piece. Additive only: nothing existing changes, no data is
-- moved. Own rows only (row level security). Nothing reads or writes the table
-- while NEXT_PUBLIC_NEW_LOOK is off.
--
-- Removing a link keeps its row (removed_at is set; null = live), so removing
-- a link never lowers the daily cap on new links (controller ruling 5). The
-- unique index holds live rows only, so a piece can be linked again after a
-- removal. Deleting a chat still deletes its rows (the FK cascade).
--
-- Checked against the code (2026-11-24):
--   threads.id is uuid (20260617000000_threads_messages.sql), so thread_id is
--   a uuid FK; ON DELETE CASCADE: deleting a chat deletes its posts.
--   piece_kind is PieceKind of src/lib/library/chat-summary.ts without 'chat'.
--   piece_key is a video's analysis id (text) or a text piece's result-page key.
--
-- Safe to run twice: every create is guarded, the policy by a lookup.
-- Applied ALONE, by hand, by the controller, with the owner's word (2026-11-24).
--
-- Undo:
--   DROP TABLE IF EXISTS public.piece_posts;
-- =========================================================================

create table if not exists public.piece_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete cascade,
  piece_key text not null check (char_length(piece_key) between 1 and 200),
  piece_kind text not null check (piece_kind in ('video','script','remix','hooks','ideas','text')),
  said_number smallint not null check (said_number between 0 and 100),
  said_measure text not null check (said_measure in ('stop','end')),
  said_at timestamptz,
  platform text not null default 'tiktok' check (platform in ('tiktok')),
  post_url text not null check (char_length(post_url) between 1 and 500),
  post_id text check (post_id ~ '^[0-9]{5,25}$'),
  handle text check (handle ~ '^[a-z0-9._]{1,50}$'),
  posted_at timestamptz,
  views bigint check (views >= 0),
  likes bigint check (likes >= 0),
  comments bigint check (comments >= 0),
  shares bigint check (shares >= 0),
  saves bigint check (saves >= 0),
  read_at timestamptz,
  reads jsonb not null default '[]'::jsonb,
  settled_at timestamptz,
  usual_views bigint check (usual_views > 0),
  usual_posts smallint check (usual_posts >= 5),
  attempts smallint not null default 0 check (attempts >= 0),
  read_error text check (read_error in ('gone','failed')),
  last_attempt_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.piece_posts is
  'After posting (new look only): the TikTok post linked to a simulated piece, what Maven said about it (copied once, at the link) and the post''s public numbers. One live row per person, chat and piece; a removed link keeps its row with removed_at set. Own rows only. The link shown is built from handle and post_id, never from post_url.';

-- One live post per person, chat and piece; a piece outside a chat counts as one chat.
-- Partial: a removed link does not hold its piece.
create unique index if not exists piece_posts_one_per_piece
  on public.piece_posts (user_id, coalesce(thread_id, '00000000-0000-0000-0000-000000000000'::uuid), piece_key)
  where removed_at is null;
-- A Library page's posted pieces (and the chat's cascade).
create index if not exists piece_posts_thread on public.piece_posts (thread_id);
-- One account read updates every linked post of that account.
create index if not exists piece_posts_user_handle on public.piece_posts (user_id, handle);

alter table public.piece_posts enable row level security;

-- One policy: a person may READ their own rows, in the (select auth.uid()) form of
-- 20260711193000_db_hygiene_advisors.sql. There is no policy for writing, on purpose: every write
-- goes through the server (the service role), which checks the link and the day's allowance. A
-- signed-in browser talking to the database directly can therefore change nothing here.
-- Postgres has no CREATE POLICY IF NOT EXISTS: the lookup makes a second run a no-op.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'piece_posts' and policyname = 'piece_posts_select_own') then
    create policy piece_posts_select_own on public.piece_posts
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;
