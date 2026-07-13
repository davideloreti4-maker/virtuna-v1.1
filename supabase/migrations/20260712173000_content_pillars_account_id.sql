-- Per-account content pillars (2026-07-12, planned follow-up from #214–#216)
--
-- content_pillars rows were user-scoped while posts + pillar assignments were
-- already account-scoped, so only the PRIMARY account ever got pillar sets —
-- secondary connected accounts (IG/YT since #216) showed honest-empty forever.
-- This keys the rows to the connected account: each handle gets its own frozen
-- themes/mix/cadence, never merged across accounts.
--
-- user_id stays: it drives the own-rows RLS policy (content_pillars_all_own)
-- and the user-level confirm flow. Uniqueness moves user → account.

alter table public.content_pillars
  add column if not exists account_id uuid references public.connected_accounts(id) on delete cascade;

comment on column public.content_pillars.account_id is
  'Owning connected account — pillar sets are per-handle, never merged across a user''s accounts.';

-- Backfill: existing pillars were clustered from the primary account's posts.
update public.content_pillars cp
set account_id = ca.id
from public.connected_accounts ca
where cp.account_id is null and ca.user_id = cp.user_id and ca.is_primary;

alter table public.content_pillars alter column account_id set not null;

-- One pillar per name per ACCOUNT (was per user).
alter table public.content_pillars drop constraint if exists content_pillars_user_id_name_key;
alter table public.content_pillars
  add constraint content_pillars_account_id_name_key unique (account_id, name);

-- Ordered per-account listing (also covers the new FK).
create index if not exists idx_content_pillars_account_id
  on public.content_pillars (account_id, sort_order);
