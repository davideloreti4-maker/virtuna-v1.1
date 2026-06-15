---
phase: 03-story-showcase
plan: 04
subsystem: marketing-story-skeletons
tags: [skeletons, svg, rsc, placeholder, gap-closure, story-showcase]
gap_closure: true
requires:
  - "src/app/globals.css flat-warm tokens (bg-surface-elevated, border-border, text-foreground-*, --color-accent, --radius-lg)"
  - "src/components/marketing/hero/hero.tsx + simulation-showcase.tsx (chrome idioms factored, not imported)"
provides:
  - "ScoreGaugeSkeleton — static 270deg arc + score 87 (>=70) + 'Strong' band word"
  - "AudienceCloudSkeleton — 18-dot deterministic cloud (one coral worst-cluster hint) + '68% watch-through'"
  - "DriverRowsSkeleton — Hook/Retention/Shareability rows + neutral bars + 'drops at 0:07'"
  - "BrowserChrome + PhoneChrome — reusable device-chrome wrappers"
  - "skeletons/index.ts barrel re-exporting all five primitives"
  - "marketing <Placeholder> with the '16:10' dev ratio label removed"
affects:
  - "03-05 (Wave 2) consumes these primitives inside the story sections"
tech-stack:
  added: []
  patterns:
    - "Pure-RSC static-SVG skeleton primitives (zero animation, role=img + aria-label, deterministic hand-authored coords — no Math.random)"
    - "Re-derived 270deg arc geometry locally (stroke-dasharray on a <circle>), never imported from the product"
    - "Device chrome factored into reusable wrappers so 03-05 reuses chrome without re-importing the hero"
key-files:
  created:
    - src/components/marketing/story/skeletons/score-gauge-skeleton.tsx
    - src/components/marketing/story/skeletons/audience-cloud-skeleton.tsx
    - src/components/marketing/story/skeletons/driver-rows-skeleton.tsx
    - src/components/marketing/story/skeletons/device-chrome.tsx
    - src/components/marketing/story/skeletons/index.ts
    - src/components/marketing/story/__tests__/skeletons.test.tsx
  modified:
    - src/components/marketing/placeholder.tsx
decisions:
  - "Skeleton score fixed at 87 (>= BAND_THRESHOLDS.STRONG=70 honesty floor) + band word 'Strong' (03-RESEARCH Pitfall 4)"
  - "Coral kept precious: exactly ONE coral dot (worst cluster) + exactly ONE coral bar (Retention, the weakest driver); everything else cream"
  - "IN-04 NOT applied — CVA VariantProps types `variant` as `... | null`, so the `?? \"image\"` fallback is required (tsc TS2322)"
  - "Comments reworded off the literal quoted use-client token so the `grep -rl '\"use client\"'` pure-RSC gate stays clean"
metrics:
  duration: ~6min
  completed: 2026-06-15
  tasks: 2
  files: 7
---

# Phase 3 Plan 04: Product-Skeleton Primitives + Placeholder Ratio-Label Removal Summary

Built four reusable, pure-RSC static-SVG product-skeleton primitives (score gauge, audience dot-cloud, Hook·Retention·Shareability driver rows, device chrome) that turn the Phase-3 placeholders from flat dark boxes into intentional product skeletons hinting the real Numen Simulation reading IA (GAP-1, GAP-2), and removed the developer-artifact "16:10" ratio label from the marketing `<Placeholder>` (GAP-1). Purely additive (new files) plus one surgical edit to `placeholder.tsx`; this plan owns no story-section files — 03-05 consumes the primitives in Wave 2.

## What Was Built

### Task 1 — Static-SVG product-skeleton primitives (TDD)
- **`ScoreGaugeSkeleton`** — a 270° stroked arc (track + filled sweep on a single `<circle>` per layer via `stroke-dasharray`, geometry re-derived locally), a centered score number **87** (≥70 honesty floor), and the band word **"Strong"**. `role="img"` + `aria-label="Virality score (sample)"`.
- **`AudienceCloudSkeleton`** — an 18-dot SVG cloud at deterministic hand-authored coordinates (no `Math.random` — no hydration concern), with **exactly one** dot tinted coral (worst-cluster hint), plus a **"68% watch-through"** caption. `role="img"` + `aria-label="Audience reaction (sample)"`.
- **`DriverRowsSkeleton`** — exactly three rows in fixed order **Hook · Retention · Shareability**, each a label + neutral horizontal bar; the Retention row (the lone coral/weakest bar) carries the where-they-drop caption **"drops at 0:07"** (`/\d:\d{2}/`). `role="img"` + `aria-label="Hook, Retention and Shareability (sample)"`.
- **`device-chrome.tsx`** — `BrowserChrome` (slim bar + 3 dots + "numen.app" pill over an `overflow-hidden rounded-xl border bg-surface-elevated` window) and `PhoneChrome` (rounded `border-[5px]` bezel + `ring-1` + deep dark shadow). Both pure presentational wrappers carrying the flat-warm-legal layered DARK drop shadow idiom factored from `simulation-showcase.tsx` line 97 / `hero.tsx` lines 141-149.
- **`index.ts`** — barrel re-exporting all five.
- All five primitives are **pure RSC** (no client directive), **zero animation**, flat-warm tokens only (no glass/glow/blur/#FF7F50), STUB LOCK honored (no real data, no `src`, no engine/data hook, no product-UI import). Product noun in visible text is "Simulation"; never "reading".

### Task 2 — Placeholder ratio-label removal + skeleton Nyquist gate
- `placeholder.tsx`: deleted the `formatDimensionHint` helper and the `font-mono` caption `<span>` that rendered "16:10". Kept the `resolvedAspect` computation and the inline `aspectRatio` style (the no-CLS lock) untouched.
- `skeletons.test.tsx`: 12-test structural Nyquist gate covering all five primitives (arc + score≥70 + Strong, ≥6 circle dots + "%", Hook/Retention/Shareability ordering + `/\d:\d{2}/` timestamp + three `[data-bar]` elements, numen.app pill, phone children, and `role=img`/`aria-label` on each).

## Verification Results
- `npx vitest run src/components/marketing/` → **48 passed (6 files)**; the two plan-named suites: placeholder **11/11**, skeletons **12/12**.
- `grep -rL '"use client"' .../skeletons/*.tsx` → **4** (all pure RSC); `grep -rl '"use client"' .../skeletons/` → **none**.
- `grep -RhoE 'animate-[a-z-]+' .../skeletons/` → **none** (zero animation).
- `grep -RnE 'backdrop-blur|#FF7F50|\bglass\b|drop-shadow|blur\(' .../skeletons/` → only one JSDoc comment mention ("NOT a backdrop-blur"), no code usage.
- `grep -RnE '\b\d+:\d+\b' placeholder.tsx` → **none**; `formatDimensionHint` → **none**; `aspectRatio` inline style → **still present**.
- `npm run build` → **exit 0**, `┌ ○ /` (root route stays **static** — no client leak introduced).
- `npx tsc --noEmit` → 0 errors in touched files; `eslint` clean on touched files.

## TDD Gate Compliance
Task 1 (`tdd="true"`) followed RED → GREEN:
- RED: `test(03-04)` commit `edb0b708` — `skeletons.test.tsx` failed with `Failed to resolve import "../skeletons"` (success:false).
- GREEN: `feat(03-04)` commit `858ed926` — primitives + barrel implemented; 12/12 pass.
- REFACTOR: not needed (code clean at GREEN).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] RED-test regex broke on the concatenated `87Strong` text node**
- **Found during:** Task 1 GREEN run.
- **Issue:** The honesty-floor assertion used `/\b(7\d|8\d|9\d|100)\b/`; `textContent` is `"87Strong"`, and a `\b` after the digits requires a digit↔non-word boundary that `7→S` (word↔word) does not provide → false failure of a correct implementation.
- **Fix:** Parse the first 2-3 digit run and assert `Number(...) >= 70` instead of pattern-matching boundaries.
- **Files modified:** `src/components/marketing/story/__tests__/skeletons.test.tsx`
- **Commit:** `858ed926`

**2. [Rule 3 — Blocking] Comment mentions of the literal `"use client"` token tripped the pure-RSC grep gate**
- **Found during:** Task 1 acceptance-criteria greps.
- **Issue:** Four JSDoc comments contained `no "use client"`, so `grep -rl '"use client"'` matched all four files even though none carry the actual directive — failing the acceptance gate.
- **Fix:** Reworded each to `no client directive` (no double-quoted token). Files remain pure RSC.
- **Files modified:** all four `.../skeletons/*.tsx`
- **Commit:** `858ed926`

**3. [Rule 1 — Bug] IN-04 simplification introduced a `tsc` type error (TS2322)**
- **Found during:** Task 2 typecheck.
- **Issue:** The plan offered an OPTIONAL simplification (`const resolvedVariant = variant`). CVA's `VariantProps` types `variant` as `... | null | undefined`; the `= "image"` destructure default only covers `undefined`, so an explicit `null` leaks through → `Type '... | null' is not assignable to type 'PlaceholderVariant'`.
- **Fix:** Reverted to `variant ?? "image"` (the original guard, which also coerces `null`) and documented why IN-04 is intentionally not applied.
- **Files modified:** `src/components/marketing/placeholder.tsx`
- **Commit:** `aa906980`

**4. [Rule 3 — Blocking] JSDoc `@example` "16:9" colon form tripped the `\d+:\d+` gate**
- **Found during:** Task 2 acceptance-criteria greps.
- **Issue:** A docstring example comment read "reserves a 16:9 box"; though not rendered, it matched the `\b\d+:\d+\b` gate that asserts the ratio label is gone.
- **Fix:** Reworded the comment to slash form ("16/9 box") so no `\d+:\d+` remains anywhere in the file.
- **Files modified:** `src/components/marketing/placeholder.tsx`
- **Commit:** `aa906980`

## Known Stubs
These primitives are intentional, STUB-LOCK-compliant set-dressing (static SVG shape hints with no data source) — that is the entire purpose of this gap-closure plan (give the stubs an intentional skeleton vocabulary). The fixed sample values (score 87, 68% watch-through, drop at 0:07, bar fills) are honest-shape hints, not invented metrics, and are resolved when real screenshots/data land in a future product milestone (out of scope for this marketing milestone). 03-05 wires these primitives into the story sections.

## Self-Check: PASSED
- All 7 key files exist on disk (verified).
- All 3 commits exist in history (`edb0b708`, `858ed926`, `aa906980`).
