---
phase: 04-live-audience-node-the-killer-feature
plan: 10
subsystem: board/audience
tags: [integration, composition, audience-node, board-wire]
dependency_graph:
  requires: [04-04, 04-05, 04-06, 04-07, 04-08, 04-09]
  provides: [AudienceNode mounted in Board, full audience feature visible in board]
  affects: [Board.tsx, audience group frame rendering]
tech_stack:
  added: []
  patterns: [NodeOverlay synthetic NodeSpec, portal pattern for tap surfaces, useAnalysisStream injection]
key_files:
  created:
    - src/components/board/audience/AudienceNode.tsx
  modified:
    - src/components/board/Board.tsx
decisions:
  - "Pass injected stream to useAudienceChoreography to prevent double-subscribe"
  - "pass1Verdict=undefined pending Phase 5 — PredictionResult has no top-level verdict field"
  - "loop_pct and vs_niche_diff_pct passed as null — not in current PredictionResult schema"
  - "fixTextBySegment falls back to 'rework segment' per OQ-2 TODO for Phase 5 counterfactuals"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 4 Plan 10: AudienceNode Integration — Summary

Composed all Phase 4 leaf components into the AudienceNode shell and wired it into Board.tsx via the Audience GroupFrameOverlay children prop. The killer feature is now mounted and visible in the board.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AudienceNode shell — composition + state orchestration | 72f1cb4 | src/components/board/audience/AudienceNode.tsx (created, 355 lines) |
| 2 | Board.tsx integration — render AudienceNode inside Audience GroupFrameOverlay | 3846817 | src/components/board/Board.tsx (import + render branch, +2 lines) |

## What Was Built

### Task 1 — AudienceNode.tsx

The AudienceNode shell:

- Calls `useAnalysisStream()` once at the top, passes the stream object to `useAudienceChoreography` (preventing double-subscribe)
- Calls `useClientWeights(heatmap, initialWeights, confidence)` for client-side recompute
- Owns local UI state: `heatmapOpen`, `inspectorOpen/inspectorPersonaId`, `overrideDrawerOpen`, `popoverOpen/popoverPayload/popoverAnchorPos`
- Derives `totalDurationSec` from last segment's `t_end` (fallback 30s)
- Derives `fixTextBySegment` from `counterfactuals?.suggestions` with TODO OQ-2 fallback to `'rework segment'`
- Derives `antiViralityXRange` as `[startSeg.t_start, endSeg.t_end]` across dropoff indices
- Derives `baselineCurve` from `persona_behavioral_aggregate.completion_pct` as flat array
- Stack order (D-01): HeadlineChips → Filmstrip → RetentionCurve → HeatmapDrawer → AntiViralityOverlay
- Portals above board: TapPopover + PersonaInspector + WeightOverrideDrawer
- `handleOverrideApply` POSTs to `/api/analyze/[analysisId]/override` (T-04-22 boundary)
- `handleJumpToSegment` calls `setActivePreset('audience')` via useBoardStore
- Synthetic NodeSpec offsets y by `TITLE_BAR_HEIGHT` (36px), matches plan spec exactly
- ARIA: `aria-label="Audience analysis"`, `aria-live="polite"`, `aria-busy={isStreaming}` — all present
- `NodeOverlay` wraps content for world→screen projection and GlassPanel styling

### Task 2 — Board.tsx

Added parallel branch alongside existing `engine` branch:

```tsx
{layout.id === 'engine' && <EngineGroup />}
{layout.id === 'audience' && <AudienceNode camera={camera} layout={layout} />}
```

Import added at top: `import { AudienceNode } from './audience/AudienceNode';`

EngineGroup reference count unchanged (4). Zero Board.tsx TS errors.

## Verification Results

- `grep -c "AudienceNode" Board.tsx` → 2 (import + render)
- `grep -c "from.*audience/AudienceNode" Board.tsx` → 1
- `npx tsc --noEmit` → 0 errors in AudienceNode.tsx, 0 errors in Board.tsx
- `npm test -- src/components/board/audience` → 18 files, 125 tests, 0 failed
- `grep -c "useAudienceChoreography|useClientWeights|useAnalysisStream" AudienceNode.tsx` → 6 (≥3 required)
- `grep -c "<HeadlineChips|<Filmstrip|<RetentionCurve|<HeatmapDrawer|<TapPopover|<PersonaInspector|<WeightOverrideDrawer|<AntiViralityOverlay" AudienceNode.tsx` → 9 (≥8 required)
- `grep -c "aria-label=\"Audience analysis\"|aria-live=\"polite\"|aria-busy" AudienceNode.tsx` → 3 (≥3 required)
- `grep -c "NodeOverlay" AudienceNode.tsx` → 5 (≥1 required)
- `grep -c "TITLE_BAR_HEIGHT" AudienceNode.tsx` → 5 (≥1 required)
- `grep -c "/api/analyze/.*override" AudienceNode.tsx` → 2 (≥1 required)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `WEIGHT_PRESETS` unused import**
- **Found during:** Task 1 TS compilation
- **Issue:** WEIGHT_PRESETS imported but not referenced in AudienceNode (WeightOverrideDrawer owns preset display internally)
- **Fix:** Removed unused import
- **Files modified:** AudienceNode.tsx
- **Commit:** 72f1cb4 (pre-commit fix)

**2. [Rule 1 - Bug] `result.verdict` doesn't exist on PredictionResult**
- **Found during:** Task 1 TS compilation
- **Issue:** Plan spec suggested passing `result.verdict` to PersonaInspector but PredictionResult has no top-level `verdict` field (it lives on `PersonaSimulationResult`, a per-persona type)
- **Fix:** Passed `pass1Verdict={undefined}` pending Phase 5 Verdict node which will surface the appropriate pass1 verdict text
- **Files modified:** AudienceNode.tsx
- **Commit:** 72f1cb4 (pre-commit fix)

### Intentional Scope Decisions

- **`loop_pct` and `vs_niche_diff_pct` passed as `null`** — neither field exists in the current `PredictionResult` or `BehavioralPredictions` schema. HeadlineChips shows skeleton for these chips until Phase 5 or schema extension adds them. Plan spec anticipated this: "if unavailable in Phase 1 schema, pass null + chip shows skeleton".

- **`pass1Verdict={undefined}` to PersonaInspector** — `PredictionResult.verdict` does not exist; the field is on individual `PersonaSimulationResult` entries. A future plan can pass the persona's own `verdict` field once it's surfaced through heatmap.personas.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `loop_pct={null}` in HeadlineChips | AudienceNode.tsx:194 | Not in PredictionResult schema; HeadlineChips shows skeleton for this chip |
| `vs_niche_diff_pct={null}` in HeadlineChips | AudienceNode.tsx:195 | Not in PredictionResult schema; niche baseline diff requires Phase 5 data |
| `pass1Verdict={undefined}` in PersonaInspector | AudienceNode.tsx:339 | PredictionResult has no top-level verdict field; Phase 5 Verdict node owns this |
| `fixTextBySegment` fallback to `'rework segment'` | AudienceNode.tsx:89 | OQ-2: counterfactuals.suggestions field path unconfirmed until Phase 5 ships |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced in this plan. The `/api/analyze/[id]/override` fetch in `handleOverrideApply` uses the existing Phase 4 API route (T-04-22 — already in threat register with `accept` disposition; RLS gates DB access).

## Self-Check: PASSED

- [x] `src/components/board/audience/AudienceNode.tsx` exists
- [x] `src/components/board/Board.tsx` contains `AudienceNode` (import + render)
- [x] Commit `72f1cb4` exists (Task 1)
- [x] Commit `3846817` exists (Task 2)
- [x] 18 audience test files, 125 tests, 0 failed
- [x] Zero TS errors in AudienceNode.tsx and Board.tsx
