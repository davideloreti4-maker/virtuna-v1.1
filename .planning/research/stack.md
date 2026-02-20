# Technology Stack Research: Prediction Engine Integration

**Project:** Virtuna - Prediction Engine Integration Milestone
**Researched:** 2026-02-20
**Researcher:** Stack dimension
**Overall confidence:** HIGH

---

## 1. Video Upload Pipeline (Supabase Storage -> Gemini)

**Verdict:** Already 90% wired. The engine's `analyzeVideoWithGemini()` accepts a `Buffer` + mimeType and handles Gemini Files API upload, polling, analysis, and cleanup. The missing piece is the browser-to-Supabase upload and the server-side Supabase-download-to-Gemini bridge.

### What exists today

| Layer | Status | Location |
|-------|--------|----------|
| Gemini video analysis function | DONE | `src/lib/engine/gemini.ts` (`analyzeVideoWithGemini`) |
| Gemini Files API upload + polling | DONE | Same file, lines 425-460 |
| Video response schema (5 factors + 4 video signals) | DONE | `src/lib/engine/types.ts` |
| Pipeline input_mode="video_upload" | DONE | `src/lib/engine/types.ts` (`AnalysisInputSchema`) |
| Normalize video_storage_path | DONE | `src/lib/engine/normalize.ts` |
| Content form UI with video tab | DONE | `src/components/app/content-form.tsx` |
| API route video_storage_path validation | DONE | `src/app/api/analyze/route.ts`, line 98 |

### What's missing

1. **Browser -> Supabase Storage upload**: The content form has a `video_file` field but sets `video_storage_path: "pending-upload"` instead of actually uploading. Need to create a `prediction-videos` Supabase Storage bucket and wire up `supabase.storage.from('prediction-videos').upload()`.

2. **Server-side Storage -> Buffer download**: The API route receives `video_storage_path` but never downloads the video from Supabase Storage. Need to add `supabase.storage.from('prediction-videos').download(path)` in the pipeline to get the Buffer, then pass it to `analyzeVideoWithGemini()`.

### Gemini Video API Constraints (HIGH confidence -- official docs)

| Constraint | Value | Source |
|------------|-------|--------|
| Supported formats | MP4, MPEG, MOV, AVI, FLV, MPG, WEBM, WMV, 3GPP | [Google AI docs](https://ai.google.dev/gemini-api/docs/video-understanding) |
| Files API max size | 2GB (free) / 20GB (paid) | Official docs |
| Inline data max | 100MB | Official docs |
| File retention | 48 hours | Official docs |
| Token rate | ~300 tokens/sec (default res), ~100 tokens/sec (low res) | Official docs |
| Max videos per request | 10 (Gemini 2.5+), 1 (older) | Official docs |
| Max video duration | 1 hour (1M context), 2 hours (2M context) | Official docs |

**Existing engine cap:** 50MB (`VIDEO_MAX_SIZE_BYTES` in `src/lib/engine/gemini.ts`). This is a sensible TikTok limit (~3 min video).

### Supabase Storage Constraints (HIGH confidence -- official docs)

| Constraint | Value |
|------------|-------|
| Free plan file limit | 50MB per file |
| Pro plan file limit | Configurable up to 500GB |
| Standard upload max | 5GB |
| Resumable upload max | 50GB |
| Recommended for >6MB | TUS resumable upload |

### Recommendation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` (existing) | ^2.93.1 | Browser upload to Storage | Already installed. Use `supabase.storage.from().upload()` for standard upload. TikTok videos are typically <50MB so standard upload is fine. |
| `@google/genai` (existing) | ^1.41.0 | Files API upload + video analysis | Already installed and fully wired in `src/lib/engine/gemini.ts`. |

**No new dependencies needed.** The video upload pipeline requires:
1. A Supabase migration to create the `prediction-videos` bucket with RLS policies
2. Client-side upload code in the content form
3. Server-side download bridge in the pipeline (or API route)

### Video Processing Library?

**Not needed.** TikTok videos are already in MP4 format. Gemini accepts MP4 natively. No transcoding, thumbnail generation, or format conversion is required for the prediction pipeline. If thumbnails are desired later for the history UI, use a `<video>` element's poster frame or Supabase image transformation -- no ffmpeg needed.

---

## 2. TikTok URL Video Extraction (via Apify)

**Verdict:** Use `clockworks/tiktok-video-scraper` (already in codebase as `clockworks/tiktok-scraper`) for metadata, and add a second Apify actor (`dz_omar/tiktok-video-downloader` or `wilcode/fast-tiktok-downloader-without-watermark`) specifically for downloading the actual MP4 video file.

### Current Apify Integration

The codebase uses two Clockworks actors:
- `clockworks/tiktok-profile-scraper` -- profile data (followers, bio, etc.)
- `clockworks/tiktok-scraper` -- video metadata by profile (playCount, diggCount, etc.)

Both are wired through `ApifyScrapingProvider` in `src/lib/scraping/apify-provider.ts` using `apify-client` v2.22.1.

### The Gap

The existing `clockworks/tiktok-scraper` accepts `profiles` (handles) as input and scrapes all their videos. For the prediction engine's `tiktok_url` input mode, we need to:

1. **Extract video metadata** from a specific post URL (caption, duration, hashtags)
2. **Download the actual video file** (MP4 buffer) to pass to Gemini for visual analysis

### Recommended Approach (MEDIUM confidence -- based on Apify actor docs + community)

**For metadata extraction from a specific URL:**
Use `clockworks/tiktok-video-scraper` (note: different from `clockworks/tiktok-scraper`). This actor accepts `postURLs` as input -- an array of specific TikTok video URLs. Returns the same output format (playCount, diggCount, text, hashtags, videoMeta, etc.) already parsed by the existing `apifyVideoSchema`.

```typescript
// Example: scrape specific video by URL
const run = await client.actor("clockworks/tiktok-video-scraper").call(
  { postURLs: ["https://www.tiktok.com/@user/video/1234567890"] },
  { waitSecs: 60 }
);
```

**For actual video file download:**
Use `dz_omar/tiktok-video-downloader` or `wilcode/fast-tiktok-downloader-without-watermark`. These actors:
- Accept a TikTok URL
- Download the actual MP4 from TikTok's CDN (no watermark)
- Store the file in Apify's key-value store
- Return a `fileUrl` for downloading

```typescript
// Example: download video file
const run = await client.actor("dz_omar/tiktok-video-downloader").call(
  { url: "https://www.tiktok.com/@user/video/1234567890" },
  { waitSecs: 120 }
);
// Then fetch the video buffer from the fileUrl in the output
```

### Alternative: Two-Step with Existing Actor

The `clockworks/tiktok-scraper` output includes a `webVideoUrl` field. This is the TikTok web player URL (not a direct MP4 link). However, looking at the existing schema, there may be a `videoUrl` or download URL in the raw Apify output that we're currently not parsing. Worth investigating before adding a new actor.

### Recommendation

| Technology | Purpose | Why |
|------------|---------|-----|
| `clockworks/tiktok-video-scraper` (new actor, same client) | Metadata by URL | Same Clockworks ecosystem, accepts `postURLs`, same output schema as existing `clockworks/tiktok-scraper` |
| `dz_omar/tiktok-video-downloader` (new actor, same client) | Download MP4 | Clean CDN downloads, no watermark, returns `fileUrl` for direct download |
| `apify-client` (existing) | ^2.22.1 | Already installed. Both new actors use the same ApifyClient. |

**No new npm dependencies.** Just add new actor IDs and methods to `ApifyScrapingProvider`.

### Cost Consideration

Each Apify actor run costs compute units. For the TikTok URL flow:
- Metadata scrape: ~$0.01-0.02 per URL
- Video download: ~$0.02-0.05 per video (depends on file size)
- Combined: ~$0.03-0.07 per prediction with video

This is within budget alongside Gemini (~$0.01-0.05 per video analysis) and DeepSeek costs.

---

## 3. Outcomes Auto-Scraping (48h Post-Prediction)

**Verdict:** Reuse the existing Apify integration with `clockworks/tiktok-video-scraper` (postURLs mode). Vercel cron is sufficient for the scheduling. No job queue needed.

### How it works

After a user makes a prediction for a TikTok URL, we need to scrape the actual performance (views, likes, shares, comments) ~48 hours later to compare predicted vs actual.

### Scraping Actor

Use `clockworks/tiktok-video-scraper` with `postURLs` input. It returns:
- `playCount` (views)
- `diggCount` (likes)
- `shareCount` (shares)
- `commentCount` (comments)
- `collectCount` (saves)

This is the same output format already validated by `apifyVideoSchema` in `src/lib/schemas/competitor.ts`.

### Scheduling Strategy

**Vercel cron is sufficient.** Here's why:

| Factor | Assessment |
|--------|------------|
| Frequency | Run every 6 hours, check for predictions due for scraping |
| Batch size | Likely <100 URLs per run (realistic user volume) |
| Execution time | Apify actor run ~30-60s per batch. Well within Vercel's 300s default / 800s max (Pro). |
| Existing pattern | Already 7 crons configured in `vercel.json`. Same pattern. |
| Complexity | Simple: query DB for predictions where `created_at < now() - 48h` AND `outcome_scraped = false`, batch scrape, update. |

**No job queue (BullMQ, Inngest, etc.) needed** because:
1. The workload is batch-oriented and time-insensitive (6h polling granularity is fine for a 48h window)
2. Apify handles the actual scraping infrastructure (retries, proxies, etc.)
3. Vercel cron handles the scheduling
4. Volume is predictable and bounded by daily analysis limits

### Implementation

Add a new cron endpoint: `/api/cron/scrape-outcomes`

```json
{
  "path": "/api/cron/scrape-outcomes",
  "schedule": "0 */6 * * *"
}
```

The cron handler:
1. Queries `analysis_results` for predictions with `input_mode = 'tiktok_url'` AND `outcome_scraped_at IS NULL` AND `created_at < now() - interval '48 hours'`
2. Batches the TikTok URLs (up to ~50 per Apify run)
3. Calls `clockworks/tiktok-video-scraper` with `postURLs`
4. Updates `analysis_results` with actual metrics and `outcome_scraped_at = now()`

### Schema Addition Needed

```sql
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS outcome_views BIGINT;
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS outcome_likes BIGINT;
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS outcome_shares BIGINT;
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS outcome_comments BIGINT;
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS outcome_saves BIGINT;
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS outcome_scraped_at TIMESTAMPTZ;
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
```

---

## 4. Analytics Charting

**Verdict:** Recharts v3.7.0 (already installed) is sufficient for all required chart types. No new charting library needed.

### Required Chart Types and Recharts Coverage

| Chart Type | Use Case | Recharts Support | Confidence |
|------------|----------|-----------------|------------|
| Confidence distribution | Show prediction confidence spread | `AreaChart` with `isRange` prop for bands, or `BarChart` for histogram | HIGH |
| Cost trend lines | Track API cost over time | `LineChart` with `Line` -- already used in competitor sparklines | HIGH |
| Model drift visualization | Score calibration over time | `ComposedChart` with `Line` (predicted) + `Scatter` (actual) | HIGH |
| Prediction accuracy scatter | Predicted vs actual scores | `ScatterChart` with `Scatter` + `ReferenceLine` for perfect correlation | HIGH |
| Score distribution | Histogram of prediction scores | `BarChart` with bucket ranges | HIGH |
| Factor radar | 5-factor breakdown | `RadarChart` with `Radar` -- native Recharts component | HIGH |

### Recharts Range/Band Support (MEDIUM confidence -- verified via GitHub issue #316 + API docs)

Recharts `Area` component supports:
- **`isRange` prop**: Enables range mode where data can specify upper and lower bounds
- **`baseLine` prop**: Sets a custom baseline (number or coordinate array) instead of zero

This means confidence interval bands (e.g., "predicted score 72 +/- 8") can be rendered as a shaded area between upper and lower bounds using a single `Area` component with `isRange={true}`.

### Existing Recharts Usage in Codebase

Already used in 7 components:
- `competitor-sparkline.tsx` -- LineChart
- `comparison-bar-chart.tsx` -- BarChart
- `comparison-growth-chart.tsx` -- LineChart
- `follower-growth-chart.tsx` -- LineChart
- `duration-breakdown-chart.tsx` -- BarChart
- `engagement-bar-chart.tsx` -- BarChart
- `earnings-chart.tsx` -- AreaChart

### Recommendation

**No new dependencies.** Recharts v3.7.0 covers all required chart types. Use:
- `AreaChart` with `isRange` for confidence bands
- `ComposedChart` for overlaying lines + scatter for drift visualization
- `RadarChart` for factor breakdowns (already a Recharts component)
- Existing `LineChart` pattern for cost/trend lines

---

## 5. Cron Scheduling / Job Queue

**Verdict:** Vercel cron is sufficient. No job queue needed.

### Current Cron Setup

7 crons already configured in `vercel.json`:

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/calculate-trends` | Hourly | Trend calculation |
| `/api/cron/scrape-trending` | Every 6h | Trending video scrape |
| `/api/cron/sync-whop` | Every 12h | Payment sync |
| `/api/cron/refresh-competitors` | Daily 6am | Competitor data refresh |
| `/api/cron/validate-rules` | Daily 2am | Rule validation |
| `/api/cron/retrain-ml` | Weekly Mon 3am | ML model retraining |
| `/api/cron/calibration-audit` | Monthly 1st 4am | Calibration audit |

### Vercel Function Limits (HIGH confidence -- official docs)

| Plan | Default Duration | Max Duration |
|------|-----------------|--------------|
| Hobby | 300s (5 min) | 300s (5 min) |
| Pro (Fluid Compute) | 300s (5 min) | 800s (13 min) |
| Enterprise | 300s (5 min) | 800s (13 min) |

The existing API route already uses `export const maxDuration = 120` (2 minutes). The outcomes scraper cron would need similar -- Apify actor runs typically complete in 30-120 seconds.

### When You WOULD Need a Job Queue

A job queue (Inngest, Trigger.dev, BullMQ + Redis) would be needed if:
- Individual jobs took >800 seconds (Vercel max)
- You needed exactly-once delivery guarantees
- You needed complex retry/backoff logic beyond Apify's built-in retries
- You needed to process >1000 URLs per cron run

None of these apply to the outcomes scraper. Apify handles the heavy lifting (proxies, retries, rate limiting). The cron just orchestrates.

### Recommendation

Add one new cron to `vercel.json`:

```json
{
  "path": "/api/cron/scrape-outcomes",
  "schedule": "0 */6 * * *"
}
```

Set `export const maxDuration = 300` in the route handler to allow for larger batches.

---

## Stack Summary

### No New Dependencies Required

The existing stack handles everything:

| Need | Covered By | Status |
|------|-----------|--------|
| Video upload (browser) | `@supabase/supabase-js` v2.93.1 | Installed, need bucket + upload code |
| Video analysis | `@google/genai` v1.41.0 | Installed, `analyzeVideoWithGemini()` fully implemented |
| TikTok URL scraping | `apify-client` v2.22.1 | Installed, need new actor IDs + methods |
| Outcomes scraping | `apify-client` v2.22.1 | Installed, reuse same client |
| Analytics charts | `recharts` v3.7.0 | Installed, supports all required chart types |
| Cron scheduling | Vercel cron (vercel.json) | Configured, add 1 new cron |
| Video format handling | None needed | TikTok = MP4, Gemini accepts MP4 natively |

### Infrastructure Additions

| Addition | Type | Effort |
|----------|------|--------|
| `prediction-videos` Supabase bucket | Migration | Low |
| Outcome columns on `analysis_results` | Migration | Low |
| `/api/cron/scrape-outcomes` route | API Route | Medium |
| Video upload in content form | Frontend | Medium |
| Pipeline video download bridge | Backend | Medium |
| New Apify actor methods | Backend | Low |

---

## Sources

### Official Documentation (HIGH confidence)
- [Gemini Video Understanding](https://ai.google.dev/gemini-api/docs/video-understanding) -- supported formats, size limits, token counting
- [Gemini Files API](https://ai.google.dev/gemini-api/docs/files) -- upload, polling, 48h retention
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- plan limits, maxDuration config
- [Supabase Storage File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits) -- per-plan size limits
- [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) -- upload API

### Apify Actors (MEDIUM confidence -- actor marketplace docs)
- [clockworks/tiktok-scraper](https://apify.com/clockworks/tiktok-scraper) -- existing actor for profile video scraping
- [clockworks/tiktok-video-scraper](https://apify.com/clockworks/tiktok-video-scraper) -- accepts postURLs for specific video scraping
- [dz_omar/tiktok-video-downloader](https://apify.com/dz_omar/tiktok-video-downloader) -- downloads MP4 from CDN without watermark
- [wilcode/fast-tiktok-downloader](https://apify.com/wilcode/fast-tiktok-downloader-without-watermark) -- alternative video downloader

### Recharts (MEDIUM confidence -- GitHub issues + API docs)
- [Recharts Area API](https://recharts.github.io/en-US/api/Area/) -- isRange and baseLine props
- [Recharts Issue #316](https://github.com/recharts/recharts/issues/316) -- range area implementation discussion

### Codebase (HIGH confidence -- verified by reading source)
- `src/lib/engine/gemini.ts` -- `analyzeVideoWithGemini()` implementation
- `src/lib/engine/types.ts` -- `AnalysisInputSchema` with 3 input modes
- `src/lib/scraping/apify-provider.ts` -- existing Apify integration
- `src/app/api/analyze/route.ts` -- API route with video_storage_path handling
- `vercel.json` -- 7 existing crons
