# Technology Stack Research: Prediction Engine Integration

**Project:** Virtuna - Prediction Engine Integration Milestone
**Researched:** 2026-02-20 (updated with deep-dive on upload/Apify/charting)
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
| Avatar upload precedent | DONE | `src/app/api/profile/avatar/route.ts` (uses `supabase.storage.from('avatars').upload()`) |

### What's missing

1. **Browser -> Supabase Storage upload**: The content form has a `video_file` field but sets `video_storage_path: "pending-upload"` instead of actually uploading. Need to create a `prediction-videos` Supabase Storage bucket and wire up the upload.

2. **Server-side Storage -> Buffer download**: The API route receives `video_storage_path` but never downloads the video from Supabase Storage. Need to add `supabase.storage.from('prediction-videos').download(path)` in the pipeline to get the Buffer, then pass it to `analyzeVideoWithGemini()`.

### Upload Strategy: Standard vs Resumable (HIGH confidence)

TikTok videos are typically 5-50MB. Two approaches available:

**Option A: Standard Upload (RECOMMENDED for this project)**
- Use `supabase.storage.from('prediction-videos').upload(path, file)` directly from the browser client
- Handles files up to 5GB (though bucket will be capped at 50MB)
- Simpler implementation, no extra dependencies
- **Limitation:** No native progress tracking. Upload is all-or-nothing.
- Already proven in codebase via avatar upload at `src/app/api/profile/avatar/route.ts`

**Option B: TUS Resumable Upload (for progress tracking)**
- Uses the TUS protocol via `tus-js-client` (v4.3.1)
- Provides real progress tracking via `onProgress` callback
- Supports pause/resume on network interruption
- Requires additional dependency: `tus-js-client`

**Decision: Use Standard Upload.** For 50MB-capped TikTok videos on a typical connection, upload takes 2-10 seconds. Progress tracking is a nice-to-have, not a must-have. If we later find users complaining about upload UX, we can add TUS. For now, a simple loading spinner with the existing `supabase.storage.from().upload()` pattern matches the avatar upload precedent.

### Standard Upload Implementation Pattern

```typescript
// Client-side: src/lib/upload-video.ts
import { createClient } from "@/lib/supabase/client";
import { nanoid } from "nanoid";

export async function uploadPredictionVideo(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "mp4";
  const path = `${nanoid(12)}.${ext}`;

  const { error } = await supabase.storage
    .from("prediction-videos")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}
```

```typescript
// Server-side: download video in pipeline
const { data, error } = await supabase.storage
  .from("prediction-videos")
  .download(videoStoragePath);

if (error || !data) throw new Error("Failed to download video from storage");
const buffer = Buffer.from(await data.arrayBuffer());
// Pass buffer to analyzeVideoWithGemini(buffer, mimeType)
```

### If Progress Tracking Is Needed Later (TUS)

```typescript
// Only add if users report upload UX issues
// npm install tus-js-client
import * as tus from "tus-js-client";

function uploadWithProgress(
  file: File,
  bucketName: string,
  filePath: string,
  accessToken: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace("https://", "")
    .replace(".supabase.co", "");

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectId}.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024, // 6MB chunks (Supabase requirement)
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName,
        objectName: filePath,
        contentType: file.type,
      },
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
}
```

**Key TUS details (from Supabase docs):**
- Endpoint: `https://{projectId}.supabase.co/storage/v1/upload/resumable`
- Chunk size MUST be 6MB (`6 * 1024 * 1024`)
- Upload URLs remain valid for up to 24 hours
- Requires `authorization` header with Bearer token from session

### Signed Upload URLs

Supabase also supports signed upload URLs via `createSignedUploadUrl()`. This pattern is useful when you want the server to authorize an upload but have the client upload directly to storage. **Not needed here** because the Supabase browser client handles auth transparently via the session token. Signed URLs are more relevant for unauthenticated/external uploads.

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

| Constraint | Free Plan | Pro Plan |
|------------|-----------|----------|
| Global file size limit | 50MB max | Configurable up to 500GB |
| Per-bucket file size limit | Up to global limit | Up to global limit |
| Standard upload max | 5GB | 5GB |
| Resumable upload max | 50GB | 50GB |
| Recommended for >6MB | TUS resumable upload | TUS resumable upload |
| Storage pricing | 1GB included | $0.021/GB/month |

**Common pitfall:** Upgrading the global limit but forgetting the per-bucket limit. If you see `Payload too large` errors, check BOTH settings.

**Next.js body size limit:** Default 1MB on server actions. This is why client-side direct upload to Supabase Storage is preferred over routing through a Next.js API route.

### Supabase Bucket Configuration

```sql
-- Migration: create prediction-videos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prediction-videos',
  'prediction-videos',
  false,  -- private bucket, requires auth
  52428800,  -- 50MB in bytes
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
);

-- RLS: users can only upload to their own folder
CREATE POLICY "Users can upload prediction videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'prediction-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: service role can read any video (for pipeline download)
CREATE POLICY "Service can read prediction videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'prediction-videos');
```

### Recommendation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` (existing) | ^2.93.1 | Browser upload to Storage | Already installed. Standard upload sufficient for 50MB TikTok videos. |
| `@google/genai` (existing) | ^1.41.0 | Files API upload + video analysis | Already installed and fully wired in `src/lib/engine/gemini.ts`. |

**No new dependencies needed.** The video upload pipeline requires:
1. A Supabase migration to create the `prediction-videos` bucket with RLS policies
2. Client-side upload code in the content form (~30 lines)
3. Server-side download bridge in the pipeline (~10 lines)

**Integration complexity: LOW-MEDIUM** -- avatar upload is a direct precedent, just adapt for video.

### Video Processing Library?

**Not needed.** TikTok videos are already in MP4 format. Gemini accepts MP4 natively. No transcoding, thumbnail generation, or format conversion is required for the prediction pipeline. If thumbnails are desired later for the history UI, use a `<video>` element's poster frame or Supabase image transformation -- no ffmpeg needed.

---

## 2. TikTok URL Video Extraction (via Apify)

**Verdict:** Use `clockworks/tiktok-video-scraper` (already in codebase as `clockworks/tiktok-scraper`) for metadata, and add a second Apify actor for downloading the actual MP4 video file.

### Current Apify Integration

The codebase uses two Clockworks actors:
- `clockworks/tiktok-profile-scraper` -- profile data (followers, bio, etc.)
- `clockworks/tiktok-scraper` -- video metadata by profile (playCount, diggCount, etc.)

Both are wired through `ApifyScrapingProvider` in `src/lib/scraping/apify-provider.ts` using `apify-client` v2.22.1.

### The Gap

The existing `clockworks/tiktok-scraper` accepts `profiles` (handles) as input and scrapes all their videos. For the prediction engine's `tiktok_url` input mode, we need to:

1. **Extract video metadata** from a specific post URL (caption, duration, hashtags, audio info)
2. **Download the actual video file** (MP4 buffer) to pass to Gemini for visual analysis

### Recommended Approach (MEDIUM confidence -- based on Apify actor docs + community)

**For metadata extraction from a specific URL:**
Use `clockworks/tiktok-video-scraper` (note: different from `clockworks/tiktok-scraper`). This actor accepts `postURLs` as input -- an array of specific TikTok video URLs.

**Output fields returned per video:**

| Field | Type | Maps To |
|-------|------|---------|
| `id` | string | `platform_video_id` |
| `text` | string | caption / `content_text` |
| `playCount` | number | views |
| `diggCount` | number | likes |
| `shareCount` | number | shares |
| `commentCount` | number | comments |
| `collectCount` | number | saves |
| `hashtags` | `Array<{ name: string }>` | hashtag extraction |
| `musicMeta.musicName` | string | `sound_name` |
| `musicMeta.musicAuthor` | string | sound artist |
| `musicMeta.playUrl` | string | `sound_url` |
| `videoMeta.duration` | number | `duration_seconds` |
| `webVideoUrl` | string | TikTok page URL |
| `authorMeta.name` | string | creator handle |

This output format is already parsed by the existing webhook handler at `src/app/api/webhooks/apify/route.ts` (lines 8-21) and the import script at `scripts/import-apify-data.ts`.

```typescript
// Example: scrape specific video by URL
const run = await client.actor("clockworks/tiktok-video-scraper").call(
  { postURLs: ["https://www.tiktok.com/@user/video/1234567890"] },
  { waitSecs: 60 }
);
const { items } = await client.dataset(run.defaultDatasetId).listItems();
const videoData = items[0]; // Contains all fields above
```

**For actual video file download:**
Use `dz_omar/tiktok-video-downloader`. This actor:
- Accepts a TikTok URL
- Downloads the actual MP4 from TikTok's CDN (no watermark)
- Stores the file in Apify's key-value store
- Returns a `fileUrl` for downloading

```typescript
// Example: download video file
const run = await client.actor("dz_omar/tiktok-video-downloader").call(
  { url: "https://www.tiktok.com/@user/video/1234567890" },
  { waitSecs: 120 }
);
// Fetch the actual video buffer from the key-value store output
const { items } = await client.dataset(run.defaultDatasetId).listItems();
const videoUrl = items[0]?.downloadUrl; // Direct CDN link
const videoBuffer = await fetch(videoUrl).then(r => r.arrayBuffer());
```

### Alternative: Two-Step with Existing Actor

The `clockworks/tiktok-scraper` output includes a `webVideoUrl` field. This is the TikTok web player URL (not a direct MP4 link). However, looking at the existing schema, there may be a `videoUrl` or download URL in the raw Apify output that we're currently not parsing. Worth investigating before adding a new actor.

### Apify Pricing (MEDIUM confidence -- Apify marketplace)

| Actor | Pricing Model | Cost |
|-------|--------------|------|
| `clockworks/tiktok-video-scraper` | Pay-per-result (PPR) | ~$0.005 per video |
| `clockworks/free-tiktok-scraper` | Pay-per-result (PPR) | $5 per 1,000 results ($0.005/item) |
| `dz_omar/tiktok-video-downloader` | Compute units | ~$0.02-0.05 per video |
| `apidojo/tiktok-scraper` | Pay-per-result (PPR) | $0.30 per 1,000 posts ($0.0003/item) |

**Free tier:** Apify provides $5 free usage credits per month. This covers ~1,000 metadata scrapes or ~100-250 video downloads.

**Cost per prediction with TikTok URL:**
- Metadata scrape: ~$0.005 per URL
- Video download: ~$0.02-0.05 per video
- Combined: ~$0.025-0.055 per prediction
- Plus Gemini video analysis: ~$0.01-0.05
- **Total per TikTok URL prediction: ~$0.035-0.10**

### Recommendation

| Technology | Purpose | Why |
|------------|---------|-----|
| `clockworks/tiktok-video-scraper` (new actor, same client) | Metadata by URL | Same Clockworks ecosystem, accepts `postURLs`, same output schema as existing webhook handler |
| `dz_omar/tiktok-video-downloader` (new actor, same client) | Download MP4 | Clean CDN downloads, no watermark, returns direct download URL |
| `apify-client` (existing) | ^2.22.1 | Already installed. Both new actors use the same ApifyClient. |

**No new npm dependencies.** Just add new actor IDs and methods to `ApifyScrapingProvider`.

**Integration complexity: MEDIUM** -- need to add new provider methods, handle the two-step (metadata + download) flow, and wire into the prediction pipeline.

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

**Vercel cron is the right choice.** Here's why:

| Factor | Assessment |
|--------|------------|
| Frequency | Run every 6 hours, check for predictions due for scraping |
| Batch size | Likely <100 URLs per run (realistic user volume) |
| Execution time | Apify actor run ~30-60s per batch. Well within Vercel's 300s default / 800s max (Pro). |
| Existing pattern | Already 7 crons configured in `vercel.json`. Same pattern. |
| Complexity | Simple: query DB for predictions where `created_at < now() - 48h` AND `outcome_scraped = false`, batch scrape, update. |

### Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| **Vercel Cron** | RECOMMENDED | Already in use (7 crons), simple, proven pattern, Pro plan supports per-minute scheduling |
| **Supabase pg_cron** | Not needed | Adds complexity. pg_cron is great for pure-DB jobs, but our scraper calls external APIs (Apify) which is better suited for a serverless function. Max 8 concurrent jobs, 10-min limit per job. |
| **Supabase Edge Functions** | Not needed | Deno-based runtime. Would require porting Apify client usage to Deno. No benefit over Vercel functions for this use case. |
| **Apify Scheduled Runs** | Possible but worse | Could schedule the Apify actor directly, but then we lose control over which URLs to scrape. The Vercel cron queries our DB for pending outcomes first. |
| **Job Queue (Inngest/Trigger.dev)** | Overkill | Adds infra complexity. Workload is batch-oriented, time-insensitive, and bounded by daily analysis limits. |

**No job queue (BullMQ, Inngest, etc.) needed** because:
1. The workload is batch-oriented and time-insensitive (6h polling granularity is fine for a 48h window)
2. Apify handles the actual scraping infrastructure (retries, proxies, etc.)
3. Vercel cron handles the scheduling
4. Volume is predictable and bounded by daily analysis limits

### Vercel Cron Limits (HIGH confidence -- official docs)

| Feature | Hobby | Pro | Enterprise |
|---------|-------|-----|------------|
| Cron jobs per project | 100 | 100 | 100 |
| Minimum interval | Once per day | Once per minute | Once per minute |
| Scheduling precision | Hourly (+/- 59 min) | Per-minute | Per-minute |
| Function max duration | 300s (5 min) | 800s (13 min) | 800s (13 min) |
| CPU time included | 100 hrs/month | 40 hrs/month | Custom |

**Currently 7 of 100 cron slots used.** Adding 1 more is trivial.

### Implementation

Add a new cron endpoint: `/api/cron/scrape-outcomes`

```json
{
  "path": "/api/cron/scrape-outcomes",
  "schedule": "0 */6 * * *"
}
```

The cron handler flow:

```typescript
// 1. Query for predictions needing outcome scraping
const { data: pending } = await supabase
  .from("analysis_results")
  .select("id, tiktok_url")
  .eq("input_mode", "tiktok_url")
  .is("outcome_scraped_at", null)
  .lt("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
  .limit(50); // batch size cap

// 2. Batch scrape via Apify
const urls = pending.map(p => p.tiktok_url);
const run = await client.actor("clockworks/tiktok-video-scraper").call(
  { postURLs: urls },
  { waitSecs: 120 }
);

// 3. Match results back and update analysis_results
const { items } = await client.dataset(run.defaultDatasetId).listItems();
for (const item of items) {
  // Match by URL, update with actual metrics
  await supabase.from("analysis_results")
    .update({
      outcome_views: item.playCount,
      outcome_likes: item.diggCount,
      outcome_shares: item.shareCount,
      outcome_comments: item.commentCount,
      outcome_saves: item.collectCount,
      outcome_scraped_at: new Date().toISOString(),
    })
    .eq("tiktok_url", item.webVideoUrl);
}
```

### Also feed the existing outcomes table

The project already has an `outcomes` table (see `src/app/api/outcomes/route.ts`) that stores `actual_views`, `actual_likes`, `actual_shares`, `predicted_score`, `actual_score`, and `delta`. The auto-scraper should also create an entry in `outcomes` to feed the calibration loop:

```typescript
// 4. Also insert into outcomes table for calibration
await supabase.from("outcomes").insert({
  analysis_id: analysisId,
  user_id: userId,
  actual_views: item.playCount,
  actual_likes: item.diggCount,
  actual_shares: item.shareCount,
  predicted_score: analysis.overall_score,
  platform: "tiktok",
  platform_post_url: item.webVideoUrl,
  reported_at: new Date().toISOString(),
});
```

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

**Integration complexity: MEDIUM** -- straightforward cron handler following existing patterns, but needs careful matching logic between Apify results and DB records.

### Cost Estimation for Auto-Scraping

| Volume | Apify Cost | Notes |
|--------|-----------|-------|
| 10 outcomes/day | ~$0.05/day ($1.50/month) | Small user base |
| 50 outcomes/day | ~$0.25/day ($7.50/month) | Medium user base |
| 200 outcomes/day | ~$1.00/day ($30/month) | Heavy usage |

Well within Apify free tier for early stages ($5/month free credits = ~1,000 scrapes).

---

## 4. Analytics Charting

**Verdict:** Recharts v3.7.0 (already installed) is sufficient for all required chart types. No new charting library needed.

### Required Chart Types and Recharts Coverage

| Chart Type | Use Case | Recharts Component | Implementation Approach | Confidence |
|------------|----------|-------------------|------------------------|------------|
| Confidence distribution histogram | Show spread of prediction confidence values | `BarChart` | Pre-bin data into ranges (0-0.2, 0.2-0.4, etc.), render as bar chart | HIGH |
| Cost trend line | Track API cost over time | `AreaChart` with `Area` | Same pattern as `earnings-chart.tsx` -- already proven in codebase | HIGH |
| Model drift detection | Score calibration divergence over time | `ComposedChart` | Overlay `Line` (predicted avg) + `Area` (actual avg range) + `ReferenceLine` at zero-drift | HIGH |
| Per-model accuracy scatter | Predicted vs actual scores by model | `ScatterChart` with `Scatter` | Each model as a different `Scatter`, `ReferenceLine` at y=x for perfect correlation | HIGH |
| Score distribution | Histogram of overall_score values | `BarChart` with pre-binned data | Same approach as confidence distribution | HIGH |
| Factor radar | 5-factor breakdown per analysis | `RadarChart` with `Radar` | Native Recharts component, no tricks needed | HIGH |

### Recharts Components Needed (all built-in)

```typescript
import {
  // Already used in codebase
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,

  // New for analytics (all native Recharts, no extra deps)
  ScatterChart, Scatter,
  ComposedChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ReferenceLine, ReferenceArea,
  ErrorBar,
  Legend,
} from "recharts";
```

### Histogram Implementation Pattern

Recharts has no dedicated `Histogram` component. Use `BarChart` with pre-binned data:

```typescript
// Pre-process confidence values into histogram bins
function binData(values: number[], binCount = 10): Array<{ range: string; count: number }> {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    range: `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`,
    count: 0,
  }));

  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
    bins[idx].count++;
  });

  return bins;
}

// Render as BarChart
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={binData(confidenceValues)}>
    <CartesianGrid horizontal vertical={false} stroke="rgba(255,255,255,0.04)" />
    <XAxis dataKey="range" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
    <Bar dataKey="count" fill="#FF7F50" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### Model Drift Chart Pattern

```typescript
// ComposedChart overlaying predicted average vs actual outcomes
<ComposedChart data={driftData}>
  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
  <XAxis dataKey="week" />
  <YAxis domain={[-20, 20]} label="Score Delta" />
  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
  <Area
    type="monotone"
    dataKey="upperBound"
    stroke="none"
    fill="#FF7F50"
    fillOpacity={0.1}
    // Use baseLine for the lower bound to create a band
    baseLine={driftData.map(d => d.lowerBound)}
  />
  <Line type="monotone" dataKey="avgDelta" stroke="#FF7F50" strokeWidth={2} dot={false} />
</ComposedChart>
```

### Prediction Accuracy Scatter Plot Pattern

```typescript
<ScatterChart>
  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
  <XAxis dataKey="predicted" name="Predicted Score" domain={[0, 100]} />
  <YAxis dataKey="actual" name="Actual Score" domain={[0, 100]} />
  {/* Perfect correlation line: y = x */}
  <ReferenceLine
    segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
    stroke="rgba(255,255,255,0.2)"
    strokeDasharray="5 5"
  />
  <Scatter name="Gemini" data={geminiData} fill="#FF7F50" />
  <Scatter name="DeepSeek" data={deepseekData} fill="#4A9EFF" />
  <Legend />
</ScatterChart>
```

### ErrorBar Component

Recharts includes a native `ErrorBar` component for showing uncertainty ranges. Useful for displaying confidence intervals on individual data points:

```typescript
<Bar dataKey="score">
  <ErrorBar dataKey="errorRange" width={4} strokeWidth={2} stroke="#FF7F50" />
</Bar>
```

ErrorBar accepts:
- Symmetric form: single number (e.g., `errorRange: 5` means +/- 5)
- Asymmetric form: `[lowerError, upperError]` array

### Existing Recharts Usage in Codebase (chart styling reference)

The project has a consistent chart styling pattern established across 7 components. Follow these conventions:

```typescript
// Standard chart styling tokens (from earnings-chart.tsx)
const CHART_STYLES = {
  grid: { stroke: "rgba(255, 255, 255, 0.04)" },
  axis: { fill: "rgba(255, 255, 255, 0.4)", fontSize: 12 },
  axisLine: { stroke: "rgba(255, 255, 255, 0.06)" },
  accentColor: "#FF7F50", // coral
  gradientStart: { stopColor: "#FF7F50", stopOpacity: 0.3 },
  gradientEnd: { stopColor: "#FF7F50", stopOpacity: 0.02 },
  tooltip: {
    background: "#222326",
    border: "border-white/[0.06]",
    shadow: "rgba(255,255,255,0.1) 0 1px 0 0 inset, 0 4px 12px rgba(0,0,0,0.5)",
  },
};
```

### Recommendation

**No new dependencies.** Recharts v3.7.0 covers all required chart types natively.

**Integration complexity: LOW-MEDIUM** -- chart components are self-contained, but need backend queries to aggregate data for histograms, drift calculations, and scatter plots.

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

### Optional Future Addition

| Dependency | Version | When to Add |
|------------|---------|-------------|
| `tus-js-client` | ^4.3.1 | Only if users report upload UX issues with large videos |

### Infrastructure Additions

| Addition | Type | Effort | Cost Impact |
|----------|------|--------|-------------|
| `prediction-videos` Supabase bucket | Migration | Low | ~$0.021/GB/month storage |
| Outcome columns on `analysis_results` | Migration | Low | None |
| `/api/cron/scrape-outcomes` route | API Route | Medium | ~$1.50-30/month Apify |
| Video upload in content form | Frontend | Medium | None |
| Pipeline video download bridge | Backend | Low | None |
| New Apify actor methods | Backend | Medium | ~$0.025-0.055/prediction |
| 5-6 new chart components | Frontend | Medium | None |

### Total New Recurring Costs

| Cost Item | Low Volume (10/day) | Medium Volume (50/day) | High Volume (200/day) |
|-----------|--------------------|-----------------------|----------------------|
| Apify (TikTok extraction) | ~$0.75/month | ~$3.75/month | ~$15/month |
| Apify (outcomes scraping) | ~$1.50/month | ~$7.50/month | ~$30/month |
| Supabase Storage (videos) | ~$0.10/month | ~$0.50/month | ~$2/month |
| **Total new costs** | **~$2.35/month** | **~$11.75/month** | **~$47/month** |

These are well within free tiers for early stages and scale linearly with usage.

---

## Sources

### Official Documentation (HIGH confidence)
- [Gemini Video Understanding](https://ai.google.dev/gemini-api/docs/video-understanding) -- supported formats, size limits, token counting
- [Gemini Files API](https://ai.google.dev/gemini-api/docs/files) -- upload, polling, 48h retention
- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- plan limits, intervals, pricing
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- plan limits, maxDuration config
- [Supabase Storage File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits) -- per-plan size limits, per-bucket config
- [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) -- upload API
- [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) -- TUS protocol, tus-js-client usage
- [Supabase Storage v3 Blog](https://supabase.com/blog/storage-v3-resumable-uploads) -- 50GB support, TUS details
- [Supabase Cron](https://supabase.com/docs/guides/cron) -- pg_cron alternative (evaluated, not recommended)

### Apify Actors (MEDIUM confidence -- actor marketplace docs)
- [clockworks/tiktok-scraper](https://apify.com/clockworks/tiktok-scraper) -- existing actor for profile video scraping
- [clockworks/tiktok-video-scraper](https://apify.com/clockworks/tiktok-video-scraper) -- accepts postURLs for specific video scraping
- [dz_omar/tiktok-video-downloader](https://apify.com/dz_omar/tiktok-video-downloader) -- downloads MP4 from CDN without watermark
- [Clockworks pricing](https://apify.com/clockworks) -- $5/1000 results PPR model

### Recharts (MEDIUM confidence -- GitHub + API docs)
- [Recharts API Reference](https://recharts.github.io/en-US/api/) -- full component list
- [Recharts ScatterChart](https://recharts.github.io/en-US/api/ScatterChart/) -- scatter plot API
- [Recharts ErrorBar](https://recharts.github.io/en-US/api/ErrorBar/) -- error bar / confidence interval component
- [Recharts Issue #316](https://github.com/recharts/recharts/issues/316) -- range area implementation discussion

### Codebase (HIGH confidence -- verified by reading source)
- `src/lib/engine/gemini.ts` -- `analyzeVideoWithGemini()` implementation
- `src/lib/engine/types.ts` -- `AnalysisInputSchema` with 3 input modes
- `src/lib/scraping/apify-provider.ts` -- existing Apify integration
- `src/app/api/analyze/route.ts` -- API route with video_storage_path handling
- `src/app/api/profile/avatar/route.ts` -- existing Supabase Storage upload pattern
- `src/app/api/outcomes/route.ts` -- existing outcomes API with manual submission
- `src/app/api/webhooks/apify/route.ts` -- existing Apify webhook handler with output format
- `src/components/app/brand-deals/earnings-chart.tsx` -- chart styling reference
- `vercel.json` -- 7 existing crons
