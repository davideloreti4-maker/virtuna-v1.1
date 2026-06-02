---
phase: "03"
plan: "02"
subsystem: api
tags: [decode, route, sse, tdd, security]
dependency_graph:
  requires: [plan-03-01-decode-engine]
  provides: [decode-route-branch, persistDecodeToVariants, runDecodeStream]
  affects: [variants.remix.decode, plan-03-03-frame]
tech_stack:
  added: []
  patterns: [sse-early-return-branch, read-merge-write-jsonb, derive-and-drop-finally]
key_files:
  created:
    - src/app/api/analyze/__tests__/decode-route.test.ts
  modified:
    - src/app/api/analyze/route.ts
    - src/app/api/analyze/__tests__/derive-and-drop.test.ts
decisions:
  - "Early-return ReadableStream chosen for remix branch — keeps score-path start() body byte-for-byte identical; no interleaving risk"
  - "Existing placeholder INSERT reused for remix row — mode:validated.mode already 'remix', overall_score already null; no separate insert needed"
  - "cleanup() placed in finally of runDecodeStream inner try block — ensures unconditional execution even on analyzeVideoWithOmni or runDecode throw"
  - "mockVariantsSelect removed from hoisted vi.hoisted() — was declared but unused; service mock inlines the fn directly"
metrics:
  duration_minutes: 20
  completed_date: "2026-06-02"
  tasks_completed: 2
  files_changed: 3
---

# Phase 03 Plan 02: Decode Route Branch Summary

One-liner: Remix decode branch in /api/analyze — resolveAndRehost + Omni + runDecode pipeline with persistDecodeToVariants read-merge-write and SSE complete carrying variants.remix.decode + overall_score:null.

## What Was Built

**`route.ts` additions:**

- **`persistDecodeToVariants(service, id, decode, log)`** — read-merge-write function mirroring `persistCraftToVariants`. Three-level spread (`{...current, remix: {...remix, decode}}`) preserves sibling `craft` and `filmstrip_segments` regardless of concurrent write order. Non-fatal: warns on read/write error, never throws.

- **`runDecodeStream(controller, send, opts)`** — module-scope helper. Runs `resolveAndRehost → analyzeVideoWithOmni → runDecode → persistDecodeToVariants`. Emits `started`, `phase` (analyzing), and `complete` events. `overall_score: null` on the complete payload (m3). `cleanup()` called in `finally` (C4 derive-and-drop). Never calls `runPredictionPipeline`, `aggregateScores`, or `usage_tracking` upsert (C2).

- **Remix early-return branch** — `if (validated.mode === 'remix')` inserted between the placeholder INSERT and the score-path SSE setup. Returns its own `ReadableStream` immediately, keeping the score-path `start()` body byte-for-byte unchanged. Reuses the existing placeholder INSERT (already sets `overall_score: null`, `mode: validated.mode`, no `video_storage_path`).

- **Imports** — `resolveAndRehost`, `analyzeVideoWithOmni`, `runDecode`, `DecodeResult`, `OmniStructuralInput` added at top.

**`decode-route.test.ts`** — 11 tests covering:
- C2: `runPredictionPipeline` never called; `usage_tracking` upsert never called
- T-03-04: `persistDecodeToVariants` read-merge-write preserves existing `craft` + `filmstrip_segments`
- m3: INSERT has `overall_score: null` + `mode: 'remix'`; INSERT has no `video_storage_path`
- m3 complete event: `overall_score: null`, `variants.remix.decode` populated, `mode: 'remix'`
- T-03-05: DAILY_LIMITS 429 guard fires on remix body (decode engine not invoked)
- C4 DD-04: `cleanup()` called even when `runDecode` returns null
- C4 DD-05: INSERT never sets `video_storage_path`

**`derive-and-drop.test.ts`** — header docblock updated to note Plan 03-02 additions; no new tests added (cleanup assertions moved to decode-route.test.ts to avoid vi.mock hoisting conflicts).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 — decode-route test (RED) | cd34aadf | decode-route.test.ts (new), derive-and-drop.test.ts |
| 2 | Add decode branch + persistDecodeToVariants | e3624807 | route.ts |
| fix | Remove unused mockVariantsSelect (tsc clean) | cbc6adc2 | decode-route.test.ts |

## Verification Results

- `npx vitest run decode-route.test.ts` — **11 PASS, 0 FAIL**
- `npx vitest run derive-and-drop.test.ts` — **3 PASS, 0 FAIL**
- `npx vitest run route.test.ts` — **21 PASS, 0 FAIL** (score path no regression)
- `npx vitest run stream-route.test.ts` — **7 PASS, 0 FAIL**
- All 42 analyze route tests GREEN combined
- `npx tsc --noEmit` — 0 errors
- `grep -c 'persistDecodeToVariants' route.ts` — 3 (definition + call + docblock reference)
- `runDecodeStream` body contains no `runPredictionPipeline` or `usage_tracking` call (verified by grep + test spies)
- `git diff HEAD~3 -- src/lib/engine/pipeline.ts` — empty (pipeline.ts unchanged)

## Deviations from Plan

**1. [Rule 1 - Bug] DD-04/DD-05 tests moved from derive-and-drop.test.ts to decode-route.test.ts**
- **Found during:** Task 1 — vitest hoisting error when adding `vi.mock` calls after existing ones in the same file for the same module IDs
- **Issue:** vitest hoists all `vi.mock` calls; duplicate module mocks in same file at different positions cause `[vitest] There was an error when mocking a module` error
- **Fix:** Moved DD-04 (cleanup on null decode) and DD-05 (no video_storage_path) to decode-route.test.ts which already has the correct mocks for the route handler
- **Impact:** None — all assertions are present, behavioral contract fully covered

**2. [Rule 1 - Bug] Unused `mockVariantsSelect` removed from vi.hoisted()**
- **Found during:** Task 2 tsc --noEmit
- **Issue:** `mockVariantsSelect` declared but not referenced in the service mock factory (factory uses inline `vi.fn(async ...)` instead)
- **Fix:** Removed from `vi.hoisted()` return object and destructuring
- **Commit:** cbc6adc2

## Threat Mitigations Verified

| Threat ID | Mitigation | Verified |
|-----------|-----------|---------|
| T-03-04 | Three-level spread preserves craft + filmstrip_segments | Test T-03-04 GREEN; mockVariantsUpdate called with both siblings |
| T-03-05 | DAILY_LIMITS 429 runs on remix mode | Test T-03-05 GREEN; mockResolveAndRehost not called on 429 |
| T-03-06 | No usage_tracking upsert on decode row; overall_score null | C2 test GREEN; m3 test GREEN |
| T-03-02 | cleanup() unconditional in finally; video_storage_path never set | DD-04/DD-05 tests GREEN |

## Known Stubs

None. The decode branch is fully wired: resolveAndRehost → Omni → runDecode → persistDecodeToVariants → SSE complete.

## Threat Flags

None. No new network endpoints beyond the plan's declared threat model. The existing `/api/analyze` POST receives the `mode:'remix'` flag — no new auth paths or schema changes.

## Self-Check: PASSED

- [x] `src/app/api/analyze/__tests__/decode-route.test.ts` — exists
- [x] `src/app/api/analyze/route.ts` — modified with decode branch
- [x] `src/app/api/analyze/__tests__/derive-and-drop.test.ts` — modified (docblock)
- [x] Commit cd34aadf exists (Task 1)
- [x] Commit e3624807 exists (Task 2)
- [x] Commit cbc6adc2 exists (fix)
- [x] 11 decode-route tests GREEN
- [x] 3 derive-and-drop tests GREEN
- [x] 21 route.test.ts tests GREEN (score path no regression)
- [x] 7 stream-route.test.ts tests GREEN
- [x] 0 TypeScript errors
