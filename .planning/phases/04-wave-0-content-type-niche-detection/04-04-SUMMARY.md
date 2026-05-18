---
phase: "04-wave-0-content-type-niche-detection"
plan: "04"
subsystem: "engine/wave0"
tags: ["gap-closure", "GAP-04-01", "bugfix", "supabase-storage", "regression-lock"]
dependency_graph:
  requires: ["04-01", "04-02", "04-03"]
  provides: ["GAP-04-01-closed", "video_storage_path-field", "supabase-download-pattern"]
  affects: ["content-type-detector", "wave0-orchestrator", "pipeline", "normalize"]
tech_stack:
  added: ["SupabaseClient injection pattern into detectors"]
  patterns: ["Option A foot-gun elimination", "supabase.storage.from(bucket).download() instead of fetch()", "Sentry.captureException on rejected detector outcomes"]
key_files:
  created: []
  modified:
    - "src/lib/engine/types.ts (+1 field on ContentPayload)"
    - "src/lib/engine/normalize.ts (+14 lines, Option A fix)"
    - "src/lib/engine/wave0/content-type-detector.ts (+20 lines, fetch → storage download)"
    - "src/lib/engine/wave0.ts (+17 lines, supabase param + Sentry captures)"
    - "src/lib/engine/pipeline.ts (+1 line, pass supabase into runWave0)"
    - "src/lib/engine/__tests__/normalize.test.ts (+45 lines, 3 new tests)"
    - "src/lib/engine/__tests__/wave0-content-type.test.ts (+112 lines, 3 new tests)"
    - "src/lib/engine/__tests__/wave0-orchestration.test.ts (+20 lines, signature update)"
    - "src/lib/engine/__tests__/stubs.test.ts (+15 lines, signature update)"
    - "src/lib/engine/__tests__/pipeline.test.ts (+50 lines, WR-04+05 fixes + 1 new test)"
    - "src/lib/engine/__tests__/aggregator.test.ts (+1 line, mechanical blast-radius fix)"
    - "src/lib/engine/__tests__/factories.ts (+1 line, mechanical blast-radius fix)"
    - "src/lib/engine/__tests__/video-e2e.test.ts (+1 line, mechanical blast-radius fix)"
decisions:
  - "Option A (eliminate alias at source) vs Option B (detect and convert) — chose Option A because it prevents re-introduction of the bug via copy-paste; the detector now reads video_storage_path explicitly and video_url is NEVER a storage key"
  - "Removed signal_availability.content_type assertion from pipeline integration test — PipelineResult doesn't expose signal_availability directly (that's on PredictionResult from aggregator); wave0Result.content_type non-null is the correct assertion"
metrics:
  duration: "11 min"
  completed: "2026-05-18T06:59:50Z"
  tasks: 3
  files_modified: 13
---

# Phase 4 Plan 04: GAP-04-01 Closure — Supabase Storage Download Fix + Option A Normalize + WR Fixes Summary

**One-liner:** Closed VERIFICATION GAP-04-01 by replacing `fetch(payload.video_url)` with `supabase.storage.from("videos").download(payload.video_storage_path)` in content-type-detector, eliminating the storage-key alias in normalize.ts (Option A), plumbing the supabase client through wave0.ts and pipeline.ts, and adding 6 regression-lock tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend ContentPayload + normalize.ts (Option A) | b4c535f | types.ts, normalize.ts, normalize.test.ts, factories.ts, aggregator.test.ts, video-e2e.test.ts |
| 2 | Swap fetch() for supabase.storage.download + regression tests | 59fc29d | content-type-detector.ts, wave0-content-type.test.ts |
| 3 | Plumb supabase through wave0.ts + pipeline.ts + WR fixes | c9430e0 | wave0.ts, pipeline.ts, pipeline.test.ts, wave0-orchestration.test.ts, stubs.test.ts |

## What Was Built

### GAP-04-01 Root Cause Fixed

The original bug: `content-type-detector.ts` called `fetch(payload.video_url)`, but for `video_upload` mode, `normalize.ts` was aliasing `input.video_storage_path` (a raw S3/Supabase key like `"user-abc/video.mp4"`) into `video_url`. This is not a valid URL — `fetch()` threw `TypeError: Failed to parse URL` in production. The D-16 try/catch silently swallowed the error, so every video upload silently returned `wave0Result.content_type = null`.

### Fix Architecture

1. **`types.ts`** — Added `video_storage_path: string | null` to `ContentPayload`. The field decouples the storage key from `video_url`.

2. **`normalize.ts` (Option A)** — `video_url` is now set ONLY from `input.tiktok_url ?? null`. Storage key aliasing via `?? input.video_storage_path` is removed. `video_storage_path` gets its own explicit assignment: `video_storage_path: input.video_storage_path ?? null`. This kills the alias at the source — re-introducing it would now require changing two lines and breaking two regression-lock tests.

3. **`content-type-detector.ts`** — Accepts `SupabaseClient` as new 2nd parameter. Buffer acquisition replaced: old `fetch(payload.video_url)` → new `supabase.storage.from("videos").download(payload.video_storage_path)`. Input-mode guard now checks `!payload.video_storage_path` (not `!payload.video_url`).

4. **`wave0.ts`** — Accepts `SupabaseClient` as new 2nd parameter, forwarded to `detectContentType`. Adds `Sentry.captureException` on both rejected detector outcomes (WR-01 observability).

5. **`pipeline.ts`** — Single-line change: `runWave0(payload, supabase, creatorContext, onStageEvent)`. The `supabase` client already existed at this scope (line 276); no new client instantiation.

### Grep Evidence

**fetch() is gone:**
```
grep -E "^\s+(await |= )?fetch\(" src/lib/engine/wave0/content-type-detector.ts
→ 0 matches (only comments reference fetch)
```

**Supabase download is in:**
```
grep -n 'from("videos")' src/lib/engine/wave0/content-type-detector.ts
→ Line 108: .from("videos")   [supabase.storage.from("videos").download(...)]
```

**Option A foot-gun elimination (normalize.ts):**
```
grep -E "video_url:\s*input\.tiktok_url\s*\?\?\s*null" src/lib/engine/normalize.ts
→ 1 match (only from tiktok_url, never from video_storage_path)

grep -E "input\.video_storage_path" src/lib/engine/normalize.ts
→ 1 match (only on video_storage_path: assignment line — not on video_url: line)
```

## Bundled Fixes

### WR-01 — Sentry observability for rejected detector outcomes
`wave0.ts` now calls `Sentry.captureException(outcome.reason, { tags: { stage, source } })` for both `contentTypeOutcome` and `nicheOutcome` when rejected. Previously only `log.warn` was called.

### WR-04 — Binary test precondition (no conditional skip)
`pipeline.test.ts` line 742-744: The `if (wave1Idx >= 0) expect(w0Idx).toBeLessThan(wave1Idx)` conditional is replaced with two unconditional assertions:
```typescript
expect(wave1Idx).toBeGreaterThanOrEqual(0); // fail honestly if Wave 1 stops firing
expect(w0Idx).toBeLessThan(wave1Idx);       // ordering invariant
```

### WR-05 — Type.BOOLEAN added to @google/genai mock
`pipeline.test.ts` lines 63-69: Added `BOOLEAN: "BOOLEAN"` to the Type enum in the mock. Also added `this.files = { upload, get, delete }` to the MockGoogleGenAI constructor so the new video_upload integration test can exercise the Gemini Files API path.

## Test Count Delta

| File | Before | New | After |
|------|--------|-----|-------|
| normalize.test.ts | 16 | +2 | 18 |
| wave0-content-type.test.ts | 10 | +3 | 13 |
| wave0-orchestration.test.ts | 8 | 0 | 8 (sig update) |
| stubs.test.ts | 9 | 0 | 9 (sig update) |
| pipeline.test.ts | 18 | +1 | 19 |
| **Full suite** | **753** | **+6** | **759** |

Pre-existing skips (2 files): cost-benchmark (missing fixtures), video-e2e (missing local file) — unchanged.

## Mechanical Blast-Radius Updates

ContentPayload literal fixes (not behavior changes):
- `factories.ts`: Added `video_storage_path: null` to `makeContentPayload()` base object
- `aggregator.test.ts`: Updated `video_upload` payload literal — `video_url: null`, `video_storage_path: "test-user/video.mp4"`
- `video-e2e.test.ts`: Added `video_storage_path: null` to inline PipelineResult payload literal

## Known Stubs

None — this plan closes a production bug, not a stub.

## Verification Status

| Criterion | Status |
|-----------|--------|
| SC#2 (content_type non-null for video_upload) | MET in automated tests; HUMAN-UAT live API verification still needed |
| SC#5 (video_upload e2e with real Gemini) | MET in automated tests; HUMAN-UAT live API verification still needed |
| GAP-04-01 closed | MET — automated regression-lock suite covers the fix |
| HUMAN-UAT row #1 | Ready for human live-API validation (no longer blocked by production fetch bug) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Deviation] Removed signal_availability from pipeline integration test assertion**
- **Found during:** Task 3 — pipeline integration test first run
- **Issue:** Plan specified `expect(result.signal_availability.content_type).toBe(true)` but `PipelineResult` (returned by `runPredictionPipeline`) does not have `signal_availability` — that lives on `PredictionResult` (returned by the aggregator, a different type). The test failed with `Cannot read properties of undefined (reading 'content_type')`.
- **Fix:** Removed the `signal_availability` assertion from the pipeline integration test. The assertions `wave0Result.content_type !== null` and `wave0Result.content_type?.type === "talking_head"` are sufficient to prove the production data-flow fix (GAP-04-01 was about `content_type` being null, not about `signal_availability`).
- **Files modified:** `src/lib/engine/__tests__/pipeline.test.ts`
- **Commit:** c9430e0

**2. [Rule 3 - Deviation] pnpm install required before tests could run**
- **Found during:** Task 1 verification
- **Issue:** Worktree's `node_modules` was empty (only `.vite` cache present), causing `@testing-library/jest-dom/vitest` import to fail in setup.ts.
- **Fix:** Ran `pnpm install --frozen-lockfile` from within the worktree to populate packages from the global pnpm store. Tests then ran correctly with `pnpm test`.
- **Files modified:** None (node_modules populated from pnpm store)

## Self-Check: PASSED

All files found, all commits verified.

| Item | Status |
|------|--------|
| src/lib/engine/types.ts | FOUND |
| src/lib/engine/normalize.ts | FOUND |
| src/lib/engine/wave0/content-type-detector.ts | FOUND |
| src/lib/engine/wave0.ts | FOUND |
| src/lib/engine/pipeline.ts | FOUND |
| SUMMARY.md | FOUND |
| Task 1 commit b4c535f | FOUND |
| Task 2 commit 59fc29d | FOUND |
| Task 3 commit c9430e0 | FOUND |
| Full test suite: 759 pass / 4 skip | PASSED |
