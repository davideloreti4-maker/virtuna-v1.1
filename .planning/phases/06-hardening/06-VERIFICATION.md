---
phase: 06-hardening
verified: 2026-02-18T13:22:35Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 6: Hardening Verification Report

**Phase Goal:** Every remaining failure mode degrades gracefully — no unhandled throws, no race conditions, and creator profile scraping triggers correctly.
**Verified:** 2026-02-18T13:22:35Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Malformed calibration JSON causes neither gemini.ts nor deepseek.ts to throw — both fall back to uncalibrated defaults | VERIFIED | Both modules have try-catch in `loadCalibrationData()` with Zod schema validation, catching all JSON/schema errors and returning null; callers use `?? FALLBACK_*` null-coalescing |
| 2 | Simulating simultaneous DeepSeek + Gemini failure returns a partial result with `confidence_label: "LOW"` rather than a 500 error | VERIFIED | `DEFAULT_GEMINI_RESULT` (all factors = 0) prevents pipeline throw; aggregator.ts detects `factors.some(f => f.score > 0) = false` and explicit override at line 333-335 forces `{ confidence: 0.2, confidence_label: "LOW" }` |
| 3 | Concurrent half-open circuit breaker probes result in exactly one probe request (mutex prevents race) | VERIFIED | `probeInFlight` module-level flag gates the half-open transition in `isCircuitOpen()`; second concurrent caller sees `probeInFlight = true` and returns `true` (blocked); flag cleared in both `recordSuccess()` and `recordFailure()` and in `resetCircuitBreaker()` |
| 4 | Setting `tiktok_handle` on a user profile triggers an optional creator profile scrape without blocking the response | VERIFIED | profile `PATCH` returns `Response.json({ success: true })` unconditionally after upsert; scrape runs in `void (async () => { ... })()` — fully fire-and-forget; scrape errors are caught and swallowed with `log.warn` |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/gemini.ts` | Try-catch + Zod validation around `loadCalibrationData`; exports `CalibrationBaselineSchema` | VERIFIED | Lines 51-66: `CalibrationBaselineSchema` exported. Lines 120-139: `loadCalibrationData` wrapped in try-catch, uses `CalibrationBaselineSchema.parse()`. Lines 325, 416: callers use `?? FALLBACK_CALIBRATION` |
| `src/lib/engine/deepseek.ts` | Try-catch + Zod validation around `loadCalibrationData`; `probeInFlight` mutex | VERIFIED | Lines 90-129: `DeepSeekCalibrationBaselineSchema`. Lines 244-265: try-catch with `.parse()`. Lines 47-48: `let probeInFlight = false`. Lines 160-177: mutex logic in `isCircuitOpen()`. Lines 181, 206: cleared in `recordSuccess/recordFailure`. Line 635: cleared in `resetCircuitBreaker()` |
| `src/lib/engine/pipeline.ts` | `DEFAULT_GEMINI_RESULT` constant; Gemini stage uses fallback on error | VERIFIED | Lines 104-143: `DEFAULT_GEMINI_RESULT` with all 5 factors at score=0. Lines 224-239: Gemini promise catches errors, pushes warning, returns `DEFAULT_GEMINI_RESULT` |
| `src/lib/engine/aggregator.ts` | Gemini availability detection via factor scores; explicit LOW override when both LLMs fail | VERIFIED | Line 242: `gemini: geminiResult.analysis.factors.some((f) => f.score > 0)`. Lines 328-335: explicit `conf = { confidence: 0.2, confidence_label: "LOW" }` when both unavailable. Lines 352-356: dual-failure warning added |
| `src/app/api/profile/route.ts` | Accepts `tiktok_handle`, upserts `creator_profiles`, triggers fire-and-forget background scrape | VERIFIED | Line 13: `tiktok_handle` in Zod schema. Line 96: destructured from `settingsData` before user_settings upsert. Lines 117-151: creator_profiles upsert + void async IIFE scrape. Lines 37-51: GET returns `tiktok_handle` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `gemini.ts:loadCalibrationData` | `calibration-baseline.json` | `CalibrationBaselineSchema.parse` | WIRED | `CalibrationBaselineSchema.parse(parsed)` on line 130; try-catch returns null on failure |
| `deepseek.ts:loadCalibrationData` | `calibration-baseline.json` | `DeepSeekCalibrationBaselineSchema.parse` | WIRED | `DeepSeekCalibrationBaselineSchema.parse(parsed)` on line 254; try-catch returns null on failure |
| `deepseek.ts:isCircuitOpen` | `deepseek.ts:reasonWithDeepSeek` | `probeInFlight` flag prevents concurrent probes | WIRED | `isCircuitOpen()` called at line 457; sets `probeInFlight = true` when transitioning to half-open; cleared on both success (line 206) and failure (line 181) |
| `pipeline.ts` | `aggregator.ts` | `PipelineResult.geminiResult` can be fallback | WIRED | `DEFAULT_GEMINI_RESULT` returned on Gemini failure; aggregator receives it and detects via `factors.some(f => f.score > 0)` |
| `profile route.ts` | `creator_profiles` table | upsert on PATCH with `tiktok_handle` | WIRED | Lines 122-128: `service.from("creator_profiles").upsert(...)` with `onConflict: "user_id"` |
| `profile route.ts` | `scraping/index.ts:createScrapingProvider` | fire-and-forget void IIFE | WIRED | `createScrapingProvider()` instantiated inside void IIFE; `scraper.scrapeProfile(handle)` called; result mapped to creator_profiles columns |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `pipeline.ts` | 157 | "placeholder" in comment | Info | Comment describing Stage 4 as placeholder — the stage correctly returns `null` and is documented as handled via fuzzy matching in trends. Not a stub, intentional no-op. |
| `pipeline.ts` | 314 | "placeholder" in comment | Info | Comment explaining the trend_enrichment placeholder passed to DeepSeek prompt. Intentional design — trends run in parallel wave. |

No blocker or warning anti-patterns found.

---

### Human Verification Required

The following items cannot be verified programmatically:

#### 1. Malformed calibration file runtime behavior

**Test:** Replace `calibration-baseline.json` temporarily with `{"invalid": true}`, make a prediction request, then restore the original file.
**Expected:** Request completes successfully with valid (fallback-calibrated) scores. No 500 error, no unhandled exception. Server logs show a `warn` entry "Failed to load calibration data".
**Why human:** Requires live runtime environment with Next.js and actual file I/O path resolution.

#### 2. Dual-LLM failure end-to-end

**Test:** Mock both `GEMINI_API_KEY` and `DEEPSEEK_API_KEY` to invalid values (or block their endpoints), then POST to `/api/predict`.
**Expected:** 200 response with `confidence_label: "LOW"`, `gemini_score: 0`, `behavioral_score: 0`, and both `"Gemini analysis unavailable"` and `"Both LLM providers failed"` in the warnings array.
**Why human:** Requires live environment with network-level provider failure simulation.

#### 3. Background scrape non-blocking response time

**Test:** PATCH `/api/profile` with `{ "tiktok_handle": "@somehandle" }` while monitoring response latency.
**Expected:** Response returns in under 500ms (the Apify scrape takes 5-30s). Response body is `{ "success": true }` — scrape happens silently in background.
**Why human:** Requires live Apify credentials and real network conditions to verify timing.

#### 4. Circuit breaker concurrent probe race

**Test:** With circuit breaker open, send 10 simultaneous requests to the DeepSeek endpoint when the backoff timer expires.
**Expected:** Exactly 1 request reaches DeepSeek (probe); all others receive graceful null/fallback. No errors, no duplicate probes in DeepSeek logs.
**Why human:** Requires concurrent load testing — cannot simulate true concurrency in unit tests.

---

## Gaps Summary

No gaps found. All 4 observable truths are verified against the actual codebase implementation:

- **HARD-01/02 (calibration hardening):** Both `gemini.ts` and `deepseek.ts` have substantive Zod schemas, proper try-catch, and null-coalescing callers. The fallback constants (`FALLBACK_CALIBRATION`, `FALLBACK_DEEPSEEK_CALIBRATION`) are fully defined with conservative defaults.

- **HARD-03 (dual-LLM graceful degradation):** `DEFAULT_GEMINI_RESULT` in `pipeline.ts` has all 5 factors at score=0. The aggregator correctly detects this via `factors.some(f => f.score > 0)` and the explicit override `{ confidence: 0.2, confidence_label: "LOW" }` is in place with a code comment explaining why calculateConfidence would otherwise incorrectly yield MEDIUM.

- **HARD-04 (circuit breaker probe mutex):** The `probeInFlight` flag is present at module level, checked before probe transition, set atomically with status change, and cleared in all three exit paths (success, failure, reset). The half-open defensive guard is also present.

- **HARD-05 (creator profile scrape trigger):** The profile route correctly separates `tiktok_handle` from `settingsData`, upserts `creator_profiles` via the service client (bypasses RLS), and fires the scrape as a `void` IIFE. The scrape error path swallows exceptions, and the PATCH response returns immediately. The GET handler returns `tiktok_handle` from `creator_profiles`.

---

_Verified: 2026-02-18T13:22:35Z_
_Verifier: Claude (gsd-verifier)_
