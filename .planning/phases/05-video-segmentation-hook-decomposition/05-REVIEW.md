---
phase: 05-video-segmentation-hook-decomposition
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/lib/engine/aggregator.ts
  - src/lib/engine/gemini.ts
  - src/lib/engine/gemini/cost.ts
  - src/lib/engine/gemini/prompts.ts
  - src/lib/engine/gemini/schemas.ts
  - src/lib/engine/gemini/hook-segment.ts
  - src/lib/engine/gemini/body-segment.ts
  - src/lib/engine/gemini/cta-segment.ts
  - src/lib/engine/gemini/merge.ts
  - src/lib/engine/gemini/segmented.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/types.ts
  - src/lib/engine/__tests__/gemini-schemas.test.ts
  - src/lib/engine/__tests__/gemini-types-widening.test.ts
  - src/lib/engine/__tests__/gemini-hook-segment.test.ts
  - src/lib/engine/__tests__/gemini-merge.test.ts
  - src/lib/engine/__tests__/gemini-segmented.test.ts
  - src/lib/engine/__tests__/gemini-segmented-integration.test.ts
  - src/lib/engine/__tests__/aggregator-cta-penalty.test.ts
  - src/lib/engine/__tests__/gemini-eval-alignment.test.ts
findings:
  critical: 4
  warning: 9
  info: 6
  total: 19
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 19 (10 source + 8 test + 2 spec references)
**Status:** issues_found

## Summary

Phase 5 ships a sophisticated segmented video analysis architecture with strong contract discipline (D-01 through D-16 lock points are largely honored). The merge module handles all 8 partial-failure permutations correctly; the per-segment AbortController pattern is correctly implemented; CTA-penalty matrix is pure-function clean; tests are comprehensive (~80+ test cases across 8 files).

However, several non-trivial correctness defects must be addressed before this code ships:

- **CR-01** — The polling loop in `segmented.ts` is infinite-loopable: if Files API returns an unrecognized state (anything that's not `PROCESSING`, `ACTIVE`, or `FAILED`), the loop exits but no error is thrown, and `fileUri` may be a stale/empty value that causes downstream segment failures with no actionable error.
- **CR-02** — Body segment retry logic does not reset the AbortController between attempts. If the first `generateContent` call burns half the 30s timeout on transient errors, the retry runs against an AbortController that fires mid-flight, guaranteeing failure. CTA segment has the identical bug.
- **CR-03** — The wave 0 detector emits a `gemini_video_analysis`-equivalent prompt that includes `visual_production_quality` AND the wave 0 prompt may use the Gemini SDK in ways that the segment router cannot disambiguate, but more critically, the segment router (test side) routes wave 0 calls to `wave0_ct` only by exclusion — there is no positive identifier, so the test coverage of "exactly 3 segment calls" is brittle and silently passes if wave 0 prompts evolve.
- **CR-04** — `applyContentTypeWeights` is invoked on Gemini results regardless of whether `signalAvailability.gemini_body` is `false`. After 3-of-3 segment failure, the aggregator runs the content-type weight matrix over the structural-zero `video_signals` (because `DEFAULT_GEMINI_RESULT` is used), which silently feeds non-zero adjusted signals into the ML feature vector when `applyContentTypeWeights` has any non-1.0 multiplier.

Several WARNINGS document defensive-coding gaps, ordering risks, retry-vs-timeout edge cases, and contract drift between the schema enums and the CTA-penalty matrix that will eventually misfire.

## Critical Issues

### CR-01: `segmented.ts` polling loop does not validate non-{PROCESSING,ACTIVE,FAILED} states

**File:** `src/lib/engine/gemini/segmented.ts:108-131`
**Issue:** The polling loop exits as soon as `fileState !== "PROCESSING"`. If Gemini returns any unexpected state (`"PENDING"`, `"UNKNOWN"`, `null`, `undefined`, `""`), the loop terminates without invoking the FAILED branch and without verifying ACTIVE. The subsequent `if (!fileUri)` check is the only safety net, but `fileUri` may have been populated by the upload response even for a non-ACTIVE state. The three parallel `generateContent` calls then fire against a file that is not actually ready, producing 3-of-3 failures with cryptic 503/404 errors instead of an explicit `Video processing did not reach ACTIVE state` error.

Compare to legacy `analyzeVideoWithGemini` (gemini.ts:473-488) — it has the identical bug. Phase 5 should have fixed the inherited pattern.

**Fix:**
```ts
while (fileState === "PROCESSING") {
  // ...existing logic...
}
if (fileState === "FAILED") { /* existing throw */ }
if (fileState !== "ACTIVE") {
  throw new Error(
    `Video processing returned unexpected state "${fileState ?? "<undefined>"}". Expected ACTIVE.`
  );
}
if (!fileUri) { /* existing throw */ }
```

This converts a 3-segment cascade into a single actionable upstream error and removes a tail-latency tarpit (a sticky non-PROCESSING state would otherwise burn the full 30s × 3 segment timeouts before producing a useless 3-of-3 failure).

### CR-02: `body-segment.ts` + `cta-segment.ts` retry uses the same already-counting-down AbortController across attempts

**File:** `src/lib/engine/gemini/body-segment.ts:64-100` (and `cta-segment.ts:64-100` — identical bug)
**Issue:** The `for (let attempt = 0; attempt <= BODY_MAX_RETRIES; attempt++)` retry loop is *inside* the outer try/finally that owns the single `setTimeout(...,BODY_TIMEOUT_MS)`. If the first attempt fails Zod validation after, say, 18 seconds of generation time, the retry inherits 12 seconds of remaining timeout budget — and worse, if the first attempt fails near or after the timeout fires (`controller.abort()` already invoked), the retry's `generateContent` call passes an already-aborted `controller.signal` and rejects synchronously with AbortError.

Code path proof:
1. attempt=0: Zod fails after 18s (network slow + invalid schema). `lastError` set.
2. The `continue` flows back into the for-loop. AbortController is unchanged.
3. attempt=1: `await ai.models.generateContent({ ..., abortSignal: controller.signal })` — if abort already fired in step 1 (timeout was 30s but a slow first call could trip it on retry), this call rejects with AbortError immediately.
4. Even when not aborted, the retry has less than half the budget to complete a fresh round-trip.

The hook segment does NOT have this bug because it does not retry. The bodily impact is that under load (when retries are most needed), body+CTA retries fail at higher rates than the no-retry path.

**Fix:** Move the AbortController + setTimeout creation INSIDE the retry loop so each attempt gets its own fresh budget:
```ts
for (let attempt = 0; attempt <= BODY_MAX_RETRIES; attempt++) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BODY_TIMEOUT_MS);
  try {
    // ...generateContent...
  } finally {
    clearTimeout(timeout);
  }
}
```
Pull the existing outer try/catch envelope outside the loop boundary if needed for the Sentry tag, but per-attempt controllers are the correctness contract. Apply the identical fix to `cta-segment.ts`.

### CR-03: `applyContentTypeWeights` adjusts structural-zero `video_signals` after 3-of-3 segment failure

**File:** `src/lib/engine/aggregator.ts:365-371` + `src/lib/engine/pipeline.ts:408-413`
**Issue:** When `analyzeVideoSegmented` returns `{ analysis: null, ... }` (3-of-3 failure), `pipeline.ts:408-413` returns `{ ...DEFAULT_GEMINI_RESULT, signalAvailability }`. The aggregator at line 367-371 reads `geminiResult.analysis.video_signals` — but `DEFAULT_GEMINI_RESULT.analysis` (defined in pipeline.ts:181-220) has NO `video_signals` key. `geminiResult.analysis.video_signals` is therefore `undefined`, so `rawVideoSignals = undefined ?? null = null` and `applyContentTypeWeights` is correctly skipped.

But: when only the HOOK fails (FHH path), `mergeSegments` returns an `analysis` object with `video_signals: { ..., hook_visual_impact: 0, ... }` — the structural zero null-fill. The aggregator then routes that into `applyContentTypeWeights(rawVideoSignals, contentTypeSlug)`, multiplying the structural zeros by the content-type multipliers. The result is a `video_signals` object whose `hook_visual_impact` is `0 × multiplier = 0` (harmless), but where every signal has been adjusted by a matrix designed for real Gemini scores. The FeatureVector consumer reads these *as-if* Gemini scored them.

The fix is small but the audit surface is large: the aggregator must check the per-segment `signalAvailability.gemini_body` / `gemini_hook` flags AND degrade `video_signals.{visual_production_quality,pacing_score,transition_quality}` to `null` when the segment is unavailable. The current `?? null` does not catch this because structural-zero null-fill yields a literal `0`, not `null`. Tests only assert pure-function `applyCtaPenalty` math, not the FeatureVector contamination path.

**Fix:**
```ts
// Build a body-availability-aware video_signals so structural-zero null-fill
// from mergeSegments does not flow into the ML feature vector.
const segAvailability = pipelineResult.geminiResult.signalAvailability;
const rawVideoSignals = (() => {
  const vs = geminiResult.analysis.video_signals ?? null;
  if (!vs) return null;
  // Structural zeros from FHH/FHF/FFH null-fill must not be weighted.
  if (segAvailability && !segAvailability.gemini_body) {
    return {
      ...vs,
      visual_production_quality: null,
      pacing_score: null,
      transition_quality: null,
    } as unknown as GeminiVideoSignals; // FeatureVector handles null per types.ts:27-30
  }
  if (segAvailability && !segAvailability.gemini_hook) {
    return { ...vs, hook_visual_impact: null } as unknown as GeminiVideoSignals;
  }
  return vs;
})();
```
The cleaner long-term fix is to widen `GeminiVideoSignalsSchema` fields to `z.number().nullable()` and have `mergeSegments` emit `null` instead of `0` when a segment fails — but that's a larger schema change. The above is the minimum-surface defensive fix that preserves the existing FHH/HFF test fixtures.

### CR-04: `CTA_PENALTY_POINTS` references unsupported content-type slug; D-06 contract drift

**File:** `src/lib/engine/aggregator.ts:69-73` + `src/lib/engine/types.ts:297-305`
**Issue:** The D-06 penalty matrix in CONTEXT D-06 lists `comedy` as a neutral content type. `ContentTypeEnumSchema` at `types.ts:297-305` does NOT include `comedy`. The `aggregator-cta-penalty.test.ts:124-127` Test 5 calls `applyCtaPenalty(70, "comedy", ctaPresentFalse())` expecting `70` — which works *only* because the function accepts `contentTypeSlug: string | null` (NOT typed `ContentTypeSlug | null`).

Two consequences:
1. **Type safety lost at boundary:** `applyCtaPenalty` signature is `(geminiScore, contentTypeSlug: string | null, ...)`. The aggregator's caller at line 463-467 passes `contentTypeSlug` (which IS typed `ContentTypeSlug | null`), but the function accepts any string. Future drift in the enum (Phase 4 deferred item: add `dance` as 8th type) silently bypasses the penalty.
2. **CONTEXT D-06 contradicts types.ts:** D-06 lists `comedy` neutral as documentation contract. `ContentTypeEnumSchema` does not allow it. If Wave 0 returns `comedy` (per a future fix), the aggregator will accept it; if the enum is hardened first, the route will reject `comedy` from Wave 0 with a Zod parse error.

Plus a smaller bug: the `aggregator-cta-penalty.test.ts:209-211` buildPipelineResult signature accepts `"comedy"` as a content-type-slug type-literal, but `Wave0ContentTypeResultSchema` rejects `comedy` at Zod parse time. Test 5 only "passes" because `makePipelineResult` does NOT route the wave0Result through `Wave0ResultSchema.parse(...)` — so production code that does run the parse will reject this fixture shape.

**Fix:** Either:
- (A) Add `comedy` to `ContentTypeEnumSchema` (small risk: production Wave 0 hasn't seen the prompt enumerate "comedy" before — check `wave0/content-type-detector.ts` prompts before doing this), AND keep `applyCtaPenalty` accepting `ContentTypeSlug | null` (narrow the parameter type so future drift is a compile error); OR
- (B) Remove `comedy` from the D-06 penalty matrix documentation and the test fixture, treating it as "fold into `other`" for D-06 purposes.

Strongly prefer (A) — the locked CONTEXT D-06 decision explicitly contains comedy.

## Warnings

### WR-01: `cost.ts` silently falls back to Flash-preview pricing on unknown models

**File:** `src/lib/engine/gemini/cost.ts:41`
**Issue:** `PRICING[model] ?? PRICING["gemini-3-flash-preview"]!` does NOT log or telemetry-emit when the model is unknown. Production model changes (e.g., flipping `GEMINI_HOOK_MODEL=gemini-3.2-pro-preview` when 3.2 ships) will silently bill at Flash rates, under-counting cost by ~13× exactly as Pitfall #9 warned in research. The fallback was intentional (per the file docstring) but should at least emit a `pipeline_warning` or `log.warn`.

**Fix:**
```ts
const knownModel = PRICING[model];
if (!knownModel) {
  // Logging to a logger not available here — return a typed sentinel and
  // surface via the segment helper's onStageEvent callback instead.
  // OR: import the logger at module scope and log here.
  console.warn(`[gemini/cost] Unknown model "${model}" — using gemini-3-flash-preview pricing as safe default. Production cost will be under-counted if this is a Pro model.`);
}
const rates = knownModel ?? PRICING["gemini-3-flash-preview"]!;
```

### WR-02: Hook segment has no retry, but body + CTA each retry once — silent inconsistency

**File:** `src/lib/engine/gemini/hook-segment.ts:30-78` vs. `body-segment.ts:41` + `cta-segment.ts:41`
**Issue:** `HOOK_MAX_RETRIES` is implicit zero (no constant defined), while `BODY_MAX_RETRIES = 1` and `CTA_MAX_RETRIES = 1`. The hook is the most expensive call (Pro, ~1.3¢) and the most schema-critical (10 fields incl. weakest_modality + 5 factors + decomp); a Zod-validation flake on a transient model output produces a permanent FHH (hook-failed) result with zero gemini factors. Per AI-SPEC §4b cost budget the rationale was "Flash retries are cheap" — but Hook is ALSO ~1.3¢ per re-call, which is well inside the soft cap. Either retry hook once on Zod failure, OR explicitly document why hook is intentionally retry-less.

**Fix:** Add a 1-attempt retry guard to hook-segment.ts on Zod-parse failure only (NOT on AbortError, NOT on transport errors — preserves the "no exponential backoff at this latency" pattern). The retry should be Zod-failure-conditional only:
```ts
const result = HookSegmentZodSchema.safeParse(parsed);
if (!result.success) {
  if (attempt === 0) {
    // One corrective retry, only on Zod failure (model produced malformed JSON).
    lastError = ...; continue;
  }
  throw new Error(`Hook segment Zod validation failed: ${result.error.message}`);
}
```
Apply at the planner-locked boundary; keep `MAX_RETRIES = 0` if D-15 prompt iteration is sufficient.

### WR-03: `mergeSegments` `validateRationaleConsistency` regex false-positives on plausible content

**File:** `src/lib/engine/gemini/merge.ts:284-299` (`ABSENT_TEXT_PATTERNS` etc.)
**Issue:** The regex `\bsilent (?:hook|opening|video)\b` matches "silent video" but also matches "the silent video movement is huge in this niche" — a legitimate rationale describing trending content. Similarly `\bat the end\b` matches "the punchline at the end of the hook" (within the first 5s). These false positives generate noisy `pipeline_warning` events that pollute the F8/F9 flywheel signal (AI-SPEC §7 M9/M10).

**Fix:** Narrow the regex set to clauses that ONLY appear in the failure-mode language, e.g.:
```ts
const ABSENT_SPEECH_PATTERNS: RegExp[] = [
  /\bno (?:spoken|verbal) (?:words?|content|opening)\b/i,
  /^silent (?:hook|opening|video)\b/i,             // anchor or require strong precedent
  /(?:hook|opening) is silent\b/i,
  /\bno (?:speech|narration|voiceover|dialogue)\b/i,
];
// Drop the bare "\bat the end\b" — too generic; replace with:
const TEMPORAL_DRIFT_PATTERNS: RegExp[] = [
  /\blater in the video\b/i,
  /\bafter the (?:hook|5 seconds?|5s)\b/i,
  /\bat the (?:very )?end of the video\b/i,
  /\b(?:[6-9]|[1-9]\d+)s\b/i,                       // existing
];
```
Add Vitest coverage for the false-positive sentence shapes before deploying. Phase 12's LLM-judge layer is the real fix; this is the floor-pass.

### WR-04: `segmented.ts` skipBody event-suppression wrapper drops *legitimate* concurrent body failures

**File:** `src/lib/engine/gemini/segmented.ts:182-203`
**Issue:** When `skipBody=true`, the wrapping callback suppresses ANY `pipeline_warning` event with `stage === "gemini_body"`. But the synthetic `{ ok: false, error: "body skipped" }` is the ONLY body-related event source in the skip-branch path. If a future change adds a different body-related warning emitter (e.g., from `mergeSegments` for a cost-cap edge case attributed to body's 0 cost), it would be silently swallowed. The wrapper is correct for the current scope but is a near-future footgun — the suppression logic should match the specific "skipped (short video ≤ 8s)" message instead of the broad `stage === "gemini_body"`.

**Fix:**
```ts
const onStageEventForMerge: StageEventCallback | undefined = skipBody
  ? (event) => {
      const isSkipWarning =
        event.type === "pipeline_warning" &&
        event.stage === "gemini_body" &&
        event.message.includes("unavailable"); // mergeSegments emits this exact string
      if (isSkipWarning) {
        log.info("Body segment skipped (short video ≤ 8s)", {
          durationSeconds: opts.durationSeconds,
        });
        return;
      }
      opts.onStageEvent?.(event);
    }
  : opts.onStageEvent;
```
This preserves cost-cap warnings that happen to carry `stage: "gemini_body"` from `mergeSegments`. Edge but real.

### WR-05: Body window at exactly 8s (`SHORT_VIDEO_THRESHOLD_SEC` boundary) inverts CTA window math

**File:** `src/lib/engine/gemini/segmented.ts:147` + `cta-segment.ts:67-70`
**Issue:** `skipBody = opts.durationSeconds <= SHORT_VIDEO_THRESHOLD_SEC` (≤ 8). For `durationSeconds = 8`, body is skipped. CTA window for 8s: `startOffset = max(5, 8-3) = 5s`, `endOffset = 8s`. Hook window is `0s → 5s`. So at exactly 8s, hook+CTA cover the entire video edge-to-edge with no body — correct.

But for `durationSeconds = 9`, body runs: body window is `5s → max(5, 9-3) = 6s` (1-second body), CTA window is `max(5, 9-3) = 6s → 9s`. A 1-second body window is at the limit of what Gemini Flash can meaningfully analyze for "pacing rhythm" / "transition quality" — the rubric explicitly references the three-beat rule which requires ≥ 3-4s of footage. The model will hallucinate scores for a body window that's too short to score.

Recommend raising the body-skip threshold to 11s OR clamping the body window to `endOffsetSec = max(8, duration-3)` so a 9s video gets `body: 5s → 8s` (3-second window — the minimum the rubric can score).

**Fix:**
```ts
const SHORT_VIDEO_THRESHOLD_SEC = 10; // body skip when ≤ 10s to ensure ≥ 3s body window
// OR keep threshold and clamp:
const endOffsetSec = Math.max(Math.max(5, opts.durationSeconds - 3), 8); // ensure ≥ 3s window
```
Either direction is acceptable; both eliminate the sub-3s body window problem. Document the rationale in CONTEXT D-08 + the helper docstring.

### WR-06: `Promise.allSettled` ordering invariant is fragile; tests use prompt-routing as a workaround

**File:** `src/lib/engine/__tests__/gemini-segmented.test.ts:166-198` + `gemini-segmented-integration.test.ts:249-277`
**Issue:** Tests route mock responses to the right segment by inspecting prompt text via `segmentOf()`. The routing logic relies on `prompt.contains("Scroll-Stop Power")` for hook, `prompt.contains("cta_present")` for CTA, and falls through to body. If a future prompt edit moves "Scroll-Stop Power" into the body prompt (it's not impossible — body prompts could discuss factor-level rubrics), all hook calls get routed to body. This is a maintenance hazard and an early sign that the tests aren't asserting via the orchestrator-level contract.

The cleaner fix is to add an internal marker to each prompt (e.g. a HTML-comment-style `<!-- SEGMENT: hook -->`) OR to introspect the `videoMetadata.startOffset` to disambiguate (`"0s"` = hook, `"5s"` = body, anything else = CTA). The latter is more reliable.

**Fix:** Replace `segmentOf` body with:
```ts
function segmentOf(call: { contents?: ... }): Segment {
  const part = call.contents?.[0]?.parts?.[1];
  const startOffset = (part as { videoMetadata?: { startOffset: string } })?.videoMetadata?.startOffset;
  if (startOffset === "0s") return "hook";
  if (startOffset === "5s") return "body";
  return "cta"; // startOffset > 5s
}
```

### WR-07: `validateRationaleConsistency` only runs on hook segment, never on CTA — D-15 contract gap

**File:** `src/lib/engine/gemini/merge.ts:255-257`
**Issue:** D-15 (rationale-vs-score consistency) per AI-SPEC §6 G7 lists the consistency check as covering "for every Zod-parsed segment." The current implementation only fires on the hook segment. CTA has its own rationale-vs-presence invariant that could drift (e.g., rationale says "creator clearly says follow" while `cta_present=false`). The Zod `.refine` catches structural mismatches but not semantic ones.

This is technically aligned with the implementation comment ("hook segment" passed in), but the AI-SPEC D-15 dimension is broader. Either narrow the AI-SPEC dimension to hook-only, or add a CTA consistency check (e.g., regex for "no", "absent", "missing" + `cta_present === true` → flag).

**Fix:** Add CTA arm to `mergeSegments`:
```ts
if (ctaOk && ctaValue) {
  const r = ctaValue.analysis.rationale.toLowerCase();
  const claimsAbsence = /\b(?:no |missing|absent|did not|doesn't|isn't|isn[’']t)\b/.test(r);
  if (ctaValue.analysis.cta_present && claimsAbsence) {
    onStageEvent?.({
      type: "pipeline_warning",
      message: `CTA rationale claims absence but cta_present=true: "${ctaValue.analysis.rationale}"`,
      stage: "rationale_inconsistency",
    });
  }
}
```

### WR-08: `pipeline.ts` falls back to 30s when `payload.duration_hint` is null — silent regression for short videos

**File:** `src/lib/engine/pipeline.ts:398-400`
**Issue:** `durationSeconds: payload.duration_hint ?? 30`. When the video has no upstream duration metadata (text mode would never reach this branch, but `video_upload` mode could plausibly have a null duration), the orchestrator runs the body segment + CTA window math as if the video is 30s. A real 6-second short video without duration metadata will:
1. NOT skip body (`30 > 8`).
2. Body window = `5s → 27s` (well beyond the 6-second video — Gemini will return empty/garbage scores).
3. CTA window = `27s → 30s` (also beyond the video).

The result is a HHH-looking response with completely fabricated body+CTA scores. This is silently wrong, not just degraded.

**Fix:** When `duration_hint` is null, EITHER fall back to the legacy `analyzeVideoWithGemini` path (single-call, no segmentation) OR refuse to segment and emit a `pipeline_warning`. Falling back to single-call is the most aligned with D-11.
```ts
if (validated.input_mode === "video_upload" && validated.video_storage_path) {
  if (payload.duration_hint == null) {
    log.warn("video_upload missing duration_hint — falling back to legacy analyzeVideoWithGemini path");
    // ...invoke legacy path...
  }
  // ...segmented path...
}
```
Or extract video duration server-side before the pipeline runs — but that's a larger fix.

### WR-09: AbortController not properly threaded through retry catch path in body/cta segments

**File:** `src/lib/engine/gemini/body-segment.ts:145-148` + `cta-segment.ts:146-149`
**Issue:** If `innerError` is an AbortError on attempt=0, the loop continues to attempt=1, which then immediately fails with the same already-aborted controller. The outer catch eventually wraps it as a generic "Body segment Zod validation failed" because `lastError` is set inside the Zod-fail path, not the abort path.

Code trace:
```ts
for (let attempt = 0; attempt <= BODY_MAX_RETRIES; attempt++) {
  try {
    const response = await ai.models.generateContent({ /* aborted controller */ });
    // ...
  } catch (innerError) {
    lastError = innerError;            // ← AbortError
    if (attempt >= BODY_MAX_RETRIES) break;
    // loop continues with same aborted controller!
  }
}
```
This compounds CR-02. Once CR-02 is fixed (controller-per-attempt), this becomes moot — but until then, an abort on attempt 0 is a guaranteed waste of one wasted retry.

**Fix:** With CR-02 fix applied, also short-circuit the retry on AbortError:
```ts
} catch (innerError) {
  lastError = innerError;
  // Don't retry on AbortError — the segment timed out, retrying won't help.
  if (innerError instanceof Error && innerError.name === "AbortError") break;
  if (attempt >= BODY_MAX_RETRIES) break;
}
```

## Info

### IN-01: `cognitive_load` polarity warning lives only in code comments and prompt text — not in the schema docstring

**File:** `src/lib/engine/gemini/schemas.ts:40` + `types.ts:222`
**Issue:** Downstream consumers (Phase 10 ML retrain, Phase 7 persona simulation) will read `cognitive_load` from `hook_decomposition` and may naively assume "higher = better" because that's the convention for every OTHER 0-10 score in the system. The polarity is documented in:
- `schemas.ts:22` (a comment)
- `schemas.ts:40` (a comment)
- The Gemini prompt text (`prompts.ts:51` — visible only to the model)

There is no TypeScript-level signal (e.g., a branded type `CognitiveLoadScore` or a JSDoc on the type). When the field flows through `HookDecomposition` to aggregator → FeatureVector → ML, future maintainers will likely invert the polarity by accident.

**Fix:** Add a structural comment on the inferred type alias:
```ts
/**
 * Hook decomposition scores. NOTE polarity for `cognitive_load`:
 * higher score = MORE cognitive load = WORSE retention.
 * Every other score in this object uses the standard "higher = better" polarity.
 */
export type HookDecomposition = z.infer<typeof HookDecompositionZodSchema>;
```
Plus an integration test that asserts `cognitive_load` is NOT averaged with other hook fields by any aggregator path (pin the contract).

### IN-02: `calibration-baseline.json` path computation uses `import.meta.url` — Edge runtime caveat

**File:** `src/lib/engine/gemini.ts:142`
**Issue:** `path.dirname(new URL(import.meta.url).pathname)` works in Node.js but Next.js 15 App Router can route segments through Edge runtime where `import.meta.url` resolution differs. Pre-Phase-5 this was already in the codebase, but Phase 5 doubles-down by exporting `loadCalibrationData` and calling it from `pipeline.ts` (line 382). If the route runs on Edge runtime (per `runtime: "edge"` route export), this throws at runtime, not build-time.

Recommend either keeping the calibration data inlined as a TS module constant (loaded at build time) or pinning the route runtime to Node.js. Not Phase-5-introduced, but Phase 5 has expanded the blast radius.

### IN-03: `applyCtaPenalty` does not log when the penalty fires — observability gap

**File:** `src/lib/engine/aggregator.ts:88-98`
**Issue:** No log/telemetry when the penalty fires; the M2 UI breakdown card would be the only signal that a CTA penalty was applied (and only via the `gemini_score` vs `overall_score` delta). Phase 10 ML audit (per CONTEXT D-06: "Phase 10 ML audit revisits the magnitude") will want to retrospectively analyze the penalty firing rate.

**Fix:** Either log inside the function or emit a `pipeline_warning` with a low-severity informational message:
```ts
if (penalty > 0) {
  // Pure functions shouldn't side-effect; emit via aggregator-level breadcrumb instead.
}
```
Best done at the aggregator call site (line 463-467) where context is available.

### IN-04: `routedMockGenerate` in tests has no assertion on call count per segment

**File:** `src/lib/engine/__tests__/gemini-segmented.test.ts:201-208` + `gemini-segmented-integration.test.ts:263-281`
**Issue:** The mock dispatches by prompt content but doesn't track that each fixture was called exactly once. A bug where the orchestrator accidentally calls `runHookSegment` twice would route both calls to the hook fixture and the test would pass. Add per-segment call-count assertions to the HHH happy-path tests.

**Fix:**
```ts
const hookCalls = mockGenerate.mock.calls.filter((c) => segmentOf(c[0]) === "hook");
expect(hookCalls).toHaveLength(1);
```
Apply to body + cta as well in Test 1 / Test 3 of the orchestrator suite.

### IN-05: Re-export of `analyzeVideoWithGemini` from pipeline.ts is unnecessary

**File:** `src/lib/engine/pipeline.ts:20-24`
**Issue:** The re-export comment says "for the Phase 12 acceptance benchmark's A/B comparison run" but the legacy export is already available via `src/lib/engine/gemini` (its original module). Re-exporting from `pipeline.ts` creates two import paths to the same symbol — a maintenance smell and a search-and-replace hazard. Consumers should import directly from `./gemini`.

**Fix:** Remove the re-export at pipeline.ts:24:
```ts
// Remove these lines:
// Phase 5 D-11: re-export the legacy single-call video analyzer for eval-harness ...
export { analyzeVideoWithGemini } from "./gemini";
```
Update the gemini-eval-alignment test to import directly from `./gemini`.

### IN-06: `gemini-segmented-integration.test.ts` does not assert pipeline.warnings is populated for partial Gemini failures

**File:** `src/lib/engine/__tests__/gemini-segmented-integration.test.ts:507-525`
**Issue:** Test 8 (body failure path) asserts `signalAvailability.gemini_body === false` and that the `gemini_body` pipeline_warning event was emitted, but does NOT assert that `result.warnings` (the persisted-on-PipelineResult warnings array) contains an entry. Pipeline-level warnings flow to the API response's `warnings` field and into the DB JSONB; if the only signal is the SSE event (transient), there's no audit trail.

Inspecting pipeline.ts:355-437, the `geminiPromise`'s catch block pushes warnings to the `warnings` array ONLY for the outermost catch (e.g., a Files API upload failure). Per-segment failures from `mergeSegments` emit pipeline_warning events but never populate the `warnings` array. This is the correct boundary (segment-level is event-only; pipeline-level is array-persisted), but the test should at least assert this expected behavior to prevent future drift.

**Fix:**
```ts
// Test 8 additions:
expect(result.warnings).toEqual([]); // body failure handled via SSE event, not pipeline.warnings
// Test 9 additions:
expect(result.warnings).toEqual([]); // 3-of-3 failure handled via gemini_video_unavailable event
// Test 10:
expect(result.warnings.some((w) => w.includes("Gemini analysis unavailable"))).toBe(true); // outer-catch path
```

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
