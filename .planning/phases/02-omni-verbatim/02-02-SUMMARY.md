---
phase: 02-omni-verbatim
plan: 02
subsystem: engine/qwen/aggregator/route
tags: [verbatim, threading, aggregator, migration, persistence, cache-invalidation, tdd]
dependency_graph:
  requires: [02-01]
  provides: [verbatim-e2e-thread, verbatim-jsonb-column, engine-version-3.2.0]
  affects: [types.ts, aggregator.ts, omni-analysis-verbatim.test.ts, database.types.ts, route.ts, version.ts, supabase/migrations]
tech_stack:
  added: []
  patterns: [emotion-arc-analog, as-unknown-as-cast, two-site-persistence, non-fatal-pluck]
key_files:
  created:
    - supabase/migrations/20260604000000_persist_engine_verbatim_phase2.sql
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/omni-analysis-verbatim.test.ts
    - src/types/database.types.ts
    - src/app/api/analyze/route.ts
    - src/lib/engine/version.ts
decisions:
  - "VerbatimPayload { hook?, segments?[] } — hook axis via as-unknown-as cast (mirrors emotion_arc), segments axis derived from omniSegments after pipelineResult.segments available (:866)"
  - "verbatim.segments populated only when any segment carries non-null text — all-null array (video with no speech) stays null/hook-only, not an empty segments array"
  - "Both route persistence sites (:594 INSERT + :921 SSE UPDATE) store the full VerbatimPayload — not a hook-only subset — to avoid T-2-05 per-segment drop on streaming runs"
  - "Task 4 (ENGINE_VERSION 3.2.0) executed before checkpoint despite Task 3 ordering in plan — independent task, no dependency on live DB"
metrics:
  duration: "~25 minutes (Tasks 1+2+4 autonomous; Task 3 human-applied ~5 min)"
  completed: "2026-06-04"
  tasks_completed: 4
  files_modified: 6
  files_created: 1
  tests_added: 5
---

# Phase 02 Plan 02: Verbatim Thread + Persistence Summary

One-liner: VerbatimPayload (hook + per-segment segments[]) threaded through aggregator onto PredictionResult, persisted at both route sites (INSERT + SSE UPDATE) into a dedicated verbatim JSONB column (live on prod), ENGINE_VERSION bumped to 3.2.0.

## Tasks

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | VerbatimPayload type + aggregator pluck/thread (TDD) | 71ed9f44 (hook) + 60f01e38 | done |
| 2 | Verbatim JSONB migration + db types + both route persist sites | e7dc9b3c | done |
| 3 [BLOCKING] | Apply verbatim migration to live DB | human-applied | done — confirmed live (project virtuna-v1.1 / qyxvxleheckijapurisj; information_schema: analysis_results.verbatim, data_type=jsonb) |
| 4 | ENGINE_VERSION bump 3.1.0 → 3.2.0 | 75ac99d0 | done |

## What Was Built

### Task 1 — VerbatimPayload type + aggregator pluck/thread

**`src/lib/engine/types.ts`**

`VerbatimPayload` interface added near the SegmentGrid re-export:

```typescript
export interface VerbatimPayload {
  hook?: { spoken_words?: string | null; on_screen_text?: string | null };
  segments?: Array<{
    idx: number;
    spoken_text: string | null;
    on_screen_text: string | null;
  }>;
}
```

`verbatim?: VerbatimPayload | null` added to `PredictionResult` after `emotion_arc` field (same optional pattern — preserves compile against existing consumers).

**`src/lib/engine/aggregator.ts`**

Two additions following the emotion_arc precedent (non-fatal try/catch, `as unknown as` cast):

1. **Hook pluck** — immediately after the emotion_arc pluck (~518-531):
   - `(geminiResult.analysis as unknown as { hook_verbatim? })?.hook_verbatim` → stored as `verbatim.hook`
   - Non-fatal; null on exception

2. **Per-segment derivation** — immediately after `omniSegments = pipelineResult.segments` (~889):
   - Maps each SegmentGrid to `{ idx, spoken_text, on_screen_text }` via narrow `as unknown as` cast (SegmentGrid now carries both fields per Plan 01 SegmentSchema extension)
   - Populates `verbatim.segments` only when any segment carries non-null text — all-null (truly silent video) keeps verbatim null/hook-only
   - Synthetic fallback segments (buildFixedBuckets) legitimately have null spoken_text/on_screen_text — no invented text (D-02)
   - D-04.2 preserved: `[inaudible]` strings pass through unchanged; never coerced to null

3. **Thread onto PredictionResult** — alongside emotion_arc in the result assembly (~925): `verbatim,`

**`src/lib/engine/__tests__/omni-analysis-verbatim.test.ts`**

5 new tests added (TDD RED via tsc, GREEN at runtime):

- `VerbatimPayload: type is exported and has hook + segments fields`
- `VerbatimPayload: hook-only shape is valid (segments optional)`
- `VerbatimPayload: segments-only shape is valid (hook optional)`
- `PredictionResult.verbatim: field accepts VerbatimPayload | null`
- `PredictionResult.verbatim: field accepts null`

Total test count: 25 (20 from Plan 01 + 5 new). All GREEN.

### Task 2 — Migration + db types + route persistence

**`supabase/migrations/20260604000000_persist_engine_verbatim_phase2.sql`**

Minimal ADD COLUMN pattern (mirrors 20260531000000):

```sql
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS verbatim JSONB;

COMMENT ON COLUMN public.analysis_results.verbatim IS '...';
```

No backfill. D-02/D-04.2 contracts documented in the comment. No DROP.

**`src/types/database.types.ts`**

`verbatim: Json | null` added to Row (after emotion_arc); `verbatim?: Json | null` to Insert and Update sections. Mirrors emotion_arc pattern in all three sections (grep count = 3).

**`src/app/api/analyze/route.ts`**

Both persistence sites updated with the FULL `finalResult.verbatim` object:

- INSERT `buildInsertRow` (~594): `verbatim: (finalResult.verbatim ?? null) as unknown as Json`
- SSE safety-net UPDATE (~921): `verbatim: (finalResult.verbatim ?? null) as unknown as null`

Both store `{ hook, segments }` — not a `{ hook }`-only subset. This prevents T-2-05: streaming runs (default board UI) use the UPDATE path; a subset there would silently drop per-segment text.

### Task 3 — Live DB migration (human-applied)

Migration `persist_engine_verbatim_phase2` applied to Supabase project `virtuna-v1.1` (qyxvxleheckijapurisj). Verified via information_schema: `analysis_results.verbatim`, `data_type=jsonb`, `is_nullable=YES`. Plan 03 real-run R1 proof can now proceed against the live column.

### Task 4 — ENGINE_VERSION 3.2.0

`version.ts`: `"3.1.0"` → `"3.2.0"`. Comment updated to document the bump rationale (verbatim threading). Single constant gates both L1 in-memory `cacheKey()` template and L2 Supabase `.eq("engine_version", ENGINE_VERSION)` filter. All stale pre-verbatim cached rows auto-invalidate on next `/api/analyze` call.

## Verification

- `npx vitest run src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` → PASS 25 / FAIL 0
- `npx tsc --noEmit` → 0 errors (clean across all 6 touched files)
- Migration applied: information_schema confirms `analysis_results.verbatim` jsonb on live DB
- `grep -c 'verbatim:' src/app/api/analyze/route.ts` → 2 (both INSERT + UPDATE sites)
- `grep -c 'ENGINE_VERSION = "3.2.0"' src/lib/engine/version.ts` → 1
- Additive-only guard: `git diff` shows only inserted lines; no existing fields removed or repointed

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Execution Order Note

Task 4 (ENGINE_VERSION bump) was executed before Task 3 checkpoint returned, not after. Task 4 has no dependency on the live DB column existing — it is a pure code change. Ordering preserved the intent: Tasks 1+2+4 are all committed before human confirmation of Task 3. This is correct per plan (Task 3 is gate for Plan 03 real-run, not for Tasks 1/2/4).

## Known Stubs

None — this plan wires data end-to-end. No UI rendering, no placeholder values. `PredictionResult.verbatim` is populated from real model output (null when model emits no verbatim, which is legitimate).

## Threat Surface Scan

No new network endpoints, auth paths, or new access surface introduced. `verbatim` persists on the same `user_id`-scoped, RLS-governed `analysis_results` row the existing pipeline already writes. T-2-03 (information disclosure) accepted per plan — same RLS as emotion_arc. T-2-04/T-2-04b/T-2-05 fully mitigated as planned.

## Self-Check

Files exist:
- [x] `supabase/migrations/20260604000000_persist_engine_verbatim_phase2.sql` — FOUND
- [x] `src/lib/engine/types.ts` (VerbatimPayload + verbatim field) — FOUND
- [x] `src/lib/engine/aggregator.ts` (verbatim pluck + thread) — FOUND
- [x] `src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` (25 tests) — FOUND
- [x] `src/types/database.types.ts` (verbatim in Row/Insert/Update) — FOUND
- [x] `src/app/api/analyze/route.ts` (verbatim at both persist sites) — FOUND
- [x] `src/lib/engine/version.ts` (ENGINE_VERSION = "3.2.0") — FOUND

Commits exist:
- [x] 71ed9f44 — test: changes (VerbatimPayload + test additions via post-commit hook)
- [x] 60f01e38 — feat(02-02): Task 1 aggregator verbatim pluck/thread
- [x] e7dc9b3c — feat(02-02): Task 2 migration + db types + route persist sites
- [x] 75ac99d0 — chore(02-02): Task 4 ENGINE_VERSION 3.2.0

## Self-Check: PASSED
