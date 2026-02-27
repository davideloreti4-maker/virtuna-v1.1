# Domain Pitfalls

**Domain:** TikTok Creator Intelligence Platform -- Prediction Engine Integration
**Researched:** 2026-02-20
**Overall Confidence:** HIGH (verified against official docs + codebase analysis)

---

## Critical Pitfalls

Mistakes that cause rewrites, user-visible failures, or architectural dead ends.

---

### Pitfall 1: Video Upload Through Vercel Serverless (4.5MB Body Limit)

**What goes wrong:** Video files (up to 200MB per the current `VideoUpload` component) are sent through the Next.js API route, which hits Vercel's hard 4.5MB request body limit. The upload fails with `413: FUNCTION_PAYLOAD_TOO_LARGE`. Currently the codebase hardcodes `video_storage_path = "pending-upload"` -- this is not a bug, it is explicitly deferred work. But the pattern chosen to replace it matters enormously.

**Why it happens:** Developers instinctively route file uploads through their API for auth/validation, not realizing serverless platforms have strict body limits. Vercel's 4.5MB limit applies to both request AND response bodies (streaming responses are exempt from the response limit).

**Consequences:** Complete failure of video upload flow. No graceful degradation possible -- the request is rejected at the platform level before your code runs.

**Prevention:** Use the **client-side direct upload pattern**:

1. Client requests a signed upload URL from your API route (lightweight JSON request, well under 4.5MB)
2. Server creates signed URL via Supabase Storage `createSignedUploadUrl()` (valid for 2 hours)
3. Client uploads directly to Supabase Storage using the signed URL (bypasses Vercel entirely)
4. Client sends the resulting storage path back to the API for analysis

For files over 6MB (most videos), use **Supabase resumable uploads** with the TUS protocol via `tus-js-client` or Uppy. This handles network interruptions gracefully and supports files up to 50GB. Use the direct storage hostname (`https://project-id.storage.supabase.co`) for performance.

**Detection:** Any video upload attempt in production will fail immediately. Test with a >5MB file before shipping.

**Confidence:** HIGH -- [Vercel docs](https://vercel.com/docs/functions/limitations) explicitly state the 4.5MB limit. [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) is the documented solution.

---

### Pitfall 2: SSE Connection Timeout During Video Analysis

**What goes wrong:** The current SSE streaming pipeline takes ~74 seconds for text analysis. Video analysis adds: Supabase Storage download (~2-5s), Gemini Files API upload (~5-15s depending on file size), Gemini video processing polling (~10-60s), plus the existing pipeline stages. Total could reach 3-5 minutes. The current `maxDuration = 120` (2 minutes) will be insufficient for larger videos.

**Why it happens:** The analyze route streams SSE within a single serverless function invocation. The function must stay alive for the entire analysis duration. Vercel Fluid Compute allows up to 300s (Hobby) or 800s (Pro), but the SSE connection is also subject to intermediate proxy/CDN timeouts and client-side fetch timeouts.

**Consequences:**
- Function times out mid-analysis: client sees connection drop, no result, analysis cost wasted
- Gemini video processing poll exceeds timeout: same result
- Client browser may timeout the fetch before Vercel does (browsers typically timeout at ~5 minutes for streaming)
- Mobile browsers are more aggressive with background tab throttling

**Prevention:**
1. **Increase `maxDuration` to 300** (or 800 on Pro) for the analyze route when video is detected
2. **Add intermediate SSE heartbeat events** every 10 seconds during long waits (Gemini polling, file upload). Without heartbeats, proxies/CDNs may close the connection thinking it is stale. The current implementation only sends phase events at stage transitions -- long gaps between stages will appear as dead connections.
3. **Add client-side reconnection logic** in `useAnalyze()`. Currently, if the ReadableStream errors, the mutation throws and the user sees "error". Add: detect timeout, offer retry, preserve the analysis-in-progress ID.
4. **Consider a polling fallback**: For video analysis specifically, start the pipeline, return a job ID immediately, then have the client poll `/api/analysis/{id}` until complete. This decouples the SSE connection lifetime from the analysis duration.

**Detection:** Test with a 30-second video (50MB+). Monitor for `504 FUNCTION_INVOCATION_TIMEOUT` in Vercel logs. Watch for SSE connections that go silent for >30 seconds during Gemini polling.

**Confidence:** HIGH -- The current `maxDuration = 120` and the existing Gemini `VIDEO_POLL_TIMEOUT_MS = 60_000` plus `VIDEO_TIMEOUT_MS = 30_000` in `gemini.ts` already push close to the limit. Adding file transfer time makes timeouts inevitable for non-trivial videos.

---

### Pitfall 3: Outcomes Scraping as a Silent Data Integrity Failure

**What goes wrong:** The outcomes system (`/api/outcomes`) currently relies on manual user submission. The planned automated scraping (scrape TikTok post metrics 48h after analysis) introduces a chain of failure modes that can silently corrupt the feedback loop: TikTok blocks the scrape, the video was deleted, metrics are geo-restricted, or the Apify actor returns stale/partial data. The prediction calibration system (Platt scaling in `calibration.ts`) depends on outcomes data quality -- bad outcomes poison the calibration.

**Why it happens:** TikTok's anti-bot measures change frequently. Apify actors are maintained by third parties. A scrape that worked yesterday may silently return zero views tomorrow (the video exists but metrics are region-locked). The system has no way to distinguish "this video genuinely got 0 views" from "scrape failed silently."

**Consequences:**
- Calibration system trains on garbage data, making ALL future predictions worse
- Users see inaccurate accuracy metrics ("your predictions were 85% accurate" based on incomplete outcomes)
- Silent failures accumulate over weeks before anyone notices the calibration drift

**Prevention:**
1. **Scrape result validation**: Never accept an outcome where ALL metrics (views, likes, shares, comments) are zero or null. Flag these as "scrape_failed" with a separate status column, not as valid outcomes.
2. **Confidence gating on outcomes**: Add an `outcome_confidence` field. Set it based on: scrape succeeded (HIGH), partial data (MEDIUM), manual entry (MEDIUM), scrape returned suspicious data (LOW). Only use HIGH/MEDIUM outcomes for calibration.
3. **Retry with exponential backoff**: TikTok scrape failures should retry at 48h, 72h, and 96h before giving up. After 3 failures, mark as `scrape_abandoned` and exclude from calibration.
4. **Cross-reference sanity checks**: If a video URL was valid at analysis time but returns zero data at scrape time, check if the video is still public (separate lightweight request). Mark deleted/private videos distinctly from scrape failures.

**Detection:** Monitor the ratio of successful outcomes to total scheduled scrapes. If success rate drops below 80%, alert. Track calibration parameter drift over time -- sudden shifts indicate data quality issues.

**Confidence:** MEDIUM -- TikTok's specific current anti-bot behavior is hard to verify precisely. The failure modes are well-documented in the scraping community. The Apify TikTok Scraper (clockworks) is updated frequently but has periodic breakage windows.

---

### Pitfall 4: Feature Vector Schema Evolution Without Versioning

**What goes wrong:** The 26-signal `FeatureVector` is stored as JSONB in `analysis_results.feature_vector`. When video-specific signals are added (4 more from `GeminiVideoSignalsSchema`), old records have `null` for those fields. This is fine initially. But the ML model (`ml.ts`) expects a fixed feature vector shape via `featureVectorToMLInput()`. Retraining the model with new features while old predictions used the old feature set creates a backward compatibility nightmare.

**Why it happens:** JSONB is schema-flexible, which feels like it solves the problem. But the ML model, aggregator weights, and calibration system all depend on the feature vector having a specific shape. Adding fields is easy; ensuring the entire pipeline handles the transition is not.

**Consequences:**
- ML model retrained on new features produces predictions incomparable to old ones
- Calibration system compares new-schema predictions against old-schema outcomes: meaningless comparison
- Dashboard analytics that aggregate across time periods mix incompatible feature vectors
- Any query that indexes or filters on JSONB fields (e.g., `WHERE feature_vector->>'hookScore' > 7`) breaks silently when the field name changes

**Prevention:**
1. **Add `engine_version` gating everywhere**: The `ENGINE_VERSION = "2.1.0"` already exists in the aggregator. Use it. Every query that touches feature vectors or outcomes should filter by engine version range. The calibration system should only compare predictions made with compatible engine versions.
2. **Version the feature vector shape**: Add a `feature_vector_version: number` field to the FeatureVector interface. Version 1 = current 26 signals. Version 2 = 26 + 4 video signals. The ML model should refuse to predict on mismatched versions rather than silently using `null` values.
3. **Backfill strategy**: When adding new signals, consider whether old records can be backfilled. For video signals, old text-only records correctly have `null` -- no backfill needed. But if a signal calculation changes (e.g., `hashtagRelevance` algorithm improves), old values become misleading. Document which changes require backfill vs. version gating.
4. **Never mutate the JSONB shape in-place**: PostgreSQL JSONB updates on millions of rows are extremely slow. Instead, version-gate at read time. Accept that old records have the old shape forever.

**Detection:** After any feature vector change, run the ML model on 100 random old records. If it produces substantially different scores than the stored `ml_score`, the version boundary is leaking.

**Confidence:** HIGH -- This is a universal ML pipeline problem. The codebase already has the building blocks (`engine_version`, `is_calibrated`) but does not enforce version boundaries in queries.

---

## Moderate Pitfalls

Issues that cause bugs, performance problems, or user confusion but are recoverable.

---

### Pitfall 5: Gemini Video Analysis Cost Explosion

**What goes wrong:** Gemini processes video at ~300 tokens/second (258 tokens per frame at 1 FPS + 32 audio tokens/second). A 60-second video = ~18,000 tokens input just for the video, plus the prompt tokens. At Gemini Flash pricing ($0.15/1M input), individual video analyses are cheap. But: (a) users on the free tier get 5 analyses/day, (b) a 3-minute video = ~54,000 video tokens, and (c) if the video processing fails and retries (current `MAX_RETRIES = 2` in `gemini.ts`), costs triple.

**Prevention:**
- The existing `VIDEO_MAX_SIZE_BYTES = 50MB` cap in `gemini.ts` is good. Keep it.
- Add a **duration cap** (not just file size): reject videos over 3 minutes at the UI level. The Gemini API processes up to 1 hour, but the cost and latency don't justify it for viral prediction.
- Track per-user video analysis cost separately from text analysis cost. Consider counting video analyses as 2-3x against rate limits (e.g., free tier: 5 text OR 2 video per day).
- The `cost_cents` soft cap check (`> 2.0` for video) in `gemini.ts` warns but does not prevent. Add a hard cap that returns an error if estimated cost exceeds threshold.

**Confidence:** HIGH -- Token-per-second rates from [Gemini video understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding).

---

### Pitfall 6: Analytics Dashboard N+1 Queries and Full-Table Scans

**What goes wrong:** The current `/api/analysis/history` endpoint does `SELECT *` with a `LIMIT 50` and no cursor pagination. As the `analysis_results` table grows (every analysis creates a row with JSONB columns `factors`, `suggestions`, `behavioral_predictions`, `feature_vector`, `rule_contributions`), this query returns increasingly large payloads. An analytics dashboard that aggregates scores over time will compound this with GROUP BY queries on unindexed JSONB fields.

**Prevention:**
1. **Column-selective queries**: Never `SELECT *` from `analysis_results` for dashboard/list views. Select only the columns needed: `id, overall_score, confidence, content_type, input_mode, created_at, latency_ms`. The JSONB columns can be 5-10KB each -- multiplied by 50 rows = 500KB response for a list view.
2. **Cursor-based pagination**: The outcomes endpoint already uses cursor pagination (`decodeCursor`/`encodeCursor`). Apply the same pattern to analysis history.
3. **Pre-computed aggregates via cron**: For dashboard metrics (average score this week, accuracy trend, most common warnings), pre-compute into a `user_analytics` table via a Vercel cron job. Do NOT compute aggregates on every dashboard load.
4. **Index planning**: Add indexes for the most common dashboard queries:
   - `CREATE INDEX ON analysis_results(user_id, created_at DESC) WHERE deleted_at IS NULL` (primary list query)
   - `CREATE INDEX ON analysis_results(user_id, content_type, created_at DESC) WHERE deleted_at IS NULL` (filtered by type)
   - Do NOT add GIN indexes on JSONB columns unless you have specific query patterns that need them. GIN indexes are expensive to maintain and bloat the table.
5. **Materialized views** are supported in Supabase but have limited tooling (no realtime, manual refresh). Use them only for truly expensive aggregations (e.g., weekly accuracy report), refreshed via cron. For user-facing dashboards, prefer pre-computed tables.

**Confidence:** HIGH -- The current `SELECT *` pattern in `/api/analysis/history` is directly observable in the codebase. PostgreSQL JSONB query performance characteristics are well-documented.

---

### Pitfall 7: TikTok URL Extraction Failure with No Graceful Degradation

**What goes wrong:** When `input_mode = "tiktok_url"`, the normalize step sets `video_url = input.tiktok_url`. But the actual Apify extraction (to get video file + metadata) is deferred to "Phase 5." If Apify extraction fails (private video, deleted, geo-restricted, rate-limited, or TikTok URL redirect changed), the pipeline currently has no fallback. The user submitted a URL expecting video analysis but gets... what?

**Why it happens:** The `normalizeInput()` function treats the TikTok URL as the video URL, but the pipeline's `analyzeWithGemini()` function expects either text content or a video buffer. There is no code path that: (a) extracts video from TikTok URL, (b) falls back to caption-only analysis if extraction fails, (c) informs the user what happened.

**Consequences:**
- User pastes TikTok URL, waits 2+ minutes, gets an error or a text-only analysis with no explanation
- No feedback about WHY the URL failed (private? deleted? geo-restricted?)
- User wastes one of their daily analysis quota on a failed analysis

**Prevention:**
1. **Pre-validate URL accessibility**: Before starting the full pipeline, make a lightweight HEAD/metadata request to check if the TikTok URL is accessible. Return an immediate error with a specific message ("This video appears to be private", "This video may not be available in your region") before consuming an analysis credit.
2. **Explicit fallback with user consent**: If video extraction fails mid-pipeline, do NOT silently fall back to text-only. Send an SSE event: `{ type: "fallback_offer", message: "Couldn't access the video. Want to proceed with caption-only analysis?" }`. Let the user decide.
3. **Don't count failed extractions against rate limits**: The current rate limit increment happens AFTER successful analysis. Good. But ensure URL extraction failures that abort the pipeline also don't increment usage.
4. **Common TikTok URL patterns to handle**:
   - `vm.tiktok.com/xxx` (short URL, requires redirect resolution)
   - `tiktok.com/@user/video/123` (standard)
   - `tiktok.com/t/xxx` (another short form)
   - Private video (returns 404 or login prompt)
   - Deleted video (returns 404)
   - Region-restricted (returns video page but metrics/download blocked)

**Detection:** Log every URL extraction attempt with outcome (success/failure/fallback). Track failure rate by URL pattern. If `vm.tiktok.com` short URLs fail more than direct URLs, the redirect resolution is broken.

**Confidence:** MEDIUM -- Specific TikTok URL failure modes are based on community reports and Apify actor documentation. The exact failure behavior changes as TikTok updates their platform.

---

### Pitfall 8: Supabase Storage to Gemini Files API -- Double Upload Bottleneck

**What goes wrong:** For video upload flow, the video travels: Client -> Supabase Storage -> Serverless Function (download) -> Gemini Files API (upload). The serverless function must download the entire video from Supabase into memory (up to 50MB based on current cap), then re-upload it to Gemini. This means: (a) 2x bandwidth cost, (b) 50MB+ memory pressure on a function with 2-4GB limit, (c) doubled latency, (d) risk of timeout during either transfer.

**Why it happens:** Gemini's Files API requires direct upload -- it can't fetch from a Supabase Storage URL. The serverless function acts as an expensive proxy.

**Consequences:**
- Memory exhaustion for large videos (50MB video + overhead = significant chunk of 2GB function memory)
- Double network latency adds 10-30 seconds to video analysis
- If either transfer fails, the entire analysis fails

**Prevention:**
1. **Stream, don't buffer**: Instead of downloading the entire video into a `Buffer` (as the current `analyzeVideoWithGemini(videoBuffer, mimeType)` signature suggests), stream the Supabase Storage response directly into the Gemini Files API upload. This keeps memory usage constant regardless of file size.
2. **Consider client-side Gemini upload**: For the fastest path, have the client upload to BOTH Supabase Storage (for storage/audit) and Gemini Files API (for analysis) in parallel. The client gets the Gemini file URI and passes it to the analyze route along with the Supabase storage path. This eliminates the server-side proxy entirely. Downside: exposes Gemini API interaction to the client (mitigated by using short-lived tokens or a thin proxy).
3. **Reduce the size cap**: The current 50MB cap in `gemini.ts` is reasonable, but consider a 25MB UI recommendation with 50MB hard limit. Most TikTok videos are under 30 seconds and well under 25MB.

**Confidence:** HIGH -- The current `analyzeVideoWithGemini(videoBuffer: Buffer, ...)` signature in `gemini.ts` confirms the buffer-based approach. Memory limits from [Vercel docs](https://vercel.com/docs/functions/limitations).

---

## Minor Pitfalls

Issues that cause minor friction, tech debt, or edge case bugs.

---

### Pitfall 9: Optional Fields Collected But Discarded

**What goes wrong:** The `ContentForm` collects `hashtags` and `notes` fields, but `dashboard-client.tsx` does not pass them to the API. The `AnalysisInputSchema` does not accept these fields. Users who fill in hashtags expecting them to influence the prediction will be confused when they see no effect.

**Prevention:**
- Either wire the fields through to the pipeline (the hashtag extraction in `normalize.ts` already extracts from `content_text`, but user-provided hashtags could supplement this)
- Or remove the fields from the form to avoid misleading users
- At minimum, add placeholder text explaining "Hashtags are automatically detected from your content"

**Confidence:** HIGH -- Directly verified in `dashboard-client.tsx` lines 90-105 and `AnalysisInputSchema`.

---

### Pitfall 10: Content Form Niche Field Not Wired for URL Mode

**What goes wrong:** In the `handleContentSubmit` function in `dashboard-client.tsx`, the `niche` field is only sent for `text` mode (`if (data.niche) payload.niche = data.niche`) and `video_upload` mode (`if (data.video_niche) payload.niche = data.video_niche`). For `tiktok_url` mode, no niche is sent. The pipeline's creator context lookup and Gemini prompt both benefit from niche context.

**Prevention:** Either add a niche field for URL mode in the form, or extract niche from the TikTok profile metadata during URL processing.

**Confidence:** HIGH -- Directly verified in codebase.

---

### Pitfall 11: Cron Job Cascading Failures

**What goes wrong:** The system has 7 cron jobs running on Vercel. If `scrape-trending` fails (Apify is down), then `calculate-trends` runs on stale data, then the pipeline's `enrichWithTrends` returns stale trends, and predictions drift. No cron job checks whether its upstream dependency succeeded.

**Prevention:**
1. Add a `cron_health` table that records each cron run's success/failure/timestamp
2. Each cron job checks its upstream dependency: `calculate-trends` should verify `scrape-trending` ran within the last 2 hours before processing
3. Add a `/api/health` endpoint that reports cron staleness for monitoring

**Confidence:** HIGH -- Verified by reading the cron routes. No inter-dependency checking exists.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|---|---|---|---|
| Video upload implementation | 4.5MB body limit kills upload | CRITICAL | Client-side direct upload to Supabase Storage with signed URLs |
| Video analysis pipeline | SSE timeout during Gemini video processing | CRITICAL | Heartbeat events + increased maxDuration + polling fallback |
| Outcomes auto-scraping | Silent scrape failures poison calibration | CRITICAL | Validation, confidence gating, retry with backoff |
| Feature vector expansion | Version incompatibility breaks ML + calibration | CRITICAL | Version field + engine_version gating on all queries |
| Analytics dashboard | Full-table JSONB scans on growing table | MODERATE | Column-selective queries, pre-computed aggregates, proper indexes |
| TikTok URL extraction | URL inaccessible with no user feedback | MODERATE | Pre-validation, explicit fallback offer, don't charge failed attempts |
| Video processing pipeline | Double upload (Storage -> Function -> Gemini) wastes memory/time | MODERATE | Streaming or client-side parallel upload |
| Gemini video costs | Uncontrolled costs on long videos | MODERATE | Duration cap (3 min), weighted rate limits, hard cost cap |
| Cron reliability | Upstream cron failure causes downstream staleness | MINOR | Health table, dependency checking |

---

## Sources

- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) -- 4.5MB body limit, maxDuration, memory limits
- [Vercel: How to bypass the 4.5MB body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) -- TUS protocol, 50GB support
- [Supabase Signed Upload URLs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) -- 2-hour validity
- [Gemini API Video Understanding](https://ai.google.dev/gemini-api/docs/video-understanding) -- 300 tokens/sec, Files API limits
- [Gemini API File Size Limits](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-new-file-limits/) -- 2GB via Files API, 100MB inline
- [Vercel Community: SSE Time Limits](https://community.vercel.com/t/sse-time-limits/5954)
- [Apify TikTok Scraper](https://apify.com/clockworks/tiktok-scraper) -- Reliability, anti-bot handling
- [Supabase: Managing JSON and unstructured data](https://supabase.com/docs/guides/database/json)
- [PostgreSQL JSONB documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- Codebase analysis: `src/app/api/analyze/route.ts`, `src/lib/engine/gemini.ts`, `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts`, `src/components/app/video-upload.tsx`, `src/hooks/queries/use-analyze.ts`, `src/app/(app)/dashboard/dashboard-client.tsx`
