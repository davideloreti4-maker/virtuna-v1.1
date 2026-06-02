---
phase: 05-develop-predict-lineage
plan: "04"
subsystem: regression-polish
tags: [error-boundary, raycast, mobile, regression, tsc]
dependency_graph:
  requires: [05-02, 05-03]
  provides: [FrameErrorBoundary, decode-adapt-error-containment, mobile-tap-target-fix]
  affects:
    - src/components/board/FrameErrorBoundary.tsx
    - src/components/board/Board.tsx
    - src/components/board/BoardMobile.tsx
    - src/components/board/adapt/AdaptConceptCard.tsx
tech_stack:
  added: []
  patterns: [react-error-boundary-class, raycast-conformance-sweep, mobile-tap-target]
key_files:
  created:
    - src/components/board/FrameErrorBoundary.tsx
  modified:
    - src/components/board/Board.tsx
    - src/components/board/BoardMobile.tsx
    - src/components/board/adapt/AdaptConceptCard.tsx
decisions:
  - "FrameErrorBoundary: class component required by React (getDerivedStateFromError must be static); no external dependency (T-05-SC)"
  - "Fallback copy: generic '{frame} couldn't render' + muted secondary — no stack/PII rendered to DOM (T-05-10)"
  - "Score-mode frames NOT wrapped in FrameErrorBoundary — scope minimal, D-14 regression surface clean"
  - "AdaptConceptCard Develop trigger: py-3 added (12px×2 + ~20px text = ≥44px tap target for mobile)"
  - "Raycast audit: DecodeShellNode, AdaptShellNode, AdaptFrameBody all conformant — no changes needed"
  - "coral accent on format_borrowed chip (AdaptConceptCard line 39) is sanctioned per CLAUDE.md reserved-for rule"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-02T12:30:00Z"
  tasks_completed: 3
  tasks_total: 4
  files_changed: 4
---

# Phase 05 Plan 04: Regression + Polish (FrameErrorBoundary, Raycast Sweep, Mobile) Summary

**One-liner:** FrameErrorBoundary class component wraps Decode + Adapt mounts on desktop + mobile; Raycast sweep confirmed conformant except Develop trigger mobile tap-target fixed (py-3); full regression gate (tsc, lint, 1840 tests, build) passes.

## What Was Built

Phase-level polish + regression gate for the Develop & Predict milestone (D-14):

1. **FrameErrorBoundary** (`src/components/board/FrameErrorBoundary.tsx`) — `'use client'` class component with `static getDerivedStateFromError` (returns `{ hasError: true }`) and `componentDidCatch` (console.error to dev tooling only — T-05-10). Props: `frameLabel: string`, `children: React.ReactNode`. Fallback: `role="alert"`, `data-testid="frame-error-boundary"`, Raycast chip style (`rounded-xl border border-white/[0.06] p-4`), no coral, no glow. A render throw in Decode or Adapt is contained — the rest of the board keeps rendering (T-05-09 / D-14).

2. **Board.tsx wrapped** — `FrameErrorBoundary` imported and wrapping `DecodeShellNode` + `AdaptShellNode` mounts only. Score-mode frames (verdict/actions/input/engine/audience/content-analysis) are NOT wrapped — scope kept minimal.

3. **BoardMobile.tsx wrapped** — same pattern for `case 'decode'` and `case 'adapt'` in the mobile card render switch. Score cases untouched.

4. **Develop trigger tap target** — `AdaptConceptCard`: Develop button had no explicit vertical padding (`text-xs` alone ≈ 18–20px). Added `py-3` (24px padding) bringing effective height to ≥44px for mobile tappability. Desktop look unchanged (button is still inline at bottom of card).

5. **Raycast audit result** — `DecodeShellNode`, `AdaptShellNode`, `AdaptFrameBody` fully conformant: no `white/[0.08]`/`white/[0.12]` borders, no `drop-shadow`/glow tokens, no unauthorized coral usage. `format_borrowed` chip (`text-accent bg-accent/[0.12]`) in `AdaptConceptCard` is the sanctioned coral accent use.

6. **Regression gate** — `npx tsc --noEmit` → 0 errors. `npm run lint` → 0 errors in changed files (pre-existing lint warnings in unrelated files are out of scope). `npm test` → 1840 passed, 0 failed. `npm run build` → compiled successfully in 11.6s, 55/55 static pages generated.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `df34b472` | feat(05-04): create FrameErrorBoundary and wrap Decode + Adapt mounts |
| Task 2 | `469b7f96` | fix(05-04): add py-3 to Develop trigger for ≥44px mobile tap target |
| Task 3 | (no source edits — verification only) | tsc, lint, 1840 tests, build all pass |

## Acceptance Criteria Verification

- [x] `FrameErrorBoundary.tsx` is a class component with both `getDerivedStateFromError` and `componentDidCatch`; renders a `role="alert"` Raycast fallback (no coral, no glow); `data-testid="frame-error-boundary"`
- [x] `Board.tsx` wraps BOTH decode and adapt mounts; score-mode frames NOT wrapped
- [x] `BoardMobile.tsx` wraps the decode and adapt cases; score-mode cases untouched
- [x] No non-Raycast border opacities (white/[0.08], white/[0.12]) and no glow tokens in DecodeShellNode, AdaptShellNode, or AdaptConceptCard
- [x] Develop trigger is full-width with ≥44px effective tap target on mobile (py-3 added)
- [x] No score-mode component file modified
- [x] `npx tsc --noEmit` → TypeScript: No errors found
- [x] `npm test` → 1840 passed, 26 skipped, 0 failed
- [x] `npm run build` → compiled successfully

## Deviations from Plan

**1. [Rule 2 - Missing] Mobile tap target fix**
- **Found during:** Task 2 Raycast sweep
- **Issue:** `AdaptConceptCard` Develop trigger button had no explicit vertical padding. `text-xs` line-height (~20px) alone falls below the 44px mobile touch target minimum.
- **Fix:** Added `py-3` class (12px top + 12px bottom + ~20px text = ≥44px effective height)
- **Files modified:** `src/components/board/adapt/AdaptConceptCard.tsx`
- **Commit:** `469b7f96`
- **Note:** Plan §Task 2 explicitly anticipated this finding and authorized it: "if its rendered height is below 44px on mobile, add vertical padding (e.g. py-2)". Used py-3 for a clean 44px+ margin.

## Raycast Audit Results

| File | Status | Notes |
|------|--------|-------|
| `DecodeShellNode.tsx` | Conformant, no change | 6% borders, no glow/tint, correct text hierarchy |
| `AdaptShellNode.tsx` | Conformant, no change | Thin wrapper — no styling of its own |
| `AdaptFrameBody.tsx` | Conformant, no change | NichePicker/Button/Skeleton use design system components |
| `AdaptConceptCard.tsx` | Fixed | py-3 added for tap target; coral chip is sanctioned |

## Regression Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS — TypeScript: No errors found |
| `npm run lint` (changed files) | PASS — 0 errors in FrameErrorBoundary, Board, BoardMobile, AdaptConceptCard |
| `npm test` | PASS — 1840 tests passed, 26 skipped (all pre-existing), 0 failed |
| `npm run build` | PASS — compiled successfully 11.6s, 55/55 pages generated |
| Score-path tests (Board/BoardMobile) | PASS — all Board + BoardMobile tests green, decode/adapt NOT in score cases |

## Known Stubs

None. FrameErrorBoundary is a fully functional render error boundary — no stub behavior.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. FrameErrorBoundary is a pure React component with no external data flow. Console.error logs to dev tooling only — no stack trace or PII rendered to DOM (T-05-10 satisfied). No new dependencies introduced (React built-in class lifecycle).

## Human Checkpoint Pending

Task 4 is a `checkpoint:human-verify` gate for the full Develop & lineage loop on the running app (8-step verification including mobile card-stack, chip navigation, Recent tag, error boundary containment, and grade-mode regression). This SUMMARY records the 3 automatable tasks as complete.

## Self-Check: PASSED

- `src/components/board/FrameErrorBoundary.tsx` — exists (created)
- `src/components/board/Board.tsx` — FrameErrorBoundary wraps decode + adapt (grep confirms 5 occurrences)
- `src/components/board/BoardMobile.tsx` — FrameErrorBoundary wraps decode + adapt (grep confirms 5 occurrences)
- `src/components/board/adapt/AdaptConceptCard.tsx` — py-3 present on Develop trigger button
- Commit `df34b472` confirmed in git log (Task 1)
- Commit `469b7f96` confirmed in git log (Task 2)
- npm test: 1840 passed confirmed in run output
- npm run build: "Compiled successfully" confirmed in run output
