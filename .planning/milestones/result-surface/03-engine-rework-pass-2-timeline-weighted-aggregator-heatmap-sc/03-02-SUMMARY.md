---
phase: 03
plan: 02
subsystem: engine/schema-types-config
tags: [phase-3, schema, types, wave-0-omni, events, ffmpeg]
dependency_graph:
  requires:
    - src/lib/engine/qwen/schemas.ts (SegmentSchema added here)
    - src/lib/engine/events.ts (new StageEvent variants)
    - src/lib/engine/types.ts (HeatmapPayload, PredictionResult extensions)
    - next.config.ts (ffmpeg-static externalized)
  provides:
    - src/lib/engine/qwen/schemas.ts
    - src/lib/engine/qwen/omni-analysis.ts
    - src/lib/engine/qwen/normalize-segments.ts
    - src/lib/engine/qwen/__tests__/normalize-segments.test.ts
    - src/lib/engine/types.ts
    - src/lib/engine/events.ts
    - src/hooks/queries/use-analysis-stream.ts (PerPersonaPartial extended)
    - next.config.ts
  affects:
    - Plans 04/05/06/07/08 (all import HeatmapPayload, SegmentGrid, new event variants)
tech_stack:
  added: []
  patterns:
    - Additive optional fields on existing interfaces (emotion_arc pattern extended to segments[])
    - Server-side normalizer with deterministic fallback (D-07 + D-08 rules)
    - Re-export barrel from types.ts for engine consumers (SegmentGrid, PersonaStreamingPartial)
key_files:
  created:
    - src/lib/engine/qwen/normalize-segments.ts
    - src/lib/engine/qwen/__tests__/normalize-segments.test.ts
  modified:
    - src/lib/engine/qwen/schemas.ts
    - src/lib/engine/qwen/omni-analysis.ts
    - src/lib/engine/types.ts
    - src/lib/engine/events.ts
    - src/hooks/queries/use-analysis-stream.ts
    - next.config.ts
decisions:
  - "SegmentGrid re-exported from types.ts: engine consumers use @/lib/engine/types single import surface; avoids reaching into qwen/ internals"
  - "PersonaStreamingPartial added to types.ts: D-15 partial shape lives in engine types, not hook file; hook's PerPersonaPartial also extended for backward compat"
  - "normalizeSegments fallback threshold: 4 segments (MIN_BOUNDARY_COUNT) before falling back to fixed buckets — aligns with D-07 and provides at least 4 time windows"
  - "Hook zone split uses enforceHookZoneBoundary before mergeSubMinSegments: ensures Rule 2 invariant always checked first, then merges applied within zones"
  - "videoDurationSeconds derived from max t_end of raw segments as defensive fallback when not passed through opts: avoids requiring a new parameter on OmniAnalysisOptions"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-27T08:19:03Z"
  tasks_completed: 3
  files_created: 2
  files_modified: 6
---

# Phase 3 Plan 02: Schema + Type Contracts Summary

**One-liner:** API lock for Phase 3 — SegmentSchema (D-07), D-08 normalizer, HeatmapPayload (D-13), PredictionResult.weighted_* (D-12), PersonaStreamingPartial (D-15), 3 new SSE event variants, ffmpeg-static externalized (Pitfall 1).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend Zod schemas + omni prompt for segments[] | 619505f | schemas.ts, omni-analysis.ts, normalize-segments.ts (new), normalize-segments.test.ts (new) |
| 2 | Extend types.ts (PredictionResult + HeatmapPayload + partial.personas) and events.ts | 97e1751 | types.ts, events.ts, use-analysis-stream.ts |
| 3 | Configure next.config.ts to externalize ffmpeg-static | 5aa8033 | next.config.ts |

## Type Signatures (Verbatim)

### SegmentGrid (from schemas.ts)

```typescript
export const SegmentSchema = z.object({
  t_start: z.number().min(0),
  t_end:   z.number().min(0),
  visual_event: z.string().max(200),
  audio_event:  z.string().max(200),
  scene_boundary_reason: z.string().max(300).optional(),
  is_hook_zone: z.boolean().optional(),
  idx: z.number().int().min(0).optional(),
});
export type SegmentGrid = z.infer<typeof SegmentSchema>;
```

### HeatmapPayload (from types.ts, D-13 verbatim)

```typescript
export interface HeatmapPayload {
  segments: Array<{
    idx: number;
    t_start: number;
    t_end: number;
    label?: string;
    is_hook_zone: boolean;
    keyframe_uri: string | null;
  }>;
  personas: Array<{
    id: string;
    attentions: number[];
    swipe_predicted_at: number | null;
    segment_reasons: Record<number, string>;
  }>;
  weighted_curve: number[];
  weights: {
    fyp: number;        // 0.65
    niche: number;      // 0.20
    loyalist: number;   // 0.10
    cross_niche: number;// 0.05
  };
  weights_source: 'default' | 'niche_override' | 'creator_override' | 'analysis_override';
}
```

### PredictionResult additions (D-12)

```typescript
weighted_completion_pct?: number | null;
weighted_top_dropoff_t?: number | null;
weighted_hook_score?: number | null;
heatmap?: HeatmapPayload | null;
```

### New StageEvent variants

```typescript
| { type: "pass2_persona_start"; persona_id: string; archetype: string }
| { type: "pass2_persona_end"; persona_id: string; archetype: string; latency_ms: number; cost_cents: number; ok: boolean }
| { type: "filmstrip_segment_ready"; segment_idx: number; keyframe_uri: string }
```

## Verification Results

```
pnpm vitest run \
  src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts \
  src/lib/engine/__tests__/events.test.ts \
  src/lib/engine/qwen/__tests__/normalize-segments.test.ts \
  --reporter=dot

Test Files: 3 passed (3)
Tests:      23 passed (23)
Exit code:  0
```

```
pnpm tsc --noEmit — zero new errors in any plan-modified file
Pre-existing board/__tests__ errors are unrelated to plan scope
```

## D-08 Normalizer (normalize-segments.ts)

Three rules enforced by `normalizeSegments(raw, videoDurationSeconds)`:

1. **Rule 1:** Merge any segment with `t_end - t_start < 1` into adjacent (prefer next; fallback previous). No merge across the 3s hook-zone boundary.
2. **Rule 2:** `enforceHookZoneBoundary` splits segments straddling t=3 before any merge pass.
3. **Rule 3:** `< 4` post-normalization segments OR malformed timestamps → `buildFixedBuckets`: 2s buckets for `>= 8s`, 1s buckets for `< 8s`; first bucket always 0-3s hook zone.

Constants: `HOOK_ZONE_END_S = 3`, `MIN_CELL_WIDTH_S = 1`, `MIN_BOUNDARY_COUNT = 4`, `SHORT_VIDEO_THRESHOLD_S = 8`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test for Rule 1 (merge sub-1s) triggered Rule 3 fallback with only 3 segments**
- **Found during:** Task 1 test execution
- **Issue:** Test input `[seg(0,2), seg(2,2.4), seg(2.4,5)]` — 3 segments. After merging, 2 segments remain < `MIN_BOUNDARY_COUNT` (4) → normalizer falls back to fixed buckets (5 segments), so `result.length < input.length` (5 < 3) failed.
- **Fix:** Updated test to use 6 segments so merge result stays above MIN_BOUNDARY_COUNT. Test now correctly validates Rule 1 without triggering Rule 3.
- **Files modified:** `src/lib/engine/qwen/__tests__/normalize-segments.test.ts`
- **Commit:** 619505f

**2. [Rule 2 - Missing Critical Functionality] D-15 partial type needed in engine types, not just hook file**
- **Found during:** Task 2 acceptance criteria check (`grep -c "pass2_status" src/lib/engine/types.ts`)
- **Issue:** `PerPersonaPartial` lives in `src/hooks/queries/use-analysis-stream.ts`, not `src/lib/engine/types.ts`. Acceptance criteria checks `types.ts`.
- **Fix:** Added `PersonaStreamingPartial` interface directly to `types.ts` (canonical engine type); also extended `PerPersonaPartial` in the hook file for backward compat.
- **Files modified:** `src/lib/engine/types.ts`, `src/hooks/queries/use-analysis-stream.ts`
- **Commit:** 97e1751

## Known Stubs

None — all types are complete interfaces. Downstream consumers (Plans 04-08) will populate the fields.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input_validation | src/lib/engine/qwen/schemas.ts | `z.string().max(200)` on visual_event/audio_event mitigates T-03-02-01 (prompt injection via segment text) per STRIDE register |
| threat_flag: timestamp_validation | src/lib/engine/qwen/normalize-segments.ts | Non-monotonic/NaN/negative timestamp detection in `hasMalformedTimestamps` mitigates T-03-02-02 |

Existing T-03-02-03 (tenant disclosure) remains covered by Phase 1 RLS — no new endpoints added in this plan.

## Self-Check: PASSED

Files exist:
- [x] src/lib/engine/qwen/schemas.ts — SegmentSchema + SegmentGrid exported
- [x] src/lib/engine/qwen/omni-analysis.ts — segments instruction + normalizeSegments wired
- [x] src/lib/engine/qwen/normalize-segments.ts — D-08 normalizer
- [x] src/lib/engine/qwen/__tests__/normalize-segments.test.ts — 10 unit tests
- [x] src/lib/engine/types.ts — HeatmapPayload, PersonaStreamingPartial, PredictionResult extensions
- [x] src/lib/engine/events.ts — 3 new StageEvent variants
- [x] src/hooks/queries/use-analysis-stream.ts — PerPersonaPartial D-15 extension
- [x] next.config.ts — ffmpeg-static externalized

Commits exist:
- [x] 619505f — feat(03-02): extend Zod schemas + omni prompt for segments[] (Task 1)
- [x] 97e1751 — feat(03-02): extend types.ts, events.ts, and partial type for Phase 3 (Task 2)
- [x] 5aa8033 — chore(03-02): externalize ffmpeg-static in next.config.ts (Task 3)
