-- Durable cover thumbnails for competitor videos. Mirrors scraped_videos.metadata.cover_url,
-- but competitor_videos is a flat table so the cover gets its own column. Populated (rehosted to
-- the public `covers` bucket) by src/app/actions/competitors/add.ts on scrape. Nullable — a video
-- whose cover rehost failed keeps null and the tile falls back to its caption poster.
alter table competitor_videos add column if not exists cover_url text;
