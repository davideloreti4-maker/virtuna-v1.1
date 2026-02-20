# Requirements: Prediction Engine Integration

**Milestone:** Prediction Engine Integration
**Created:** 2026-02-20
**Scope:** Full (9 categories, 6 phases)

---

## WIRE — Wire Existing UI to Real Engine Data

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| WIRE-01 | Results panel displays real PredictionResult (scores, factors, behavioral predictions) | P0 | ResultsPanel component exists, verify data flow end-to-end |
| WIRE-02 | DeepSeek reasoning text displayed in expandable section | P0 | ReasoningSection exists, wire to `reasoning` field from aggregator |
| WIRE-03 | Confidence badge shows HIGH/MEDIUM/LOW from engine output | P0 | Badge component exists, wire to `confidence_label` |
| WIRE-04 | Suggestions section shows DeepSeek suggestions with priority/category | P0 | Component exists, verify real data populates correctly |
| WIRE-05 | Behavioral predictions (completion %, share %, comment %, save %) displayed with percentiles | P0 | Component exists, verify real data from DeepSeek |
| WIRE-06 | Niche field from content form passed through to API and used in pipeline | P1 | Currently collected but partially wired |
| WIRE-07 | Hashtags field from content form passed to API for trend enrichment | P1 | Currently collected but discarded before API call |
| WIRE-08 | Pipeline warnings displayed in results UI when stages degrade | P1 | Warnings banner exists, verify real warnings flow through |
| WIRE-09 | Score weight breakdown (behavioral/gemini/ml/rules/trends) visible in results | P1 | Verify component displays `score_weights` from PredictionResult |
| WIRE-10 | Engine version and model info shown in results footer | P2 | Data available in PredictionResult, display in bottom bar |

## HIST — History View

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| HIST-01 | History list shows past analysis results with score, date, input mode | P0 | useAnalysisHistory() exists and connected |
| HIST-02 | Click history item to view full results (rehydrate ResultsPanel) | P0 | useAnalysisDetail(id) exists, wire to results display |
| HIST-03 | Delete history item (soft delete) with confirmation | P1 | useDeleteAnalysis() exists, verify UX flow |
| HIST-04 | History items show input mode badge (text/url/video) | P1 | input_mode stored in DB, display in list |

## VID — Video Upload Pipeline

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| VID-01 | Create `prediction-videos` Supabase Storage bucket with RLS | P0 | New bucket, user-scoped paths, 24h TTL cleanup policy |
| VID-02 | Client-side direct upload to Supabase via signed URLs | P0 | Critical: Vercel 4.5MB body limit prevents server-side upload |
| VID-03 | Upload progress bar (determinate) during video upload | P0 | Standard XHR/fetch progress events |
| VID-04 | Video format validation (MP4, MOV, WEBM) and size cap (50MB) | P0 | Match Gemini constraints |
| VID-05 | Duration cap: reject videos longer than 3 minutes | P1 | Cost control: Gemini charges per video second |
| VID-06 | Pipeline Stage 3 branches: video analysis replaces text analysis when video present | P0 | analyzeVideoWithGemini() exists, wire into pipeline |
| VID-07 | SSE heartbeat events every 10s during video processing | P0 | Critical: prevent connection timeout during long Gemini processing |
| VID-08 | Increase API route maxDuration to 300s for video analysis | P0 | Vercel Pro plan supports up to 800s |
| VID-09 | Video thumbnail preview shown during/after upload | P2 | Nice-to-have UX polish |

## URL — TikTok URL Extraction

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| URL-01 | Pre-stage extraction: Apify scrapes video metadata from TikTok URL | P0 | clockworks/tiktok-video-scraper with postURLs input |
| URL-02 | Download video from TikTok URL for Gemini analysis | P0 | dz_omar/tiktok-video-downloader or equivalent actor |
| URL-03 | Graceful fallback to caption-only analysis if extraction fails | P0 | Show user-visible SSE message, offer to continue with text only |
| URL-04 | Pre-validate TikTok URL format before triggering extraction | P1 | Regex + domain check, instant feedback |
| URL-05 | Extract creator metadata (handle, followers) from URL for creator context | P1 | Enriches pipeline Stage 5 (Creator Context) |
| URL-06 | No permanent storage of downloaded TikTok video content | P0 | In-memory buffer to Gemini only, no storage of copyrighted content |

## VIZ — Hive Visualization with Real Data

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| VIZ-01 | `predictionToHiveData()` transformer: 26-signal feature vector -> HiveNode tree | P1 | 5 tier-1 nodes (behavioral, gemini, ml, rules, trends), 26 tier-2 leaf nodes |
| VIZ-02 | Node radius encodes signal strength (0-10 or 0-100 normalized) | P1 | Larger = stronger signal |
| VIZ-03 | Node color encodes scoring dimension (unique color per tier-1) | P1 | Already supported by hive renderer |
| VIZ-04 | Hive updates when new prediction result is available | P2 | Replace mock data call with real data |
| VIZ-05 | Tooltip shows signal name and value on hover | P2 | Existing interaction system supports this |

## DATA — Data Integrity

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| DATA-01 | Add `feature_vector_version` field to analysis_results schema | P0 | Critical for ML/calibration compatibility as signals evolve |
| DATA-02 | All analytics/ML queries filter by `engine_version` | P0 | Prevent mixing incompatible feature vectors |
| DATA-03 | Migration: add outcome-related columns to analysis_results if missing | P1 | `outcome_scraped_at`, `actual_views`, `actual_engagement_rate` |
| DATA-04 | Backfill `input_mode` for any existing rows missing the field | P2 | Default to "text" for historical data |

## OUT — Outcomes Feedback Loop

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| OUT-01 | Manual outcome form functional end-to-end (already exists, verify) | P0 | POST /api/outcomes exists with validation |
| OUT-02 | `outcome_scrape_queue` table: analysis_id, tiktok_url, status, attempts, scraped_at | P0 | New table for auto-scrape scheduling |
| OUT-03 | Auto-enqueue: after prediction with tiktok_url or platform_post_url, add to scrape queue | P0 | Trigger on successful analysis completion |
| OUT-04 | `/api/cron/scrape-outcomes` cron: every 6h, batch process queue (20 items, 5 concurrent) | P0 | New cron in vercel.json |
| OUT-05 | Scrape validation: reject all-zero results, require minimum metrics, confidence scoring | P0 | Critical: prevent silent calibration poisoning |
| OUT-06 | 3-attempt retry with exponential backoff for failed scrapes | P1 | Mark as failed after 3 attempts |
| OUT-07 | Predicted vs actual comparison view in results/history | P1 | Show delta, accuracy indicator |
| OUT-08 | Running accuracy metric: show after 10+ outcomes minimum | P1 | Display with uncertainty caveat |
| OUT-09 | Feed validated outcomes into calibration-audit cron (monthly Platt re-fitting) | P1 | Existing calibration-audit pipeline, add outcome data source |
| OUT-10 | Feed validated outcomes into retrain-ml cron as supervised labels | P2 | Improve ML classifier with real data |

## ANLY — Analytics Dashboard

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| ANLY-01 | KPI summary cards: total predictions, avg confidence, avg score, total cost | P0 | Top of analytics page |
| ANLY-02 | Score distribution chart (histogram/area) | P0 | Recharts AreaChart |
| ANLY-03 | Confidence distribution chart | P0 | Recharts AreaChart or PieChart |
| ANLY-04 | Predictions over time (line chart, daily/weekly) | P0 | Recharts LineChart |
| ANLY-05 | Cost tracking (admin-only): per-day cost trend, model breakdown | P1 | Admin endpoint exists at /api/admin/costs |
| ANLY-06 | Model drift indicator: average score trend over time | P1 | Recharts ComposedChart |
| ANLY-07 | `analytics_daily_summary` materialized view via Supabase pg_cron | P1 | Pre-compute aggregates, refresh daily |
| ANLY-08 | Column-selective queries (never SELECT * with JSONB columns) | P0 | Pitfall prevention: avoid full-table scans |
| ANLY-09 | Per-user prediction accuracy (after outcomes available) | P2 | Depends on OUT phase completion |

## TRND — Trending Page Re-launch

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| TRND-01 | Verify scrape-trending cron produces fresh data in `scraped_videos` table | P0 | Cron exists (every 6h), verify data flow |
| TRND-02 | "Analyze this" CTA on video cards links to /dashboard?url={tiktok_url} | P0 | Button exists in VideoDetailModal, verify routing |
| TRND-03 | Data freshness indicator: show "Updated X hours ago" on trending page | P1 | Query latest scraped_at timestamp |
| TRND-04 | Time period filter (24h, 7d, 30d) for trending videos | P1 | Filter on created_at column |
| TRND-05 | Category tabs pull from real scraped data categories | P1 | Currently 3 hardcoded tabs, wire to DB |
| TRND-06 | Trending page loads with skeleton states during data fetch | P2 | Already implemented, verify working |

---

## Traceability Matrix

| Phase | Requirements | Count |
|-------|-------------|-------|
| Phase 1: Wire UI + History + Display + Data Integrity | WIRE-01..10, HIST-01..04, DATA-01..04 | 18 |
| Phase 2: Video Upload Pipeline | VID-01..09 | 9 |
| Phase 3: TikTok URL Extraction | URL-01..06 | 6 |
| Phase 4: Outcomes Feedback Loop | OUT-01..10 | 10 |
| Phase 5: Analytics Dashboard | ANLY-01..09 | 9 |
| Phase 6: Trending + Hive Visualization | TRND-01..06, VIZ-01..05 | 11 |
| **Total** | | **63** |

---

## Decisions

| Decision | Outcome |
|----------|---------|
| Cost tracking visibility | Admin-only. Users see quality metrics, not per-analysis cost. |
| Outcomes approach | Auto-scrape + manual form. Both channels active. |
| Accuracy display threshold | 10+ outcomes minimum before showing accuracy %. |
| Video duration cap | 3 minutes maximum for cost control. |
| TikTok video storage | No permanent storage. In-memory buffer to Gemini only. |
| Feature vector versioning | Explicit version field, all queries filter by engine_version. |
