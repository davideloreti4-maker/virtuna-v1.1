---
phase: 5
plan: uat-ux-followup
subsystem: board-ui
tags: [ux, a11y, polish, tailwind-v4, reduced-motion]
---

# Phase 5 UAT UX Follow-up Summary

9 polish items identified during Playwright UAT, applied as atomic commits after dec517e.

---

## Fixes Applied

### Fix 1 — Responsive mobile banner (<1024px)
**Commit:** e6a3036  
**Files:** `src/components/board/MobileBoardBanner.tsx` (new), `Board.tsx`  
**Tests:** `src/components/board/__tests__/MobileBoardBanner.test.tsx` — 4 tests pass  
**Details:** GlassPanel banner at z-160, gate on `window.innerWidth < 1024`, localStorage dismiss, fires `board_mobile_banner_shown` telemetry, renders above OrientationHint.

---

### Fix 2 — WhyVerdict typography hierarchy (Tailwind v4)
**Commit:** cf8c503  
**Files:** `WhyVerdictCollapsible.tsx`, `WhyVerdictCollapsible.test.tsx`  
**Tests:** 16 tests pass (2 new: space-y-1.5 + leading-[1.45] assertions)  
**Details:** `prose-xs` not available in Tailwind v4 — replaced with explicit `leading-[1.45]`, `space-y-1.5`, `[&_p]:mb-2` utilities. Sub-section lists use `space-y-1.5` for 6px gaps.

---

### Fix 3 — WCAG AA contrast on PlaceholderCard
**Commit:** 0927714  
**Files:** `PlaceholderCard.tsx`, `PlaceholderCard.test.tsx`  
**Tests:** 9 tests pass  
**Details:** `text-white/40` → `text-white/55` on card container. `/40` (6.5% opacity) fails 4.5:1 at 12px on `bg-white/[0.02]` dark surface. Test assertion updated.

---

### Fix 4 — Confidence level dot indicator in PercentileChip
**Commit:** ca7e987  
**Files:** `PercentileChip.tsx`, `PercentileChip.test.tsx`  
**Tests:** 17 tests pass (4 new: dot color class per label + no dot in skeleton)  
**Details:** 4px inline circle before "Confidence: X" label. GREEN (`bg-success`) = HIGH, AMBER (`bg-warning`) = MEDIUM, CORAL (`bg-accent`) = LOW. Hidden in streaming state.

---

### Fix 5 — PercentileChip skeleton visibility + breathing animation
**Commit:** b2dd697  
**Files:** `PercentileChip.tsx`, `src/app/globals.css`  
**Tests:** 17 tests pass (no regression)  
**Details:** Skeleton percentile `text-white/20` → `text-white/35`. Added `@keyframes skeleton-breathe` (opacity 40%→60%, 1.2s ease-in-out) + `.animate-skeleton-breathe` utility class in globals.css.

---

### Fix 6 — Unified empty-state copy across 3 components
**Commit:** cfcf717  
**Files:** `actions-constants.ts`, `SimilarVideosCard.tsx`, `content-analysis-constants.ts`, `HookDecompNode.tsx`, `EmotionArcNode.tsx` + 3 test files  
**Tests:** 35 tests pass across 4 test files  
**Details:** Standardised template `"<Feature> isn't available for this analysis"` for missing data. CTA copy (`try a new analysis`) kept only for zero-items case in SimilarVideosCard. Added `SIMILAR_VIDEOS_UNAVAILABLE`, `HOOK_DECOMP_UNAVAILABLE`, `EMOTION_ARC_UNAVAILABLE` constants.

---

### Fix 7 — vs-my-history empty CTA link
**Commit:** 4a6199d  
**Files:** `VsHistoryCollapsible.tsx`, `VsHistoryCollapsible.test.tsx`  
**Tests:** 8 tests pass (2 new: CTA present + onClick calls openInputDrawer)  
**Details:** Added coral `→ Run another analysis` button below empty state text. Calls `openInputDrawer` from board-store on click.

---

### Fix 8 — TikTok embed modal focus trap + keyboard
**Commit:** 6a8f024  
**Files:** `SimilarVideosCard.tsx`, `SimilarVideoCardCompact.tsx` + 3 test files (updated mocks + new focus test)  
**Tests:** 32 tests pass in actions suite (3 new focus tests)  
**Details:** Added `DialogClose` with `autoFocus` inside modal for initial focus. `onOpenAutoFocus` prevents Radix default. `onCloseAutoFocus` returns focus to triggering row element. Updated `SimilarVideoCardCompact.onTap` signature to pass `HTMLElement | null`. Updated 3 dialog mocks to include `DialogClose` export.

---

### Fix 9 — Reduced-motion verification
**Commit:** 6d67047  
**Files:** `GlassProgress.tsx`, `WhyVerdictCollapsible.tsx`, `VsHistoryCollapsible.tsx` + 2 test files  
**Tests:** 27 tests pass in content-analysis suite (2 new)  
**Details:**
- `GlassProgress`: `transition-all duration-300` → `motion-safe:transition-all motion-safe:duration-300` (CSS-level guard, no prop needed)
- `WhyVerdictCollapsible` chevron: `transition-transform` → `motion-safe:transition-transform`
- `VsHistoryCollapsible` chevron: same
- `EmotionArcNode`: `isAnimationActive={!prefersReducedMotion}` already in place (verified)
- `ActionsNode` frame transition: already conditional at line 47 (verified)

---

## Test Summary

| Metric | Baseline | Final |
|--------|---------|-------|
| Test files | 143 passed / 1 failed | 145 passed / 1 failed |
| Tests passing | 1553 | 1570 (+17) |
| Pre-existing failures | 1 (Sidebar a11y env var) | 1 (same) |
| New tests added | — | 17 |

---

## TypeScript

`npx tsc --noEmit`: 3 pre-existing errors in `src/app/api/analysis/[id]/route.ts` (schema type mismatch, pre-dating this PR). 0 new errors introduced.

---

## Deviations from Plan

**None significant.** Minor implementation note: Fix 6 differentiates `signalAvailable=false` (shows "unavailable" copy) vs. empty `items` array (shows CTA copy) in SimilarVideosCard — the plan's description implied this distinction and the implementation follows it correctly.

## Known Stubs

None. All 9 fixes are complete implementations.

## Self-Check: PASSED

- All 9 commits verified in `git log`
- All new test files exist at their declared paths
- TypeScript: 0 new errors
- Test count: 1570 passing (was 1553)
