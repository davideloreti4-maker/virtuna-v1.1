---
phase: 04-wave-0-content-type-niche-detection
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/lib/engine/__tests__/aggregator.test.ts
  - src/lib/engine/__tests__/content-type-weights.test.ts
  - src/lib/engine/__tests__/pipeline.test.ts
  - src/lib/engine/__tests__/stubs.test.ts
  - src/lib/engine/__tests__/wave0-content-type.test.ts
  - src/lib/engine/__tests__/wave0-niche-detector.test.ts
  - src/lib/engine/__tests__/wave0-orchestration.test.ts
  - src/lib/engine/aggregator.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/types.ts
  - src/lib/engine/wave0.ts
  - src/lib/engine/wave0/content-type-detector.ts
  - src/lib/engine/wave0/content-type-weights.ts
  - src/lib/engine/wave0/niche-detector.ts
  - src/lib/engine/wave0/prompts.ts
  - src/lib/niches/__tests__/taxonomy.test.ts
  - src/lib/niches/taxonomy.ts
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 4 introduces Wave 0 (content-type + niche detection) running BEFORE Wave 1, with the content-type weight matrix flowing into the FeatureVector via aggregator changes. The implementation is generally well-structured (good separation of concerns, defensive null handling, graceful degradation contract, proper Zod validation), and the test coverage is broad. However, there is a **production-breaking blocker** in the content-type detector: `payload.video_url` is the raw Supabase Storage path key from `normalizeInput()` — it is NOT a fetchable URL — yet `detectContentType()` calls `fetch(payload.video_url)` directly. The test suite masks this bug by hand-mocking `video_url: "https://test-bucket.supabase.co/video.mp4"`, which bypasses the real production data flow through `normalize.ts`. A second blocker concerns the niche detector's cost-tracking: DeepSeek responses without cache-prefix fields silently yield `cost_cents: 0`, which corrupts cost reporting.

Additional concerns include silent error swallowing in the Wave 0 orchestrator (rejected detector promises do not propagate to pipeline `warnings`), brittle test isolation (env vars leak between test files; `stubs.test.ts` depends on real network failures), and several minor style/clarity issues. None of the test failures appear to be intentional — the bugs reflect implementation gaps between the plan ("resolved Supabase storage URL" — Plan 04-02 line 184) and what `normalizeInput()` actually produces.

## Critical Issues

### CR-01: `detectContentType` fetches storage path key as URL — production runtime failure

**File:** `src/lib/engine/wave0/content-type-detector.ts:96`
**Issue:** The content-type detector unconditionally calls `await fetch(payload.video_url)` to download the video. In `video_upload` mode, `payload.video_url` is populated by `normalize.ts:46` as `input.tiktok_url ?? input.video_storage_path ?? null` — `video_storage_path` is a Supabase Storage object key (e.g., `"user-abc/video.mp4"`), NOT a fetchable URL. Compare with pipeline.ts:336-352 which correctly uses `supabase.storage.from("videos").download(validated.video_storage_path!)` to retrieve the binary. The comment on line 95 ("Pattern matches gemini.ts:425-462 — fetch from resolved Supabase URL") is misleading — `analyzeVideoWithGemini()` does NOT fetch; it accepts a Buffer that the pipeline pre-downloads. In production, `fetch("user-abc/video.mp4")` will throw `TypeError: Failed to parse URL from user-abc/video.mp4` in Node.js. The Wave 0 detector then catches the error (per D-16 contract) and silently returns null — meaning Wave 0 content-type detection will **never work for video uploads in production**. The plan at `.planning/phases/04-wave-0-content-type-niche-detection/04-02-PLAN.md:184` documents the assumption that `video_url` is a "resolved Supabase storage URL," but that resolution never happens. The unit test `wave0-content-type.test.ts:52` masks this by hardcoding `video_url: "https://test-bucket.supabase.co/video.mp4"` and mocking `globalThis.fetch`. The integration test (`pipeline.test.ts`) avoids the bug entirely by using `input_mode: "text"`.
**Fix:** Inject the Supabase service client into the detector and download via storage, mirroring pipeline.ts:336-345. Alternative: have the pipeline pre-download the buffer (once) and pass it to `detectContentType` and `analyzeVideoWithGemini`. The buffer-injection approach also de-duplicates the network round-trip and avoids racing two downloads of the same blob.

```ts
// In content-type-detector.ts
export async function detectContentType(
  payload: ContentPayload,
  supabase: SupabaseClient,   // inject client
  onEvent?: StageEventCallback,
): Promise<Wave0ContentTypeResult | null> {
  // ...
  if (payload.input_mode !== "video_upload" || !payload.video_storage_path) {
    // emit no_video_input + return null
  }
  const { data: blob, error } = await supabase.storage
    .from("videos")
    .download(payload.video_storage_path);
  if (error || !blob) throw new Error(`Video download failed: ${error?.message ?? "no data"}`);
  const buffer = Buffer.from(await blob.arrayBuffer());
  // ... proceed with upload to Gemini Files API
}
```

Also: add `video_storage_path` to `ContentPayload` (currently only `video_url` is on the payload — `normalize.ts` drops the original storage path). And add an integration test that exercises the full `normalizeInput() -> runWave0()` path with a `video_upload` input to ensure the bug cannot regress silently again.

### CR-02: Niche detector cost tracking returns 0 cents when DeepSeek omits cache fields

**File:** `src/lib/engine/wave0/niche-detector.ts:89-92`
**Issue:** Cost computation reads `prompt_cache_hit_tokens`, `prompt_cache_miss_tokens`, and `completion_tokens` only. If DeepSeek returns a standard `prompt_tokens` field (without the cache breakdown — which happens when caching is not enabled on the account, when the model variant doesn't report cache fields, or during transient infrastructure events), `cacheHit` and `cacheMiss` both default to 0 → `costCents = 0 + 0 + completion * OUTPUT_PRICE`. The input-token cost is silently dropped, under-reporting cost by up to ~80% (the input prompt is the dominant cost driver for niche classification — 500+ tokens of system prompt vs. ~80 tokens of completion). This breaks billing visibility, downstream cost monitoring, and the `cost_cents.toFixed(4) > 0` assertion-style invariants the test suite would otherwise enforce. The unit test `wave0-niche-detector.test.ts:205-217` happens to mock with cache fields present, so the bug is not caught.
**Fix:** Fall back to `prompt_tokens` when neither cache field is present. Mirrors the cache-aware pricing logic in `deepseek.ts:560-580` which has the same fallback.

```ts
const usage = response.usage as unknown as {
  prompt_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens?: number;
} | undefined;
const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
const completion = usage?.completion_tokens ?? 0;
const hasCacheBreakdown = cacheHit > 0 || cacheMiss > 0;
const inputCost = hasCacheBreakdown
  ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
  : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE; // treat as full cache miss when no breakdown
costCents = (inputCost + completion * OUTPUT_PRICE) * 100;
```

Add a unit test for the no-cache-fields case so this can't regress.

## Warnings

### WR-01: Rejected detector promises silently dropped — no pipeline warning surfaced

**File:** `src/lib/engine/wave0.ts:32-46`
**Issue:** When `detectContentType` or `detectNiche` reject (e.g., a future bug causes them to throw instead of returning null per their documented contract), the orchestrator logs at WARN level but does NOT push anything to `pipelineResult.warnings` and does NOT report to Sentry. The caller sees `content_type: null, niche: null` with no indication that a failure occurred. This breaks the observability contract that "missing signal" is distinguishable from "detector crashed." Compare with the explicit `warnings.push(...)` and `Sentry.captureException` calls in pipeline.ts for every other non-critical stage.
**Fix:** Push a warning to a returned warnings array (would require adjusting `Wave0Result` shape) OR call `Sentry.captureException` on `outcome.reason` so the failure is at least observable in error tracking. Even simpler: rethrow to the caller and let pipeline.ts add the warning, since rejections in detectors indicate a contract violation that should bubble up. At minimum, add a Sentry capture:

```ts
if (contentTypeOutcome.status === "rejected") {
  Sentry.captureException(contentTypeOutcome.reason, {
    tags: { stage: "wave_0_content_type", source: "orchestrator" },
  });
  log.warn(...);
}
// repeat for nicheOutcome
```

### WR-02: `stubs.test.ts` depends on real network failures — flaky and environment-dependent

**File:** `src/lib/engine/__tests__/stubs.test.ts:26-51`
**Issue:** The test `runWave0(fakePayload, fakeCreatorContext)` (line 27) does NOT mock `openai`, `@google/genai`, or `fetch`. It passes `fakePayload = {} as ContentPayload` and asserts `result === { content_type: null, niche: null }`. The content-type detector returns null early (no `video_url`), but the niche detector will execute through to `ai.chat.completions.create()` with whatever `DEEPSEEK_API_KEY` is set in the test environment (Vitest does not isolate `process.env` between test files; `wave0-niche-detector.test.ts:28` sets `DEEPSEEK_API_KEY = "test-key"` globally). With a fake key, the request hits api.deepseek.com and fails with 401 — taking real network time and consuming Vitest's default 5s test timeout budget. If the network is offline, the test still passes (DNS error → catch → null), but slow. If a developer accidentally sets a real `DEEPSEEK_API_KEY` in their shell, the test makes a real API call. **This is a brittle test that should mock its dependencies.**
**Fix:** Add `vi.mock("openai", ...)` and `vi.mock("@google/genai", ...)` to `stubs.test.ts` so detectors fail with a controlled, fast error path. Or, even better: refactor the detectors to be injectable (pass the API clients in) so they can be replaced with fakes without module-level mocking.

### WR-03: `extractHandleOrHost` may leak arbitrary free-text into prompt

**File:** `src/lib/engine/wave0/prompts.ts:100-108`
**Issue:** The fallback `return s.trim()` (line 106) returns the raw input string when it has no `@`-handle and is not a valid URL. The comment claims "host-only extraction; never surface full URLs in LLM prompt" but the catch-fallthrough surfaces whatever string was passed in. If a Card 5 reference has a malformed URL like `"see https://tiktok.com/private/info for examples"`, `new URL()` throws, and the catch returns the entire string — leaking the URL anyway. For Card 6 hosts (`tryUrlHost`, line 110-116), invalid URLs at least return `""` (empty string is filtered out by the caller), so the leak is asymmetric.
**Fix:** Be consistent with `tryUrlHost` — return empty string on parse failure, and let the caller filter:

```ts
function extractHandleOrHost(s: string): string {
  const m = s.match(/@([a-zA-Z0-9._]+)/);
  if (m && m[1]) return `@${m[1]}`;
  try {
    return new URL(s).host;
  } catch {
    return ""; // do not surface arbitrary text
  }
}
```

### WR-04: Pipeline test "Wave 0 fires before Wave 1" conditionally skips assertion

**File:** `src/lib/engine/__tests__/pipeline.test.ts:733`
**Issue:** `if (wave1Idx >= 0) expect(w0Idx).toBeLessThan(wave1Idx);` — if `wave1Idx` is not found (returns -1), the ordering check is silently skipped and the test passes regardless. This means the test cannot fail if Wave 1 events stop firing entirely. The test gives a false sense of coverage.
**Fix:** Assert wave1Idx is found, then assert ordering: `expect(wave1Idx).toBeGreaterThan(w0Idx);` (since findIndex returns -1 when not found, the comparison correctly fails). Or use `expect(wave1Idx).toBeGreaterThanOrEqual(0)` as a separate assertion. Currently the test "passes by accident."

### WR-05: Test mock for `@google/genai` in `pipeline.test.ts` omits `Type.BOOLEAN`

**File:** `src/lib/engine/__tests__/pipeline.test.ts:63-68`
**Issue:** The mock provides `Type: { OBJECT, ARRAY, STRING, NUMBER }` but the content-type detector's `RESPONSE_SCHEMA` uses `Type.BOOLEAN` (line 33 of content-type-detector.ts). In `pipeline.test.ts` this happens to be safe because all tests use `input_mode: "text"`, so the detector returns null early and never builds the schema. But if any future test exercises `input_mode: "video_upload"` through the pipeline, schema construction will throw `TypeError: Cannot read property 'BOOLEAN' of undefined`.
**Fix:** Add the missing enum members so the mock is complete:

```ts
Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" },
```

### WR-06: `pre_creator_context` stage labeled as `wave: 1` but runs BEFORE Wave 0

**File:** `src/lib/engine/pipeline.ts:290-294`
**Issue:** The `pre_creator_context` stage is emitted via `timed("pre_creator_context", ..., { wave: 1, onEvent: onStageEvent })` — wave=1 — but it runs sequentially BEFORE `runWave0()` is called. This conflicts with the implicit ordering convention (lower wave numbers fire first). Downstream SSE consumers that group events by `wave` would see a wave-1 event before any wave-0 event, suggesting the ordering is broken when it isn't. The `StageEventWave` enum doesn't include a "pre" tier; the closest correct label would be `wave: 0` (since it's a Wave 0 prerequisite) or introducing a new tier.
**Fix:** Use `wave: 0` for `pre_creator_context` since it semantically belongs to the Wave 0 preparation phase. Update any downstream consumer assumptions accordingly. (No test currently asserts on the wave number of `pre_creator_context`, so this is a forward-looking concern.)

### WR-07: `mockFileDelete` defined but never asserted in `wave0-content-type.test.ts`

**File:** `src/lib/engine/__tests__/wave0-content-type.test.ts:22-27`
**Issue:** The test sets up `mockFileDelete = vi.fn()` and includes it in the mock client (line 27), but no test asserts that delete is actually called. The `finally` block in `content-type-detector.ts:200-208` is responsible for resource cleanup — without test coverage, a future refactor could remove or short-circuit the cleanup, causing Gemini Files API quota leaks (uploaded files persist for 48h by default). Additionally, the test does not exercise the cleanup-on-error path (where upload succeeds but generateContent throws — delete must still fire).
**Fix:** Add explicit assertions:

```ts
it("deletes uploaded file on success path (cleanup)", async () => {
  mockGenerate.mockResolvedValue({ text: JSON.stringify({...}), usageMetadata: {...} });
  await detectContentType(videoPayload);
  expect(mockFileDelete).toHaveBeenCalledWith({ name: "files/abc" });
});

it("deletes uploaded file even when generateContent throws (cleanup-on-error)", async () => {
  mockGenerate.mockRejectedValue(new Error("API error"));
  await detectContentType(videoPayload);
  expect(mockFileDelete).toHaveBeenCalled();
});
```

## Info

### IN-01: Duplicate sub-niche slugs `tutorials` and `hauls` across primaries

**File:** `src/lib/niches/taxonomy.ts:65, 175, 225`
**Issue:** Sub-slugs are scoped to primaries (validated correctly via `getNicheBranches()`), but `tutorials` appears under both `beauty` and `tech-gadgets`, and `hauls` appears under both `beauty` and `lifestyle`. The system prompt at `wave0/prompts.ts:12-15` renders these as comma-separated lists per primary, so the LLM sees the same slug name in multiple contexts. This may cause inconsistent classification (the LLM may not consistently pick the correct primary when the differentiator is only the sub-slug context).
**Fix:** Disambiguate the duplicates: `beauty-tutorials`, `tech-tutorials`, `beauty-hauls`, `lifestyle-hauls`. Or document this as intentional polysemy in the taxonomy comment.

### IN-02: `MULTIPLIER_FLOOR = 0.5` silently clamps the slideshow.pacing_score = 0.5 boundary

**File:** `src/lib/engine/wave0/content-type-weights.ts:25-44`
**Issue:** `slideshow.pacing_score = 0.5` is exactly at `MULTIPLIER_FLOOR`. The clamp `Math.max(0.5, Math.min(1.5, m))` is a no-op for this value, but if a future revision sets it to 0.4 by accident, the clamp silently corrects it to 0.5 — masking the typo. The clamp is "defensive" but also "silent." Consider logging a warning (or asserting in dev) when the raw matrix value falls outside the cap range.
**Fix:** Add a runtime check at module load that validates the matrix is within bounds (would catch matrix edits at module init time, fail loudly):

```ts
for (const [type, mults] of Object.entries(CONTENT_TYPE_WEIGHT_MATRIX)) {
  for (const [signal, m] of Object.entries(mults)) {
    if (m < MULTIPLIER_FLOOR || m > MULTIPLIER_CEILING) {
      throw new Error(`Matrix ${type}.${signal} = ${m} outside [${MULTIPLIER_FLOOR}, ${MULTIPLIER_CEILING}]`);
    }
  }
}
```

### IN-03: Aggregator could simplify content-type matrix application

**File:** `src/lib/engine/aggregator.ts:314-317`
**Issue:** `applyContentTypeWeights` already handles `contentType: null` by using the `"other"` (passthrough) row. The conditional `contentTypeSlug !== null ? applyContentTypeWeights(...) : rawVideoSignals` is redundant — both branches produce identical results. Inlining `applyContentTypeWeights(rawVideoSignals, contentTypeSlug)` would be simpler.
**Fix:**

```ts
const adjustedVideoSignals = rawVideoSignals
  ? applyContentTypeWeights(rawVideoSignals, contentTypeSlug)
  : null;
```

### IN-04: "Matrix does not mutate" test uses spread copy — weaker assertion than needed

**File:** `src/lib/engine/__tests__/aggregator.test.ts:629-635`
**Issue:** The test spreads `originalSignals` into the gemini result (`video_signals: { ...originalSignals }`), then asserts that `pipeline.geminiResult.analysis.video_signals` equals the original after `aggregateScores` runs. Since `{...originalSignals}` is already a copy, mutating either object would not affect the other — the test would pass even if the matrix DID mutate the geminiResult, as long as it didn't reach back to mutate the original `originalSignals` reference. The unit test for `applyContentTypeWeights` ("does not mutate input object") covers the actual contract, so this aggregator test is somewhat redundant. Either tighten the assertion (pass `originalSignals` directly to `video_signals`, then assert `originalSignals` is unchanged) or remove the test since the unit-level test is sufficient.
**Fix:**

```ts
const pipeline = makePipelineResult({
  wave0Result: { content_type: { type: "action", confidence: 0.9 }, niche: null },
  geminiResult: {
    analysis: makeGeminiAnalysis({ video_signals: originalSignals }), // pass directly
    cost_cents: 0.5,
  },
});
await aggregateScores(pipeline);
expect(originalSignals).toEqual({   // assert the original reference is unchanged
  visual_production_quality: 8,
  hook_visual_impact: 8,
  pacing_score: 8,
  transition_quality: 8,
});
```

### IN-05: Parallel orchestrator test relies on a real `setTimeout(r, 10)` to establish ordering

**File:** `src/lib/engine/__tests__/wave0-orchestration.test.ts:101-124`
**Issue:** The test verifies parallelism by setting `contentTypeStarted = true` synchronously, then awaiting a 10ms real-time delay before setting `contentTypeResolved = true`. The niche detector then asserts `contentTypeStarted === true && contentTypeResolved === false`. This relies on real wall-clock time, which can be slow in CI environments and adds noise to test runs. Vitest's fake timers (`vi.useFakeTimers()`) would let you control timing deterministically — though that's tricky for testing parallel awaits. An alternative is to use a resolved promise to yield the event loop without sleeping. Minor — current test is correct, just slower than necessary.
**Fix:** Replace `setTimeout(r, 10)` with `await Promise.resolve()` (yields once to allow microtasks to run) — should be sufficient to verify both promises started before either resolved.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
