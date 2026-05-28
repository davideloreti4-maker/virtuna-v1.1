---
phase: "03"
plan: "07"
subsystem: engine.filmstrip
tags: [filmstrip, ffmpeg, supabase-storage, tdd, graceful-degradation]

dependency_graph:
  requires:
    - "03-02 (ffmpeg-static external in next.config.ts — Pitfall 1 workaround)"
    - "03-03 (filmstrips Storage bucket created in outcomes_and_filmstrips migration)"
  provides:
    - "filmstrip keyframe extraction pipeline (extract + storage + queue)"
    - "/api/filmstrip/extract route (auth-gated, SSRF-guarded, inline processing)"
    - "keyframe_uri persistence in analysis_results.variants JSONB"
  affects:
    - "03-08 (Plan 08 will call triggerFilmstripGeneration from pipeline.ts at wave_0_complete)"
    - "Phase 4 Audience node (consumes keyframe_uri via variants.filmstrip_segments)"

tech_stack:
  added:
    - "ffmpeg-static (npm) — installed as missing dependency (Rule 3 deviation)"
  patterns:
    - "child_process.spawn wrapping ffmpeg binary (D-09)"
    - "Supabase service-role upload + createSignedUrl 30-day TTL (D-10)"
    - "void fetch fire-and-forget pattern (D-11)"
    - "Zod + SSRF deny-list on API route (T-03-07-03)"

key_files:
  created:
    - src/lib/engine/filmstrip/extract.ts
    - src/lib/engine/filmstrip/storage.ts
    - src/lib/engine/filmstrip/queue.ts
    - src/app/api/filmstrip/extract/route.ts
  modified:
    - src/lib/engine/__tests__/filmstrip.test.ts
    - package.json

decisions:
  - "Store keyframe_uris in analysis_results.variants JSONB under filmstrip_segments key (no heatmap column in DB schema)"
  - "Use static imports in test file (not dynamic) to avoid Vitest mock isolation timeout bug"
  - "ffmpeg-static installed as dependency (was referenced in next.config.ts but not in package.json)"

metrics:
  duration: "12m"
  completed: "2026-05-27T08:58:16Z"
  tasks_completed: 2
  tasks_total: 2
  tests_passed: 11
  tests_total: 11
---

# Phase 3 Plan 07: Filmstrip Generation Pipeline Summary

## One-liner

ffmpeg-static keyframe extraction with Supabase Storage upload (30-day signed URL), fire-and-forget queue trigger, and auth+SSRF-guarded POST route that persists keyframe_uris into `analysis_results.variants`.

## What Was Built

### Task 1 — Filmstrip lib triple (extract / storage / queue) + tests

**src/lib/engine/filmstrip/extract.ts**
- `extractFrameAtTimestamp(videoUrl, tStartSeconds): Promise<Buffer | null>`
- Spawns ffmpeg-static: `-ss <t> -i <url> -frames:v 1 -q:v 4 -f image2 pipe:1`
- Graceful degradation: non-zero exit → null; spawn error → null; null ffmpegPath → null
- Never throws (D-09 contract)

**src/lib/engine/filmstrip/storage.ts**
- `uploadFrameAndGetSignedUrl(analysisId, segmentIdx, jpegBuffer): Promise<string | null>`
- Path: `filmstrips/<analysisId>/<segmentIdx>.jpg` (bucket: `filmstrips`, private)
- 30-day signed URL: `createSignedUrl(path, 60 * 60 * 24 * 30)` = 2592000 seconds
- Upload: `upsert: true, contentType: 'image/jpeg'`
- Never throws (D-10 contract)

**src/lib/engine/filmstrip/queue.ts**
- `triggerFilmstripGeneration(analysisId, segments, videoUrl): void`
- `void fetch(...)` — returns synchronously, never awaited
- Authorization: `Bearer ${FILMSTRIP_EXTRACT_SECRET}` header included
- `.catch()` swallows errors with log.error (D-11 contract)

**Test results: 11/11 passing** (all Plan 01 stubs converted to live tests)

### Task 2 — /api/filmstrip/extract route

**src/app/api/filmstrip/extract/route.ts**
- `export const runtime = "nodejs"; dynamic = "force-dynamic"; maxDuration = 300`
- Auth gate: `Authorization: Bearer <FILMSTRIP_EXTRACT_SECRET>` required → 401 on mismatch (T-03-07-01)
- Body schema: `{ analysisId: UUID, videoUrl: URL, segments: SegmentSchema[1..50] }` via Zod → 400 on fail (T-03-07-05)
- SSRF deny-list: localhost, 127.0.0.1, ::1, 10.x, 172.16-31.x, 192.168.x, 169.254.x → 400 (T-03-07-03)
- Extraction loop: `extractFrameAtTimestamp → uploadFrameAndGetSignedUrl` per segment (graceful-degradation: null → skip)
- Persist: reads `analysis_results.variants`, merges `filmstrip_segments` array, writes back
- Returns: `{ ok: true, segments_processed, segments_succeeded }`
- Top-level catch: 500 with `{ error: "internal" }` — no stack trace exposure

## Environment Variable Required

```
FILMSTRIP_EXTRACT_SECRET=<random-secret>
```

Set in Vercel environment variables (Production + Preview). Also set locally in `.env.local`. Both `queue.ts` (caller) and `/api/filmstrip/extract` (receiver) read this secret. Empty string → all requests rejected (no bypass).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ffmpeg-static not in package.json**
- **Found during:** Task 1 TypeScript check
- **Issue:** `ffmpeg-static` was referenced in `next.config.ts` (Plan 02 added `serverExternalPackages: ['ffmpeg-static']`) but not installed in `package.json`. TypeScript error: `Cannot find module 'ffmpeg-static'`
- **Fix:** `npm install ffmpeg-static` — adds to package.json dependencies
- **Files modified:** `package.json`
- **Commit:** 08d21d4

**2. [Rule 1 - Bug] Dynamic import in test caused Vitest mock timeout**
- **Found during:** Task 1 test run
- **Issue:** `await import("child_process")` inside test body caused first test to timeout (5000ms) because the cached module reference after `vi.resetAllMocks()` broke the mock return value chain
- **Fix:** Converted to static top-level imports + `vi.hoisted()` for spawn mock ref
- **Files modified:** `src/lib/engine/__tests__/filmstrip.test.ts`
- **Commit:** 08d21d4

**3. [Rule 1 - Bug] DB schema mismatch — no `heatmap` column in analysis_results**
- **Found during:** Task 2 TypeScript check
- **Issue:** Plan described persisting to `analyses.analysis_results.heatmap.segments[idx].keyframe_uri` but the DB table is `analysis_results` (not `analyses`) and has no `heatmap` JSONB column. Plan 03 migration only created the `filmstrips` storage bucket.
- **Fix:** Used `analysis_results.variants` JSONB column (currently unused, `Json | null`) to store `{ filmstrip_segments: [{ idx, keyframe_uri }] }`. Plan 08 will read from `variants.filmstrip_segments` to emit SSE events.
- **Files modified:** `src/app/api/filmstrip/extract/route.ts`
- **Commit:** 393454b

## Known Stubs

None — all functionality is implemented and live.

## Threat Surface Scan

All threats from the plan's `<threat_model>` are mitigated:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-03-07-01 | Bearer token gate in POST handler (FILMSTRIP_EXTRACT_SECRET) | Implemented |
| T-03-07-02 | spawn() array args (no shell interpolation) + Zod `z.number().min(0)` | Implemented |
| T-03-07-03 | SSRF deny-list: 7 private/loopback ranges checked | Implemented |
| T-03-07-04 | 30-day TTL accepted; bucket private, signed URLs only | Accepted |
| T-03-07-05 | `z.array().max(50)` segment cap | Implemented |
| T-03-07-06 | maxDuration=300 + null-on-failure degradation | Accepted |
| T-03-07-07 | path includes analysisId UUID; upsert: true | Implemented |

## Self-Check: PASSED

All files created and committed:
- `src/lib/engine/filmstrip/extract.ts` — FOUND
- `src/lib/engine/filmstrip/storage.ts` — FOUND
- `src/lib/engine/filmstrip/queue.ts` — FOUND
- `src/app/api/filmstrip/extract/route.ts` — FOUND
- `src/lib/engine/__tests__/filmstrip.test.ts` — FOUND (modified)

Commits:
- `08d21d4` — Task 1: filmstrip lib triple + tests (11/11 passing)
- `393454b` — Task 2: /api/filmstrip/extract route
