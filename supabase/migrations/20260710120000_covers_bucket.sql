-- Durable cover thumbnails: a PUBLIC storage bucket that holds re-hosted scraped covers.
-- Scraped TikTok covers are short-lived signed URLs (x-expires) that 403 within days; we
-- download them at ingest and re-host the bytes here so the feed/start tiles keep a real
-- thumbnail forever. Public read (the tiles render <img src> directly); writes are service-role.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = true;
