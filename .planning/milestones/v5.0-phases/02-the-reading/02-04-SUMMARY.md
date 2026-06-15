---
phase: 02-the-reading
plan: 04
subsystem: ui
tags: [react, clipboard, radix-accordion, apollo, counterfactuals, flat-warm, tdd]

# Dependency graph
requires:
  - phase: 02-the-reading (02-01)
    provides: src/components/reading/ scaffold + shared makeReadingResult/makeApolloNullResult fixture + vendored ui/accordion.tsx
  - phase: 02-the-reading (02-03)
    provides: DriverRows degrade pattern (D-13) + bandTone/zone-token SSOT precedent
provides:
  - "RewriteItem — copyable hook rewrite atom (struck original + variant + Copy→Copied→Copy 1.5s, graceful clipboard failure), flat-warm coral Copy surface (D-15)"
  - "FixFirstList — top-3 type='fix' counterfactuals + inline 'N more fixes →' expand + D-14 positive empty win, decoupled from useBoardStore"
  - "DeeperRead — inline Radix-Accordion expand of the remaining 3 Apollo dims (clarity/substance/credibility) on score-zone tokens, D-13 degrade-to-null"
affects: [02-05 reading-container, 03-rich-visuals]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Light two-tier disclosure (D-10): inline useState toggle (FixFirstList 'N more') + inline Radix Accordion (DeeperRead) — never a Sheet; the heavy half stays DrillSheet"
    - "Clipboard atom test harness: happy-dom navigator.clipboard via Object.defineProperty (read-only polyfill) + fireEvent + vi.useFakeTimers/advanceTimersByTime for the revert window"
    - "OLD-palette repoint: InsightHeroFrame BAND_COLOR (emerald/amber/red) → THEME-06 zone tokens text-success/-warning/-error (shared score-color language with the hero gauge + driver rows)"

key-files:
  created:
    - src/components/reading/rewrite-item.tsx
    - src/components/reading/fix-first-list.tsx
    - src/components/reading/deeper-read.tsx
    - src/components/reading/__tests__/rewrite-item.test.tsx
    - src/components/reading/__tests__/fix-first.test.tsx
    - src/components/reading/__tests__/deeper-read.test.tsx
  modified: []

key-decisions:
  - "RewriteItem drops the analog's dropLabel prop — FixFirstList owns the timestamped fix context; the atom stays minimal (original + variant + Copy)"
  - "Copy button = sanctioned coral surface (--color-accent bg + --color-accent-foreground #1a0f0a text), one of the 3 reserved coral affordances per UI-SPEC §accent-reserved; matte, no glow"
  - "'N more fixes →' uses a one-way useState reveal (no Accordion) — lightest possible in-thread expand; DeeperRead uses the vendored Radix Accordion (a11y + reduced-motion handled)"
  - "DeeperRead overrides the vendored Accordion primitive's baked elevated-tint + white text via className (flat-warm cream/transparent) rather than editing the shared primitive (out of scope)"

patterns-established:
  - "Reading actionable-cluster components are board-store-free — no component under src/components/reading/ imports useBoardStore (verified grep=0 + bare-mount test)"
  - "D-13/D-14 as correctness: zero fixes → positive win (never blank); null Apollo → render only what's present (never a fabricated 0 / placeholder chip)"

requirements-completed: [READ-07, READ-08]

# Metrics
duration: 7min
completed: 2026-06-14
---

# Phase 2 Plan 04: Fix First + Deeper Read Summary

**The actionable bottom of the Reading — copyable hook rewrites (the D-15 product payload), top-3 timestamped fixes with an inline "N more" expand, and an inline Accordion "Deeper read" of the remaining 3 Apollo dims — all board-store-free with D-13/D-14 empty/degraded states handled as correctness.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-14T18:32:20Z
- **Completed:** 2026-06-14T18:38:51Z
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 6 created (3 components + 3 tests)

## Accomplishments

- **RewriteItem (READ-08, D-15):** the literal product value — a copyable hook rewrite (struck-through original + variant + Copy). Copy writes only `rewrite.variant` to the clipboard, toggles Copy → Copied → Copy over 1.5s, and a rejected clipboard promise is a silent no-op (insecure-context / permission-denied safe). Repointed off the OLD Raycast white-alpha palette to cream tokens; the Copy button is a sanctioned coral surface.
- **FixFirstList (READ-07/08, D-08/D-14):** reuses TopFixesList's fix-card markup + the `type==='fix'` filter but severs the board coupling — no `useBoardStore`, the dead audience-filmstrip jump anchor dropped. Top-3 fixes always inline; overflow collapses behind an inline `{n} more fixes →` reveal (NOT a Sheet). Zero fixes is a **win** ("Nothing urgent to fix" / "This one's solid."), not a blank. No-rewrites omits the rewrite section entirely (no placeholder chip). Rewrites delegate to `<RewriteItem>`.
- **DeeperRead (READ-08, D-13):** the light half of the two-tier system — an inline Radix Accordion (vendored `ui/accordion.tsx`, never a Sheet) revealing the remaining trio clarity / substance / credibility. Band words repointed to the THEME-06 score-zone tokens (strong→success / mid→warning / weak→error). When Apollo is absent the component returns `null` (no fabricated dims); partial Apollo renders only the dims present.
- **Full suite green:** 2019 passed / 0 failed (was 2000 baseline → +19, exactly the new RewriteItem 5 + FixFirstList 8 + DeeperRead 6). 680/680 suites pass; tsc + ESLint clean on all 3 new files.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: RewriteItem** — `a1b5d227` (test) → `83906adf` (feat)
2. **Task 2: FixFirstList** — `1890a5de` (test) → `a41a680b` (feat)
3. **Task 3: DeeperRead** — `f7793529` (test) → `e331ea08` (feat)

_All three followed the RED → GREEN gate; no REFACTOR commits were needed (components landed clean, each under 130 lines)._

## Files Created/Modified

- `src/components/reading/rewrite-item.tsx` (69 lines) — copyable hook rewrite atom; `navigator.clipboard.writeText(rewrite.variant)`, Copy→Copied 1.5s, graceful failure; flat-warm coral Copy surface.
- `src/components/reading/fix-first-list.tsx` (126 lines) — top-3 fixes + inline `{n} more fixes →` expand + D-14 win + no-rewrites graceful; renders `<RewriteItem>` for each rewrite; board-store-free.
- `src/components/reading/deeper-read.tsx` (108 lines) — inline Accordion expand of clarity/substance/credibility on zone tokens; D-13 returns null when Apollo absent.
- `src/components/reading/__tests__/rewrite-item.test.tsx` — 5 tests (struck original + variant, Copy writes variant, Copy→Copied→Copy timers, rejected-clipboard no-op, a11y/axe).
- `src/components/reading/__tests__/fix-first.test.tsx` — 8 tests (top-3 + inline expand no-dialog, non-fix excluded, D-14 empty ×2, no-rewrites graceful, rewrites delegate, bare-mount no-throw, axe full+empty).
- `src/components/reading/__tests__/deeper-read.test.tsx` — 6 tests (collapsed-by-default + inline reveal no-dialog, score+band-zone-token rows, strong/mid/weak→success/warning/error, D-13 null degrade, partial-dims silent omit, axe).

## Decisions Made

- **Dropped RewriteItem's `dropLabel` prop** — the analog attached a D-07 retention-drop label to the rewrite; in the thread, FixFirstList + DriverRows already own the timestamped context, so the atom stays minimal (original + variant + Copy).
- **Copy = sanctioned coral surface** — `--color-accent` bg + `--color-accent-foreground` (#1a0f0a) text, one of the 3 reserved coral affordances (UI-SPEC §accent-reserved). Matte, focus ring also accent.
- **Two different "light" expands by weight** — FixFirstList's overflow uses a one-way `useState` reveal (lightest, short list); DeeperRead uses the vendored Radix Accordion (collapse/re-collapse + a11y + reduced-motion). Both honor D-10 "never a Sheet."
- **DeeperRead overrides the vendored Accordion's baked tint/white-text via `className`** rather than editing the shared `ui/accordion.tsx` primitive (other consumers exist — out of scope to retheme the primitive).

## Deviations from Plan

None — plan executed exactly as written. The plan's interfaces (verbatim lift points, the shared fixture, the vendored Accordion, the zone-token repoint map) were complete and correct; all three components and their tests landed on the first GREEN.

Two acceptance-criteria grep gates (`grep -c "text-white"` and the `navigator.clipboard.writeText` / `useBoardStore` / `Sheet` counts) initially tripped on **doc-comment mentions** of the OLD-palette / dead-coupling tokens being repointed away. Reworded the comments so the literal grep gates read 0 (no JSX/code change). This is a gate-hygiene cleanup, not a deviation — the components never used those tokens in markup.

## Issues Encountered

- **rtk tee wrapper truncated the vitest JSON reporter** (`PASS (n)` header printed 0/0/0 in the captured log). Worked around by running vitest with `--reporter=json --outputFile=/tmp/*.json` and parsing the real counts — confirmed 52/52 reading + 2019/2019 full-suite green.

## User Setup Required

None — zero new dependencies (threat T-02-SC: nothing to vet), no external service configuration. All clipboard/Accordion primitives were already vendored.

## Next Phase Readiness

- **02-05 (reading container)** can now wire all three: `<FixFirstList fixes={data.counterfactuals?.suggestions} rewrites={apollo?.rewrites} />` and `<DeeperRead dimensions={apollo?.dimensions} />` per the PATTERNS composition (L320-321). No barrel exists yet — siblings are imported directly; the container plan may add `index.ts`.
- **Phase 3 (rich visuals)** inherits the deliberate two-tier seam: these light inline expands are final; the heavy DrillSheet (DriverRows' `onRowTap` mount point) is where Phase 3 swaps in the rich charts.
- All three components are presentation-only (engine FROZEN 3.19.0 respected), read only whitelisted fields (READ-10 / T-02-08), and degrade as correctness (D-13/D-14) on permalink reload.

## Self-Check: PASSED

- Files (7/7 found): rewrite-item.tsx, fix-first-list.tsx, deeper-read.tsx + 3 test files + this SUMMARY.
- Commits (6/6 found): `a1b5d227`, `83906adf`, `1890a5de`, `a41a680b`, `f7793529`, `e331ea08`.

---
*Phase: 02-the-reading*
*Completed: 2026-06-14*
