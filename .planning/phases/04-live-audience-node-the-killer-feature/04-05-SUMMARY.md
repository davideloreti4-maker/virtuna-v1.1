---
phase: 04-live-audience-node-the-killer-feature
plan: "05"
subsystem: board/audience
tags: [components, display, filmstrip, headline-chips, tdd]
dependency_graph:
  requires: [04-02, 04-03]
  provides: [HeadlineChips, Filmstrip]
  affects: [AudienceNode (04-08)]
tech_stack:
  added: []
  patterns: [dl-aria-chip, coral-placeholder-crossfade, skeleton-shimmer]
key_files:
  created:
    - src/components/board/audience/HeadlineChips.tsx
    - src/components/board/audience/Filmstrip.tsx
  modified:
    - src/components/board/audience/__tests__/HeadlineChips.test.tsx
    - src/components/board/audience/__tests__/Filmstrip.test.tsx
decisions:
  - "rgba(255,127,80,0.20) for coral placeholder band (happy-dom normalizes to rgba(255, 127, 80, 0.20) with spaces — tests updated to use substring checks)"
  - "Filmstrip uses absolute positioning for placeholder and img layers — both present in DOM, placeholder fades via opacity 0/1 transition"
  - "HeadlineChips uses <dl>/<dt>/<dd> ARIA chip pattern per UI-SPEC"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 04 Plan 05: HeadlineChips + Filmstrip Summary

HeadlineChips (5-chip metric row + weights transparency badge) and Filmstrip (segment keyframe band with coral placeholder→image cross-fade) — two pure presentational leaf components for the Audience node stack.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | HeadlineChips component | f2e9201 | HeadlineChips.tsx, HeadlineChips.test.tsx |
| 2 | Filmstrip component with placeholder→keyframe swap | 8b6ba7b | Filmstrip.tsx, Filmstrip.test.tsx |

## What Was Built

### HeadlineChips (`src/components/board/audience/HeadlineChips.tsx`)

- 5 metric chips: Avg watch %, Loop %, Top dropoff, Hook score, vs Niche
- Chips use `<dl>/<dt role="term">/<dd role="definition">` ARIA pattern
- Weights transparency badge: `Weighted: {fyp}/{niche}/{loyalist}/{cross_niche}` — tappable, calls `onWeightsBadgeClick`
- Fallback path: when `weighted_*` is null and `fallback` prop provided, shows fallback value + sr-only "(estimated, Pass 1)" note
- Streaming skeleton: when `isStreaming=true` or values null, each chip slot shows `<Skeleton>` block
- vs Niche chip: positive → `text-[var(--color-success)]`, negative → `text-[var(--color-error)]`
- Raycast chip style: `rgba(255,255,255,0.05)` bg, `border-white/[0.06]`, 8px radius

### Filmstrip (`src/components/board/audience/Filmstrip.tsx`)

- `<figure aria-label="Video keyframe filmstrip">` wraps N segment cells
- Cell width proportional: `(t_end - t_start) / totalDurationSec * 100%`, min 48px, height 64px
- Default state: coral band `rgba(255,127,80,0.20)` + segment label text (placeholder per O-4)
- Keyframe swap: when `filmstrips[seg.idx]` string arrives → `<img>` renders with `opacity: 1`; placeholder fades to `opacity: 0`. Both use `transition: opacity 150ms linear` (FILMSTRIP_KEYFRAME_FADE_MS)
- Anti-virality: when `seg.idx` in `antiViralitySegmentIndices` → `⚠` chip positioned below cell with `aria-label="Warning: critical drop in segment N"`
- Empty state (`segments=null`): 10 uniform placeholder cells
- Horizontal scroll: `overflow-x-auto`, `scrollbarWidth: 'none'`

## Tests

- HeadlineChips: 6/6 passed
- Filmstrip: 6/6 passed
- Total: 12/12 passed, 0 failed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertions used wrong rgba substring for happy-dom comparison**
- **Found during:** Task 2 initial test run (2 failing)
- **Issue:** Tests checked `el.style.background?.includes('rgba(255,127,80')` but happy-dom normalizes inline `rgba(255,127,80,0.20)` to `rgba(255, 127, 80, 0.20)` (adds spaces after commas)
- **Fix:** Updated Filmstrip test assertions to check for `'255'`, `'127'`, and `'80'` individually as substrings — semantically equivalent, happy-dom safe
- **Files modified:** `src/components/board/audience/__tests__/Filmstrip.test.tsx`
- **Commit:** 8b6ba7b (included in Task 2 commit)

## Known Stubs

None — both components are fully wired. HeadlineChips receives real prop values from its parent (AudienceNode, plan 04-08). Filmstrip receives `filmstrips` record from `useAnalysisStream().filmstrips` (plan 04-02 extended dispatch).

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. Trust boundaries covered by plan threat model:
- `segment.label` → text content: React auto-escapes, no dangerouslySetInnerHTML
- `keyframe_uri` → `<img src>`: server-signed URL, browser img parser blocks javascript:/data: schemes for cross-origin

## Self-Check: PASSED

- `src/components/board/audience/HeadlineChips.tsx` — FOUND
- `src/components/board/audience/Filmstrip.tsx` — FOUND
- `src/components/board/audience/__tests__/HeadlineChips.test.tsx` — FOUND (6 tests)
- `src/components/board/audience/__tests__/Filmstrip.test.tsx` — FOUND (6 tests)
- Commit f2e9201 — FOUND (git log)
- Commit 8b6ba7b — FOUND (git log)
