---
phase: 04-wave-0-content-type-niche-detection
verified: 2026-05-18T09:25:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5 must-haves verified (SC#2 production runtime broken by CR-01)
  gaps_closed:
    - "GAP-04-01: fetch(payload.video_url) replaced with supabase.storage.from('videos').download(payload.video_storage_path)"
    - "GAP-04-02: niche-detector cost fallback to prompt_tokens x CACHE_MISS_PRICE when cache breakdown absent"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "End-to-end Wave 0 content-type detection for a real video_upload"
    expected: "detectContentType() returns Wave0ContentTypeResult with one of the 7 enum slugs and confidence in [0,1]; signal_availability.content_type === true; feature_vector.pacingScore / visualProductionQuality reflect content-type weight matrix application"
    why_human: "Requires live GEMINI_API_KEY + DEEPSEEK_API_KEY + Supabase Storage with real uploaded video. Integration tests exercise the storage download path via mocks — confirms the code-level fix. Live Gemini Files API + generateContent path requires human."
  - test: "Niche detector cost-tracking shows non-zero input cost when DeepSeek omits cache breakdown"
    expected: "When DeepSeek returns prompt_tokens without cache_hit/cache_miss fields, cost_cents > 0 in niche-detector structured logs (reflecting prompt_tokens x CACHE_MISS_PRICE)"
    why_human: "Requires real DeepSeek API call with caching disabled or against a model variant that omits cache fields. Unit tests cover this via mocks — live confirmation still needed."
---

# Phase 4: Wave 0 — Content Type + Niche Detection Verification Report (Re-verification)

**Phase Goal:** A new Wave 0 runs two V3 classifier calls before Wave 1, producing `content_type` and hierarchical `niche` signals that drive downstream weighting.
**Verified:** 2026-05-18T09:25:00Z
**Status:** human_needed — all 5 SCs now verified at code+test level; 2 human UAT items remain (live API confirmation)
**Re-verification:** Yes — after gap closure (GAP-04-01 + GAP-04-02)

## Re-verification Summary

Both gaps from the initial verification are now closed:

- **GAP-04-01 (BLOCKER) — CLOSED:** `content-type-detector.ts:96` no longer calls `fetch(payload.video_url)`. Replaced with `supabase.storage.from("videos").download(payload.video_storage_path)`. `normalize.ts` now decouples `video_url` (only for tiktok_url mode) from `video_storage_path` (only for video_upload mode) — Option A foot-gun elimination. 6 regression-lock tests across normalize.test.ts, wave0-content-type.test.ts, and pipeline.test.ts lock the fix.
- **GAP-04-02 (WARNING) — CLOSED:** `niche-detector.ts` cost block now has `hasCacheBreakdown` guard — falls back to `(usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE` when cache fields are absent or zero. 3 regression tests in wave0-niche-detector.test.ts lock the behavior.

No regressions were introduced. Test count: 753 (pre-gap-closure) → 762 passed (post-gap-closure), with the same 3 pre-existing failures (cost-benchmark missing fixtures, video-e2e missing local file).

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (SC) | Status | Evidence |
| - | ---------- | ------ | -------- |
| 1 | Pipeline's Wave 0 fires before Wave 1 with two parallel V3 calls (content type + niche) | VERIFIED | Unchanged from initial verification. `pipeline.ts` calls `runWave0(payload, supabase, creatorContext, onStageEvent)` at line 310 BEFORE `geminiPromise`. `wave0.ts:35` uses `Promise.allSettled([detectContentType(payload, supabase, onEvent), detectNiche(payload, creatorContext, onEvent)])`. WR-04 binary precondition now unconditional at pipeline.test.ts:742-744 (`expect(wave1Idx).toBeGreaterThanOrEqual(0)` + `expect(w0Idx).toBeLessThan(wave1Idx)` — no conditional skip). |
| 2 | Content type classifier returns one of {talking_head, b_roll, slideshow, action, tutorial, vlog, other} with confidence | VERIFIED | GAP-04-01 closed. `content-type-detector.ts` now calls `supabase.storage.from("videos").download(payload.video_storage_path)` (line 106-109). `grep -c 'fetch(payload.video'` returns 0 (comment-only reference at line 75). `grep -c 'from("videos")'` returns 2 (both production call + test file reference). `normalize.ts` uses Option A: `video_url: input.tiktok_url ?? null` (never aliased to storage key); `video_storage_path: input.video_storage_path ?? null` explicitly. New pipeline integration test at pipeline.test.ts:754 proves `wave0Result.content_type.type === "talking_head"` with production-shaped input (`video_storage_path: "user-abc/test-content.mp4"`, no scheme). |
| 3 | Niche detector returns hierarchical {primary, sub_niche, micro_niche} with confidence; falls back to creator profile Card 1 if confidence <0.6 | VERIFIED | Unchanged. `niche-detector.ts:99-145` + all 17 tests pass (14 existing + 3 new GAP-04-02 regression tests). |
| 4 | Niche taxonomy tree exists with mappings to persona archetypes + benchmark filters | VERIFIED | Unchanged. `taxonomy.ts` 10 primaries with `PersonaMix[]` + `BenchmarkFilters`. 14 grep matches for PersonaMix/BenchmarkFilters/benchmark_filters. |
| 5 | Aggregator weights content-type-aware (slideshows down-weight pacing signal; action videos up-weight visual_production_quality) | VERIFIED | Now fully verified at production runtime level (not just unit-test level). GAP-04-01 closure means `wave0Result.content_type` is no longer always null for video_upload mode → `applyContentTypeWeights` (aggregator.ts:316, 2 matches) now receives a real content type slug in production. `content-type-weights.ts` matrix unchanged and proven by 8/8 aggregator Phase 4 tests. |

**Score:** 5/5 SCs verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/engine/types.ts` | `ContentPayload` has `video_storage_path: string \| null` (Phase 4 gap-closure field) | VERIFIED | `grep -c "video_storage_path" src/lib/engine/types.ts` = 3 (declaration + 2 comments). Field is `string \| null` between `video_url` and `hashtags`. |
| `src/lib/engine/normalize.ts` | Option A: `video_url` only from `tiktok_url`; `video_storage_path` explicitly from input | VERIFIED | `grep -E "video_url:\s*input\.tiktok_url\s*\?\?\s*null"` = 1. `grep -E "input\.video_storage_path"` = 1 (only on video_storage_path: line, never on video_url: line). |
| `src/lib/engine/wave0/content-type-detector.ts` | Uses `supabase.storage.from("videos").download(payload.video_storage_path)`; accepts SupabaseClient as 2nd param | VERIFIED | `grep -c 'import type { SupabaseClient }'` = 1. `grep -c 'fetch(payload.video'` = 1 (comment only, line 75). `grep -c 'from("videos")'` = 2. `grep -c 'payload.video_storage_path'` = 3. |
| `src/lib/engine/wave0.ts` | Accepts SupabaseClient as 2nd param; forwards to detectContentType; Sentry.captureException on both rejected outcomes (WR-01) | VERIFIED | `grep -c "import type { SupabaseClient }"` = 1. `grep -c "import \* as Sentry"` = 1. `grep -c "Sentry.captureException"` = 2. `grep -c "detectContentType(payload, supabase"` = 1. |
| `src/lib/engine/pipeline.ts` | Passes existing supabase client into `runWave0(payload, supabase, creatorContext, onStageEvent)`; no new client instantiation | VERIFIED | `grep -Ec "runWave0\(payload,\s*supabase"` = 1. |
| `src/lib/engine/wave0/niche-detector.ts` | `hasCacheBreakdown` guard; `prompt_tokens` fallback for absent cache fields | VERIFIED | `grep -c "hasCacheBreakdown"` = 2 (declaration + branch use). `grep -c "prompt_tokens"` = 3 (comment + type cast + fallback expression). `inputCost` ternary at lines 99-101. |
| `src/lib/engine/__tests__/normalize.test.ts` | Option A contract-lock tests (video_url null for video_upload; video_storage_path carries key) | VERIFIED | `grep -c "GAP-04-01 regression-lock"` = 3. `grep -c "video_storage_path"` = 11. |
| `src/lib/engine/__tests__/wave0-content-type.test.ts` | 3 new regression tests; videoPayload uses Option A shape (video_url: null) | VERIFIED | `grep -c "GAP-04-01 regression"` = 2. `grep -n "video_url:"` for videoPayload constant = `video_url: null`. `grep -c "mockStorageDownload\|mockStorageFrom"` = 8. |
| `src/lib/engine/__tests__/pipeline.test.ts` | WR-04 binary precondition; WR-05 Type.BOOLEAN; GAP-04-01 pipeline integration test | VERIFIED | `grep -c "if (wave1Idx >= 0)"` = 0 (conditional skip gone). `grep -c "expect(wave1Idx).toBeGreaterThanOrEqual(0)"` = 1. `grep -c "BOOLEAN"` = 1. `grep -c "GAP-04-01 regression"` = 1. |
| `src/lib/engine/__tests__/wave0-orchestration.test.ts` | Updated call sites pass mockSupabaseClient as 2nd arg | VERIFIED | `grep -c "mockSupabaseClient"` = 12. |
| `src/lib/engine/__tests__/stubs.test.ts` | Updated call sites pass supabase client as 2nd arg (named fakeSupabaseClient) | VERIFIED | `grep -c "fakeSupabaseClient"` = 4 (definition + 3 call sites). All runWave0 calls use 4-arg signature. Plan artifact said "contains: mockSupabaseClient" but test uses `fakeSupabaseClient` — behaviorally equivalent, naming deviation only. |
| `src/lib/engine/__tests__/wave0-niche-detector.test.ts` | 3 regression tests in `describe("GAP-04-02 regression")` block; 17 total tests | VERIFIED | `grep -c "GAP-04-02 regression"` = 1. `grep -c "it("` = 17. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `pipeline.ts` | `runWave0(payload, supabase, creatorContext, onStageEvent)` | 4-arg call | WIRED | `grep -Ec "runWave0\(payload,\s*supabase"` = 1 at pipeline.ts |
| `wave0.ts:35` | `detectContentType(payload, supabase, onEvent)` | 3-arg call, supabase forwarded | WIRED | `grep -c "detectContentType(payload, supabase"` = 1 |
| `content-type-detector.ts:106-109` | `supabase.storage.from("videos").download(payload.video_storage_path)` | injected SupabaseClient | WIRED | `grep -c 'from("videos")'` = 2; `grep -c 'payload.video_storage_path'` = 3 |
| `normalize.ts` | `ContentPayload.video_url` from `input.tiktok_url ?? null` only | Option A contract | WIRED | `grep -E "video_url:\s*input\.tiktok_url\s*\?\?\s*null"` = 1; `grep -E "input\.video_storage_path"` = 1 (on video_storage_path: line only) |
| `normalize.ts` | `ContentPayload.video_storage_path` from `input.video_storage_path ?? null` | explicit assignment | WIRED | `grep -E "video_storage_path:\s*input\.video_storage_path"` = 1 |
| `wave0.ts` | `Sentry.captureException` on rejected detector outcomes | WR-01 observability | WIRED | `grep -c "Sentry.captureException"` = 2 (one per detector rejection path) |
| `niche-detector.ts:98-102` | `hasCacheBreakdown` guard → `inputCost` fallback | GAP-04-02 cost fix | WIRED | `hasCacheBreakdown = cacheHit > 0 || cacheMiss > 0`; fallback reads `usage?.prompt_tokens ?? 0` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `wave0Result.content_type` | Returned from `detectContentType(payload, supabase, onEvent)` | `supabase.storage.from("videos").download(video_storage_path)` → Gemini 3 Flash Files API | YES (production code path now correct) | FLOWING — storage key downloads via Supabase client; no more fetch() on raw key. New pipeline integration test confirms `wave0Result.content_type.type === "talking_head"` with production-shaped data. Live API confirmation is the remaining human item. |
| `wave0Result.niche` | Returned from `detectNiche(payload, creatorContext, onEvent)` | DeepSeek V4 Flash chat.completions.create | YES (unchanged from initial verification) | FLOWING |
| `cost_cents` (niche-detector) | `(inputCost + completion * OUTPUT_PRICE) * 100` | `hasCacheBreakdown ? cache path : prompt_tokens * CACHE_MISS_PRICE` | YES (fallback now fires when cache fields absent) | FLOWING — non-zero for non-empty prompts regardless of whether DeepSeek returns cache breakdown |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All gap-closure test files pass | `pnpm test src/lib/engine/__tests__/normalize.test.ts wave0-content-type.test.ts wave0-niche-detector.test.ts pipeline.test.ts wave0-orchestration.test.ts stubs.test.ts` | 84 passed / 0 failed | PASS |
| Full test suite | `pnpm test` | 762 passed / 3 pre-existing failures (cost-benchmark missing fixtures, video-e2e missing local file) / 1 skipped | PASS |
| fetch(payload.video eliminated | `grep -c 'fetch(payload.video' content-type-detector.ts` | 1 (comment only — line 75 "instead of calling fetch(payload.video_url)") | PASS |
| Supabase storage download in place | `grep -c 'from("videos")' content-type-detector.ts` | 2 | PASS |
| Option A normalize contract | `grep -Ec "video_url:\s*input\.tiktok_url\s*\?\?\s*null" normalize.ts` | 1 | PASS |
| hasCacheBreakdown guard present | `grep -c "hasCacheBreakdown" niche-detector.ts` | 2 | PASS |
| WR-04 binary precondition | `grep -c "if (wave1Idx >= 0)" pipeline.test.ts` | 0 | PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (no scripts/*/tests/probe-*.sh in this repo) | — | — | N/A — repo uses vitest only |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| CONTENT-01 | 04-02, 04-03, 04-04 | Content type classifier (V3, ~$0.001/call) — talking head / B-roll / slideshow / action / tutorial / vlog | SATISFIED | GAP-04-01 closed. `content-type-detector.ts` now downloads via `supabase.storage.from("videos").download(video_storage_path)`. 13 unit tests pass; pipeline integration test proves end-to-end. Previous "blocked at production runtime" status is lifted. |
| CONTENT-02 | 04-02, 04-03, 04-05 | Hierarchical niche detector (V3, ~$0.001/call) — primary / sub-niche / micro-niche from content + creator profile | SATISFIED | GAP-04-02 closed. 17 niche-detector tests pass (14 existing + 3 new cost-fallback regression tests). Cost telemetry now reports non-zero input cost when cache breakdown absent. |
| CONTENT-03 | 04-01, 04-03 | Niche taxonomy stored as tree structure with mappings to persona archetypes and benchmark filters | SATISFIED | Unchanged from initial verification. `taxonomy.ts` 10 primaries with PersonaMix + BenchmarkFilters. No regression. |
| CONTENT-04 | 04-01, 04-03, 04-04 | Content-type-aware signal weighting passed to aggregator | SATISFIED | Previously "blocked at production runtime" — now lifted. With GAP-04-01 closed, `wave0Result.content_type` is non-null in production for video_upload mode → aggregator.ts:316 `applyContentTypeWeights` now uses the real content type slug. 2 call-site matches in aggregator.ts confirmed. |

**Orphaned requirements check:** REQUIREMENTS.md traceability table does not yet list CONTENT-01..04 rows for Phase 4 (the table only includes PROFILE-* and INT-02/04). This is a documentation gap in the traceability table, not a code gap — the ROADMAP.md explicitly maps `CONTENT-01..04` to Phase 4, and all four are satisfied by the code.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (no TBD/FIXME/XXX in any Phase 4 gap-closure file) | — | — | — | Debt-marker gate PASSES |
| `src/lib/engine/pipeline.ts` | 132 | TS2740: CreatorContext literal missing required fields | INFO (pre-existing, introduced by Phase 6 commit 8dcfba9) | Not introduced by Phase 4 gap-closure; outside Phase 4 scope. 966 total TS errors all pre-date or post-date Phase 4 gap-closure (Phase 6+ routes, calibration.test.ts missing vitest types, etc.) |
| `src/lib/engine/__tests__/stubs.test.ts` | 24 | `fakeSupabaseClient` naming vs plan acceptance criterion "contains: mockSupabaseClient" | INFO (naming deviation, not behavioral) | Behavior is correct — supabase client is passed as 2nd arg to runWave0. Plan acceptance criterion used different naming than what executor chose. No production impact. |
| `wave0/prompts.ts` | 100-108 | `extractHandleOrHost` fallback `return s.trim()` may leak free text (WR-03 from initial verification) | WARNING (pre-existing, unchanged) | PROFILE-16 host-only extraction asymmetry. Not introduced by gap-closure. Not blocking. |

### Human Verification Required

#### 1. End-to-end Wave 0 content-type detection for a real video_upload

**Test:** Upload a real video file (any short mp4/mov, ideally a single-content-type 5+s clip) through the live `/api/analyze` route. Inspect `wave0Result.content_type` and `signal_availability.content_type` in the response and persisted analysis row.

**Expected:** `wave0Result.content_type` is non-null with `{ type: "talking_head" | "b_roll" | "slideshow" | "action" | "tutorial" | "vlog" | "other", confidence: 0..1 }`. `signal_availability.content_type === true`. `feature_vector.pacingScore` and `visualProductionQuality` reflect the content-type matrix (e.g., slideshow = 0.5x pacing score).

**Why human:** Requires (a) live `GEMINI_API_KEY`, (b) live Supabase Storage with real uploaded video object, (c) running Next.js server. The automated pipeline integration test at pipeline.test.ts:754 mocks the storage download and Gemini Files API — confirms the code-level fix. Live API path (Files upload + generateContent with real video Blob) requires human.

#### 2. Niche detector cost-tracking shows non-zero input cost when cache breakdown absent

**Test:** Run an analysis against the live DeepSeek API and inspect the niche-detector structured log `cost_cents` field. Ideally use a model variant or account configuration where `prompt_cache_hit_tokens` and `prompt_cache_miss_tokens` are absent from the response.

**Expected:** `cost_cents` > 0 in the `wave0.niche` logger output (reflecting at least the `~500-token NICHE_SYSTEM_PROMPT × CACHE_MISS_PRICE × 100`). Previously, this would be 0¢ when cache fields absent.

**Why human:** Requires real DeepSeek API call. Unit tests (wave0-niche-detector.test.ts) cover this path via mocks. Live confirmation verifies the fallback fires in production.

### Gaps Summary

No gaps remaining. Both structured gaps from the initial VERIFICATION.md are closed:

1. **GAP-04-01 (was BLOCKER)** — Closed by Plan 04-04. `fetch(payload.video_url)` replaced with `supabase.storage.from("videos").download(payload.video_storage_path)`. Option A normalize fix eliminates the storage-key alias at the source. 6 regression-lock tests prevent re-introduction. All 5 roadmap success criteria now satisfied at code+test level.

2. **GAP-04-02 (was WARNING)** — Closed by Plan 04-05. `hasCacheBreakdown` guard added to niche-detector cost calc. Fallback to `prompt_tokens × CACHE_MISS_PRICE` when cache fields absent or zero. 3 regression tests lock the behavior. Pattern now consistent with `deepseek.ts:338-362`.

Remaining status is `human_needed` (not `passed`) because 2 human UAT items require live API + infrastructure that cannot be automated.

---

_Verified: 2026-05-18T09:25:00Z_
_Verifier: Claude (gsd-verifier)_
