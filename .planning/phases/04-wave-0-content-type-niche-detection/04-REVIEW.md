---
phase: 04-wave-0-content-type-niche-detection
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/lib/engine/__tests__/aggregator.test.ts
  - src/lib/engine/__tests__/factories.ts
  - src/lib/engine/__tests__/normalize.test.ts
  - src/lib/engine/__tests__/pipeline.test.ts
  - src/lib/engine/__tests__/stubs.test.ts
  - src/lib/engine/__tests__/video-e2e.test.ts
  - src/lib/engine/__tests__/wave0-content-type.test.ts
  - src/lib/engine/__tests__/wave0-niche-detector.test.ts
  - src/lib/engine/__tests__/wave0-orchestration.test.ts
  - src/lib/engine/normalize.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/types.ts
  - src/lib/engine/wave0.ts
  - src/lib/engine/wave0/content-type-detector.ts
  - src/lib/engine/wave0/niche-detector.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 4 delivers Wave 0 content-type and niche detectors, wires them into the pipeline via `Promise.allSettled` isolation, and adds comprehensive tests. The architecture is sound and the GAP-04-01 storage-key fix is correctly propagated through the entire stack. Three blockers were found: a silent logic failure when environment variables are misconfigured (`parseFloat` producing `NaN` silently disabling the Card 1 fallback and micro-confidence gating), an incomplete `PipelineResult` struct in the video E2E test (stale `creatorContext` shape and missing required `wave0Result`/`wave3Result` fields) that represents a TypeScript type violation, and a `setTimeout` timer leak in `content-type-detector.ts` where failures before the `generateContent` call leave dangling abort timers. Five warnings cover narrower MIME-type coverage than the pipeline, module-level singleton client state shared across test files, missing `globalThis.fetch` cleanup in a test, a fragile ordering assertion, and a missing `#` prefix on hashtags in the E2E fixture.

---

## Critical Issues

### CR-01: `parseFloat` of malformed env var produces `NaN`, silently disabling Card 1 fallback

**File:** `src/lib/engine/wave0/niche-detector.ts:26-27`

**Issue:** `CONFIDENCE_THRESHOLD` and `MICRO_THRESHOLD` are computed at module load time via `parseFloat(process.env.NICHE_CONFIDENCE_THRESHOLD ?? "0.6")`. When the env var is set to any non-numeric string (`""`, `"off"`, `"0,6"`), `parseFloat` returns `NaN`. All comparisons against `NaN` evaluate to `false` in JavaScript, so `result.confidence < NaN` is always `false`. The consequences are:

1. Card 1 fallback at line 136 never triggers, regardless of AI confidence level.
2. Micro-nulling at line 131 never triggers, allowing low-confidence micro niches to pass through.

The failure is completely silent: the code compiles, unit tests pass (they rely on the default `"0.6"` string), and no exception is raised. The only symptom is wrong product behavior in a misconfigured deployment.

**Fix:**
```typescript
function parseThreshold(envValue: string | undefined, defaultValue: number): number {
  if (envValue === undefined) return defaultValue;
  const parsed = parseFloat(envValue);
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(
      `Invalid threshold env var value: "${envValue}" — expected a number in [0, 1]`
    );
  }
  return parsed;
}

const CONFIDENCE_THRESHOLD = parseThreshold(process.env.NICHE_CONFIDENCE_THRESHOLD, 0.6);
const MICRO_THRESHOLD = parseThreshold(process.env.NICHE_MICRO_CONFIDENCE_THRESHOLD, 0.6);
```

---

### CR-02: `video-e2e.test.ts` constructs `PipelineResult` with stale `CreatorContext` shape and missing required fields

**File:** `src/lib/engine/__tests__/video-e2e.test.ts:335-351`

**Issue:** The manually assembled `PipelineResult` object at lines 318-351 has two distinct structural problems:

1. **Stale `creatorContext` shape (lines 335-339):** The object literal uses `{ handle: null, historicalPerformance: null, contentPatterns: null }`. These keys do not exist on the current `CreatorContext` interface (which requires `found: boolean`, `follower_count`, `niche_primary`, `platform_averages`, etc.). This is a TypeScript type violation. At runtime when `aggregateScores` reads `creatorContext.found`, `creatorContext.niche_primary`, etc., it will silently get `undefined` instead of the expected types, causing incorrect downstream behavior in the aggregator.

2. **Missing required `wave0Result` and `wave3Result` fields:** `PipelineResult.wave0Result` and `PipelineResult.wave3Result` are non-optional required fields (defined at `pipeline.ts:51-52`). The object literal at line 318 omits both. This is a compile-time error that is hidden because the test suite skips execution when API keys are absent (the `describe.skipIf` at line 193), meaning these structural errors are never surfaced by the CI test runner.

**Fix:**
```typescript
const pipelineResult: PipelineResult = {
  payload: { /* ... */ },
  geminiResult: { analysis: geminiAnalysis, cost_cents: geminiResult.cost_cents },
  creatorContext: {
    found: false,
    follower_count: null,
    avg_views: null,
    engagement_rate: null,
    niche: null,
    posting_frequency: null,
    platform_averages: {
      avg_views: 50000,
      avg_engagement_rate: 0.06,
      avg_share_rate: 0.008,
      avg_comment_rate: 0.005,
    },
    // ... all other required CreatorContext fields (use DEFAULT_CREATOR_CONTEXT from pipeline.ts)
  },
  ruleResult: defaultRules,
  trendEnrichment: defaultTrends,
  deepseekResult,
  audioResult: null,
  wave0Result: { content_type: null, niche: null },  // add missing field
  wave3Result: [],                                     // add missing field
  requestId: "video-e2e-test",
  timings: [ /* ... */ ],
  total_duration_ms: Math.round(geminiLatency + deepseekLatency),
  warnings: [],
};
```

---

### CR-03: `AbortController` `setTimeout` handle is never cleared when storage download or upload fails

**File:** `src/lib/engine/wave0/content-type-detector.ts:143-170`

**Issue:** The `AbortController` and its associated `setTimeout` are created at line 143-144 inside the outer `try` block, but `clearTimeout` is only called inside the inner `try/finally` at lines 147-170 that wraps `generateContent`. If any code between line 98 (the outer `try` start) and line 147 (the inner `try` start) throws — specifically: the storage download at line 106, buffer construction at line 117, `ai.files.upload` at line 122, or the file-state polling loop at lines 128-138 — the outer `catch` at line 210 is entered, `null` is returned, and the `setTimeout` handle from line 144 is never cleared.

The `abort()` fires 20 seconds later against an `AbortController` with no active `fetch`/`generateContent` attached, which is functionally harmless. However, in a long-lived server process handling many failed video downloads or upload failures, this accumulates live `setTimeout` handles and their closures, leaking memory proportional to the error rate.

**Fix:** Move the `AbortController`/timeout setup to immediately before the inner `generateContent` call, or track and clear in the outer `finally`:

```typescript
let timeout: ReturnType<typeof setTimeout> | undefined;
let uploadedFileName: string | undefined;

try {
  // ... storage download, buffer, blob, upload, poll ...

  const controller = new AbortController();
  timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await ai.models.generateContent({ /* ... */ });
  } finally {
    clearTimeout(timeout);
    timeout = undefined;
  }
  // ... success path ...
} catch (error) {
  // ... error handling ...
} finally {
  if (timeout !== undefined) clearTimeout(timeout); // safety net for early throws
  // ... file cleanup ...
}
```

---

## Warnings

### WR-01: `content-type-detector.ts` MIME type mapping is narrower than `pipeline.ts`

**File:** `src/lib/engine/wave0/content-type-detector.ts:118-119`

**Issue:** The detector maps file extensions to MIME types with only two entries: `mov` → `video/quicktime`, everything else → `video/mp4`. The pipeline's `EXT_TO_MIME` at `pipeline.ts:324-330` correctly handles `mp4`, `mov`, `webm`, `avi`, `mkv`. A `.webm` file uploaded by a user will be sent to Gemini with `Content-Type: video/mp4`, which Gemini may reject or misprocess. The inconsistency silently corrupts Wave 0 classification for non-mp4 formats while Wave 1 handles them correctly.

**Fix:** Extract a shared `EXT_TO_MIME` constant (or import the one from `pipeline.ts`):
```typescript
const EXT_TO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
};
const mimeType = EXT_TO_MIME[ext] ?? "video/mp4";
```

---

### WR-02: Module-level singleton clients leak across test files

**File:** `src/lib/engine/wave0/content-type-detector.ts:59-67` and `src/lib/engine/wave0/niche-detector.ts:31-39`

**Issue:** Both detectors cache their API clients in module-level `let client` variables. `vi.clearAllMocks()` in `beforeEach` resets mock *call history and return values* but does not reset module-level variables. When Vitest runs multiple test files in the same worker (the default with `--poolOptions.threads.singleThread` or when files share a module registry), the `client` cached by one test file persists into subsequent files.

Concretely: `wave0-content-type.test.ts:46` sets `process.env.GEMINI_API_KEY = "test-key"` and triggers `getClient()` on first import. Any subsequent test file that expects `getClient()` to throw (testing the missing-key error path) will instead receive the already-cached client and silently succeed. This is a test isolation bug that can cause false passes depending on test file execution order.

**Fix:** Export a `resetClientForTesting()` function from each detector and call it in `afterEach` in test files that need isolation, or refactor the detectors to accept the client as a parameter (dependency injection) to avoid module-level state entirely.

---

### WR-03: `video-e2e.test.ts` `globalThis.fetch` override not restored within the test body

**File:** `src/lib/engine/__tests__/wave0-content-type.test.ts:183-200`

**Issue:** The GAP-04-01 regression test at line 183 assigns `globalThis.fetch = fetchSpy` mid-test. There is an `afterAll` at line 244 that eventually restores `globalThis.fetch = originalFetch`, but any test in the same suite that runs *after* this test and *before* the suite teardown will see `fetchSpy` as the live `fetch`. The suite is currently small enough that no other test invokes `fetch`, but this is a fragile pattern that will cause incorrect behavior if the suite grows.

**Fix:** Restore within the test, not in `afterAll`:
```typescript
it("GAP-04-01 regression: downloads via supabase.storage...", async () => {
  const fetchSpy = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response));
  const saved = globalThis.fetch;
  globalThis.fetch = fetchSpy;
  try {
    const result = await detectContentType(videoPayload, mockSupabaseClient);
    expect(result?.type).toBe("talking_head");
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^user-abc\//));
  } finally {
    globalThis.fetch = saved;
  }
});
```

---

### WR-04: `wave0-orchestration.test.ts` "Wave 0 fires before Wave 1" assertion can silently pass when Wave 1 is absent

**File:** `src/lib/engine/__tests__/pipeline.test.ts:743`

**Issue:** The ordering assertion at line 743 reads:
```typescript
expect(wave1Idx).toBeGreaterThanOrEqual(0); // WR-04 fix: fail honestly if Wave 1 stops firing
expect(w0Idx).toBeLessThan(wave1Idx);       // ordering invariant
```

The comment documents this was already a known weakness and a fix was applied. Reading the actual test more carefully, `wave1Idx` is found by a filter that excludes `pre_creator_context`, `creator_context`, `validate`, `normalize`, and `wave_1` stage names — it looks for the *first Wave 1 sub-stage event* (not the `wave_1` wrapper event itself). If Wave 1 sub-stages all have names that match the exclusion list, `wave1Idx` will be -1 and `expect(-1).toBeGreaterThanOrEqual(0)` will correctly fail — this is fine.

However, in the Phase 4 setup where `wave_1` sub-stages include `gemini_analysis`, `audio_analysis`, `creator_context`, `rule_scoring`, the first match found by `findIndex` where `e.wave === 1` AND stage is not in the exclusion list would be `gemini_analysis`. If Gemini is failing silently (returning `DEFAULT_GEMINI_RESULT`), the stage event still fires — so this path is adequately covered. No blocker here, but the filter logic is fragile and would benefit from a comment explaining which stage name it expects to match.

**Fix (low urgency):** Replace the multi-condition `findIndex` with an explicit assertion against a known Wave 1 stage:
```typescript
const geminiIdx = events.findIndex(
  (e) => e.type === "stage_start" && e.stage === "gemini_analysis",
);
expect(geminiIdx).toBeGreaterThanOrEqual(0);
expect(w0Idx).toBeLessThan(geminiIdx);
```

---

### WR-05: `video-e2e.test.ts` hardcodes `hashtags` without `#` prefix, diverging from `normalizeInput` output

**File:** `src/lib/engine/__tests__/video-e2e.test.ts:325`

**Issue:** The manually constructed `ContentPayload.hashtags` at line 325 is `["comedy", "funny", "skit", "viral"]` — missing the `#` prefix that `normalizeInput` always prepends. The `normalize.test.ts` tests confirm hashtags are stored as `["#viral", "#trending"]`. Any downstream consumer that processes hashtags (trend matching, hashtag relevance scoring in the aggregator) will silently find no matches because the strings don't match the `#`-prefixed format. The E2E test is therefore exercising a data shape that cannot occur in production, undermining its validity as an integration test.

**Fix:**
```typescript
hashtags: ["#comedy", "#funny", "#skit", "#viral"],
```

---

## Info

### IN-01: `ContentPayload.content_type` typed as `string` rather than the validated enum union

**File:** `src/lib/engine/types.ts:93`

**Issue:** `AnalysisInputSchema` validates `content_type` as `z.enum(["post", "reel", "story", "video", "thread"])` at line 68, but `ContentPayload.content_type` is typed as `string` (line 93). After `normalizeInput` the type constraint is lost. Code that pattern-matches on `payload.content_type` does not benefit from TypeScript's exhaustiveness checking. A future arm on `content_type` values that misses a case silently falls through.

**Fix:**
```typescript
export interface ContentPayload {
  content_type: "post" | "reel" | "story" | "video" | "thread";
  // ...
}
```

---

### IN-02: Hardcoded machine-specific absolute path in `video-e2e.test.ts`

**File:** `src/lib/engine/__tests__/video-e2e.test.ts:158-159`

**Issue:** `VIDEO_PATH` is hardcoded to `/Users/davideloreti/virtuna-v1.1/ssstik.io_@agentoflaughter_1771597963788.mp4`. This path is specific to one developer's machine. On any other machine or in CI, the test skips silently because `hasGeminiKey` or `hasDeepSeekKey` will be false — but if both keys are present in CI (e.g., in a staging environment), the test will fail with a cryptic file-not-found error rather than a clear "fixture missing" message. The path also references a deleted worktree (`virtuna-v1.1`).

**Fix:**
```typescript
const VIDEO_PATH = process.env.E2E_VIDEO_PATH
  ?? "/Users/davideloreti/virtuna-v1.1/ssstik.io_@agentoflaughter_1771597963788.mp4";
const hasVideoFile = !!VIDEO_PATH && existsSync(VIDEO_PATH);

describe.skipIf(!hasGeminiKey || !hasDeepSeekKey || !hasVideoFile)(
  "Video E2E — Gemini + DeepSeek + Aggregation",
  () => { /* ... */ }
);
```

---

### IN-03: Module-level `log` in `wave0.ts` has no `requestId` — log lines unattributable under concurrency

**File:** `src/lib/engine/wave0.ts:10`

**Issue:** `const log = createLogger({ module: "wave0" })` creates a module-level logger with no `requestId`. Unlike `pipeline.ts` which constructs a per-request logger with `requestId`, all Wave 0 log lines will be emitted without request correlation. Under concurrent requests in production, multiple `runWave0` invocations will interleave log lines with no way to attribute them to specific requests.

**Fix:** Accept an optional `requestId` parameter and create the logger per-invocation:
```typescript
export async function runWave0(
  payload: ContentPayload,
  supabase: SupabaseClient,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
  requestId?: string,
): Promise<Wave0Result> {
  const log = createLogger({ module: "wave0", requestId });
  // ...
}
```
(Pipeline.ts would pass `requestId` when calling `runWave0`.)

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
