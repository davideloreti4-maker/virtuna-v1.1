-- Thread titles (sidebar naming fix, 2026-07-12)
--
-- Problem: sidebar labels were DERIVED on every list-load from each thread's
-- earliest text-bearing message block. Hooks Auto runs persist no user turn, so
-- every such thread titled itself from the model follow-up message — which by
-- prompt design opens near-identically ("Hook #1 wins by…" × N threads).
--
-- title is set write-once app-side at the first meaningful signal (typed ask >
-- anchor > rank-1 hook line); legacy/untitled threads are read-repaired at list
-- time from a role/block-aware derivation. Nullable: null = derive at read.

alter table public.threads add column if not exists title text;

comment on column public.threads.title is
  'Sidebar label. Write-once from first user ask / skill subject; null = derive at read (legacy).';
