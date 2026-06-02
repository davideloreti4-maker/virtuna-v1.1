---
phase: 05-develop-predict-lineage
plan: "02"
subsystem: develop-trigger
tags: [component, stream, navigation, lineage]
dependency_graph:
  requires: [05-01]
  provides: [AdaptConceptCard.onDevelop, AdaptFrameBody.developStream, navigate-on-started]
  affects:
    - src/components/board/adapt/AdaptConceptCard.tsx
    - src/components/board/adapt/AdaptFrameBody.tsx
tech_stack:
  added: []
  patterns: [second-stream-instance, navigate-on-started-ref, useCallback-stream-handler]
key_files:
  created: []
  modified:
    - src/components/board/adapt/AdaptConceptCard.tsx
    - src/components/board/adapt/AdaptFrameBody.tsx
decisions:
  - "developStream is a second useAnalysisStream instance, not a reuse of the remix stream — guarantees isolation (C3/D-02)"
  - "brief assembly uses 3 fields joined with double-newline (hook + angle + format_borrowed) per D-04; concept.hook as first line serves as D-05 label in Recent"
  - "parent_id = analysisId sourced from usePermalinkAnalysis (line 59) — known before started frame (D-07); NOT derived from child SSE"
  - "navigate-on-started: developPrevIdRef.current === null gate ensures router.push fires exactly once on null→id transition (D-01)"
  - "isPending covers analyzing|reconnecting|polling phases — disables all 3 card triggers while stream is in flight (T-05-03 DoS mitigation)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-02T11:15:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 05 Plan 02: Develop & Predict Trigger Summary

**One-liner:** Per-concept "Develop & predict" button wired into AdaptConceptCard and AdaptFrameBody to launch one scored child stream with parent_id on click and navigate to the child board on started.

## What Was Built

Develop & Predict payoff for the Adapt frame (DEVELOP-01):

1. **AdaptConceptCard trigger** — `AdaptConceptCardProps` extended with `onDevelop?: () => void` and `isPending?: boolean`. Trigger renders only when `onDevelop` is provided (gated — preserves Phase 4 callers that pass no callback). Raycast secondary-action styling: `text-white/55 → hover:text-foreground`, full-width (`w-full`) for mobile tap target, plain-text `→` arrow (no icon dependency), `opacity-40 pointer-events-none` when `isPending`. No coral accent, no border change on hover.

2. **AdaptFrameBody Develop stream** — `developStream = useAnalysisStream({ initialData: null })` added as a second, isolated stream instance (separate from the existing remix `stream` on line 60). `handleDevelop(concept: AdaptConcept)` assembles a `content_text` brief by joining `hook`, `angle`, and `Format: ${format_borrowed}` with `\n\n`, then calls `developStream.start` with `input_mode: 'text'`, `content_type: 'video'`, `mode: 'score'`, `parent_id: analysisId`. The `analysisId` is the source remix id from `usePermalinkAnalysis` — known before the child's `started` frame (D-07).

3. **Navigate-on-started** — `developPrevIdRef` initialized to `null`; `useEffect` keyed on `[developStream.analysisId, router]` fires `router.push('/analyze/' + id)` exactly once when `developPrevIdRef.current === null` (verbatim Board.tsx D-01 pattern). No redundant navigation on re-renders.

4. **C3 discipline enforced** — `handleDevelop` is the only code path to `developStream.start`. It is only reachable via a single card's `onClick`. No loop, no prefetch over concepts. `isPending` blocks all card triggers while a stream is in flight, preventing duplicate submissions (T-05-03).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `7f245225` | Add Develop & predict trigger to AdaptConceptCard |
| Task 2 | `740e845f` | Wire Develop stream in AdaptFrameBody |

## Acceptance Criteria Verification

- [x] `AdaptConceptCardProps` declares `onDevelop?: () => void` and `isPending?: boolean`
- [x] Trigger is gated on `onDevelop &&` — cards without callback show no button
- [x] Button text "Develop & predict", arrow is plain text `→`, no `@phosphor-icons` import added
- [x] Button is `w-full`, uses `disabled={isPending}`
- [x] No `text-accent`/`bg-accent` on trigger; no border color change on hover
- [x] Second `useAnalysisStream` (`developStream`) exists, distinct from line-60 remix `stream`
- [x] `handleDevelop` assembles `content_text` from hook + angle + format_borrowed (3 fields joined)
- [x] `developStream.start(...)` called with `input_mode: 'text'`, `mode: 'score'`, `parent_id: analysisId`
- [x] Navigate effect fires once when `developPrevIdRef.current === null`
- [x] Each `AdaptConceptCard` in success render receives `onDevelop` and `isPending`
- [x] No loop/prefetch — start is only reachable via single card onClick (C3/D-02)
- [x] `npx tsc --noEmit` — TypeScript: No errors found

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Develop trigger routes to the existing `/api/analyze` endpoint (already auth-gated and rate-limited). `parent_id` is validated by `AnalysisInputSchema` (05-01). T-05-03 mitigated via `isPending` gate. T-05-04 mitigated via server-side ownership check. T-05-05 accepted (brief contains only user's own concept fields).

## Self-Check: PASSED

Both modified files exist on disk. Both task commits (`7f245225`, `740e845f`) confirmed in git log.
