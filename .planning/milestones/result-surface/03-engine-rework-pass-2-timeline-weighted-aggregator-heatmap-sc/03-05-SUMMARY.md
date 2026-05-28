---
phase: "03"
plan: "05"
subsystem: engine/anti-virality
tags: [phase-3, anti-virality, stage10, thinking-mode, D-16, D-17, D-21]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [isTimelinePatternTriggered, isAntiViralityGatedFull, topDropoffSegmentIndices, Stage10-qwen3.6-plus]
  affects: [03-08-aggregator-wiring, Phase-5-visual-treatment]
tech_stack:
  added: []
  patterns: [dual-trigger OR logic, DashScope thinking-mode, calculateCost helper]
key_files:
  created: []
  modified:
    - src/lib/engine/anti-virality.ts
    - src/lib/engine/stage10-critique.ts
    - src/lib/engine/__tests__/anti-virality.test.ts
    - src/lib/engine/__tests__/stage10-critique.test.ts
decisions:
  - "Single @ts-expect-error for both enable_thinking+thinking_budget (TypeScript bundles into one TS2769; two @ts-expect-error would cause TS2578)"
  - "Timeout bumped 45s → 60s for Stage10 (thinking-mode latency)"
  - "topDropoffSegmentIndices exported separately for composability (Phase 5 consumer)"
metrics:
  duration: "12m"
  completed_date: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 3 Plan 05: Anti-Virality Dual-Trigger + Stage10 Thinking-Mode Summary

One-liner: Dual-trigger anti-virality gate (D-17: timeline pattern OR confidence) and Stage10 upgraded to qwen3.6-plus with enable_thinking=true, thinking_budget=4000 (D-21).

## Tasks Completed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 | Add isTimelinePatternTriggered + isAntiViralityGatedFull to anti-virality.ts | d6d3ce9 | 16/16 |
| 2 | Swap Stage10 to qwen3.6-plus thinking-mode (D-21) | 37a192f | 19/19 |

**Combined: 35 tests passing, 0 failing.**

## New Anti-Virality Export Signatures (verbatim)

```typescript
// src/lib/engine/anti-virality.ts

/** D-17: timeline trigger — >=40% attention loss in first 5s AND >=70% persona consensus */
export function isTimelinePatternTriggered(heatmap: HeatmapPayload | null): boolean

/** D-17: top-N worst weighted_curve dips for Phase 5 visual anchoring */
export function topDropoffSegmentIndices(heatmap: HeatmapPayload, n = 3): number[]

/** D-17: dual-trigger OR logic with reason discriminator */
export function isAntiViralityGatedFull(
  confidence: number,
  heatmap: HeatmapPayload | null,
): {
  gated: boolean;
  reason: "confidence" | "timeline_pattern" | "both" | null;
  dropoff_segment_indices: number[];
}

// PRESERVED (D-16 — existing call sites unchanged):
export function isAntiViralityGated(confidence: number): boolean
```

## Stage10 Diff (D-21 — before/after)

| Property | Before | After |
|----------|--------|-------|
| Import | `QWEN_FAST_MODEL` (qwen3.6-flash) | `QWEN_REASONING_MODEL` (qwen3.6-plus) |
| Model in call | `QWEN_FAST_MODEL` | `QWEN_REASONING_MODEL` |
| enable_thinking | absent | `true` (DashScope extension, @ts-expect-error) |
| thinking_budget | absent | `4000` |
| Cost calculation | inline `CACHE_HIT_PRICE * cacheHit + ...` | `calculateCost(QWEN_REASONING_MODEL, usage)` |
| Timeout | 45s (`45_000`) | 60s (`60_000`) |
| Cost import | none | `import { calculateCost } from "./qwen/cost"` |

## D-17 Threshold Implementation

- Aggregate attention loss: `weighted_curve[startIdx] - weighted_curve[endIdx] >= 0.40`
- Persona consensus: `personaDrops / personas.length >= 0.70` (where drop = startA - endA >= 0.40)
- First-5s window: segments with `t_end <= 5`; gate requires `>= 2` segments in window
- NaN guard: all array accesses use `?? 0` (T-03-05-01 mitigated)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Single @ts-expect-error instead of two**

- **Found during:** Task 2 TypeScript verification
- **Issue:** Plan called for `>= 2 @ts-expect-error` (one per DashScope extension property). TypeScript's overload resolution bundles both extra-property errors (`enable_thinking`, `thinking_budget`) into a single TS2769. Adding a second `@ts-expect-error` would cause TS2578 (Unused @ts-expect-error directive) — a new TypeScript error violating the "no new errors" criterion.
- **Fix:** Used ONE `@ts-expect-error` with a comment documenting both DashScope extensions: `// @ts-expect-error — DashScope extensions not in OpenAI SDK types (enable_thinking + thinking_budget)`
- **Files modified:** `src/lib/engine/stage10-critique.ts`
- **Result:** Zero new TypeScript errors; both extensions documented; 19/19 tests passing
- **Acceptance criteria delta:** grep count = 1 (plan required >= 2); functionally equivalent since both extensions share one overload error

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/engine/anti-virality.ts | FOUND |
| src/lib/engine/stage10-critique.ts | FOUND |
| src/lib/engine/__tests__/anti-virality.test.ts | FOUND |
| src/lib/engine/__tests__/stage10-critique.test.ts | FOUND |
| Task 1 commit d6d3ce9 | FOUND |
| Task 2 commit 37a192f | FOUND |
| Tests: 35/35 passing | PASSED |
| New TypeScript errors | 0 |
