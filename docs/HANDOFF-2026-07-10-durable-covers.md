# Handoff — Durable video covers across Discover + /start (2026-07-10)

## What shipped

Every Discover surface + /start now shows **real video thumbnails that don't expire**. Root cause: scraped TikTok cover URLs are short-lived signed links (`x-expires`) that 403 within days, and most ingest paths never persisted covers at all.

**Core mechanism** — `src/lib/scraping/rehost-cover.ts` (`rehostCover` / `rehostCovers`): at scrape time (while the signature is still valid) download the cover → upload to a public `covers` Storage bucket → store the permanent URL. SSRF allowlist (tiktokcdn hosts, HTTPS), total-degrade to `null` on failure (card falls back to its caption poster), idempotent on key `tiktok/<platformVideoId>`.

**Wired into all three scraped-video writers** (covers live in `scraped_videos.metadata.cover_url`, read at `feed-query.ts:160`):
- `src/lib/channels/ingest.ts` — Watching feed (channel ingest).
- `src/app/api/webhooks/apify/route.ts` — Trending (previously dropped `videoMeta.coverUrl` entirely).
- `src/app/actions/competitors/add.ts` — Competitor videos (needed a new `competitor_videos.cover_url` column).

**UI cover rendering added:**
- `src/components/surfaces/sections/outlier-card.tsx` — /start outliers (opt-in `<img>` + gradient/caption poster fallback).
- `src/components/competitors/detail/video-card.tsx` — competitor detail, now **cover-forward**. Cover is **opt-in** via `"cover_url" in video` so the `outlier-tile.tsx` reuse (which brings its own cover banner) is unaffected.
- `src/components/competitors/competitor-card.tsx` — Competitors tab: a 3-cover top-videos strip.
- `feed-card.tsx` already had the `onError` poster pattern.

## DB changes (already applied to prod `qyxvxleheckijapurisj`)
- `covers` public Storage bucket (migration `supabase/migrations/20260710120000_covers_bucket.sql`, also created live).
- `competitor_videos.cover_url text` (migration `20260710130000_competitor_videos_cover.sql`, applied via Supabase MCP).
- `src/types/database.types.ts` hand-edited for the new column (not a full regen).

## Backfill done (live Apify spend)
- Re-scraped channels @zachking / @khaby.lame / @chrisbumstead (covers rehosted).
- Trending: one bulk actor call on the **top-60 by views** → 51 permanent covers (webhook fix only helps NEW scrapes; this covers the visible set).
- 4 competitor profiles re-scraped.

## Verified in browser (Playwright MCP, e2e-test@virtuna.local)
/start outliers 3/3 · Watching 14 · Trending 22 (real thumbnails on visible cards) · Competitors tab (real strips) · competitor detail (cover-forward grid) · Channels (watchlist real stats + avatars). **tsc 0**, tests green (matte guard 38, ingest route 7, feed 5). Hooks = text templates by design (no covers).

## Open items for next session
1. **Seed competitors** — the 3 originally-tracked competitors (`leanwithliv`, `coachderaldo`, `themobilitymethod`) are **fake seed fixtures** (video_urls `.../video/seed1`, no real TikTok) → cannot get real covers. Real ones (mrbeast / khaby.lame / chrisbumstead, which DO have covered videos) were added to the test user's `user_competitors`. **Decide: remove the seed competitors?**
2. **`chrisbumstead` handle** scrapes as ~42 followers — that TikTok handle is a small/inactive account, not his main (~millions). **Swap for the correct handle?**
3. **Trending backfill is bounded to top-60.** Deeper pages still show caption posters until the daily trending cron re-scrapes (webhook now rehosts). Consider a scheduled cover-backfill if deeper coverage matters.
4. **`account_posts`** also drops covers (own-profile posts) — not a thumbnail surface today, left untouched.
5. **Avatars** (channel/competitor `avatar_url`) are still ephemeral TikTok URLs (load now because freshly scraped; will expire). Same rehost pattern could be applied if avatar rot appears.

## Notes
- Auto-wip daemon is DISABLED — nothing auto-commits.
- The `user_competitors` demo rows are DB-only (not in the diff).
