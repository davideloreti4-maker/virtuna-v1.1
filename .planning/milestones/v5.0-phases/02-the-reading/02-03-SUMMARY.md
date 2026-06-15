---
phase: 02-the-reading
plan: 03
subsystem: ui
tags: [react, driver-rows, apollo-dimensions, score-zone, bandTone, formatTime, retention-dropoff, flat-warm, vitest, vitest-axe, sidebar, theme-06]

# Dependency graph
requires:
  - phase: 02-the-reading
    plan: 01
    provides: "src/components/reading/__tests__/fixtures/reading-fixture.ts — shared makeReadingResult + makeApolloNullResult (Apollo dimensions 0-100, heatmap, drop time); the reading test scaffold + flat-warm matte conventions"
  - phase: 01-foundation-shell
    provides: "THEME-06 flat-warm score-zone tokens (--color-success/warning/error), cream foreground tokens, --color-border 6% track"
provides:
  - "DriverRows — 3 always-visible fixed-funnel levers (Hook → Retention → Shareability) from ApolloDimension[] (0-100); neutral cream bars, only the single weakest in its score-zone color + ⚠; Retention value = ⚠ drop-timestamp (SECONDS) while its bar fills by the retention score; ≥44px <button> tap target → onRowTap(panelId) for the DrillSheet; degrades on null dimensions, never a fabricated 0 (READ-05/06)"
  - "DriverPanelId — the closed union ('hook'|'retention'|'shareability') the container maps to a DrillSheet panel"
  - "Sidebar score chips unified onto the locked THEME-06 score-zone tokens (--color-success/warning/error) via the bandTone SSOT — one score-color language across hero gauge + sidebar (P1 follow-up closed)"
affects: [02-05, phase-03-rich-visuals]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies (threat T-02-SC: nothing to vet)
  patterns:
    - "DriverRows borrows ONLY FactorBars' 3-col grid + 5px rounded-full bar geometry (grid-cols-[130px_1fr_42px] sm:[152px_1fr_42px]); the 0-10 data path, the strongest-first sort, the 'keep' tag, the #FF7F50 coral gradient + boxShadow glow are all REBUILT/STRIPPED (RESEARCH correction #1 — markup donor only, not a copy-reuse)"
    - "Weakest-lever zone color reuses score-gauge's ZONE_VAR pattern: bandTone(min score) → var(--color-success|warning|error). Non-weakest bars get a neutral cream linear-gradient (rgba(236,231,222,0.22→0.38)), NO coral, NO glow — matte"
    - "Retention readout split: bar fills by retention.score (how good), value shows ⚠ formatTime(dropT) (where it breaks, D-06). dropT is SECONDS → audience-derive.formatTime, NOT the TopFixesList ms variant (correction #4 / Landmine 6 — the documented 0:08-vs-0:00 trap)"
    - "Sidebar scoreTone() derives from bandTone(score) (≥70 good / 40-69 warn / <40 crit) → text-success/warning/error, matching the hero ScoreGauge exactly; the score==null em-dash branch stays text-foreground-muted"

key-files:
  created:
    - src/components/reading/driver-rows.tsx
    - src/components/reading/__tests__/driver-rows.test.tsx
  modified:
    - src/components/sidebar/Sidebar.tsx
    - src/components/reading/__tests__/fixtures/reading-fixture.ts

key-decisions:
  - "DriverRows is a NEW component, NOT a FactorBars reuse. FactorBars is 0-10 with 5 axis-mismatches (0-10 + /max suffix, strongest-first sort, 'keep' tag, coral gradient, glow); the Reading wants 3 fixed-order 0-100 dimensions, neutral cream, only-weakest in its ZONE color (amber/red, NOT coral). Only the grid + bar markup was borrowed."
  - "Retention drop value reads weighted_top_dropoff_t in SECONDS via audience-derive.formatTime → '⚠ 0:08' for t=8 (NOT '0:00'). The ms-based TopFixesList.formatTime was explicitly avoided (Landmine 6)."
  - "The weakest lever (min of the 3 present scores) is the ONLY one colored — its bar + value take bandTone(weakestScore)'s zone token + ⚠; the eye lands on the one lever to change next time (brief §2.4). Hero gauge owns the verdict color; rows stay calm."
  - "Degrade (D-13): when apollo_reasoning is null (no dimensions), the three labels still show but render 'Not available' instead of any bar/value — NEVER a fabricated 0 score."
  - "Fixture seam (additive): exposed weighted_top_dropoff_t at the canonical PredictionResult top level (types.ts L483 — the path the container reads, PATTERNS L319 `data.weighted_top_dropoff_t`). The fixture previously only carried it inside the heatmap object (a cast that the HeatmapPayload type doesn't declare). Top-level add is purely additive — no 02-01/02-02 test regressed."
  - "Sidebar chip unify derives from bandTone (not the old >=80/<50 emerald/amber thresholds) so the sidebar and the hero gauge share one threshold SSOT. Color-token swap only — chip layout, rounding, data-testid all unchanged."

patterns-established:
  - "Reading driver levers are prop-driven leaves: DriverRows({ dimensions, dropT, onRowTap }) takes the small whitelist (dimension name/score + drop time) — never the raw PredictionResult spread (READ-10 / threat T-02-06)"
  - "Markup-donor-not-fork: when an existing board component has the right geometry but the wrong data contract/behavior, borrow the JSX grid and rebuild the logic to the new contract rather than copy-reuse"
  - "Score-color language is a single SSOT (bandTone → --color-success/warning/error) shared by ScoreGauge, DriverRows weakest-lever, and the sidebar chip"

requirements-completed: [READ-05, READ-06]

# Metrics
duration: ~12min
completed: 2026-06-14
---

# Phase 2 Plan 03: DriverRows + Sidebar Score-Chip Unify Summary

**The three always-visible levers of the Reading — Hook, Retention, Shareability as fixed-funnel `label | bar | value` rows from the 0-100 Apollo dimensions (a NEW component that borrows only FactorBars' grid, not its 0-10 data path) with neutral cream bars, the single weakest lever zone-colored + ⚠, and the Retention value showing the ⚠ drop-timestamp (SECONDS, via audience-derive.formatTime — not the 0:00 ms trap) while its bar still fills by the score; each row a ≥44px tap target into the DrillSheet, degrading cleanly to "Not available" (never a fabricated 0) when the Apollo reasoner is absent. Plus the carried-forward P1 follow-up closed: the sidebar score chips now derive from the bandTone SSOT onto the locked THEME-06 `--color-success/warning/error` zone tokens, matching the hero gauge's color language exactly.**

## Performance

- Duration: ~12 min
- Tasks: 2 (both `type=auto`; Task 1 `tdd=true`)
- Files: 2 created, 2 modified
- Tests: +8 (driver-rows), full suite 1992 → 2000 passed / 0 failed

## What Was Built

### Task 1 — DriverRows (READ-05/06) · commit `f5d7b20d`
- `src/components/reading/driver-rows.tsx` (181 lines, `'use client'`): `DriverRows({ dimensions, dropT, onRowTap })`.
  - Finds hook / retention / share_pull by name; renders them in **fixed funnel order Hook → Retention → Shareability** (no sort — even though hook 87 > share_pull 64 > retention 55 in the fixture).
  - Bar `pct = dimension.score` (0-100, no `/10`, no `/max` suffix). Track = `--color-border`; bar geometry borrowed from FactorBars (`grid-cols-[130px_1fr_42px] sm:[152px_1fr_42px]`, `h-[5px] rounded-full`).
  - **Only the single weakest** lever (min score across the 3) takes its zone color via `bandTone(weakestScore)` → `var(--color-success|warning|error)` + a `⚠` glyph. The other two bars use a **neutral cream** gradient (`rgba(236,231,222,0.22→0.38)`), **no coral, no glow** — the legacy `#FF7F50`/`boxShadow` were stripped.
  - **Retention** row: bar fills by `retention.score`; value column shows `⚠ ${formatTime(dropT)}` — `dropT` is SECONDS → **audience-derive `formatTime`** (`t=8 → "0:08"`, never the ms-variant's `0:00`).
  - Each row is a `<button>` with `min-h-[44px]` (≥44px tap target) firing `onRowTap('hook'|'retention'|'shareability')` to open the DrillSheet (Phase-3 mount point).
  - **Degrade (D-13):** `apollo_reasoning: null` → labels show with `"Not available"`, no bars/values, never a fabricated `0`.
- `driver-rows.test.tsx` (151 lines): 8 tests — fixed order, Hook/Shareability fill widths, Retention bar-by-score + value `⚠ 0:08`, only-weakest-colored (+ a weak-red `--color-error` case), null-dimensions degrade (no `0`), per-row `onRowTap(panelId)` + `<button>` + `min-h-[44px]`, axe.
- `reading-fixture.ts`: additively exposed `weighted_top_dropoff_t: 8` at the PredictionResult top level (the canonical container read-path).

### Task 2 — Sidebar score-chip unify (P1 follow-up) · commit `c4009b22`
- `src/components/sidebar/Sidebar.tsx`: `scoreTone()` rewritten to `switch (bandTone(score))` → `text-success` / `text-warning` / `text-error`; imported `bandTone` from `@/components/board/verdict/verdict-derive`. The `score == null` em-dash/remix branch keeps `text-foreground-muted`. `data-testid="sidebar-score-chip"`, layout, and rounding unchanged. No other sidebar sub-file hardcodes `emerald-400`/`amber-400` for scores (verified by grep).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture missing the top-level `weighted_top_dropoff_t` the container reads**
- **Found during:** Task 1 (writing the Retention `0:08` test).
- **Issue:** The shared fixture (02-01) only carried `weighted_top_dropoff_t` *inside* the `HEATMAP` object literal, but `HeatmapPayload` does not declare that field — it is a **top-level** `PredictionResult` field (types.ts L483), and PATTERNS L319 wires the container as `dropT={data.weighted_top_dropoff_t}` (top level). Reading it via `heatmap!.weighted_top_dropoff_t` was a tsc error and the wrong contract.
- **Fix:** Added `weighted_top_dropoff_t: 8` at the top level of `makeReadingResult` (kept the heatmap copy untouched). The test's `dropT()` helper now reads `makeReadingResult().weighted_top_dropoff_t` — the exact path the container uses.
- **Files modified:** `src/components/reading/__tests__/fixtures/reading-fixture.ts`
- **Commit:** `f5d7b20d` (with Task 1)
- **Why safe:** purely additive top-level field; the full suite stayed green (1992 → 2000), so no 02-01/02-02 consumer regressed.

## Authentication Gates

None — pure presentation-layer work.

## Known Stubs

None. Both components are wired to real engine fields (`ApolloDimension[]`, `weighted_top_dropoff_t`) via the shared fixture; the degrade path renders an honest "Not available" rather than a stub `0`.

## Deferred Items

- **`src/components/sidebar/Sidebar.tsx` is 537 lines (> the 500-line guideline).** It was already 529 lines before this plan (it crept over after the P1-02 `SidebarAccountSelector` extraction); Task 2 added net +8 for the token swap. **Not split here** — Task 2 is scoped to a color-token swap ONLY ("do NOT change the chip layout … or any other sidebar behavior"), and a structural split is out of scope. Logged to `deferred-items.md` for a future sidebar refactor. The new component this plan owns (`driver-rows.tsx`, 181 lines) is well under 500.
- Pre-existing `tsc --noEmit` strict-typecheck errors in untouched engine/board test files (12 across 6 files) remain deferred from Plan 02-01 — `driver-rows.tsx`, the test, and `Sidebar.tsx` are all tsc-clean.

## Threat Surface

No new security-relevant surface. `DriverRows` reads only `dimensions[].name`/`.score` + `weighted_top_dropoff_t` (never spreads the raw PredictionResult — READ-10 / T-02-06); `onRowTap`'s `panelId` is a hardcoded closed union, not a reflected value (T-02-07); zero new dependencies (T-02-SC). No `## Threat Flags` to report.

## Verification

- `npx vitest run src/components/reading/__tests__/driver-rows.test.tsx` → 8 passed.
- `npx vitest run src/components/reading` → 33 passed.
- `npx vitest run src/components/sidebar` → 19 passed.
- `grep -c "FF7F50\|E8703F\|0 0 10px\|boxShadow" driver-rows.tsx` → 0; `grep -c "\.sort(" driver-rows.tsx` → 0.
- `grep -c "emerald-400\|amber-400" Sidebar.tsx` → 0; `grep -c "text-success\|text-warning\|text-error\|bandTone" Sidebar.tsx` → 6.
- `tsc --noEmit` clean on `driver-rows.tsx`, `driver-rows.test.tsx`, `Sidebar.tsx`, `reading-fixture.ts`.
- **Full suite (`npm test`): 2000 passed / 0 failed / 26 skipped** (was 1992 passed — +8 from the new driver-rows tests; no regressions).

## Self-Check: PASSED

- FOUND: `src/components/reading/driver-rows.tsx`
- FOUND: `src/components/reading/__tests__/driver-rows.test.tsx`
- FOUND: `src/components/sidebar/Sidebar.tsx` (modified)
- FOUND: `src/components/reading/__tests__/fixtures/reading-fixture.ts` (modified)
- FOUND commit: `f5d7b20d` (Task 1)
- FOUND commit: `c4009b22` (Task 2)
