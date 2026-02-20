# Roadmap: Prediction Engine Integration

**Milestone:** Prediction Engine Integration
**Created:** 2026-02-20
**Depth:** Comprehensive
**Phases:** 6
**Requirements:** 63/63 mapped

---

## Phases

- [ ] **Phase 1: Wire UI + History + Data Integrity** - Connect existing components to real engine data, verify history view, enforce feature vector versioning
- [ ] **Phase 2: Video Upload Pipeline** - Client-side upload to Supabase Storage, pipeline Stage 3 branching, SSE heartbeat during Gemini processing
- [ ] **Phase 3: TikTok URL Extraction** - Apify pre-stage scraping, video download to Gemini, graceful fallback to caption-only
- [ ] **Phase 4: Outcomes Feedback Loop** - Auto-scrape queue, cron-based batch processing, predicted vs actual comparison, accuracy tracking
- [ ] **Phase 5: Analytics Dashboard** - KPI cards, distribution charts, cost tracking, materialized views for performance
- [ ] **Phase 6: Trending Re-launch + Hive Visualization** - Verify trending data pipeline, wire hive to real 26-signal feature vector

---

## Execution Waves

| Wave | Phases | Rationale |
|------|--------|-----------|
| 1 | Phase 1 | Foundation -- proves engine-to-UI data path before adding complexity |
| 2 | Phase 2, Phase 4, Phase 6 | Three independent tracks after foundation (can parallelize) |
| 3 | Phase 3, Phase 5 | Phase 3 needs Phase 2's pipeline branching; Phase 5 needs Phase 4's outcome data |

---

## Phase Details

### Phase 1: Wire UI + History + Data Integrity
**Goal**: Users see real prediction engine output in every results component -- scores, factors, reasoning, suggestions, behavioral predictions, confidence, and history
**Depends on**: Nothing (first phase)
**File Ownership**:
- `src/components/app/results-panel.tsx` (and child components)
- `src/components/app/reasoning-section.tsx`
- `src/components/app/confidence-badge.tsx`
- `src/components/app/suggestions-section.tsx`
- `src/components/app/behavioral-predictions.tsx`
- `src/components/app/content-form.tsx` (niche/hashtag field wiring)
- `src/components/app/history/` (history list, detail view)
- `src/app/api/analyze/route.ts` (form field passthrough)
- `supabase/migrations/` (feature_vector_version, outcome columns)
- `src/lib/engine/` (query filters for engine_version)
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05, WIRE-06, WIRE-07, WIRE-08, WIRE-09, WIRE-10, HIST-01, HIST-02, HIST-03, HIST-04, DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. User submits content via the form and sees real scores, factor breakdown, behavioral predictions with percentiles, confidence badge, DeepSeek reasoning, and actionable suggestions in the results panel -- no mock data anywhere
  2. User can view a list of past analyses showing score, date, and input mode badge, click any item to rehydrate the full results panel, and soft-delete items with confirmation
  3. Niche and hashtags entered in the content form are passed through to the API and used by the prediction pipeline (visible in engine logs or result metadata)
  4. All analytics and ML queries filter by `engine_version` so incompatible feature vectors are never mixed; `feature_vector_version` column exists in the schema
**Estimated Plans**: 3 (results wiring, history wiring, data integrity migrations)

### Phase 2: Video Upload Pipeline
**Goal**: Users can upload a video file and receive a full prediction with video-specific Gemini analysis signals
**Depends on**: Phase 1
**File Ownership**:
- `src/app/api/upload/video/route.ts` (new: signed URL upload endpoint)
- `src/components/app/content-form.tsx` (video tab upload UI)
- `src/components/app/upload-progress.tsx` (new or existing progress bar)
- `src/lib/engine/pipeline.ts` (Stage 3 video branch)
- `src/app/api/analyze/route.ts` (maxDuration, heartbeat SSE)
- `supabase/migrations/` (prediction-videos bucket, RLS)
- `vercel.json` (maxDuration config)
**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05, VID-06, VID-07, VID-08, VID-09
**Success Criteria** (what must be TRUE):
  1. User can select a video file (MP4/MOV/WEBM, up to 50MB), see a determinate progress bar during upload, and the file lands in Supabase Storage without routing through the API server
  2. Videos longer than 3 minutes are rejected with a clear error message before upload begins
  3. After upload completes, submitting analysis triggers Gemini video analysis (not text analysis) and the results panel shows video-specific signals and scores
  4. The SSE stream stays alive during extended Gemini processing (no timeout) via heartbeat events every 10 seconds
  5. The Supabase Storage bucket has RLS policies scoping files to the uploading user and a 24-hour TTL cleanup policy
**Estimated Plans**: 3 (storage bucket + upload flow, pipeline video branching + SSE heartbeat, upload UI + validation)

### Phase 3: TikTok URL Extraction
**Goal**: Users can paste a TikTok URL and receive a full prediction with extracted video content and creator metadata
**Depends on**: Phase 1, Phase 2
**File Ownership**:
- `src/app/api/analyze/route.ts` (pre-stage 0 extraction logic)
- `src/lib/engine/tiktok-extraction.ts` (new: Apify actor integration)
- `src/components/app/content-form.tsx` (URL tab validation)
- `src/lib/validations/` (TikTok URL format validation)
**Requirements**: URL-01, URL-02, URL-03, URL-04, URL-05, URL-06
**Success Criteria** (what must be TRUE):
  1. User pastes a TikTok URL, it is pre-validated for format instantly, and Apify extracts video metadata (caption, hashtags, sound) and downloads the video for Gemini analysis
  2. If extraction fails, the user sees a clear SSE message explaining the failure and is offered the option to continue with caption-only text analysis
  3. Creator metadata (handle, follower count) extracted from the URL enriches the pipeline's creator context stage
  4. No TikTok video content is permanently stored -- video data flows in-memory to Gemini only
**Estimated Plans**: 2 (Apify extraction + fallback logic, URL validation + form wiring)

### Phase 4: Outcomes Feedback Loop
**Goal**: The system automatically collects real-world performance data for predictions and feeds it back into calibration and ML training
**Depends on**: Phase 1
**File Ownership**:
- `supabase/migrations/` (outcome_scrape_queue table)
- `src/app/api/cron/scrape-outcomes/route.ts` (new cron)
- `src/app/api/outcomes/route.ts` (verify manual form)
- `src/lib/outcomes/` (new: scrape queue logic, validation, accuracy calculation)
- `src/components/app/outcome-comparison.tsx` (new: predicted vs actual view)
- `vercel.json` (add scrape-outcomes cron)
- `src/lib/engine/calibration.ts` (feed validated outcomes)
- `src/lib/engine/ml.ts` (feed validated outcomes as labels)
**Requirements**: OUT-01, OUT-02, OUT-03, OUT-04, OUT-05, OUT-06, OUT-07, OUT-08, OUT-09, OUT-10
**Success Criteria** (what must be TRUE):
  1. After a prediction with a TikTok URL, the analysis is automatically enqueued for outcome scraping; the cron processes the queue every 6 hours in batches of 20 with 5-concurrent Apify calls
  2. Scraped outcomes are validated (all-zero results rejected, minimum metrics required, confidence scored) before being stored -- no silent data corruption
  3. Failed scrapes retry with exponential backoff up to 3 attempts before being marked as permanently failed
  4. User can see a predicted vs actual comparison for any prediction that has outcome data, including delta and accuracy indicator
  5. After 10+ validated outcomes accumulate, a running accuracy metric is displayed with an uncertainty caveat
**Estimated Plans**: 3 (scrape queue table + cron infrastructure, validation + retry logic, comparison UI + accuracy display)

### Phase 5: Analytics Dashboard
**Goal**: Users can view aggregated insights about their prediction usage, score distributions, and system health
**Depends on**: Phase 1, Phase 4
**File Ownership**:
- `src/app/(app)/analytics/page.tsx` (new or existing analytics page)
- `src/components/app/analytics/` (new: chart components)
- `src/app/api/analytics/route.ts` (new: analytics endpoint)
- `supabase/migrations/` (analytics_daily_summary materialized view)
- `src/app/api/admin/costs/route.ts` (existing, verify)
**Requirements**: ANLY-01, ANLY-02, ANLY-03, ANLY-04, ANLY-05, ANLY-06, ANLY-07, ANLY-08, ANLY-09
**Success Criteria** (what must be TRUE):
  1. User sees KPI summary cards (total predictions, average confidence, average score, total cost) at the top of the analytics page
  2. User can view score distribution (histogram/area chart), confidence distribution chart, and predictions-over-time line chart with daily/weekly toggle
  3. Admin users can see per-day cost trend and model breakdown; regular users cannot access cost data
  4. All analytics queries use column-selective patterns (never SELECT * with JSONB columns) and global aggregations come from a materialized view refreshed daily
  5. After sufficient outcome data, per-user prediction accuracy is displayed on the analytics page
**Estimated Plans**: 3 (materialized view + API endpoint, KPI cards + distribution charts, cost tracking + drift + accuracy)

### Phase 6: Trending Re-launch + Hive Visualization
**Goal**: The trending page shows verified real-time data with actionable CTAs, and the hive visualization renders the real 26-signal prediction feature vector
**Depends on**: Phase 1
**File Ownership**:
- `src/app/(app)/trending/page.tsx` (trending page)
- `src/components/app/trending/` (video cards, filters, freshness indicator)
- `src/components/hive/` (hive visualization, layout, types)
- `src/lib/transformers/prediction-to-hive.ts` (new: data transformer)
**Requirements**: TRND-01, TRND-02, TRND-03, TRND-04, TRND-05, TRND-06, VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05
**Success Criteria** (what must be TRUE):
  1. Trending page loads with real data from the scrape-trending cron; a freshness indicator shows "Updated X hours ago" based on the latest scraped_at timestamp
  2. "Analyze this" button on video cards navigates to /dashboard?url={tiktok_url} and pre-fills the prediction form
  3. Time period filter (24h, 7d, 30d) and category tabs pull from real scraped data (not hardcoded)
  4. Hive visualization renders the real 26-signal feature vector with 5 tier-1 nodes, node radius encoding signal strength, unique color per scoring dimension, and tooltips showing signal name and value on hover
**Estimated Plans**: 2 (trending verification + filters + CTA, hive data transformer + real data wiring)

---

## Progress

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Wire UI + History + Data Integrity | 0/3 | Not started | - |
| 2. Video Upload Pipeline | 0/3 | Not started | - |
| 3. TikTok URL Extraction | 0/2 | Not started | - |
| 4. Outcomes Feedback Loop | 0/3 | Not started | - |
| 5. Analytics Dashboard | 0/3 | Not started | - |
| 6. Trending Re-launch + Hive Visualization | 0/2 | Not started | - |

---

## Coverage Map

```
WIRE-01  -> Phase 1    HIST-01  -> Phase 1    VID-01  -> Phase 2
WIRE-02  -> Phase 1    HIST-02  -> Phase 1    VID-02  -> Phase 2
WIRE-03  -> Phase 1    HIST-03  -> Phase 1    VID-03  -> Phase 2
WIRE-04  -> Phase 1    HIST-04  -> Phase 1    VID-04  -> Phase 2
WIRE-05  -> Phase 1                           VID-05  -> Phase 2
WIRE-06  -> Phase 1    DATA-01  -> Phase 1    VID-06  -> Phase 2
WIRE-07  -> Phase 1    DATA-02  -> Phase 1    VID-07  -> Phase 2
WIRE-08  -> Phase 1    DATA-03  -> Phase 1    VID-08  -> Phase 2
WIRE-09  -> Phase 1    DATA-04  -> Phase 1    VID-09  -> Phase 2
WIRE-10  -> Phase 1

URL-01   -> Phase 3    OUT-01   -> Phase 4    ANLY-01  -> Phase 5
URL-02   -> Phase 3    OUT-02   -> Phase 4    ANLY-02  -> Phase 5
URL-03   -> Phase 3    OUT-03   -> Phase 4    ANLY-03  -> Phase 5
URL-04   -> Phase 3    OUT-04   -> Phase 4    ANLY-04  -> Phase 5
URL-05   -> Phase 3    OUT-05   -> Phase 4    ANLY-05  -> Phase 5
URL-06   -> Phase 3    OUT-06   -> Phase 4    ANLY-06  -> Phase 5
                       OUT-07   -> Phase 4    ANLY-07  -> Phase 5
TRND-01  -> Phase 6    OUT-08   -> Phase 4    ANLY-08  -> Phase 5
TRND-02  -> Phase 6    OUT-09   -> Phase 4    ANLY-09  -> Phase 5
TRND-03  -> Phase 6    OUT-10   -> Phase 4
TRND-04  -> Phase 6
TRND-05  -> Phase 6    VIZ-01   -> Phase 6
TRND-06  -> Phase 6    VIZ-02   -> Phase 6
                       VIZ-03   -> Phase 6
                       VIZ-04   -> Phase 6
                       VIZ-05   -> Phase 6

Mapped: 63/63 ✓
Orphaned: 0
Duplicated: 0
```
