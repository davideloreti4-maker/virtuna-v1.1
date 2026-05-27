---
phase: 04-live-audience-node-the-killer-feature
plan: "08"
subsystem: audience-node-interactive-surfaces
tags: [tapping, popover, inspector, anti-virality, radix-ui, canvas, a11y]
dependency_graph:
  requires: [04-04, 04-05, 04-06, 04-07]
  provides: [TapPopover, PersonaInspector, AntiViralityOverlay]
  affects: [04-10-AudienceNode]
tech_stack:
  added:
    - Radix PopoverPrimitive (anchor-based canvas positioning)
    - vitest-axe (axe-core a11y testing)
  patterns:
    - GlassPanel inline-style backdropFilter (Lightning CSS workaround)
    - useIsMobile Sheet side switching (desktop right / mobile bottom)
    - isAntiViralityGatedFull dual-trigger discriminator
    - DPR-aware canvas sparkline (AttentionSparkline)
key_files:
  created:
    - src/components/board/audience/TapPopover.tsx
    - src/components/board/audience/PersonaInspector.tsx
    - src/components/board/audience/AntiViralityOverlay.tsx
    - src/components/board/audience/__tests__/TapPopover.test.tsx (rewritten)
    - src/components/board/audience/__tests__/TapPopover.a11y.test.tsx (rewritten)
    - src/components/board/audience/__tests__/PersonaInspector.test.tsx (rewritten)
    - src/components/board/audience/__tests__/AntiViralityOverlay.test.tsx (rewritten)
  modified: []
decisions:
  - Plan 4.9 inline-expand absorbed into PersonaInspector (D-14) — inspector IS the deep-read surface on both desktop/mobile
  - buildAntiViralityHeatmap fixture does NOT trigger isTimelinePatternTriggered (segments 4-6 outside first 5s window); added local buildTimelinePatternHeatmap helper in test file
  - vitest-axe/matchers uses export type — imported via require() to avoid TS1362
metrics:
  duration_seconds: 667
  completed: "2026-05-27T16:17:00Z"
  tasks_completed: 3
  files_created: 7
---

# Phase 04 Plan 08: TapPopover + PersonaInspector + AntiViralityOverlay Summary

**One-liner:** Radix Popover with 5 canvas-anchored content variants, responsive Sheet inspector absorbing plan 4.9 inline-expand, and conditional anti-virality overlay with D-15 hard-locked no-cell-tint guarantee.

## Tasks Completed

| Task | Name | Commit | Tests |
|------|------|--------|-------|
| 1 | TapPopover (5 variants + scroll-dismiss + a11y) | 6bd75ce, 44893d4 | 18 passed |
| 2 | PersonaInspector (desktop right / mobile bottom Sheet) | e6b32d6 | 10 passed |
| 3 | AntiViralityOverlay (dual-trigger variants, D-15 lock) | 60cbc1d | 8 passed |

**Total: 36 tests green**

## Component Details

### TapPopover (6bd75ce)

- Radix `PopoverPrimitive.Root` + `PopoverPrimitive.Anchor` positioned at CSS tap coordinates (x, y viewport px)
- 5 content variants via kind discriminator: `cell`, `marker`, `cluster`, `curve-point`, `fix-chip`
- Scroll-dismiss: window scroll listener comparing delta from mount-time `scrollY` ref; triggers `onOpenChange(false)` when `|delta| > 40px`
- Escape-dismiss: handled by Radix Popover natively
- GlassPanel via React inline style — `backdropFilter: 'blur(5px)'` NOT Tailwind class (Lightning CSS workaround per CLAUDE.md)
- `z-index: 300` (above command bar 200, below modal 400)
- `data-tap-anchor` div positioned at anchor coordinates for test assertions
- `data-tap-popover-content` attribute on content for style assertions

### PersonaInspector (e6b32d6)

- Radix `Sheet` from `src/components/ui/sheet.tsx`
- `side = isMobile ? 'bottom' : 'right'` via `useIsMobile()` hook
- Desktop: `max-w-[360px]` right panel. Mobile: `max-h-[85dvh]` bottom sheet
- Content: archetype tag (coral border), persona ID, pass1 verdict + confidence, swipe prediction, segment_reasons timeline with "Jump to segment →" buttons
- `AttentionSparkline`: private canvas component — DPR-aware, RAF one-shot draw, 1px coral stroke, no gradient fill, no morph
- Empty state when `personaId === null` or persona not in heatmap: "No persona selected"
- `onCloseAutoFocus` returns focus to `triggerRef` if provided
- **D-14 absorbed**: inline-expand from original plan 4.9 collapsed here; inspector IS the deep-read surface

### AntiViralityOverlay (60cbc1d)

- `isAntiViralityGatedFull(confidence, heatmap)` called via `useMemo` on every `result` change
- Three reason branches:
  - `reason === 'confidence'`: 1px `var(--color-warning)` border + ⚠ warning span; NO chips
  - `reason === 'timeline_pattern'`: fix-chip buttons below filmstrip (per `dropoff_segment_indices`); NO border
  - `reason === 'both'`: border + chips combined
- Fix chip anatomy: `text-[11px]`, `borderColor: var(--color-warning)`, `background: var(--color-surface-elevated)`, `rounded-[4px]`
- `fixTextBySegment[segIdx] ?? 'rework segment'` fallback
- `role="status" aria-live="polite"` for screen readers
- CSS transition `400ms cubic-bezier(0.4,0,0.2,1)` on opacity (enter), handled by parent state
- **D-15 hard lock**: zero references to `rgba(255,127,80` or `heatmap-cell` in source

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] buildAntiViralityHeatmap fixture does not trigger timeline pattern**
- **Found during:** Task 3 testing
- **Issue:** `buildAntiViralityHeatmap` sets low attention on segments 4-6 (t=12-21s), but `isTimelinePatternTriggered` checks `t_start < 5` → only covers segments 0-1. Aggregate loss at 0→1 was 0.07, not ≥0.40.
- **Fix:** Added local `buildTimelinePatternHeatmap()` helper in `AntiViralityOverlay.test.tsx` that sets `weighted_curve[0]=1.0, [1]=0.5` and persona attentions `[0]=1.0, [1]=0.4` — produces 50%/60% drops satisfying both ≥40% thresholds.
- **Files modified:** `src/components/board/audience/__tests__/AntiViralityOverlay.test.tsx`
- **Commit:** 60cbc1d

**2. [Rule 2 - Missing a11y] PersonaInspector empty state missing SheetTitle**
- **Found during:** Task 2 — Radix Dialog console warning about missing `DialogTitle` in empty state
- **Fix:** Added `<SheetHeader><SheetTitle className="sr-only">Persona analysis</SheetTitle></SheetHeader>` in empty state branch
- **Files modified:** `src/components/board/audience/PersonaInspector.tsx`
- **Commit:** e6b32d6

**3. [Rule 1 - Bug] vitest-axe/matchers uses `export type` syntax**
- **Found during:** Task 1 a11y test — TS1362 error "cannot be used as a value because it was exported using export type"
- **Fix:** Changed import to `const { toHaveNoViolations } = require('vitest-axe/matchers')` to avoid TS type-only export restriction at runtime
- **Files modified:** `src/components/board/audience/__tests__/TapPopover.a11y.test.tsx`
- **Commit:** 44893d4

**4. [Rule 1 - Bug] `border: 'none'` DOM storage format**
- **Found during:** Task 3 test for timeline_pattern — `style.border` is stored as `"none none none"` in happy-dom (shorthand expansion)
- **Fix:** Changed test assertion from `.toBe('none')` to `.toMatch(/^none/)`
- **Files modified:** `src/components/board/audience/__tests__/AntiViralityOverlay.test.tsx`
- **Commit:** 60cbc1d

## D-15 Hard Lock Verification

```
grep -cE "background.*rgba\(255.{0,3}127.{0,3}80|heatmap-cell" src/components/board/audience/AntiViralityOverlay.tsx
# → 0
```

Overlay renders only border + chips. Zero coral/heatmap-intensity references in source.

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| TapPopover exists, exports TapPopover | PASS |
| PopoverAnchor/Content/Primitive ≥ 2 | PASS (7) |
| backdropFilter inline ≥ 1 | PASS (1) |
| backdrop-blur/backdrop-filter class = 0 | PASS (0) |
| kind === '...' discriminators ≥ 5 | PASS (5) |
| TapPopover tests ≥ 11 passed, 0 failed | PASS (18 passed) |
| PersonaInspector exists, exports PersonaInspector | PASS |
| useIsMobile ≥ 1 | PASS (2) |
| side='bottom' + side='right' ≥ 2 | PASS (2) |
| onJumpToSegment ≥ 2 | PASS (3) |
| segment_reasons ≥ 1 | PASS (2) |
| canvas ≥ 1 | PASS (1) |
| PersonaInspector tests ≥ 9 passed, 0 failed | PASS (10 passed) |
| AntiViralityOverlay exists, exports AntiViralityOverlay | PASS |
| isAntiViralityGatedFull ≥ 1 | PASS (2) |
| reason discriminators ≥ 3 | PASS (5 total) |
| var(--color-warning) ≥ 2 | PASS (3) |
| D-15 hard lock audit = 0 | PASS (0) |
| AntiViralityOverlay tests ≥ 7 passed, 0 failed | PASS (8 passed) |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All three components are presentational; they receive server-supplied data (confidence, heatmap, counterfactuals) as props. XSS mitigations per T-04-16/T-04-17:
- `fixText` rendered as React text children (auto-escaped, never `dangerouslySetInnerHTML`)
- All button labels use template string interpolation (safe)

## Known Stubs

None. All components wire to real data via props. Wiring to `AudienceNode` local state is plan 04-10's responsibility per `must_haves.key_links`.

## Self-Check: PASSED

- `src/components/board/audience/TapPopover.tsx` — EXISTS
- `src/components/board/audience/PersonaInspector.tsx` — EXISTS
- `src/components/board/audience/AntiViralityOverlay.tsx` — EXISTS
- Commit 6bd75ce — EXISTS (TapPopover)
- Commit e6b32d6 — EXISTS (PersonaInspector)
- Commit 60cbc1d — EXISTS (AntiViralityOverlay)
- Commit 44893d4 — EXISTS (a11y fix)
- 36 tests green, 0 failed
