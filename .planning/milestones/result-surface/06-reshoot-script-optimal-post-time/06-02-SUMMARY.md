---
phase: 06-reshoot-script-optimal-post-time
plan: "02"
subsystem: api-endpoint, script-transformation, cache-write-through
tags: [api, script, tdd, vitest, supabase, cache, transformation]
dependency_graph:
  requires:
    - analysis_results.script_result JSONB column (Plan 01)
    - src/lib/script-utils.ts formatTime + stripMarkdown (Plan 01)
    - src/components/board/actions/script/script-types.ts ScriptResult (Plan 01)
  provides:
    - GET /api/analyze/[id]/script endpoint
    - computeScript() deterministic transformation (D-03..D-06)
    - Cache hit/miss path with engine-version-skew guard
    - Fire-and-forget service-client write-through
    - Empty-state branch (is_empty_state: true) for high-confidence rows
  affects:
    - Plans 03-05 (UI components that fetch from this endpoint via use-script hook)
tech_stack:
  added:
    - src/app/api/analyze/[id]/script/route.ts (new GET route)
    - src/app/api/analyze/[id]/script/__tests__/route.test.ts (10-case Vitest matrix)
  patterns:
    - Mirror comparisons/route.ts shell (Zod ParamsSchema, auth gate, user_id filter)
    - Fire-and-forget service-client UPDATE pattern (mirrors prediction-cache.ts spirit)
    - TDD RED-GREEN cycle (test file first via plan, route second)
    - 401/400/404 unified error codes (no enumeration)
key_files:
  created:
    - src/app/api/analyze/[id]/script/route.ts
    - src/app/api/analyze/[id]/script/__tests__/route.test.ts
decisions:
  - No Zod parse of cached script_result on read — column written only by this route; engine-version-skew guard is sufficient. Avoids parse cost on every cache hit.
  - eslint-disable @typescript-eslint/no-explicit-any on service-client .then() chain — fire-and-forget with void prefix; typed cast would require a large generic scaffold for a one-off pattern.
  - HOOK_FIX_ANCHOR_RE narrower than HOOK_ANCHOR_RE — opening-line picks must be precise (only 4 leaf decomposition anchors). Broader HOOK_ANCHOR_RE catches edge anchors for empty-state stretch filtering only.
  - scene_order uses plain timestamp_ms ASC sort (no heatmap segment→ms mapping) per RESEARCH Item 2 / S-1 (dropoff_segment_indices→timestamp mapping not available in the row's JSONB without segment lookup).
metrics:
  duration: "12m"
  completed: "2026-05-28"
  tasks_completed: 2
  tasks_blocked: 0
  files_created: 2
  files_modified: 0
---

# Phase 6 Plan 02: GET /api/analyze/[id]/script Endpoint + Tests

GET handler with deterministic PredictionResult → ScriptResult transformation, write-through cache via service-client, and 10-case Vitest integration test matrix.

## Tasks Completed

| Task | Status | Commit |
|------|--------|--------|
| Task 1: Create route.ts with transformation algorithm | DONE | a3cc243 |
| Task 2: Co-located 10-case Vitest test matrix | DONE | 14c0f49 |

## Signal-Anchor Regexes (finalized)

Three regexes finalized in the route for future engine signal-anchor evolution tracking:

```
HOOK_ANCHOR_RE   = /^hook_decomposition\.|gemini_factor\.(Hook|Scroll-Stop|Completion Pull)|first_words|opening/i
TEXT_ANCHOR_RE   = /text_overlay|hashtag|caption|cta/i
HOOK_FIX_ANCHOR_RE = /^hook_decomposition\.(visual_stop_power|audio_hook_quality|first_words_speech_score|text_overlay_score)$|gemini_factor\.(Hook|Scroll-Stop|Completion Pull)|opening/i
```

If the engine surfaces new hook-related `signal_anchor` values post-launch, update `HOOK_FIX_ANCHOR_RE` first (opening-line precision anchor), then `HOOK_ANCHOR_RE` (broader empty-state/scene-order anchor). `TEXT_ANCHOR_RE` only needs updates if new text-overlay signal types are added.

## Transformation Algorithm Deviations from D-03..D-06

None materially. One simplification documented:

- **D-04 `scene_order` dropoff prioritization:** CONTEXT.md D-04 described optional prioritization using `dropoff_segment_indices → heatmap.segments[].t_start` mapping. Per RESEARCH Item 2 (S-1: "No heatmap available"), this mapping is not possible from the `analysis_results` row alone. Fell back to plain `timestamp_ms ASC` sort with 6-item cap. Behavior is equivalent for most rows; dropoff prioritization can be added in a future plan if heatmap is surfaced in the row.

## Cache Write Fire-and-Forget Confirmation

No `await` leaked into the response path. Pattern used:

```typescript
void (serviceClient as any)
  .from('analysis_results')
  .update({ script_result: computed })
  .eq('id', id)
  .then(({ error: writeError }) => {
    if (writeError) { log.warn(...); }
  });
```

The `void` prefix + `.then()` callback means: (a) the Promise is intentionally discarded, (b) write errors are logged at `warn` but never propagate to the response, (c) the response returns the computed result in all cases.

## Vitest Test Results

```
Tests  10 passed (10)
```

All 10 cases green:
1. Cache hit returns persisted ScriptResult (no transformation)
2. Cache miss with low band computes full 4-section script
3. HIGH confidence + !gated + band=high → is_empty_state: true with opening_variants[]
4. anti_virality_gated=true → full script even at HIGH confidence
5. null user → 401 unauthorized
6. path-traversal id → 400 invalid_id
7. wrong-owner (RLS null) → 404 not_found
8. missing row → 404 not_found
9. engine_version skew → recompute (stale cache ignored)
10. service-client write error → still 200 with computed result

Pre-existing failing tests (unrelated to Phase 6): 5 tests across Board.test.tsx, Board.a11y.test.tsx, GroupFrame.test.tsx, VerdictNode.test.tsx, WhyVerdictCollapsible.test.tsx — all failing due to missing react-konva / react-markdown type declarations.

## TypeScript

Zero errors in Phase 6 files. Pre-existing errors (react-konva, detect-gpu stubs) unrelated to this plan.

## Deviations from Plan

None. Plan executed exactly as specified. The `HOOK_FIX_ANCHOR_RE` regex was inlined exactly as designed in the plan's `<action>` block. The `as any` cast on service-client was applied as instructed (mirrors override/route.ts lines 67-78).

## Threat Surface Scan

No new threat surface beyond what's covered in the plan's `<threat_model>`:
- T-06-06 (Spoofing): auth.getUser() gate at line 82 — mitigated
- T-06-07 (Tampering): ParamsSchema at line 17 — mitigated
- T-06-08 (Info Disclosure): unified 404 at line 96 — mitigated
- T-06-09 (Info Disclosure): service-client write scoped to verified-owned id — mitigated
- T-06-10 (Tampering): engine-version-skew guard at line 102 — mitigated

## Known Stubs

None. Route is fully functional. The endpoint is ready for consumption by Plan 03 (use-script TanStack Query hook) and Plans 04-05 (UI components).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/app/api/analyze/[id]/script/route.ts exists | PASS |
| src/app/api/analyze/[id]/script/__tests__/route.test.ts exists | PASS |
| Commit a3cc243 in git log | PASS |
| Commit 14c0f49 in git log | PASS |
| 10 vitest tests pass | PASS |
| 0 TypeScript errors in Phase 6 files | PASS |
| No STATE.md or ROADMAP.md modifications | PASS |
