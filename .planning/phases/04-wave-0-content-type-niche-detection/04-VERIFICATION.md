---
phase: 04-wave-0-content-type-niche-detection
verified: 2026-05-18T04:50:00Z
status: gaps_found
score: 4/5 must-haves verified (SC#2 production runtime broken by CR-01 — gap closure required)
overrides_applied: 0
human_verification:
  - test: "End-to-end Wave 0 content-type detection for a real video_upload"
    expected: "detectContentType() returns Wave0ContentTypeResult with one of the 7 enum slugs and confidence ∈ [0,1] when a creator uploads a real video; analysis_results.signal_availability.content_type === true and feature_vector.pacingScore / visualProductionQuality reflect the content-type weight matrix application"
    why_human: "Post gap-closure verification — confirms CR-01 fix works end-to-end with a real Supabase Storage download + Gemini 3 Flash call"
  - test: "Niche detector cost-tracking shows non-zero input cost"
    expected: "When DeepSeek returns prompt_tokens without cache breakdown, costCents reflects the input-token cost (≈ promptTokens × CACHE_MISS_PRICE) — should be > 0.0001¢ for a 500-token system prompt"
    why_human: "Post gap-closure verification — confirms CR-02 fix logs non-zero cost on a cache-miss DeepSeek request"
gaps:
  - id: "GAP-04-01"
    severity: blocker
    source: "REVIEW.md CR-01"
    success_criterion: 2
    summary: "Content-type detector fetches Supabase Storage path as URL, breaking SC#2 end-to-end in production"
    file: "src/lib/engine/wave0/content-type-detector.ts"
    line: 96
    detail: "fetch(payload.video_url) called directly, but normalize.ts:46 populates video_url with payload.video_storage_path (a storage object key like 'user-abc/video.mp4'), not a fetchable URL. In production: TypeError → caught by D-16 try/catch → null. Wave 0 content-type detection silently disabled for every video upload. Unit tests mask with hardcoded URLs; pipeline.test.ts only uses input_mode='text' which short-circuits."
    fix_options:
      - "Inject Supabase client into detectContentType() and download via storage.from('videos').download(payload.video_url)"
      - "Have pipeline pre-download the video buffer once and pass it into detectContentType() alongside payload"
    impact: "Production: every video analysis returns wave0Result.content_type=null → signal_availability.content_type=false → aggregator falls back to default weights → SC#2 + SC#5 unsatisfied end-to-end"
  - id: "GAP-04-02"
    severity: warning
    source: "REVIEW.md CR-02"
    success_criterion: null
    summary: "Niche detector cost-tracking under-reports by ~80% when DeepSeek omits cache breakdown"
    file: "src/lib/engine/wave0/niche-detector.ts"
    line: 89
    detail: "Cost calculation only reads prompt_cache_hit_tokens / prompt_cache_miss_tokens. When DeepSeek returns standard prompt_tokens (caching disabled, model variant doesn't report cache stats, etc.), input cost silently defaults to 0¢. Affects cost telemetry only, not classifier behavior."
    fix_options:
      - "Fall back to prompt_tokens × CACHE_MISS_PRICE when cache breakdown fields are absent"
    impact: "Cost dashboards under-report DeepSeek spend by ~80%; budget enforcement against CONTENT-04 cost ceiling becomes unreliable"
deferred: []
---

# Phase 4: Wave 0 — Content Type + Niche Detection Verification Report

**Phase Goal:** A new Wave 0 runs two V3 classifier calls before Wave 1, producing `content_type` and hierarchical `niche` signals that drive downstream weighting.

**Verified:** 2026-05-18T04:50:00Z
**Status:** human_needed (4/5 SCs verified at code+test level; SC#2 only verified with mocked fetch — production runtime broken by CR-01)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (SC) | Status | Evidence |
| - | ---------- | ------ | -------- |
| 1 | Pipeline's Wave 0 fires before Wave 1 with two parallel V3 calls (content type + niche) | VERIFIED | `pipeline.ts:310` calls `runWave0(payload, creatorContext, onStageEvent)` after `pre_creator_context` stage and BEFORE `geminiPromise` (line 333+). `wave0.ts:27-30` uses `Promise.allSettled([detectContentType(...), detectNiche(...)])`. Pipeline test "Wave 0 fires before Wave 1" + orchestration test "detectors fire in parallel" both PASSING (753 of 757 tests green; failures are pre-existing fixture-missing benchmarks, NOT Phase 4 code) |
| 2 | Content type classifier returns one of {talking_head, b_roll, slideshow, action, tutorial, vlog, other} with confidence | PARTIALLY VERIFIED (unit-test only) | `content-type-detector.ts:25-41` defines RESPONSE_SCHEMA with the 7 enum values + confidence number. `types.ts:271-288` defines ContentTypeEnumSchema + Wave0ContentTypeResultSchema. 10/10 unit tests pass. **HOWEVER: line 96 calls `fetch(payload.video_url)` but `normalize.ts:46` sets video_url = `input.video_storage_path` (a Supabase Storage key, NOT a fetchable URL). In production, fetch() will throw, the try/catch returns null, and Wave 0 content-type detection NEVER works for real video uploads.** Tests mask the bug with `video_url: "https://test-bucket.supabase.co/video.mp4"` (line 52 of wave0-content-type.test.ts) |
| 3 | Niche detector returns hierarchical {primary, sub_niche, micro_niche} with confidence; falls back to creator profile Card 1 if confidence < 0.6 | VERIFIED | `niche-detector.ts:99-145` parses Zod-validated `{primary, sub, micro, confidence, source}`; line 126 `if (result.confidence < CONFIDENCE_THRESHOLD)` triggers Card 1 fallback; line 138 `source: "card1_fallback"`. `CONFIDENCE_THRESHOLD = 0.6` (line 26). 14/14 niche detector unit tests pass including Card 1 fallback, drift detection, micro null (D-07), and Pitfall 4 (invalid Card 1) coverage |
| 4 | Niche taxonomy tree exists with mappings to persona archetypes + benchmark filters | VERIFIED | `taxonomy.ts:27-31` defines `PersonaMix`; `38-41` defines `BenchmarkFilters`; `45-49` extends `NichePrimary` with `personas: PersonaMix[]` + `benchmark_filters: BenchmarkFilters`. All 10 primaries populated (beauty, fitness, education, comedy, lifestyle, food-cooking, tech-gadgets, gaming, fashion-style, music-performance). 18/18 taxonomy tests pass including invariant "personas weight sums to exactly 10 per primary" |
| 5 | Aggregator weights content-type-aware (slideshows down-weight pacing signal; action videos up-weight visual_production_quality) | VERIFIED | `content-type-weights.ts:18` slideshow.pacing_score=0.5; line 19 action all four ≥ 1.0 (1.3, 1.2, 1.2, 1.3). `aggregator.ts:311-322` reads `wave0.content_type?.type`, calls `applyContentTypeWeights(rawVideoSignals, contentTypeSlug)`, threads `adjustedVideoSignals` into `assembleFeatureVector`. 8/8 aggregator Phase 4 tests pass including "feature_vector uses content-type-adjusted video signals when content_type present (D-12 slideshow halves pacing)" — slideshow 8 × 0.5 = 4 |

**Score:** 4/5 SCs fully verified, 1 SC (SC#2) verified only at unit-test level due to CR-01 production bug.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/engine/types.ts` | Wave0ContentTypeResult, Wave0NicheResult, Wave0Result widened, ContentTypeSlug, SignalAvailability + content_type/niche keys | VERIFIED | Lines 271-306: ContentTypeEnumSchema (7 values), Wave0ContentTypeResultSchema, Wave0NicheResultSchema, Wave0ResultSchema (both fields nullable). Lines 197-205: SignalAvailability extended with content_type + niche |
| `src/lib/engine/wave0/content-type-weights.ts` | CONTENT_TYPE_WEIGHT_MATRIX (7×4), MULTIPLIER_FLOOR/CEILING, applyContentTypeWeights | VERIFIED | Lines 15-23: Locked matrix verbatim per D-12. Lines 25-26: FLOOR=0.5, CEILING=1.5. Lines 38-55: pure function with clamp + Math.min(10, ...) cap. Imports in `aggregator.ts:22`; usage at `aggregator.ts:316` |
| `src/lib/engine/wave0/content-type-detector.ts` | detectContentType() with Gemini 3 Flash + responseSchema + graceful degradation | EXISTS + WIRED (broken at runtime) | Line 13 GEMINI_WAVE0_MODEL default "gemini-3-flash-preview"; line 73 export; lines 138 videoMetadata {startOffset:"0s",endOffset:"5s"}; lines 144-147 responseSchema config. **CR-01: line 96 fetch(payload.video_url) is broken for video_upload mode in production** |
| `src/lib/engine/wave0/niche-detector.ts` | detectNiche() with DeepSeek V4 Flash + two-stage validation + Card 1 fallback + drift detection + micro null | VERIFIED | Line 18 DEEPSEEK_NICHE_MODEL "deepseek-v4-flash"; lines 99-117 two-stage validation (Zod + NICHE_TREE slug check); lines 126-145 Card 1 fallback (D-05); lines 146-156 drift detection (D-06); lines 121-123 micro null (D-07) |
| `src/lib/engine/wave0/prompts.ts` | NICHE_SYSTEM_PROMPT (STABLE module const) + buildNicheUserMessage (VOLATILE) | VERIFIED | Lines 12-15 NICHE_TREE.map at module load → byte-identical prefix; line 17 export const NICHE_SYSTEM_PROMPT; line 53 export buildNicheUserMessage. PROFILE-16 host-only extraction at lines 100-108 (with WR-03 caveat that the fallback `return s.trim()` may leak free text — not a blocker) |
| `src/lib/engine/wave0.ts` | runWave0(payload, creatorContext, onEvent) with Promise.allSettled | VERIFIED | Lines 22-48: signature widened to 3 args; Promise.allSettled at line 27; isolated graceful degradation (one rejection leaves the other intact) |
| `src/lib/engine/pipeline.ts` | PipelineOptions.creatorContext, pre_creator_context stage BEFORE runWave0, Wave 1 passthrough | VERIFIED | Line 84 PipelineOptions.creatorContext; lines 285-304 pre_creator_context stage with try/catch + Sentry; line 310 runWave0 with creatorContext; line 389 Wave 1 passthrough `async () => creatorContext` (no DB re-read) |
| `src/lib/engine/aggregator.ts` | selectWeights filter, signal_availability.content_type/niche, applyContentTypeWeights integration | VERIFIED | Lines 43-44 SCORE_WEIGHT_KEYS tuple; lines 66-69 filtered iteration; lines 311-322 applyContentTypeWeights call site; lines 347-348 content_type/niche flags from wave0Result. Warning-loop filter at lines 438-443 (Rule-2 fix in 04-03 SUMMARY) |
| `src/lib/niches/taxonomy.ts` | 10 primaries with personas (weight sum=10) + benchmark_filters | VERIFIED | 10 primaries each with personas[] (loyalist-existing-follower count=10) + benchmark_filters{tag_filters, min_corpus_size}. Weight-sum=10 invariant proven by taxonomy.test.ts |
| Test files (5 new) | wave0-content-type, wave0-niche-detector, wave0-orchestration, content-type-weights, taxonomy extensions | VERIFIED | All 5 files exist; 24 + 8 + 12 + 6 = 50 new Phase 4 tests + 22 aggregator/pipeline extension tests = 72 new tests; full suite 753 passing |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `pipeline.ts:310` | `wave0.ts:runWave0` | 3-arg call `runWave0(payload, creatorContext, onStageEvent)` | WIRED | Verified at pipeline.ts:310 |
| `wave0.ts:27-30` | `content-type-detector.ts:detectContentType` + `niche-detector.ts:detectNiche` | Promise.allSettled | WIRED | Verified at wave0.ts imports lines 4-5 + lines 27-30 |
| `wave0.ts:30` | `niche-detector.ts:detectNiche` | passes creatorContext as 2nd arg | WIRED | Verified at wave0.ts:29; test wave0-orchestration.test.ts "creatorContext is passed through to detectNiche" passes |
| `aggregator.ts:22` | `content-type-weights.ts:applyContentTypeWeights` | `import { applyContentTypeWeights }` + call at 316 | WIRED | Verified at aggregator.ts:22 + 316 + integration test "feature_vector uses content-type-adjusted video signals" passes |
| `aggregator.ts:316` | `assembleFeatureVector(pipelineResult, adjustedVideoSignals)` | optional 2nd arg | WIRED | Verified at aggregator.ts:322 + assembleFeatureVector signature at 166-168 |
| `aggregator.ts:347-348` | `signal_availability.content_type` + `signal_availability.niche` | derived from wave0Result.content_type/niche !== null | WIRED | Verified at aggregator.ts:347-348; test "signal_availability.content_type set to true when wave0Result.content_type is non-null" passes |
| `niche-detector.ts:71` | `prompts.ts:NICHE_SYSTEM_PROMPT` | system message in chat.completions.create | WIRED | Verified at niche-detector.ts:10 + 71 |
| `prompts.ts:12` | `taxonomy.ts:NICHE_TREE` | NICHE_TREE.map(p => p.slug) at module load | WIRED | Verified at prompts.ts:12-15 |
| `content-type-detector.ts:96` | `fetch(payload.video_url)` | direct fetch | BROKEN (CR-01) | Production runtime fails because payload.video_url is a storage-path key, not a URL. See SC#2 row + CR-01 details below |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `wave0Result.content_type` (per-analysis) | Returned from `detectContentType(payload, onEvent)` | Gemini 3 Flash Files API + generateContent | NO (production runtime broken — CR-01) | DISCONNECTED — production `payload.video_url` is `video_storage_path` (e.g., "user-abc/video.mp4") so `fetch()` throws TypeError → try/catch returns null → wave0Result.content_type is always null in production for video_upload mode |
| `wave0Result.niche` (per-analysis) | Returned from `detectNiche(payload, creatorContext, onEvent)` | DeepSeek V4 Flash chat.completions.create + Zod validation + NICHE_TREE slug check | YES (text-only data flow — no fetch dependency) | FLOWING — niche detector consumes payload.content_text + creatorContext.niche_primary/niche_sub which are populated by normalize.ts + pipeline pre-fetch |
| `signal_availability.content_type/niche` | `pipelineResult.wave0Result.content_type !== null` / `.niche !== null` | wave0Result derived above | PARTIAL | `signal_availability.niche` will be true in production when niche detector succeeds; `signal_availability.content_type` will be FALSE for every video upload in production (CR-01) |
| `feature_vector.pacingScore` (adjusted) | applyContentTypeWeights(rawVideoSignals, contentTypeSlug) | Gemini Wave 1 video_signals × matrix | PARTIAL | In production, contentTypeSlug will always be null (CR-01) → matrix uses 'other' row (1.0× passthrough) → no actual content-type-aware weighting happens. SC#5 verified at unit-test level only |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All Phase 4 test suites pass | `pnpm test` | 753 passed / 1 skipped / 3 pre-existing failures (cost-benchmark missing fixtures, video-e2e missing local file) | PASS (Phase 4 code is green) |
| Wave 0 detectors module imports resolve | `grep imports + ls src/lib/engine/wave0/` | 4 modules exist (content-type-detector, niche-detector, prompts, content-type-weights); 3 test files in __tests__ | PASS |
| Taxonomy weight-sum invariant | `pnpm test src/lib/niches/__tests__/taxonomy.test.ts -t "weight sum"` | passing (18/18 taxonomy tests green) | PASS |
| Slideshow halves pacing | `pnpm test src/lib/engine/__tests__/content-type-weights.test.ts -t "slideshow halves pacing"` | passing | PASS |
| Promise.allSettled orchestration | `grep "Promise.allSettled" src/lib/engine/wave0.ts` | 1 match at line 27 | PASS |
| `pre_creator_context` stage exists | `grep "pre_creator_context" src/lib/engine/pipeline.ts` | 3 matches (event name string + creator promise comment + Sentry tag) | PASS |
| End-to-end video_upload flow → wave0Result.content_type | Would require server + real upload — NOT runnable without live API keys + Supabase Storage | not runnable in verifier | SKIP — routed to human verification |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (no scripts/*/tests/probe-*.sh in this repo) | — | — | N/A — repo uses vitest only |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CONTENT-01 | 04-02, 04-03 | Content type classifier (V3, ~$0.001/call) — talking head / B-roll / slideshow / action / tutorial / vlog | SATISFIED at code level / BLOCKED at production runtime | content-type-detector.ts:30 enum, 10/10 unit tests pass, integrated into runWave0 at wave0.ts:28. **CR-01 prevents real production runs — see SC#2 row** |
| CONTENT-02 | 04-02, 04-03 | Hierarchical niche detector (V3, ~$0.001/call) — primary / sub-niche / micro-niche from content + creator profile | SATISFIED | niche-detector.ts:99-105 returns {primary, sub, micro, confidence, source}; Card 1 fallback at line 130; drift detection at line 148; 14/14 unit tests pass; data flow does not depend on broken fetch path |
| CONTENT-03 | 04-01, 04-03 | Niche taxonomy stored as tree structure with mappings to persona archetypes and benchmark filters | SATISFIED | taxonomy.ts:45-49 extended NichePrimary type with personas + benchmark_filters; all 10 primaries populated; weight-sum=10 invariant proven |
| CONTENT-04 | 04-01, 04-03 | Content-type-aware signal weighting passed to aggregator (e.g., slideshows down-weight pacing signal) | SATISFIED at code level / BLOCKED at production runtime | aggregator.ts:316 calls applyContentTypeWeights; slideshow.pacing_score=0.5; 8/8 aggregator Phase 4 tests pass. **Real production runtime always uses 'other' (1.0×) row because wave0Result.content_type is always null in prod due to CR-01** |

**No orphaned requirements** — REQUIREMENTS.md maps Phase 4 to CONTENT-01..04, all four claimed by plans 04-01/02/03 frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `wave0/content-type-detector.ts` | 96 | `fetch(payload.video_url)` directly while normalize.ts:46 supplies storage-path key, not URL | BLOCKER (CR-01) | Production-breaking: every video_upload analysis silently returns wave0Result.content_type=null, defeating the entire content-type-aware weighting in SC#5. Discovered by code review (REVIEW.md CR-01) — verified by reading normalize.ts:46 + content-type-detector.ts:96 + the test mock at wave0-content-type.test.ts:52 |
| `wave0/niche-detector.ts` | 89-92 | Cost computation ignores `prompt_tokens` when cache breakdown fields missing → silently reports 0¢ input cost | WARNING (CR-02 from REVIEW.md) | Cost reporting under-reports input by up to ~80% when DeepSeek omits cache fields. Doesn't break behavior, but corrupts cost telemetry + breaks any cost-budget guard. Unit tests mask the bug by always providing cache fields |
| `wave0.ts` | 32-46 | Rejected detector promises only log at WARN — no warnings.push, no Sentry.captureException | WARNING (WR-01 from REVIEW.md) | Observability gap: a real detector crash (vs documented null return) won't surface in pipelineResult.warnings or error tracking. Not a blocker because the orchestrator still produces a well-formed Wave0Result |
| `wave0/prompts.ts` | 100-108 | `extractHandleOrHost` fallback `return s.trim()` may leak free text — asymmetric with `tryUrlHost` | WARNING (WR-03 from REVIEW.md) | PROFILE-16 promise is "host-only", but a malformed Card-5 reference like "see https://tiktok.com/private/info for examples" returns the whole string. Defense-in-depth gap |
| `__tests__/stubs.test.ts` | 26-51 | Test invokes runWave0 without mocking openai or @google/genai — depends on real network failures for green | WARNING (WR-02 from REVIEW.md) | Slow + brittle test; not a phase-4 production concern but indicates the test isolation contract is weak |
| `__tests__/pipeline.test.ts` | 733 | `if (wave1Idx >= 0) expect(...)` silently skips ordering assertion when wave1Idx === -1 | WARNING (WR-04 from REVIEW.md) | Test "passes by accident" — would not fail if Wave 1 events stop firing entirely. Reduces test trust |
| `__tests__/pipeline.test.ts` | 63-68 | `@google/genai` mock omits `Type.BOOLEAN` (used by content-type-detector RESPONSE_SCHEMA) | WARNING (WR-05 from REVIEW.md) | Latent — only bites if any future pipeline test exercises video_upload mode |
| `pipeline.ts` | 290-294 | `pre_creator_context` stage labeled `wave: 1` but executes BEFORE Wave 0 | WARNING (WR-06 from REVIEW.md) | Inconsistent SSE wave numbering — could confuse downstream consumers. Forward-looking concern only |
| `taxonomy.ts` | 65, 175, 225 | Sub-slugs `tutorials` and `hauls` appear under multiple primaries | INFO (IN-01 from REVIEW.md) | LLM may inconsistently disambiguate; ok for now per researcher discretion |
| (no TBD/FIXME/XXX debt markers in any Phase 4 file) | — | — | — | Debt-marker gate PASSES |

### Human Verification Required

#### 1. End-to-end Wave 0 content-type detection for a real video_upload

**Test:** Upload a real video file (any short mp4/mov, ideally a single-content-type 5+s clip such as a talking-head selfie or slideshow) through the live `/api/analyze` route (or the upload UI). Inspect the returned `wave0Result.content_type` and `signal_availability.content_type` plus the persisted analysis row's `signal_availability` JSONB column.

**Expected:** `wave0Result.content_type` is `{ type: "talking_head" | "b_roll" | "slideshow" | "action" | "tutorial" | "vlog" | "other", confidence: 0..1 }` (non-null). `signal_availability.content_type === true`. The `feature_vector.pacingScore` and `feature_vector.visualProductionQuality` reflect the content-type matrix multiplication.

**Why human:** This cannot be verified without (a) live `GEMINI_API_KEY` + `DEEPSEEK_API_KEY` env vars, (b) live Supabase Storage with a real uploaded video object, and (c) running the full Next.js server. The integration tests in `pipeline.test.ts` only exercise `input_mode="text"`, which short-circuits the content-type detector at the input_mode check (line 80) and never reaches the broken `fetch(payload.video_url)` call. Per CR-01, this verification is expected to FAIL — content-type detection will always return null in production because `payload.video_url` is a storage-path key, not a fetchable URL.

#### 2. Niche detector cost-tracking shows non-zero input cost

**Test:** Run an analysis with caption + hashtags (any non-empty text — even a text-only TikTok URL works) against the live DeepSeek API and inspect the structured-logged `cost_cents` from the `wave0.niche` logger.

**Expected:** `cost_cents` ≥ 0.0001 (reflecting at least the input-token cost of the ~500-token NICHE_SYSTEM_PROMPT). If the account/model does not return `prompt_cache_hit_tokens`/`prompt_cache_miss_tokens`, the current code path will silently report `cost_cents: 0`.

**Why human:** Requires real DeepSeek API call. Unit tests always mock with cache breakdown fields present (`prompt_cache_miss_tokens: 1000` etc.), so the cost-tracking bug never triggers in the test suite. Per CR-02 from REVIEW.md, expected to under-report cost by ~80%.

### Gaps Summary

**No structured `gaps:` entries.** Code is well-structured, all artifacts exist, all wiring grep checks succeed, and all 50+ new Phase 4 tests pass. The phase goal is met at the **code-and-tests level**:
- Wave 0 orchestrator wired into pipeline.ts BEFORE Wave 1 ✓
- Both V3 calls fire in parallel via Promise.allSettled ✓
- Content type enum + Zod validation in place ✓
- Hierarchical niche detector with Card 1 fallback @ 0.6 ✓
- 10-primary taxonomy with persona + benchmark mappings ✓
- Content-type weight matrix wired into aggregator ✓

**However, two real production bugs are present** (caught by REVIEW.md's CR-01 + CR-02), neither of which is addressed by any later phase per ROADMAP.md scan:
1. **CR-01 (BLOCKER for production):** `fetch(payload.video_url)` in content-type-detector.ts:96 is incompatible with how `normalize.ts:46` populates `video_url` from `video_storage_path`. Production behavior: every video upload returns wave0Result.content_type=null, defeating SC#2 and SC#5 end-to-end. Fix per REVIEW.md: inject Supabase client and download via storage, OR have pipeline pre-download buffer and pass to detectContentType.
2. **CR-02 (WARNING for cost telemetry):** niche-detector.ts cost-tracking ignores `prompt_tokens` when cache breakdown is missing → reports 0¢ input cost.

Since the verifier instructions explicitly flag CR-01 as a known finding and ask for it to be noted with a status reflecting that SC#2 is unit-test-verified only, the overall status is **human_needed** — a human must (a) confirm CR-01 is intentional/deferred to a follow-up phase or (b) re-open the phase to fix it before Phase 5 begins. The 3 pre-existing test failures in cost-benchmark.test.ts + video-e2e.test.ts are missing-fixture/missing-local-file issues unrelated to Phase 4 code.

---

_Verified: 2026-05-18T04:50:00Z_
_Verifier: Claude (gsd-verifier)_
