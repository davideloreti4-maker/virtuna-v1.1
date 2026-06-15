---
phase: 03-rich-visuals-as-drill-downs
plan: 01
subsystem: testing
tags: [vitest, testing-library, happy-dom, react, svg-charts, matte-lint, fixtures]

# Dependency graph
requires:
  - phase: 02-the-reading
    provides: "reading.tsx container (closed PanelId union + PanelContent switch + PanelEmpty), the reading-fixture.ts factory (makeReadingResult/makeApolloNullResult/...), driver-rows tap sources, DrillSheet"
provides:
  - "reading.panels.test.tsx — per-panel render + degradation coverage for the 4 existing drill-down panels (the Wave-0 gap), with 14 it.todo placeholders staging the rich-visual + score-panel assertions for 03-02/03/04/05"
  - "reading-fixture.ts empty-data helpers (makeEmptyHeatmapResult / makeEmptyPersonasResult / makeEmptySegmentsResult / makeNoBehavioralResult) for the SC-2 degradation assertions"
  - "reskin-matte.test.ts — static grep gate flagging the 5 not-yet-reskinned transplant files (the Wave-0 matte gate 03-02/03-03 flip GREEN)"
affects: [03-02-reskin, 03-03-reskin, 03-04-wiring, 03-05-wiring, gsd-verify-work, D-07-human-uat-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 RED gate: the matte-lint asserts cleanliness for every transplant file; the 5 dirty files FAIL today and flip GREEN as the reskin plans repoint them (a failing test as the executable target)"
    - "it.todo contract surface: rich-visual + score-panel mount assertions are staged as named todos so the test file is the agreed contract for downstream plans, not a moving target"
    - "Glow-shadow scan that strips inset + zero-blur (0 0 0) rings before testing for the outer 0 0 Npx halo — distinguishes a Raycast glow from a legitimate hairline/inset"

key-files:
  created:
    - "src/components/reading/__tests__/reading.panels.test.tsx"
    - "src/components/reading/__tests__/reskin-matte.test.ts"
  modified:
    - "src/components/reading/__tests__/fixtures/reading-fixture.ts"

key-decisions:
  - "matte-lint detects old coral in BOTH forms (#FF7F50 literal AND rgba(255,127,80,…)) — ScoreDistribution/CraftFilmstrip/KeyframeImage use only the rgba form, so a hex-only gate would miss them"
  - "matte-lint also catches the JSX camelCase backdropFilter, not just the CSS backdrop-filter — RetentionPlayer's blur is `backdropFilter: 'blur(2px)'`"
  - "PersonaGraph is NOT a matte-lint RED file: its issues (glass hover card, <animate>, white-alpha) are real 03-03 reskin work but are NOT any of the gate's forbidden render strings — kept the gate honest rather than fabricate a violation"
  - "hook/shareability sheet-level PanelEmpty is unreachable by tap (emptying their dimension flips DriverRows to its non-clickable degraded branch) — tested the reachable graceful path and staged the sheet-level PanelEmpty as todos"

patterns-established:
  - "Wave-0 test scaffold authored FIRST as the gate the wiring/reskin plans verify against (SC-2 render+degrade, SC-3 matte)"
  - "Empty-data fixtures compose on top of makeReadingResult(over) and override only the field under test, typed Partial<PredictionResult> so schema drift fails at compile"

requirements-completed: [READ-09]

# Metrics
duration: 18min
completed: 2026-06-14
---

# Phase 3 Plan 01: Wave-0 Test Scaffold Summary

**The per-panel render + degradation suite, empty-data fixtures, and a static matte-lint grep gate that together make SC-2 (every drill-down renders real output, no throw/grey-cell) and SC-3 (flat-warm matte) enforceable before the wiring and reskin plans land.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-14T21:57:37Z
- **Completed:** 2026-06-14T22:15:32Z
- **Tasks:** 3
- **Files modified:** 3 (1 extended, 2 created)

## Accomplishments
- **The coverage gap is closed:** `reading.panels.test.tsx` gives the 4 existing drill-down panels (hook / retention / shareability / personas) a render-on-real-data assertion + a degradation assertion each — the SVG leaf charts had zero direct render tests before this.
- **The degradation inputs exist:** four empty-data fixture helpers (`makeEmptyHeatmapResult`, `makeEmptyPersonasResult`, `makeEmptySegmentsResult`, `makeNoBehavioralResult`) delegating to `makeReadingResult`, typed so a schema drift fails at compile.
- **The matte gate has teeth:** `reskin-matte.test.ts` flags the 5 not-yet-reskinned transplant files (RED today) and passes the 4 already-clean ones — a cheap automatable target before the expensive D-07 human-UAT gate.
- **The downstream contract is staged:** 14 `it.todo` placeholders name the rich-visual mounts and the new `score` panel for 03-02/03/04/05 to activate, so the test file is the agreed contract surface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend reading-fixture.ts with empty-data helpers** — `76b84ec0` (test)
2. **Task 2: Author reading.panels.test.tsx (per-panel render + degradation)** — `e9c1faf4` (test)
3. **Task 3: Author reskin-matte.test.ts (static grep gate)** — `c56ac30d` (test)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

_TDD note: Tasks 1 & 2 are `tdd="true"`; because this plan's deliverable IS the test layer (fixtures + tests), each task is a single `test(...)` commit rather than a RED→GREEN→REFACTOR triplet — there is no separate production code to make pass._

## Files Created/Modified
- `src/components/reading/__tests__/fixtures/reading-fixture.ts` — added 4 empty-data factory helpers (heatmap-null / empty-personas / empty-segments / no-behavioral) for the degradation assertions; reuses the existing `makeApolloNullResult`.
- `src/components/reading/__tests__/reading.panels.test.tsx` — NEW. Per-panel render + degradation for the 4 existing panels (mirrors `reading.test.tsx`'s single-subscription mock); 14 `it.todo`s for the rich-visual + `score` assertions. happy-dom pragma.
- `src/components/reading/__tests__/reskin-matte.test.ts` — NEW. Pure-fs (node env) grep gate scanning the 9 transplant files for `#FF7F50`, `rgba(255,127,80,…)`, `backdrop-filter`/`backdropFilter`, `linear-gradient(137deg`, and outer-glow `box-shadow: 0 0 Npx`.

## Decisions Made
- **Old-coral detection covers both forms** (`#FF7F50` + `rgba(255,127,80,…)`): the literal-hex-only approach the plan's example used would miss ScoreDistribution / CraftFilmstrip / KeyframeImage, which carry only the rgba form. Adding the rgba pattern is what makes those three actually trip the gate.
- **Backdrop-blur detection covers the JSX camelCase form** (`backdropFilter`), not just CSS `backdrop-filter` — RetentionPlayer's blur is an inline-style `backdropFilter: 'blur(2px)'`, which a CSS-only grep misses.
- **Glow scan strips inset + zero-blur rings first** so only the outer `0 0 Npx` halo trips. ScoreDistribution L240 mixes `inset 0 0 0 1px …` with `0 0 18px …` in one string; stripping the inset leaves the real glow to be caught, while RetentionChart's `0 0 0 1px` hairline correctly does NOT trip.

## Deviations from Plan

The plan was executed as written. One architecturally-honest adaptation inside Task 2 (the realized behavior differs from a literal reading of the plan's acceptance text because the existing component makes the literal target unreachable — this is a test-design correction, not a code change, so it is documented here rather than as a Rule 1–3 auto-fix):

**1. [Test-design correction] hook & shareability "degrade to PanelEmpty via row tap" → reachable graceful-degradation assertions + staged todos**
- **Found during:** Task 2 (reading.panels.test.tsx) — the first run had 2 failures at the hook + shareability degradation assertions.
- **Issue:** The plan's degradation pattern (open the panel on an empty fixture, assert `PanelEmpty`) is reachable for retention and personas (they degrade on heatmap fields, independent of the rows). It is NOT reachable for hook and shareability: their panels read the hook / share_pull *dimension*, and emptying that dimension flips `DriverRows` to its degraded branch, which renders generic NON-clickable `driver-row` divs (no `driver-row-{panelId}` button) — so the sheet can never be opened by tap in that state. Asserting `PanelEmpty` inside an un-openable sheet is impossible.
- **Fix:** For hook, assert the reachable graceful path — `hook_decomposition: undefined` with dims present keeps the row clickable and `HookPanel` falls back to the hook dimension's lever/evidence (`panel-dimension`), no throw. For shareability, assert the reachable honesty signal on apollo-null — `DriverRows` shows "Not available" in-row (never a fabricated 0). The literal sheet-level `PanelEmpty` for both is staged as `it.todo` for 03-04 (which may change the tap affordances). Retention + personas remain the genuine `PanelEmpty` exemplars.
- **Files modified:** src/components/reading/__tests__/reading.panels.test.tsx
- **Verification:** `npx vitest run …/reading.panels.test.tsx` exits 0 (9 active pass, 14 todo pending).
- **Committed in:** e9c1faf4 (Task 2 commit)

---

**Total deviations:** 1 test-design correction (no production code changed; the plan's intent — assert calm degradation, never a throw/fabricated-0 — is fully honored via the reachable path).
**Impact on plan:** None to scope. The degradation contract is enforced where the architecture allows it (retention/personas) and staged honestly where it isn't yet reachable (hook/shareability sheet-level), so 03-04 inherits an accurate target.

## Issues Encountered
None beyond the Task-2 reachability correction above (resolved within the task).

## Matte-lint RED file list (for 03-02 / 03-03)

`reskin-matte.test.ts` is **intentionally RED** for these 5 transplant files today — each must flip GREEN when its reskin lands (this is the documented Wave-0 gate state, not a defect):

| File | Violation(s) flagged today |
|------|----------------------------|
| `src/components/board/verdict/ScoreDistribution.tsx` | `rgba(255,127,80,…)` (×6) + outer glows `0 0 9px` / `0 0 13px` / `0 0 18px` |
| `src/components/board/audience/RetentionChart.tsx` | `#FF7F50` (×3) + `rgba(255,127,80,…)` (×3) |
| `src/components/board/content-analysis/CraftFilmstrip.tsx` | `rgba(255,127,80,…)` (×2) + end-cap glow `0 0 10px` |
| `src/components/board/audience/RetentionPlayer.tsx` | `#FF7F50` (×4) + `backdropFilter: blur(2px)` |
| `src/components/board/_kit/KeyframeImage.tsx` | `rgba(255,127,80,…)` (×1, coral radial fallback) |

**Already GREEN** (no forbidden render strings — informational): `PersonaGraph.tsx` (its glass-card / `<animate>` / white-alpha work is verified at the D-07 UAT gate, not by this lint), `SegmentTable.tsx`, `StatTile.tsx`, `DataTable.tsx` (Tier-1 token-swap only).

> NOTE for 03-02/03-03: the gate asserts cleanliness for EVERY transplant file. When you reskin a RED file, the test for that file simply flips to passing — no test edit needed. PersonaGraph is already passing this lint; do not expect this gate to catch its reskin (use the UAT gate for that).

## Rich-visual `it.todo`s remaining (for 03-04 / 03-05)

The following placeholders in `reading.panels.test.tsx` are staged and must be activated by the named plans:
- **retention (03-04/05):** mount `RetentionChart` (curve + niche/ghost overlay) · mount `CraftFilmstrip` (timeline-paired, D-04) · mount `SegmentTable`.
- **shareability (03-04/05):** mount `StatTile` rate tiles (share/comment/save/loop) · rate tiles degrade gracefully via `makeNoBehavioralResult` (omit absent metrics, never a fabricated 0%) · sheet-level `PanelEmpty` when the share_pull dimension is absent.
- **personas (03-03/04):** mount the full `PersonaGraph` (SVG, hover→tap) · `PanelEmpty` on empty personas inside the open sheet.
- **hook (03-04):** sheet-level `PanelEmpty` when both `hook_decomposition` and the hook dimension are absent.
- **score (03-04 — NEW panel, D-02):** opens from the hero gauge `onOpen` → `setPanel('score')` · `PANEL_TITLE.score === 'Score'` (closed-union type-enforced) · mounts `ScoreDistribution` · degrades honestly to lane/absolute mode when niche is null/thin.

## Next Phase Readiness
- **03-02 / 03-03 (reskin):** the matte-lint is the hard target — reskin each RED file to flat-warm tokens until its row in this gate flips GREEN; run `npx vitest run src/components/reading/__tests__/reskin-matte.test.ts` to check.
- **03-04 / 03-05 (wiring):** activate the relevant `it.todo`s as each rich visual is mounted; the empty-data fixtures are ready for the degradation assertions.
- **Gate state:** `npx vitest run src/components/reading` = **87 active-passing, 5 intentionally-RED** (the matte-lint dirty files). `npx tsc --noEmit` unchanged at 12 pre-existing errors (zero from 03-01 files). Full suite not re-run here (Wave-0 scaffold only adds tests); the per-wave full-suite check belongs to the reskin/wiring plans per 03-VALIDATION.

## Self-Check: PASSED

- Files: `reading.panels.test.tsx`, `reskin-matte.test.ts`, `reading-fixture.ts`, `03-01-SUMMARY.md` — all FOUND.
- Commits: `76b84ec0` (Task 1), `e9c1faf4` (Task 2), `c56ac30d` (Task 3) — all FOUND.
- Gate state confirmed: reading suite 87 active-passing / 5 intentionally-RED (matte-lint); tsc 12 pre-existing errors, 0 from 03-01 files.

---
*Phase: 03-rich-visuals-as-drill-downs*
*Completed: 2026-06-14*
