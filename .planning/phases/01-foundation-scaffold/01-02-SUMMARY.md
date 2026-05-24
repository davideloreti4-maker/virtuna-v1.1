---
phase: 01-foundation-scaffold
plan: "02"
subsystem: ui-scaffold
tags: [server-components, react, accessibility, svg, raycast, tailwind-v4]

# Dependency graph
requires:
  - "01-01 (motionTokens.ts, _components/ scaffold, fragment layout)"
provides:
  - "SectionShell.tsx server component — typed 9-slug wrapper consumed 9 times by /v3/page.tsx"
  - "GrainOverlay.tsx server component — cross-cutting fixed SVG noise layer (POLISH-01)"
  - "SkipToContent.tsx server component — WCAG 2.5.5 skip-link with coral focus ring (PERF-11)"
affects: [05-v3-page, 11-cutover]

# Tech tracking
tech-stack:
  added:
    - "Inline SVG feTurbulence + feColorMatrix filter pattern (POLISH-01 — pure-SVG noise, no backdrop-filter dependency)"
  patterns:
    - "Server-component-only primitives under src/app/(marketing)/_components/ — zero client JS shipped"
    - "Tailwind v4 arbitrary-value bracket syntax for non-standard values (min-h-[100dvh], min-h-[400px], z-[9999])"
    - "Tailwind opacity modifier on semantic token (text-foreground-muted/60) for 60% opacity body text"
    - "Inline style={} for SVG-only properties (zIndex, opacity on <svg>) — keeps wrapper layout class-driven"
    - "JSDoc comments avoid the literal string \"use client\" to prevent false-positive grep matches in acceptance gates"

key-files:
  created:
    - src/app/(marketing)/_components/SectionShell.tsx
    - src/app/(marketing)/_components/GrainOverlay.tsx
    - src/app/(marketing)/_components/SkipToContent.tsx
  modified: []

key-decisions:
  - "All three components rendered as pure server components — no \"use client\" directive, no client JS bundled. Satisfies threat T-01-08 (no XSS surface from props, all typed, no dangerouslySetInnerHTML) and matches UI-SPEC § Component Inventory classification (SkipToContent / GrainOverlay / SectionShell = Server)."
  - "GrainOverlay filter id namespaced 'virtuna-grain' (not 'grain') — UI-SPEC suggested 'grain' but a generic id risks collision if any other SVG on the page (Spline scene, future Magic UI installs) uses id=\"grain\". Trivial defensive change with zero functional impact."
  - "JSDoc reworded to drop the literal substring \"use client\" — Task 1 initially failed acceptance grep (`grep -c '\"use client\"' returns 0`) because the explanatory comment used the literal string. Rule 3 auto-fix: reworded to \"no client directive\" so the gate measures the actual directive, not documentation about it. Same convention applied prophylactically to GrainOverlay + SkipToContent."

patterns-established:
  - "When a JSDoc must mention a Next.js directive (\"use client\" / \"use server\"), spell it as 'client directive' / 'server directive' to keep acceptance greps clean"
  - "Server placeholder components consume globals.css semantic tokens through Tailwind utility classes (bg-background, bg-background-elevated, text-foreground-muted, outline-accent) — no inline color hex needed, theming stays single-sourced"

requirements-completed: [FOUND-01, POLISH-01, PERF-11]

# Metrics
duration: 3min
completed: 2026-05-24
---

# Phase 01 Plan 02: Visual Scaffold Primitives Summary

**Three server-only React components — SectionShell (9-slug typed placeholder wrapper, alternating bg, H2 + body label), GrainOverlay (3% opacity SVG fractalNoise overlay), SkipToContent (WCAG keyboard skip-link with coral focus ring) — ready for /v3/page.tsx assembly in Plan 05.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-24T04:41:13Z
- **Completed:** 2026-05-24T04:44:53Z
- **Tasks:** 3 of 3
- **Files created:** 3 (all under `src/app/(marketing)/_components/`)
- **Files modified:** 0
- **Build status:** `pnpm build` exits 0 (57/57 static pages generated, no errors)

## Accomplishments

- `SectionShell.tsx` (66 lines) exports `SectionShell` + `SectionShellProps`; 9-slug literal union for `id`; renders `<section>` with `aria-label`, alternating `bg-background` / `bg-background-elevated`, `min-h-[100dvh]` (hero) or `min-h-[400px]` (others), centered H2 (30px semibold, foreground-muted) + body text (16px regular, foreground-muted at 60% opacity). Implements FOUND-01.
- `GrainOverlay.tsx` (53 lines) exports `GrainOverlay`; `<div aria-hidden="true" className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }}>` containing inline `<svg style={{ opacity: 0.03 }}>` with `<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>` + `<feColorMatrix type="saturate" values="0"/>`; namespaced filter id `virtuna-grain`. Implements POLISH-01.
- `SkipToContent.tsx` (40 lines) exports `SkipToContent`; `<a href="#main-content">Skip to main content</a>` positioned `-top-11 left-4` (off-screen) by default, revealing to `top-4` on `:focus-visible` with `z-[9999]`, 2px coral outline (`outline-accent`), `bg-background-elevated` + `text-foreground` surface, `rounded-md` (8px), `px-4 py-3` padding, `text-sm font-normal` text. Implements PERF-11.
- All three components are pure server components (zero `"use client"` directives, zero client JS shipped). They consume `globals.css` semantic tokens through Tailwind utility classes — no inline hex, no hardcoded values that diverge from the design contract.
- `pnpm build` exits 0 after a clean install (worktree was missing `node_modules` until this plan ran `pnpm install`). 57/57 static pages generated. No new TypeScript errors introduced by the three new files (pre-existing 743 + 3 = 746 errors all in `src/lib/engine/__tests__/` + `@google/genai` — same baseline carried from Plan 01-01's deferred-items.md).

## Task Commits

Each task was committed atomically:

1. **Task 1: SectionShell.tsx** — `8476785` (feat)
2. **Task 2: GrainOverlay.tsx** — `b63c710` (feat)
3. **Task 3: SkipToContent.tsx** — `9b563a3` (feat)

## Files Created/Modified

**Created:**

- `src/app/(marketing)/_components/SectionShell.tsx` — typed reusable section wrapper with 9-slug `id` union, alternating background, optional hero `min-h-[100dvh]`, centered H2 + body label content
- `src/app/(marketing)/_components/GrainOverlay.tsx` — fixed inset-0 pointer-events-none aria-hidden SVG fractalNoise overlay at 3% opacity, z-index -1
- `src/app/(marketing)/_components/SkipToContent.tsx` — WCAG keyboard-only skip-link revealed on `:focus-visible`, coral 2px outline, links to `#main-content`

**Modified:** None.

## Decisions Made

- **Filter id namespaced `virtuna-grain` (not `grain`):** UI-SPEC § Grain Overlay Contract shows the example using `id="grain"`. Changed to `id="virtuna-grain"` (and `url(#virtuna-grain)` reference) to prevent collision with any future SVG component (Spline scene in Phase 3, Magic UI Globe/Spotlight in Phase 9, custom hero viz, etc.) that might also use the generic `grain` id. Trivial defensive rename — zero functional impact, identical render output.
- **JSDoc avoids the literal substring `"use client"`:** Acceptance gate `grep -c '"use client"' [file]` is intentionally string-literal (not regex anchored to a line start), so any documentation that mentions the directive verbatim trips the gate. Reworded all three files to say "no client directive" / "Server component (no client directive)" — preserves the doc-comment's clarity, satisfies the gate measuring only the actual Next.js directive.
- **Build gate run from inside the worktree after `pnpm install`:** Plan acceptance includes `pnpm build` succeeds locally. Worktree was missing `node_modules` (fresh worktree, never installed). Ran `pnpm install` (no lockfile drift — only restored existing pinned versions) then `pnpm build` — exit 0, 57 pages generated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Reworded JSDoc comment to drop the literal substring `"use client"`**

- **Found during:** Task 1 acceptance verification (immediately after first Write of SectionShell.tsx)
- **Issue:** Acceptance criterion `grep -c '"use client"' src/app/(marketing)/_components/SectionShell.tsx returns 0` failed with count 1, because the JSDoc header on line 4 contained the phrase `Server component (no "use client") consumed 9 times by /v3/page.tsx (Plan 05)` — the substring `"use client"` triggered the literal grep. No actual Next.js directive present.
- **Fix:** Reworded the JSDoc to `Server component (no client directive) consumed 9 times by /v3/page.tsx (Plan 05)`. Applied the same convention prophylactically to GrainOverlay.tsx and SkipToContent.tsx (drafted with `(no client directive)` from the start).
- **Files modified:** `src/app/(marketing)/_components/SectionShell.tsx` (line 4 doc-comment only)
- **Verification:** `grep -c '"use client"' src/app/(marketing)/_components/SectionShell.tsx` now returns 0. Identical render behavior — the change is comment-text only.
- **Committed in:** `8476785` (Task 1 — bundled with the initial component implementation; the rewording happened before staging, so a single clean commit ships)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking gate)

**Impact on plan:** None on scope, semantics, or render output. The acceptance gate's literal-string grep is a hard rule of the verification layer; the doc-comment was the only blocker. Pattern documented under `patterns-established` so future task drafters spell directives as "client directive" / "server directive" in JSDoc.

## Issues Encountered

- **Worktree missing `node_modules`:** First `pnpm build` attempt failed with `sh: next: command not found`. Resolved by running `pnpm install` (no `package.json` / `pnpm-lock.yaml` mutation — pure dependency restore). Re-ran build, exit 0. This is a worktree-creation hygiene observation, not a code issue.
- **Pre-existing tsc baseline still red (746 errors):** Same 743 vitest-globals errors + 3 newly visible `@google/genai` module-resolution errors that existed pre-plan and were already logged in Plan 01-01's `deferred-items.md`. None of the three new files introduce new tsc errors. Verification: `pnpm exec tsc --noEmit 2>&1 | grep -E "SectionShell|GrainOverlay|SkipToContent"` returns 0 lines.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 05 (`/v3/page.tsx` assembling 9 SectionShell instances):** Can `import { SectionShell } from '@/app/(marketing)/_components/SectionShell'` and instantiate with the 9 typed slugs (`hero`, `demo`, `how-it-works`, `surfaces`, `comparison`, `science`, `social-proof`, `pricing`, `final-cta`). The `<main id="main-content">` wrapper around these 9 sections is the target of SkipToContent's `href="#main-content"` — Plan 05 must set that id on the `<main>` element to wire the skip-link correctly.
- **Plan 03 (Header refresh):** GrainOverlay's `z-index: -1` is intentionally below the Header's `z-index: 200` and below all content. Header rebrand will not need any z-index coordination with the grain layer.
- **Polish layer (cross-cutting):** GrainOverlay is the first cross-cutting overlay shipped — same pattern (aria-hidden, pointer-events-none, fixed inset-0) will work for the planned scroll progress indicator and section-divider gradient layers in Phase 11.
- **Blocker:** None. All Phase 1 wave 2 primitives ready for Plan 05 consumption.

## Self-Check: PASSED

Verified before finalizing this SUMMARY (per `<self_check>`):

- `[ -f src/app/(marketing)/_components/SectionShell.tsx ]` → FOUND (66 lines)
- `[ -f src/app/(marketing)/_components/GrainOverlay.tsx ]` → FOUND (53 lines)
- `[ -f src/app/(marketing)/_components/SkipToContent.tsx ]` → FOUND (40 lines)
- `git log --oneline -5 | grep 8476785` → FOUND (Task 1 commit)
- `git log --oneline -5 | grep b63c710` → FOUND (Task 2 commit)
- `git log --oneline -5 | grep 9b563a3` → FOUND (Task 3 commit)
- `pnpm build` → exits 0 (57/57 static pages generated, `✓ Compiled successfully in 5.4s`)
- `pnpm exec tsc --noEmit 2>&1 | grep -E "SectionShell|GrainOverlay|SkipToContent"` → 0 lines (no new tsc errors from this plan)
- `grep -c '"use client"' src/app/(marketing)/_components/*.tsx` → 0 across all three new files
- No `pnpm.overrides.framer-motion` re-introduced (wave 1 fix preserved)

---
*Phase: 01-foundation-scaffold*
*Completed: 2026-05-24*
