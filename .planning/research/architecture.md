# Architecture Patterns

**Domain:** TikTok Creator Intelligence Platform -- Prediction Engine Integration
**Researched:** 2026-02-20
**Overall confidence:** HIGH

---

## 1. Video Upload Pipeline Architecture

### Current State

The pipeline already has three input modes in `AnalysisInputSchema`:
- `text` -- content text analyzed via Gemini text prompt
- `tiktok_url` -- TikTok URL stored in `video_url`, extraction deferred ("Phase 5" comment)
- `video_upload` -- Supabase Storage path stored in `video_url`, resolution deferred

The Gemini module (`src/lib/engine/gemini.ts`) already has:
- `analyzeWithGemini()` -- text-only analysis, used by the pipeline today
- `analyzeVideoWithGemini()` -- full video analysis via Gemini Files API, **already implemented but not wired into the pipeline**

The pipeline (`pipeline.ts` line 226) currently calls `analyzeWithGemini(validated)` for ALL input modes. It never checks `input_mode` or calls `analyzeVideoWithGemini`.

### Recommended Architecture: Branch at Stage 3

Video analysis should REPLACE text analysis when video is available, not run as an additional input. Rationale:

1. **Gemini video analysis already returns the same 5 factors + 4 video signals** -- it is a strict superset of the text analysis output. Running both would double Gemini cost (~$0.04/analysis) for no additional signal quality.

2. **The `GeminiVideoAnalysis` type extends `GeminiAnalysis`** -- the pipeline result shape does not change. `geminiResult.analysis` works identically; it just has an additional `video_signals` field.

3. **DeepSeek already handles video context** -- `formatGeminiSignals()` in `deepseek.ts` already checks for `analysis.video_signals` and includes it in the DeepSeek prompt.

**Pipeline modification (Stage 3 only):**

```
Stage 3 (Gemini Analysis):
  IF input_mode === "video_upload":
    1. Download video buffer from Supabase Storage via signed URL
    2. Call analyzeVideoWithGemini(buffer, mimeType, niche)
    3. Return GeminiVideoAnalysis (superset of GeminiAnalysis)
  ELIF input_mode === "tiktok_url":
    1. Call TikTok extraction (Apify -- see Section 2)
    2. If video extracted: analyzeVideoWithGemini(buffer, mimeType, niche)
    3. If extraction fails: fall back to analyzeWithGemini(validated) using extracted caption
  ELSE (text mode):
    1. Call analyzeWithGemini(validated) as today
```

### Video Upload Data Flow

```
Client                    API Route              Pipeline           Supabase Storage    Gemini
  |                          |                      |                     |                |
  |-- Upload video --------->|                      |                     |                |
  |   (multipart/form-data)  |                      |                     |                |
  |                          |-- Upload to bucket -->|                     |                |
  |                          |   "prediction-videos" |                     |                |
  |                          |<-- storage_path ------|                     |                |
  |                          |                      |                     |                |
  |-- POST /api/analyze ---->|                      |                     |                |
  |   { input_mode:          |-- runPipeline ------>|                     |                |
  |     "video_upload",      |                      |                     |                |
  |     video_storage_path } |                Stage 3:                    |                |
  |                          |                      |-- Download -------->|                |
  |                          |                      |<-- video buffer ----|                |
  |                          |                      |                     |                |
  |                          |                      |-- Upload to Files ->|                |
  |                          |                      |<-- analysis --------|                |
  |                          |                      |                     |                |
  |                          |              Stage 7: DeepSeek gets        |                |
  |                          |              video_signals in prompt       |                |
  |                          |                      |                     |                |
  |<-- SSE result -----------|<-- PredictionResult --|                    |                |
```

### Upload Route (New: `/api/upload/video`)

Separate the upload from the analysis. Upload happens first (client-side), then the analysis request includes the storage path.

```typescript
// POST /api/upload/video
// 1. Authenticate user
// 2. Validate file: max 50MB, video/* MIME type
// 3. Upload to Supabase Storage bucket "prediction-videos"
//    Path: {user_id}/{nanoid()}.{ext}
// 4. Return { storage_path, signed_url (for preview) }
```

**Why separate upload from analysis:**
- Upload can take 10-30s for large videos -- don't block the analysis SSE stream
- Client can show upload progress independently
- Storage path is reusable if user retries analysis
- Follows the existing `input_mode` pattern where video_storage_path is pre-resolved

### Supabase Storage Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| Bucket name | `prediction-videos` | Scoped, not shared with ml-weights |
| Max file size | 50MB | Matches `VIDEO_MAX_SIZE_BYTES` in gemini.ts |
| Allowed MIME types | `video/mp4, video/webm, video/quicktime` | TikTok standard formats |
| RLS policy | Owner-only read/write | User can only access their own uploads |
| TTL / cleanup | 24h via cron or pg_cron | Videos are transient -- delete after analysis |

**Confidence:** HIGH -- `analyzeVideoWithGemini` is already implemented and tested. The integration is a wiring exercise, not new capability.

---

## 2. TikTok URL Extraction Pipeline

### Current State

- `scrape-trending` cron uses `clockworks~tiktok-scraper` actor for bulk hashtag scraping
- Apify webhook handler (`/api/webhooks/apify`) processes bulk results into `scraped_videos`
- The pipeline normalize stage sets `video_url: input.tiktok_url` but does nothing with it
- No single-video extraction exists

### Recommended Architecture: Pre-Stage Extraction

TikTok URL extraction should be a **pre-stage** (Stage 0) that runs BEFORE the pipeline, not replace Stage 3. Rationale:

1. **Extraction produces METADATA + VIDEO**, not analysis. The pipeline needs the extracted caption text for normalize, the video file for Gemini, and the creator handle for creator context.

2. **Apify runs asynchronously** -- actor runs take 10-60s. This cannot be injected mid-pipeline without restructuring the wave architecture.

3. **Extraction failure should fall back gracefully** -- if Apify fails, the pipeline should still work with whatever caption text the user provided.

### Architecture: Synchronous Single-Video Extraction

Use a dedicated Apify actor for single-video extraction (not the bulk scraper). The `clockworks~tiktok-video-scraper` actor accepts a single URL and returns video data.

```
POST /api/analyze (tiktok_url mode)
  |
  Stage 0: TikTok Extraction (BEFORE pipeline)
  |-- Start Apify actor with single URL
  |-- Poll for completion (timeout: 60s)
  |-- Extract: {
  |     caption: string,          -> content_text (if user didn't provide)
  |     videoUrl: string,         -> download video buffer
  |     author: string,           -> creator_handle
  |     duration: number,         -> duration_hint
  |     hashtags: string[],       -> hashtags
  |     sound: string,            -> trending sound context
  |     metrics: { views, likes, shares, comments }  -> creator context enrichment
  |   }
  |
  v
  Pipeline starts with enriched AnalysisInput:
    input_mode: "tiktok_url"
    content_text: extracted_caption || user_provided_caption
    video_storage_path: null (video passed as buffer, not stored)
    creator_handle: extracted_author
    niche: inferred from hashtags
```

### Critical Design Decision: Poll vs Webhook

**Use polling, not webhooks** for single-video extraction. Rationale:

- The user is waiting (SSE stream open). Webhooks require a separate request cycle.
- Single-video extraction is fast (10-30s), well within `maxDuration = 120`.
- The existing webhook pattern is for bulk async scrapes (6h cron).

```typescript
// Extraction helper (new: src/lib/extraction/tiktok.ts)
export async function extractTikTokVideo(url: string): Promise<TikTokExtraction | null> {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

  // Use video-specific actor (not the bulk scraper)
  const run = await client.actor("clockworks~tiktok-video-scraper").call(
    { urls: [url] },
    { timeout: 60, memory: 256 }  // 60s timeout, minimal memory
  );

  // Fetch dataset
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  if (!items?.[0]) return null;

  return mapApifyItemToExtraction(items[0]);
}
```

### Video Buffer Handling (No Storage)

For TikTok URL mode, do NOT store the extracted video in Supabase Storage. Rationale:

- The video is ephemeral -- only needed for Gemini analysis
- Storing copyrighted TikTok videos has legal implications
- Extra storage write + read adds 5-10s latency
- The Gemini Files API accepts direct buffer upload

Instead, download the video buffer in-memory and pass directly to `analyzeVideoWithGemini()`.

### Extraction Integration in analyze route

```typescript
// In /api/analyze route.ts, BEFORE runPredictionPipeline:
if (validated.input_mode === "tiktok_url" && validated.tiktok_url) {
  send("phase", { phase: "extracting", message: "Extracting video from TikTok..." });

  const extraction = await extractTikTokVideo(validated.tiktok_url);

  if (extraction) {
    // Enrich the input with extracted data
    if (!validated.content_text) validated.content_text = extraction.caption;
    if (!validated.creator_handle) validated.creator_handle = extraction.author;
    // Store video buffer for pipeline Stage 3
    pipelineOpts.videoBuffer = extraction.videoBuffer;
    pipelineOpts.videoMimeType = extraction.mimeType;
  }
  // If extraction fails, pipeline continues with user-provided text (graceful degradation)
}
```

**Confidence:** MEDIUM -- The Apify single-video actor exists and is documented, but the synchronous polling approach within Vercel's 120s function timeout needs validation. If Apify consistently takes >60s, the approach needs a queue-based fallback.

---

## 3. Outcomes Auto-Scraping Architecture

### Current State

- `outcomes` table exists with manual submission (POST /api/outcomes)
- Schema: `analysis_id, user_id, actual_views, actual_likes, actual_shares, actual_engagement_rate, actual_score, predicted_score, delta, platform, platform_post_url`
- Calibration audit cron (`calibration-audit`) reads from outcomes for ECE computation and Platt re-fitting
- ML retrain cron reads from `scraped_videos`, not `outcomes`

### Recommended Architecture: Scheduled Scrape Queue

The auto-scraping system has three components:
1. **Scrape queue** -- track which analyses need outcome scraping
2. **Scrape cron** -- periodic job that processes the queue
3. **Feedback loop** -- connect outcomes back to calibration and ML

### 3a. Scrape Queue Design

New table: `outcome_scrape_queue`

```sql
CREATE TABLE outcome_scrape_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES analysis_results(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  platform_post_url text NOT NULL,        -- TikTok URL to scrape

  -- Scheduling
  scrape_after timestamptz NOT NULL,       -- When to first attempt (created_at + 48h)
  scrape_attempts int DEFAULT 0,           -- Retry count
  max_attempts int DEFAULT 3,              -- Stop after 3 failures
  last_attempt_at timestamptz,
  last_error text,

  -- Status
  status text DEFAULT 'pending'            -- pending | processing | completed | failed | cancelled
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  UNIQUE(analysis_id)                       -- One scrape per analysis
);

-- Index for the cron query pattern
CREATE INDEX idx_scrape_queue_pending
  ON outcome_scrape_queue(scrape_after)
  WHERE status = 'pending';
```

### 3b. Queue Entry Creation

When a user submits a TikTok URL for analysis AND provides the post URL (or we infer it from tiktok_url input mode):

```typescript
// After successful analysis insert in /api/analyze:
if (validated.input_mode === "tiktok_url" && validated.tiktok_url) {
  await service.from("outcome_scrape_queue").insert({
    analysis_id: analysisRow.id,
    user_id: user.id,
    platform_post_url: validated.tiktok_url,
    scrape_after: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });
}
```

For video_upload mode, the user would need to manually provide the post URL after publishing. This can be done via the existing `POST /api/outcomes` endpoint with `platform_post_url`, which would also create a queue entry.

### 3c. Scrape Cron: `/api/cron/scrape-outcomes`

**Schedule:** Every 6 hours (aligned with existing scrape-trending interval)

```
vercel.json addition:
{
  "path": "/api/cron/scrape-outcomes",
  "schedule": "0 */6 * * *"
}
```

**Processing strategy: Batch with individual Apify calls**

```typescript
// GET /api/cron/scrape-outcomes
// 1. Query pending items where scrape_after <= now() AND status = 'pending'
//    ORDER BY scrape_after ASC LIMIT 20  (batch size)
// 2. Set status = 'processing' (claim batch)
// 3. For each item:
//    a. Use Apify single-video scraper to get current metrics
//    b. Map metrics to outcome fields
//    c. Calculate actual_score using the same engagement formula as ML training
//    d. Upsert into outcomes table
//    e. Update queue status to 'completed'
// 4. On failure: increment scrape_attempts, set last_error, keep status = 'pending'
// 5. If scrape_attempts >= max_attempts: set status = 'failed'
```

**Why batch of 20, not unlimited:**
- Vercel Pro maxDuration is 120s (or 800s with Fluid Compute)
- Each Apify single-video scrape takes ~10-30s
- Processing 20 items sequentially would take ~200-600s
- Solution: Run 5 concurrent Apify calls per batch (4 batches of 5)
- Total time: ~60-120s for 20 items

**Actual score calculation:**

```typescript
// Convert raw metrics to a 0-100 score comparable to predicted_score
function calculateActualScore(metrics: ScrapedMetrics): number {
  const views = metrics.views ?? 1;
  const shareRate = (metrics.shares ?? 0) / views;
  const commentRate = (metrics.comments ?? 0) / views;
  const likeRate = (metrics.likes ?? 0) / views;

  // Weighted engagement score matching calibration-baseline.json methodology
  const engagementScore = (likeRate * 1 + commentRate * 2 + shareRate * 3);

  // Normalize to 0-100 using platform average benchmarks
  // p50 = ~45, p90 = ~85 from calibration data
  const normalized = Math.min(100, Math.max(0,
    Math.round(engagementScore * 1000) // Scale factor calibrated to match predicted scores
  ));

  return normalized;
}
```

### 3d. Feedback Loop Architecture

```
outcome_scrape_queue (pending)
        |
        v (every 6h)
  scrape-outcomes cron
        |
        v
  outcomes table (actual_score, actual_views, etc.)
        |
        +-----> calibration-audit cron (monthly)
        |         |
        |         v
        |       ECE computation -> Platt re-fitting -> platt_parameters table
        |
        +-----> retrain-ml cron (weekly) -- ENHANCEMENT NEEDED
                  |
                  v
                Uses outcomes + scraped_videos for training labels
```

**Critical enhancement for ML retrain:**

Currently `retrain-ml` uses ONLY `scraped_videos` data with tier labels derived from view count percentiles. With outcomes data, we can create a much richer training signal:

```typescript
// Enhanced training data source (retrain-ml cron):
// 1. Query outcomes with both predicted_score and actual_score
// 2. Use actual engagement metrics as features (real share/comment/like rates)
// 3. Use actual_score as training labels (instead of view-count percentiles)
// 4. This creates a true supervised learning loop:
//    predicted -> actual -> train -> better predictions
```

**Confidence:** HIGH for queue design and cron pattern (mirrors existing architecture). MEDIUM for actual_score calculation (normalization formula needs calibration against existing dataset).

---

## 4. Analytics Pre-Computation Architecture

### Current State

- `/api/admin/costs` -- daily cost aggregates (admin-only, cron-auth protected)
- `/api/trending/stats` -- per-category video stats (on-demand)
- No user-facing analytics endpoint exists
- `analysis_results` table has: overall_score, confidence, cost_cents, latency_ms, gemini_model, engine_version, feature_vector, created_at

### Recommended Architecture: Hybrid (Materialized Views + On-Demand)

**Use Supabase materialized views for heavy aggregations, on-demand for user-specific queries.**

Rationale for NOT using a pre-computation cron:
1. Vercel crons are best for triggering external work (Apify), not DB-heavy computation
2. Supabase/Postgres materialized views refresh faster and more reliably than HTTP-triggered aggregation
3. User-specific analytics (my prediction accuracy) must be on-demand anyway
4. The dataset is small enough (<100k rows) that Postgres aggregation is fast

### Analytics Queries Needed

| Query | Scope | Strategy | Refresh |
|-------|-------|----------|---------|
| Score distribution histogram | Global | Materialized view | Daily via pg_cron |
| Confidence distribution | Global | Materialized view | Daily via pg_cron |
| Average cost per model | Global | Materialized view | Daily via pg_cron |
| Model drift (score trends over time) | Global | Materialized view | Daily via pg_cron |
| User prediction accuracy | Per-user | On-demand query | Real-time |
| User score history timeline | Per-user | On-demand query | Real-time |
| Outcome vs predicted scatter | Per-user | On-demand query | Real-time |
| Signal weight distribution | Global | Materialized view | Daily via pg_cron |

### Materialized View: `analytics_daily_summary`

```sql
CREATE MATERIALIZED VIEW analytics_daily_summary AS
SELECT
  date_trunc('day', created_at) AS day,

  -- Volume
  COUNT(*) AS analysis_count,

  -- Score distribution
  AVG(overall_score) AS avg_score,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY overall_score) AS p25_score,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY overall_score) AS p50_score,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY overall_score) AS p75_score,

  -- Confidence
  AVG(confidence) AS avg_confidence,
  COUNT(*) FILTER (WHERE confidence >= 0.7) AS high_confidence_count,
  COUNT(*) FILTER (WHERE confidence < 0.4) AS low_confidence_count,

  -- Cost
  SUM(cost_cents) AS total_cost_cents,
  AVG(cost_cents) AS avg_cost_cents,

  -- Latency
  AVG(latency_ms) AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,

  -- Input modes
  COUNT(*) FILTER (WHERE input_mode = 'text') AS text_count,
  COUNT(*) FILTER (WHERE input_mode = 'tiktok_url') AS url_count,
  COUNT(*) FILTER (WHERE input_mode = 'video_upload') AS video_count,

  -- Calibration
  COUNT(*) FILTER (WHERE is_calibrated = true) AS calibrated_count,

  -- Engine
  gemini_model,
  engine_version

FROM analysis_results
WHERE deleted_at IS NULL
GROUP BY day, gemini_model, engine_version
ORDER BY day DESC;

-- Refresh daily at 1am UTC (before validate-rules at 2am)
-- Via pg_cron in Supabase:
SELECT cron.schedule(
  'refresh-analytics-summary',
  '0 1 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily_summary'
);
```

### API Endpoint: `/api/analytics`

```typescript
// GET /api/analytics?period=30d
// Returns:
// - daily_summary: from materialized view (fast, pre-computed)
// - user_accuracy: on-demand query joining analysis_results + outcomes for this user
// - score_distribution: histogram buckets from materialized view
```

### Vercel Serverless Model Considerations

| Concern | Approach |
|---------|----------|
| Cold start for analytics page | Materialized views return in <50ms, no concern |
| User-specific queries | Simple index on (user_id, created_at), fast enough for <10k rows per user |
| Refresh lag (materialized views) | 24h stale data for global metrics is acceptable for analytics |
| Concurrent refresh | Use `CONCURRENTLY` to avoid locking reads during refresh |
| No persistent server | pg_cron runs in Supabase, not Vercel -- no serverless timeout concern |

**Confidence:** HIGH -- standard Postgres pattern, no exotic dependencies. Supabase supports materialized views and pg_cron natively.

---

## 5. Hive Visualization Data Mapping

### Current State

The hive currently renders mock data with:
- Center node (tier 0): "Test Content" label
- Tier-1 nodes: Theme names (Engagement, Sentiment, Clarity, etc.)
- Tier-2 nodes: Sub-theme labels (Sub Engagement.1, etc.)
- Node position: deterministic scattered layout via golden angle + hash
- Node size: fixed by tier (tier-1: 7px, tier-2: 3-5px)
- Node color: palette by tier-1 group, lower alpha for tier-2
- No connection to real prediction data

### Recommended Data Mapping

The hive should visualize the **26-signal feature vector** from a prediction result, organized into the 5 scoring dimensions.

**Tier structure mapping:**

| Tier | Content | Source |
|------|---------|--------|
| 0 (Center) | The content being analyzed | `overall_score` determines center glow intensity |
| 1 (5 nodes) | The 5 scoring dimensions | behavioral, gemini, ml, rules, trends |
| 2 (26 leaves) | Individual signals from feature_vector | Each of the 26 FeatureVector fields |

**Tier-1 node mapping (5 nodes):**

| Node | Label | Score Source | Node Color Intensity |
|------|-------|-------------|---------------------|
| behavioral | "Behavioral" | `behavioral_score` (0-100) | Score / 100 maps to alpha 0.3-1.0 |
| gemini | "Content Quality" | `gemini_score` (0-100) | Score / 100 maps to alpha 0.3-1.0 |
| ml | "ML Pattern" | `ml_score` (0-100) | Score / 100 maps to alpha 0.3-1.0 |
| rules | "Rule Signals" | `rule_score` (0-100) | Score / 100 maps to alpha 0.3-1.0 |
| trends | "Trend Alignment" | `trend_score` (0-100) | Score / 100 maps to alpha 0.3-1.0 |

**Tier-2 node mapping (signals -> dimensions):**

```typescript
const SIGNAL_MAPPING: Record<string, { parent: string; label: string; normalize: (v: number | null) => number }> = {
  // Behavioral dimension (7 signals from DeepSeek)
  hookEffectiveness:   { parent: "behavioral", label: "Hook", normalize: v => (v ?? 0) / 10 },
  retentionStrength:   { parent: "behavioral", label: "Retention", normalize: v => (v ?? 0) / 10 },
  shareability:        { parent: "behavioral", label: "Shareability", normalize: v => (v ?? 0) / 10 },
  commentProvocation:  { parent: "behavioral", label: "Comments", normalize: v => (v ?? 0) / 10 },
  saveWorthiness:      { parent: "behavioral", label: "Save-worthy", normalize: v => (v ?? 0) / 10 },
  trendAlignment:      { parent: "behavioral", label: "Trend Fit", normalize: v => (v ?? 0) / 10 },
  originality:         { parent: "behavioral", label: "Originality", normalize: v => (v ?? 0) / 10 },

  // Content Quality dimension (5 Gemini factors + 4 video signals)
  hookScore:                  { parent: "gemini", label: "Scroll-Stop", normalize: v => (v ?? 0) / 10 },
  completionPull:             { parent: "gemini", label: "Completion", normalize: v => (v ?? 0) / 10 },
  rewatchPotential:           { parent: "gemini", label: "Rewatch", normalize: v => (v ?? 0) / 10 },
  shareTrigger:               { parent: "gemini", label: "Share Trigger", normalize: v => (v ?? 0) / 10 },
  emotionalCharge:            { parent: "gemini", label: "Emotional", normalize: v => (v ?? 0) / 10 },
  visualProductionQuality:    { parent: "gemini", label: "Visual Quality", normalize: v => (v ?? 0) / 10 },
  hookVisualImpact:           { parent: "gemini", label: "Visual Hook", normalize: v => (v ?? 0) / 10 },
  pacingScore:                { parent: "gemini", label: "Pacing", normalize: v => (v ?? 0) / 10 },
  transitionQuality:          { parent: "gemini", label: "Transitions", normalize: v => (v ?? 0) / 10 },

  // Rule Signals dimension (2 signals)
  ruleScore:       { parent: "rules", label: "Rule Match", normalize: v => (v ?? 0) / 100 },
  captionScore:    { parent: "rules", label: "Caption", normalize: v => (v ?? 0) / 10 },

  // Trend Alignment dimension (4 signals)
  trendScore:          { parent: "trends", label: "Trend Score", normalize: v => (v ?? 0) / 100 },
  audioTrendingMatch:  { parent: "trends", label: "Sound Match", normalize: v => v ?? 0 },
  hashtagRelevance:    { parent: "trends", label: "Hashtag Fit", normalize: v => v ?? 0 },
  hashtagCount:        { parent: "trends", label: "Tag Count", normalize: v => Math.min(1, (v ?? 0) / 15) },

  // Content Metadata (visual context, not ML features)
  durationSeconds:  { parent: "ml", label: "Duration", normalize: v => Math.min(1, (v ?? 30) / 180) },
  hasVideo:         { parent: "ml", label: "Has Video", normalize: v => v ? 1 : 0 },
};
```

### Visual Encoding Scheme

| Visual Property | Maps To | Formula |
|----------------|---------|---------|
| **Node radius** (tier-2) | Signal strength (0-1 normalized) | `BASE_RADIUS + normalizedValue * MAX_BONUS` (3px to 8px) |
| **Node alpha** (tier-2) | Signal strength | `0.2 + normalizedValue * 0.6` (dim when weak, bright when strong) |
| **Node color** (tier-1) | Scoring dimension | Fixed palette per dimension (same 5-color scheme as demo) |
| **Node color** (tier-2) | Inherited from parent tier-1 | Same hue, alpha varies by signal strength |
| **Tier-1 radius** | Dimension weight | `score_weights[dimension] * WEIGHT_SCALE` (larger = higher weight) |
| **Center glow** | Overall score | Pulse animation intensity maps to overall_score/100 |
| **Link opacity** (tier-1 mesh) | Score agreement | Higher when scores are similar, lower when divergent |
| **Null signals** | Video-only signals when no video | Render as hollow/dashed circles at minimum size |

### Transformer Function: `predictionToHiveData`

```typescript
export function predictionToHiveData(result: PredictionResult): HiveData {
  const dimensions = [
    { id: "behavioral", label: "Behavioral", score: result.behavioral_score, weight: result.score_weights.behavioral },
    { id: "gemini", label: "Content Quality", score: result.gemini_score, weight: result.score_weights.gemini },
    { id: "ml", label: "ML Pattern", score: result.ml_score, weight: result.score_weights.ml },
    { id: "rules", label: "Rule Signals", score: result.rule_score, weight: result.score_weights.rules },
    { id: "trends", label: "Trend Alignment", score: result.trend_score, weight: result.score_weights.trends },
  ];

  const children: HiveNode[] = dimensions.map(dim => ({
    id: dim.id,
    name: dim.label,
    tier: 1,
    meta: { score: dim.score, weight: dim.weight },
    children: Object.entries(SIGNAL_MAPPING)
      .filter(([, config]) => config.parent === dim.id)
      .map(([key, config]) => {
        const rawValue = result.feature_vector[key as keyof FeatureVector];
        const normalized = config.normalize(rawValue as number | null);
        return {
          id: `${dim.id}-${key}`,
          name: config.label,
          tier: 2 as const,
          meta: { value: normalized, rawValue, signalKey: key },
        };
      }),
  }));

  return {
    id: "center",
    name: "Your Content",
    tier: 0,
    meta: { overallScore: result.overall_score, confidence: result.confidence },
    children,
  };
}
```

### Layout Considerations

The existing `computeHiveLayout` function already works with any HiveData shape. The tier-2 node count will change from ~130 (mock) to ~26 (real signals), which means:

1. **Nodes will be less dense** -- the scattered cone algorithm will produce more spacing
2. **The visual will be more readable** -- 26 labeled nodes vs 130 generic ones
3. **Node size variation adds information** -- currently all tier-2 nodes are similar size

The `meta` field on LayoutNode is already available and unused -- the renderer can read `meta.value` to adjust radius and alpha per-node.

**Confidence:** HIGH -- the hive components are well-abstracted and the HiveData/LayoutNode types support arbitrary metadata via `meta`. The mapping is a pure data transformation.

---

## Component Boundaries Summary

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `/api/upload/video` | Video upload to Supabase Storage | Client, Supabase Storage |
| `/api/analyze` (enhanced) | Orchestrates extraction + pipeline | Extraction helper, Pipeline, Supabase DB |
| `lib/extraction/tiktok.ts` (new) | Single TikTok video extraction via Apify | Apify API |
| `lib/engine/pipeline.ts` (enhanced) | Stage 3 branches on input_mode | Gemini (text or video), Supabase Storage |
| `lib/engine/gemini.ts` (existing) | Text + video analysis | Google Gemini API |
| `/api/cron/scrape-outcomes` (new) | Batch outcome scraping | Apify API, Supabase DB |
| `outcome_scrape_queue` table (new) | Tracks pending outcome scrapes | Cron, DB |
| `analytics_daily_summary` view (new) | Pre-computed analytics | pg_cron, Supabase DB |
| `/api/analytics` (new) | Serves analytics data | Materialized view, Supabase DB |
| `lib/hive/prediction-to-hive.ts` (new) | Maps PredictionResult to HiveData | Feature vector types |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing TikTok Videos Long-Term
**What:** Downloading and persisting extracted TikTok videos in Supabase Storage.
**Why bad:** Legal liability (copyrighted content), storage costs, cleanup complexity.
**Instead:** Process in-memory, pass buffer directly to Gemini Files API, discard after analysis.

### Anti-Pattern 2: Running Extraction Inside the Pipeline
**What:** Making TikTok extraction a pipeline stage (e.g., replacing Stage 3).
**Why bad:** Pipeline stages are designed for parallel execution in waves. Extraction is sequential and slow (10-60s). It would block Wave 1 entirely.
**Instead:** Run extraction as a pre-stage in the API route, before calling `runPredictionPipeline`.

### Anti-Pattern 3: Real-Time Analytics Aggregation
**What:** Computing analytics aggregates on every page load from raw `analysis_results`.
**Why bad:** Full-table scans on every request. Degrades with scale. Serverless cold starts compound latency.
**Instead:** Materialized views refreshed daily via pg_cron. Sub-50ms reads.

### Anti-Pattern 4: Polling Apify in the Scrape-Outcomes Cron
**What:** Starting Apify runs and polling for completion within the cron handler.
**Why bad:** 20 sequential polls at 10-30s each = 200-600s. Exceeds Vercel function timeout.
**Instead:** Use `client.actor().call()` which waits for completion (Apify handles the polling internally). Run 5 concurrent calls via `Promise.all` in batches.

### Anti-Pattern 5: Separate Video + Text Analysis for Same Content
**What:** Running both `analyzeWithGemini()` and `analyzeVideoWithGemini()` when video is available.
**Why bad:** Double the Gemini cost. Video analysis already evaluates the same 5 factors PLUS video signals. The text prompt content is embedded in the video analysis prompt.
**Instead:** Branch at Stage 3: if video available, use video analysis only.

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Video upload bandwidth | No concern (Supabase handles) | Consider CDN/edge upload | Resumable uploads, regional buckets |
| Gemini API rate limits | No concern | Monitor quota tiers | Request priority queue |
| Apify extraction costs | ~$0.01/extraction | $100/day at 10k extractions | Evaluate self-hosted scraping |
| Outcome scrape queue | 20 items/batch fine | Increase batch size, add concurrency | Dedicated background worker (not cron) |
| Analytics queries | Materialized view overkill | Perfect fit | Partition by month, partial refresh |
| Hive rendering | 26 nodes trivial | 26 nodes still trivial | N/A (per-user, not aggregate) |

---

## Sources

- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Function Limits](https://vercel.com/docs/limits)
- [Supabase Storage File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase Signed Upload URLs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Supabase Cron (pg_cron)](https://supabase.com/modules/cron)
- [Apify TikTok Video Scraper](https://apify.com/clockworks/tiktok-video-scraper)
- [Apify TikTok Scraper](https://apify.com/clockworks/tiktok-scraper)
- [Gemini API Models Documentation](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- Codebase analysis: `src/lib/engine/pipeline.ts`, `gemini.ts`, `aggregator.ts`, `types.ts`, `calibration.ts`, `ml.ts`, `deepseek.ts`, `creator.ts`, `trends.ts`, `normalize.ts`
- Codebase analysis: `src/app/api/analyze/route.ts`, `outcomes/route.ts`, `cron/retrain-ml/route.ts`, `cron/calibration-audit/route.ts`, `cron/scrape-trending/route.ts`, `webhooks/apify/route.ts`
- Codebase analysis: `src/components/hive/hive-types.ts`, `hive-layout.ts`, `hive-mock-data.ts`
