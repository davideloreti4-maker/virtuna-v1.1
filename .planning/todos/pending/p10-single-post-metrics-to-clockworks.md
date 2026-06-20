# P10 single-post metrics → switch to clockworks (Apify free-plan compat)

**Found:** 2026-06-20, during the Phase 11 clockworks scrape swap.
**Area:** `src/lib/scraping/apify-provider.ts → scrapeSinglePostMetrics` (Phase 10 flywheel capture).

## Why
P11 reverted Discover/Explore (`scrapeVideos`/`scrapeProfile`) from apidojo → **clockworks** because `apidojo/tiktok-scraper` is a PAID/rental actor that the Apify **FREE plan refuses** (`"You cannot use the API with the Free Plan"`).

`scrapeSinglePostMetrics` still uses the *paid* **`apidojo/tiktok-scraper-api`** (single-post tier, `startUrls:[postUrl]`). On a free-plan token this will hit the same wall → the P10 single-post metric capture (predicted-pin reconcile / flywheel) silently fails. **Untested** in the P11 UAT (out of scope).

## What to do
- Switch `scrapeSinglePostMetrics` to a clockworks single-URL path. `resolveVideoUrl` already uses `clockworks/tiktok-scraper` with `{ postURLs:[url], shouldDownloadVideos:true }` and works on free plan — a metrics-only single-post pull via clockworks (`postURLs:[url]`, no download) should return the engagement block. Remap via the clockworks `apifyVideoSchema` (playCount/diggCount/collectCount/…), NOT the apidojo schema.
- Keep `remapApidojoVideo` only if still needed; otherwise the apidojo single-post schema can be retired.
- Verify on the free-plan token + confirm the metric block (views/likes/comments/shares/saves) is populated.

## Production note
If apidojo is preferred in production for data quality, gate the provider/actor by environment instead of hard-coding — same decision as the Discover/Explore swap.
