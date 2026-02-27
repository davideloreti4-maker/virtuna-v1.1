# Research Summary: Prediction Engine Integration

**Milestone:** Prediction Engine Integration
**Synthesized:** 2026-02-20
**Overall confidence:** HIGH

---

## Executive Summary

This milestone wires the already-built prediction engine into the Virtuna frontend, adds two new input modes (video upload, TikTok URL), builds an outcomes feedback loop, ships an analytics dashboard, and re-launches the trending feed. The most important finding across all four research dimensions is that **the heavy backend work is already done**. The Gemini video analysis function (`analyzeVideoWithGemini`) is fully implemented. The pipeline's 3 input modes are defined in `AnalysisInputSchema`. The Apify client is installed with working actor integrations. Recharts covers all chart types. No new npm dependencies are needed. The work is wiring, not invention.

The critical risk profile is concentrated in the video upload path. Two architectural pitfalls -- Vercel's 4.5MB body limit killing server-side uploads and SSE timeout during extended Gemini video processing -- must be solved before any video feature ships. The solution is well-documented: client-side direct upload to Supabase Storage via signed URLs, heartbeat SSE events during long processing, and increased `maxDuration`. The outcomes auto-scraping system introduces a subtler risk: silent scrape failures poisoning the calibration pipeline. This requires validation gating and confidence scoring on outcome data before it feeds back into Platt scaling.

The recommended approach is to work inside-out: first wire existing UI components to real engine data (low risk, immediate value), then build the two new input pipelines (video upload, TikTok URL), then layer on the feedback loop and analytics. The trending re-launch is nearly complete already and can be polished in parallel. This ordering minimizes risk by deferring the hardest problems (video upload, auto-scraping) until the core wiring is proven.

---

## Key Findings

### From STACK.md (Confidence: HIGH)

**No new dependencies required.** The entire milestone runs on the existing stack:

| Need | Existing Package | Key Gap |
|------|-----------------|---------|
| Video upload (browser) | `@supabase/supabase-js` v2.93.1 | Create `prediction-videos` bucket + upload code |
| Video analysis | `@google/genai` v1.41.0 | `analyzeVideoWithGemini()` exists, not wired into pipeline |
| TikTok URL scraping | `apify-client` v2.22.1 | Add `clockworks/tiktok-video-scraper` + `dz_omar/tiktok-video-downloader` actor IDs |
| Outcomes scraping | `apify-client` v2.22.1 | Reuse same client, add `/api/cron/scrape-outcomes` |
| Analytics charts | `recharts` v3.7.0 | Supports AreaChart (isRange), RadarChart, ComposedChart, ScatterChart |
| Cron scheduling | Vercel cron (`vercel.json`) | Add 1 new cron (scrape-outcomes every 6h) |

**Infrastructure additions:** 2 Supabase migrations (bucket + outcome columns), 1 new cron, 1 new API route, frontend upload wiring, pipeline video branch.

**Gemini constraints to respect:** 50MB file cap (matches existing `VIDEO_MAX_SIZE_BYTES`), MP4/MOV/WEBM formats, 48h file retention, ~300 tokens/sec processing.

### From FEATURES.md (Confidence: MEDIUM-HIGH)

**Table stakes (9 features):** Most are already built as UI components with mock data. The gap is wiring to real engine output.

| Feature | Status | Effort |
|---------|--------|--------|
| Score + factor breakdown | UI exists (ResultsPanel, HeroScore) | Wire to real data |
| Prediction history | UI exists, uses mock data | Wire to `analysis_results` |
| Confidence badge | Component exists | Wire to `confidence_label` |
| Actionable suggestions | Component exists | Verify real data flow |
| Manual outcome form | Component exists, functional | Verify wiring |
| Video upload with progress | Not built | New: Supabase upload + Gemini pipeline |
| TikTok URL paste-to-analyze | Not built | New: Apify extraction pipeline |
| Trending feed | Already wired to real `scraped_videos` | Polish only |
| DeepSeek reasoning | Component exists | Wire to `reasoning` field |

**Differentiators (7 features):** Society persona reactions (already built, wire to real data), prediction accuracy tracking (requires outcome data accumulation), auto-scrape outcomes (new infrastructure), confidence distribution dashboard, cost tracking (endpoint exists), hive visualization with real data, model drift monitoring.

**Anti-features (do not build):** Bare numeric score without context, "guaranteed viral" framing, real-time trending refresh, automated posting, complex ML ops dashboards for end users, side-by-side comparison.

### From ARCHITECTURE.md (Confidence: HIGH)

**5 major architectural decisions:**

1. **Video analysis branches at Pipeline Stage 3** -- video analysis replaces (not supplements) text analysis. `GeminiVideoAnalysis` is a superset of `GeminiAnalysis`. No double-Gemini-call.

2. **TikTok extraction runs as Pre-Stage 0** -- before the pipeline, not inside it. Apify single-video actor with synchronous polling (10-30s). If extraction fails, graceful fallback to caption-only analysis.

3. **Separate upload route (`/api/upload/video`)** -- upload decoupled from analysis. Client uploads first, gets `storage_path`, then submits analysis request with the path. Prevents blocking the SSE stream during upload.

4. **Outcome scrape queue table** -- dedicated `outcome_scrape_queue` table with status tracking, retry logic, and batch processing via cron (20 items/batch, 5 concurrent Apify calls).

5. **Hybrid analytics (materialized views + on-demand)** -- global aggregations via `analytics_daily_summary` materialized view refreshed daily by pg_cron. User-specific queries run on-demand (dataset small enough).

**Hive visualization data mapping:** 26-signal feature vector maps to 5 tier-1 nodes (behavioral, gemini, ml, rules, trends) with tier-2 leaf nodes for individual signals. Pure data transformation via `predictionToHiveData()`.

### From PITFALLS.md (Confidence: HIGH)

**4 Critical pitfalls:**

| # | Pitfall | Severity | Phase Impact | Prevention |
|---|---------|----------|-------------|------------|
| 1 | Vercel 4.5MB body limit kills video upload | CRITICAL | Video upload | Client-side direct upload via signed URLs. Never route video through API. |
| 2 | SSE timeout during Gemini video processing (>120s) | CRITICAL | Video analysis | Heartbeat events every 10s, `maxDuration = 300`, client reconnection, polling fallback |
| 3 | Silent scrape failures poison calibration | CRITICAL | Outcomes scraping | Validate all-zero results, confidence gating, 3-attempt retry, cross-reference checks |
| 4 | Feature vector schema change breaks ML + calibration | CRITICAL | Feature vector expansion | `feature_vector_version` field, `engine_version` gating on all queries |

**3 Moderate pitfalls:**

| # | Pitfall | Prevention |
|---|---------|------------|
| 5 | Gemini video cost explosion on long videos | Duration cap (3 min), weighted rate limits, hard cost cap |
| 6 | Analytics N+1 queries / full-table JSONB scans | Column-selective queries, materialized views, proper indexes |
| 7 | TikTok URL extraction fails with no user feedback | Pre-validate URL, explicit fallback offer via SSE, don't charge failed attempts |

**2 Minor pitfalls:**

| # | Pitfall | Prevention |
|---|---------|------------|
| 9 | Hashtags/notes collected but discarded by form | Wire through or remove from form |
| 10 | Niche field not sent for TikTok URL mode | Add niche field or extract from profile metadata |

---

## Cross-Research Consensus

All four research dimensions agree on these points:

1. **No new dependencies needed** -- Stack, Architecture, and Features all confirm the existing toolset is sufficient.
2. **Video upload is the highest-risk new feature** -- Stack identifies the Supabase/Gemini bridge gap, Architecture designs the signed-URL flow, Pitfalls flags the 4.5MB body limit and SSE timeout as critical. All three converge on client-side direct upload as the solution.
3. **Most UI work is wiring, not building** -- Features counts 7 of 9 table-stakes features as "component exists, wire to real data." Architecture confirms the data shapes are compatible. Low risk.
4. **Outcomes auto-scraping is high-value but fragile** -- Features identifies it as a key differentiator (no competitor does this). Architecture designs the queue. Pitfalls warns about silent data corruption. All agree on a conservative approach: validate outcomes, confidence-gate before feeding to calibration.
5. **Analytics can use Postgres-native patterns** -- Stack says Recharts handles all charts. Architecture recommends materialized views + on-demand queries. Pitfalls warns against full-table scans. Consensus: pre-compute aggregates, column-selective queries.

**No contradictions found between research dimensions.**

---

## Implications for Roadmap

### Suggested Phase Structure (6 phases)

**Phase 1: Foundation -- Wire Existing Components to Real Data**

- **Rationale:** Lowest risk, highest immediate impact. Every component already exists. This phase proves the engine-to-UI data path works before adding complexity.
- **Delivers:** Working prediction results display, history view, confidence badges, suggestions, reasoning, society reactions, factor breakdown -- all with real engine data.
- **Features (from FEATURES.md):** Table stakes #1-5, #8-9. Differentiator #1 (society reactions).
- **Pitfalls to avoid:** #9 (discarded form fields), #10 (missing niche for URL mode).
- **Research needed:** No -- well-documented wiring patterns, all types already defined.

**Phase 2: Video Upload Pipeline**

- **Rationale:** Hardest new feature. Contains 2 critical pitfalls (body limit, SSE timeout). Must be isolated so failures don't block other work.
- **Delivers:** Users can upload a video file and receive a full prediction with video-specific signals.
- **Features:** Table stakes #6 (video upload with progress).
- **Pitfalls to avoid:** #1 (4.5MB body limit -- use signed URLs), #2 (SSE timeout -- heartbeats + maxDuration), #5 (cost explosion -- duration cap), #8 (double upload bottleneck -- stream or parallel upload).
- **Architecture:** Separate `/api/upload/video` route, pipeline Stage 3 branch, `prediction-videos` Supabase bucket with RLS and 24h TTL cleanup.
- **Research needed:** YES -- signed URL upload flow, TUS resumable upload integration, heartbeat SSE pattern need phase-specific research.

**Phase 3: TikTok URL Extraction Pipeline**

- **Rationale:** Second new input mode. Depends on understanding the pipeline branching from Phase 2. Apify integration is lower risk than video upload (existing client, familiar pattern).
- **Delivers:** Users paste a TikTok URL and get a full prediction with extracted video + metadata.
- **Features:** Table stakes #7 (TikTok URL paste-to-analyze).
- **Pitfalls to avoid:** #7 (extraction failure with no feedback -- pre-validate, fallback offer), #4 (feature vector versioning -- video signals are new).
- **Architecture:** Pre-Stage 0 extraction in API route, `clockworks/tiktok-video-scraper` for metadata, `dz_omar/tiktok-video-downloader` for MP4, in-memory buffer to Gemini (no storage).
- **Research needed:** MAYBE -- Apify single-video actor behavior and polling within Vercel timeout needs validation.

**Phase 4: Outcomes Feedback Loop**

- **Rationale:** Creates the data foundation for accuracy tracking, analytics, and ML improvement. Must come before analytics dashboard (which depends on outcome data).
- **Delivers:** Auto-scraping of TikTok post metrics 48h after prediction, predicted vs actual comparison, running accuracy metric.
- **Features:** Table stakes #5 (verify manual outcome form). Differentiators #2 (accuracy tracking), #3 (auto-scrape outcomes).
- **Pitfalls to avoid:** #3 (silent scrape failures -- validation, confidence gating, retry), #4 (feature vector versioning for calibration), #11 (cron cascading failures).
- **Architecture:** `outcome_scrape_queue` table, `/api/cron/scrape-outcomes` cron (every 6h), batch processing (20 items, 5 concurrent), feedback to calibration pipeline.
- **Schema additions:** Outcome columns on `analysis_results`, new `outcome_scrape_queue` table.
- **Research needed:** MAYBE -- actual_score calculation formula needs calibration against existing dataset.

**Phase 5: Analytics Dashboard**

- **Rationale:** Depends on accumulated prediction data (Phase 1-3) and outcome data (Phase 4). Pure frontend + query work, low architectural risk.
- **Delivers:** KPI summary cards, score/confidence distribution charts, cost tracking visualization, accuracy trends.
- **Features:** Differentiators #4 (confidence distribution), #5 (cost tracking), #7 (model drift -- admin only).
- **Pitfalls to avoid:** #6 (N+1 queries -- materialized views, column-selective queries, proper indexes).
- **Architecture:** `analytics_daily_summary` materialized view, `/api/analytics` endpoint, Recharts components.
- **Research needed:** No -- standard dashboard patterns, Recharts already used in 7 components.

**Phase 6: Trending Re-launch + Hive Visualization**

- **Rationale:** Trending feed is already 90% built with real data flowing. Hive is a data mapping exercise. Both are polish work that can ship last.
- **Delivers:** Verified trending data pipeline, "Analyze this" CTA on trending videos, time period filter, data freshness indicator. Hive visualization showing real 26-signal feature vector.
- **Features:** Table stakes #8 (trending with categories). Differentiator #6 (hive with real data).
- **Pitfalls to avoid:** #11 (cron cascading -- health checks for scrape-trending dependency).
- **Architecture:** `predictionToHiveData()` transformer, verify Apify crons running, add CTA linking trending -> prediction.
- **Research needed:** No -- existing patterns, data mapping is straightforward.

### Phase Dependency Graph

```
Phase 1 (Wire UI)
  |
  +---> Phase 2 (Video Upload) ---> Phase 3 (TikTok URL)
  |                                        |
  |                                        v
  +---> Phase 4 (Outcomes) -----------> Phase 5 (Analytics)
  |
  +---> Phase 6 (Trending + Hive) [independent, can parallel]
```

Phases 2-3 are sequential (TikTok URL reuses the pipeline branching from video upload). Phase 4 can start after Phase 1. Phase 5 depends on Phase 4 for outcome data. Phase 6 is independent.

---

## Research Flags

| Phase | Needs Phase Research? | Rationale |
|-------|----------------------|-----------|
| Phase 1 (Wire UI) | No | Pure wiring. Types exist. Components exist. |
| Phase 2 (Video Upload) | **YES** | Signed URL upload flow, TUS resumable uploads, SSE heartbeat pattern, Supabase Storage RLS policies, Gemini Files API streaming -- multiple novel integration points. |
| Phase 3 (TikTok URL) | Maybe | Apify single-video actor behavior within Vercel timeout needs validation. Short research. |
| Phase 4 (Outcomes) | Maybe | actual_score normalization formula needs calibration. Queue design is standard. |
| Phase 5 (Analytics) | No | Standard Recharts charts + materialized views. Well-documented patterns. |
| Phase 6 (Trending + Hive) | No | Existing code, data mapping only. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already installed. Version-pinned. No new deps. Verified against official docs. |
| Features | MEDIUM-HIGH | Table stakes well-defined by competitor analysis. Differentiators are clear. Accuracy transparency UX is novel (no competitor precedent). |
| Architecture | HIGH | Pipeline branching, queue design, materialized views -- all standard patterns. Hive data mapping is pure transformation. Only MEDIUM for Apify polling within Vercel timeout. |
| Pitfalls | HIGH | Critical pitfalls (body limit, SSE timeout) verified against official Vercel/Supabase docs. Outcomes data integrity risk well-documented in ML community. |

### Gaps to Address During Planning

1. **actual_score calculation formula** -- How to normalize raw TikTok metrics (views, likes, shares) into a 0-100 score comparable to the engine's predicted score. Architecture proposes a weighted engagement formula but acknowledges it needs calibration against the existing dataset.

2. **Apify single-video actor reliability** -- The `clockworks/tiktok-video-scraper` with `postURLs` input is documented but not battle-tested in this codebase. Need to validate: response time, failure modes, output schema compatibility with existing `apifyVideoSchema`.

3. **Feature vector version migration** -- Adding 4 video signals to the feature vector is conceptually simple, but the downstream impact on ML model, calibration, and analytics needs careful version-gating. The building blocks exist (`engine_version`, `is_calibrated`) but are not enforced in queries today.

4. **Video upload UX for large files** -- Whether to use standard upload (fine for <6MB) or TUS resumable upload (needed for >6MB). Most TikTok videos are >6MB, so TUS is likely required. This means adding `tus-js-client` or Uppy -- the one potential new dependency.

5. **Prediction accuracy display threshold** -- Features research recommends showing accuracy only after 10+ outcomes. But what's the minimum sample size for statistically meaningful accuracy? Displaying "85% accurate" based on 12 predictions is misleading. Need to determine the right threshold and communicate uncertainty.

---

## Already Built vs New Work

| Category | Already Built | New Work |
|----------|--------------|----------|
| **UI Components** | ResultsPanel, HeroScore, ConfidenceBadge, SuggestionsSection, ReasoningSection, BehavioralPredictionsSection, OutcomeForm, ContentForm (3 tabs), VideoCard, trending feed, hive visualization | Video upload progress UI, analytics dashboard charts, predicted vs actual comparison view |
| **Backend Engine** | `analyzeVideoWithGemini()`, `analyzeWithGemini()`, full pipeline (10 stages), calibration, ML model, DeepSeek integration | Pipeline Stage 3 branching, TikTok extraction helper, outcome scrape queue/cron |
| **API Routes** | `/api/analyze` (SSE), `/api/outcomes`, `/api/analysis/history`, `/api/admin/costs`, 7 crons | `/api/upload/video`, `/api/cron/scrape-outcomes`, `/api/analytics` |
| **Database** | `analysis_results`, `outcomes`, `scraped_videos`, `trending_sounds`, `platt_parameters` | `outcome_scrape_queue` table, `analytics_daily_summary` materialized view, `prediction-videos` storage bucket, outcome columns on `analysis_results` |
| **Integrations** | Gemini (text + video), Apify (bulk scraping), Supabase Auth/DB, Vercel cron | Apify single-video actors (2 new actor IDs), Supabase Storage upload |

**Estimated split: ~60% wiring existing code, ~40% new infrastructure.**

---

## Sources (Aggregated)

### Official Documentation (HIGH confidence)
- [Gemini Video Understanding](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Gemini Files API](https://ai.google.dev/gemini-api/docs/files)
- [Vercel Function Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Supabase Storage Uploads](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase Signed Upload URLs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Supabase pg_cron](https://supabase.com/modules/cron)

### Competitor & UX Research (MEDIUM-HIGH confidence)
- [Dash Social Predictive AI](https://www.dashsocial.com/features/predictive-ai)
- [Opus Clip Virality Score](https://help.opus.pro/docs/article/virality-score)
- [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/trends/hub/pc/en)
- [Agentic Design Confidence Patterns](https://agentic-design.ai/patterns/ui-ux-patterns/confidence-visualization-patterns)
- [NNGroup Skeleton Screens](https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/)

### Apify Actors (MEDIUM confidence)
- [clockworks/tiktok-video-scraper](https://apify.com/clockworks/tiktok-video-scraper)
- [dz_omar/tiktok-video-downloader](https://apify.com/dz_omar/tiktok-video-downloader)

### Codebase (HIGH confidence)
- `src/lib/engine/pipeline.ts`, `gemini.ts`, `types.ts`, `normalize.ts`, `deepseek.ts`, `calibration.ts`, `ml.ts`, `aggregator.ts`
- `src/app/api/analyze/route.ts`, `outcomes/route.ts`, cron routes
- `src/components/app/content-form.tsx`, `dashboard-client.tsx`
- `src/components/hive/hive-types.ts`, `hive-layout.ts`
- `vercel.json` (7 crons)
