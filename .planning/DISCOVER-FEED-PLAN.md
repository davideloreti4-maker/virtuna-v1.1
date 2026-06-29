# Discover Feed + Channels — Build Plan

> Milestone worktree ~/virtuna-discover-feed · branch milestone/discover-feed · off origin/main @ e4a60593 (PR #88).
> Decisions locked 2026-06-29: Channels + Feed scope · feed = watched channels + Trending tab · keep existing one-shot /discover untouched · dedicated worktree.

## Goal
Sandcastles-style discovery: a persistent, filterable Videos feed from watched channels (+ a Trending tab over the corpus we already scrape), and a Channels page (suggested / describe / search / add-URL + watchlist). Every tile keeps the moat hook Remix→Read, plus Save and Track. NON-goals: Ideas page, Hooks page (later). Existing one-shot /discover stays as-is.

## Reuse (don't rebuild)
- Apify per-channel scrape: scrapeProfileBundle(handle) → profile + 10-20 videos + free subtitles (src/lib/scraping/)
- Trending corpus: scraped_videos ← cron/scrape-trending → webhooks/apify (6-hourly; embedding/niche/creator_handle/posted_at)
- Channel profile store: competitor_profiles (avatar, followers, last_scraped_at, scrape_status)
- Watchlist: tracked_accounts (user→handle, idempotent add/remove API)
- Outlier score: rankOutliers (90d, views/baseline) + rankWithAudienceFit
- Tile+save: OutlierTile, OutlierTileData, SaveAffordance(item_type=outlier), saved→library echo
- In-thread: OutlierGridBlock schema + OutlierGridBlockRenderer

## Architecture decisions
1. Unify feed on scraped_videos. Trending tab = cron rows. Watched tab = rows where creator_handle ∈ user's tracked_accounts. Per-channel ingest scrapes once, shared across users; competitor_profiles.last_scraped_at gates re-scrape.
2. Compute outlier metrics at ingest, store on row: ADD outlier_multiplier numeric, baseline_label text ('vs own'|'vs niche'), engagement_rate numeric. Filters become plain WHEREs.
3. Keep competitor_videos and /discover untouched. New feed reads scraped_videos only.
4. Channels is a sub-surface reached via "Customize channels" in the feed toolbar.

## Phase 1 — Channels page + per-channel ingest
1.0 Confirm live shell — which sidebar renders for (app) routes (Sidebar.tsx new chat/audiences/library vs app/sidebar.tsx Dashboard/Discover). Add nav entry to the LIVE one. Browser-verify.
1.1 Channel ingest: POST /api/channels/ingest {handle,platform} → scrapeProfileBundle → upsert competitor_profiles + upsert videos into scraped_videos (creator_handle, outlier_multiplier vs channel median, baseline_label='vs own', engagement_rate). Idempotent; re-scrape if stale.
1.2 Channels page /feed/channels: tabs Add URL / Search / Suggested (static curated JSON by category) / Describe (1b optional/stub) + Your Watchlist panel (tracked_accounts: avatar·followers·views, Remove, Remove all, Export).
1.3 Tests + browser pass: ingest unit (mock Apify), watchlist add/remove, channels render; add a channel → scrape → appears in watchlist.

## Phase 2 — Videos feed
2.1 GET /api/feed?tab=watched|trending&filters&sort&cursor over scraped_videos. Watched joins tracked_accounts. Filters: channels(creator_handle IN), keywords(caption ILIKE/FTS), outlier score(outlier_multiplier), views, engagement(engagement_rate), posted-in(interval), platform, status(analyzed=derived idea/read; stretch). Sort: posted_at|views|outlier_multiplier|engagement. Keyset pagination + total count.
2.2 Feed page /feed: filters sidebar + tile grid (reuse OutlierTile/DiscoverGrid) + toolbar (Customize channels, Add video URL, tab Watched|Trending, Sort by, Export). Watched empty-state → CTA to Channels.
2.3 Per-tile: Remix→Read (chain handoff), Save (item_type=outlier), Track account. Cover + multiplier/views/engagement chips, matte, no coral.
2.4 Tests + browser pass: filter/sort/paginate; both tabs; Remix launches thread; Save echoes Library.

## Phase 3 — DEFERRED
Ideas page + Hooks vault (need analyzed-video pipeline). Revisit after Phase 2.

## House rules
Flat-warm charcoal (bg #262624, cream #ece7de never #fff, accent #d97757 never coral). 6% borders, 12px radius, Inter chrome. Keep reskin-matte.test green. Server components default. Gates: next build + tsc + eslint + vitest(node ./node_modules/vitest/vitest.mjs run) + matte guard + browser verify. Commit type(phase): desc. PR+squash per phase. Cache per-channel scrape via last_scraped_at.

## Confirm during build
Live sidebar identity + nav label (Feed/Discover/Videos). status filter semantics or defer. Describe tab v1 vs stub. Export format.
