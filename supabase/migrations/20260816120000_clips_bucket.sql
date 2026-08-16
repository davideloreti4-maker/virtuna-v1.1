-- Remix beat clips (phase 4): a PRIVATE bucket for ≤8 muted ≤4s fragments per remix run,
-- keyed clips/<blueprintId>/<beatIndex>.mp4. Audio is stripped from the files themselves (-an).
-- Reaped after CLIP_TTL_DAYS=7 by /api/cron/delete-retained-videos (owner ruling D1/D2
-- 2026-08-15: per-run clips + TTL — NOT the source_video dedupe this table's own comment once
-- proposed; see the spec's §1.2). Reads and writes are service-role only; the read route signs
-- fresh URLs per request and nothing persists them.
insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do update set public = false;
