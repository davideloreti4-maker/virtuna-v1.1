---
phase: 03-rich-visuals-as-drill-downs
plan: 05
subsystem: ui
tags: [react, svg-charts, drill-down, retention, composed-cluster, filmstrip, segment-table, graceful-degradation, theme-06]

# Dependency graph
requires:
  - phase: 02-the-reading
    provides: "reading.tsx container (closed PanelId union + PanelContent switch + PanelEmpty + ONE DrillSheet); the native RetentionPanel drop-list; DriverRows tap sources"
  - phase: 03-rich-visuals-as-drill-downs
    plan: 01
    provides: "reading.panels.test.tsx staged retention todos (×3) + the empty-data fixtures (makeEmptySegmentsResult / makeEmptyHeatmapResult); reskin-matte gate"
  - phase: 03-rich-visuals-as-drill-downs
    plan: 02
    provides: "RetentionChart + CraftFilmstrip reskinned matte (the confirmed prop interfaces); RetentionPlayer reskinned but NOT mounted (this plan owns the discretionary mount = exclude)"
  - phase: 03-rich-visuals-as-drill-downs
    plan: 04
    provides: "reading.tsx after the score/personas/shareability wiring — PanelContent now carries `id`; the closed-union + useComparisons mock pattern this plan mirrors for usePermalinkFilmstrips"
provides:
  - "reading.tsx: the SIGNATURE drill-down (D-04/D-06) — the Retention row opens the composed 'watch journey' = RetentionChart + CraftFilmstrip + SegmentTable on ONE aligned, scrollable timeline (gap-6), store-free, PanelEmpty-guarded"
  - "reading.tsx: readCraftSignals() — a whitelisted variants.craft dual-read for the filmstrip's audio_signals/cta_segment (arc top-level), mirroring readApollo"
  - "HookPanel confirmed flat-warm (reskin-only — NO production change), with its 0–10 modality rows + bar math (Math.min(10,score)*10) preserved (Pitfall 3)"
  - "All 5 drill-down panels now render rich visuals (score/personas/shareability from 03-04, retention/hook here) — READ-09 is code-complete"
affects: [03-06-phase-close-uat, D-07-human-uat-gate, 04-stage-reveal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composed-cluster drill-down (D-06): three LEAF charts stacked on ONE aligned timeline by construction — all consume the SAME heatmap.segments + the SAME usePermalinkFilmstrips() map, so the curve/filmstrip/cohort line up at the same real timestamp with no manual sync"
    - "Panel-local cached query, store-free: usePermalinkFilmstrips() (keyed by the route id) is a SEPARATE endpoint, NOT a second analysis subscription — fired on panel mount, mocked in tests exactly like 03-04's useComparisons (the QueryClientProvider-free pattern)"
    - "Whitelisted variants.craft dual-read (readCraftSignals): audio_signals/cta_segment live top-level on LIVE SSE, under variants.craft on permalink reload — read both (mirrors ContentAnalysisFrame L79–99); emotion_arc is top-level on both today"
    - "Empty-curve coercion: an empty weighted_curve ([]) is coerced to null (raw.length > 0 ? … : null) so toRetentionCurve([])===[] does not leak past the D-13 guard as a 0-length SVG"
    - "Honest resolution of unreachable-by-tap PanelEmpty guards: assert the VERIFIED architectural fact (emptying the driving dimension/cohort removes the only tap source) instead of fabricating an impossible tap or exporting internals"

key-files:
  created: []
  modified:
    - "src/components/reading/reading.tsx"
    - "src/components/reading/__tests__/reading.panels.test.tsx"
    - "src/components/reading/__tests__/reading.no-cut-data.test.tsx"

key-decisions:
  - "RetentionPanel body swapped to RetentionChart + CraftFilmstrip + SegmentTable (top-to-bottom, gap-6/24px between the 3 distinct visuals, scrollable in the DrillSheet's existing overflow-y-auto). The curve recipe is traced from AudienceNode L122–131 MINUS the client-weight recompute branch (board-only); store-free, NEVER a *Node/*Frame import (Pitfall 1)"
  - "Units (Pitfall 2 — the 0:08-vs-0:00 trap): `total` is SECONDS (totalDuration → last segment t_end) and the drop time the charts render is seg.t_start (SECONDS). The charts format internally via audience-derive.formatTime / content-analysis-derive.formatTimeSec — reading.tsx passes SECONDS values only, never a ms field. (formatTime import dropped from reading.tsx; only the charts use it internally.)"
  - "D-13 guard FIRST (Pitfall 5): `segments.length === 0 || curve == null → PanelEmpty`. Widened from the plan's literal `curve==null && segments-empty` so it degrades BOTH makeEmptySegmentsResult (segments:[], curve still present from the spread) AND makeEmptyHeatmapResult (heatmap:null) — a watch JOURNEY needs a timeline (segments) to align to; either missing → the calm copy, never an empty SVG/table/fabricated 0"
  - "RetentionPlayer stays UNMOUNTED — the static composition is the SC-2-safe default per Landmine 5 (the signed-URL source is null on the dominant tiktok_url path; the store blob path must not be reintroduced into the store-free cluster). The include/exclude call is routed to the 03-06 UAT gate against a real reloaded video_upload permalink"
  - "HookPanel is reskin-only, verified clean (no text-white/*, no #FF7F50, no rgba(255,255,255), no glow) — NO production change. The 0–10 bar math is intact (Pitfall 3 — NOT 'fixed' to 0–100); a new test asserts every printed modality value ≤ 10"

patterns-established:
  - "The composed 'watch journey' is the phase's signature density justification (D-06): the value is the RELATIONSHIP between the curve (attention), the filmstrip (what's on screen), and the cohort table (who leaves) on one timeline — 'you lose them at 0:08, here's the frame + cohort at 0:08'"
  - "A second panel-local useQuery hook (usePermalinkFilmstrips) ripples into every sibling test that opens its panel — mock it the same way the first one (useComparisons, 03-04) was mocked; a Rule-1 test-design correction, not a behavior regression"

requirements-completed: [READ-09]

# Metrics
duration: 53min
completed: 2026-06-15
---

# Phase 3 Plan 05: The Signature Drill-Down — The Composed Watch-Journey Summary

**The Retention row now opens the SIGNATURE composed "watch journey" (D-04/D-06): `RetentionChart` (survival curve + built-in niche/ghost overlay + coral drop mark + time-aligned keyframe strip) **+ `CraftFilmstrip`** (energy-graded keyframe cells + audio band) **+ `SegmentTable`** (who-leaves cohorts + per-cohort drop frames), stacked on ONE aligned, scrollable timeline — store-free via `usePermalinkFilmstrips()` + pure derives, PanelEmpty-guarded, with the `hook` panel confirmed flat-warm reskin-only and `RetentionPlayer` deferred as the SC-2-safe default. All 5 drill-downs now render rich visuals — READ-09 is code-complete.**

## Performance

- **Duration:** ~53 min
- **Started:** 2026-06-14T23:57:39Z
- **Completed:** 2026-06-15T00:50:45Z
- **Tasks:** 2
- **Files modified:** 3 (1 source, 2 test)

## Accomplishments

- **The signature drill-down exists (D-04/D-06 — the "watch journey").** Tapping the Retention row opens the composed cluster: the curve shows attention across the timeline, the filmstrip shows what's on screen across the SAME timeline, the cohort table shows who leaves — all three consuming the SAME `heatmap.segments` + the SAME `filmstrips` map, so the timeline aligns **by construction**. `gap-6` (24px) between the three distinct visuals (D-06 rhythm); scrollable in the DrillSheet's existing `overflow-y-auto`.
- **The unit trap is handled (Pitfall 2 — the 0:08-vs-0:00 bug).** `total` and the drop time are SECONDS throughout (`totalDuration` → last segment `t_end`; the curve's drop is `seg.t_start`). reading.tsx passes only SECONDS values; the charts format internally via the SECONDS-side helpers (`audience-derive.formatTime` / `content-analysis-derive.formatTimeSec`) — never the `TopFixesList` ms variant. The now-unused `formatTime` import was dropped from reading.tsx.
- **Store-free invariant held (SC-2 / Pitfall 1).** Only LEAF imports entered reading.tsx (`RetentionChart`, `SegmentTable`, `CraftFilmstrip` + the pure `toRetentionCurve`/`normalizeCurve`/`findBiggestDrop`/`totalDuration`/`buildSegmentGroups`/`worstBadGroupKey`/`cohortDropFrame`/`buildCells`/`audioMixCaption`) — no `*Node`/`*Frame`/`*Hero`/`useBoardStore`. Filmstrips come from `usePermalinkFilmstrips()` (a separate cached query, NOT a second analysis subscription). Grep-confirmed: import-line coupling CLEAN, `RetentionPlayer` NOT imported.
- **Graceful degradation (D-13 / Pitfall 5).** Guard FIRST: `segments.length === 0 || curve == null → PanelEmpty` — degrades `makeEmptySegmentsResult` AND `makeEmptyHeatmapResult`, never an empty SVG/table. An empty `weighted_curve` ([]) is coerced to null. The filmstrip self-gates to neutral cells on no-keyframes; SegmentTable hides zero-count cohorts. No throw on null heatmap / null curve / apollo-null.
- **HookPanel confirmed flat-warm (reskin-only — NO production change).** Audited clean: no `text-white/*`, no `#FF7F50`, no `rgba(255,255,255)`, no glow. The 0–10 bar math (`Math.min(10, score) * 10`) is intact (Pitfall 3 — NOT "fixed" to 0–100); the cream-alpha neutral + `var(--color-warning)` weakest + `var(--color-border)` track are all flat-warm tokens. A new test asserts every printed modality value ≤ 10.
- **The 03-01 retention todos activated + the 3 unreachable PanelEmpty todos resolved honestly.** The 3 staged retention todos are now real passing tests (cluster mount + 2 degradation paths). The 3 sheet-level PanelEmpty cases 03-04 documented as "unreachable by tap" (hook / shareability / personas) are converted from `it.todo` to **real passing assertions of the verified architectural fact** — emptying the driving dimension/cohort removes the only tap source (DriverRows degrades non-clickable / the cloud hides itself), so the both-absent guard has no tap path. Honest resolution, not fabricated. **Zero `it.todo()` calls remain** in `reading.panels.test.tsx`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap RetentionPanel to the composed watch-journey cluster (+ PanelEmpty guard)** — `9406e25b` (feat)
2. **Task 2: Verify HookPanel flat-warm (0–10 preserved) + resolve unreachable PanelEmpty todos** — `97ecae99` (test)

**Plan metadata:** committed with this SUMMARY (docs).

_TDD note: Task 1 is `tdd="true"`. Following the 03-04 pattern, the RED test edits (03-01's pre-staged retention todos flipped to real assertions) and the GREEN implementation are committed together in the single Task-1 `feat` commit — the test scaffold is a pre-existing artifact this plan activates, not net-new RED authored from scratch. RED was verified live before GREEN: the 3 retention assertions failed ("Unable to find retention-chart / craft-filmstrip / segment-table" — only the native `panel-retention` list rendered), then passed once the cluster mounted._

## Files Created/Modified

- `src/components/reading/reading.tsx` — `RetentionPanel` body swapped from the native drop-list to the composed `RetentionChart` + `CraftFilmstrip` + `SegmentTable` cluster (store-free derives, `usePermalinkFilmstrips()` source, D-13 guard FIRST, `gap-6` D-06 rhythm); added `readCraftSignals()` whitelisted `variants.craft` dual-read (audio_signals/cta_segment) next to `readApollo`; added imports for the 3 leaf charts + the pure retention/filmstrip derives + the `EmotionArcPoint`/`GeminiAudioSignals`/`CtaSegmentResult` types; dropped the now-unused `formatTime` import; the call site `PanelContent` `case 'retention'` simplified to `<RetentionPanel data={data} />`. HookPanel UNCHANGED (verified already flat-warm).
- `src/components/reading/__tests__/reading.panels.test.tsx` — flipped the 3 staged retention `it.todo`s to real assertions (cluster mount on real data + 2 degradation paths via `makeEmptySegmentsResult`/`makeEmptyHeatmapResult`); added a 0–10-scale guard test for the hook panel (Pitfall 3); resolved the 3 unreachable-by-tap PanelEmpty `it.todo`s (hook/shareability/personas) into real passing assertions; added the `usePermalinkFilmstrips` mock (the QueryClientProvider-free pattern, mirroring the `useComparisons` mock).
- `src/components/reading/__tests__/reading.no-cut-data.test.tsx` — added the `usePermalinkFilmstrips` mock (the "every drill panel opened" READ-10 sweep now opens the retention cluster, which calls the hook).

## Decisions Made

- **The D-13 guard was widened beyond the plan's literal text** (`curve==null && segments-empty`) to `segments.length === 0 || curve == null`. Rationale: the plan's acceptance criterion explicitly requires degradation via BOTH `makeEmptySegmentsResult` AND `makeEmptyHeatmapResult`, but `makeEmptySegmentsResult` keeps a non-null `weighted_curve` (it spreads the base HEATMAP with only `segments:[]`), so the literal `curve==null` guard would NOT fire for it. A composed "watch JOURNEY" needs a timeline (segments) to align the curve/filmstrip/table to — with no segments there is nothing to compose. The widened guard satisfies the acceptance and is the honest degrade. (Documented as a deviation below.)
- **RetentionPlayer excluded by default** — the static composition ships as the SC-2-safe default (Landmine 5). The signed-URL source resolves only for `video_upload` rows on permalink reload; on the milestone's dominant `tiktok_url` path it is null → `status:'idle'` → no player. The store blob path (`pendingObjectUrl`) MUST NOT be reintroduced into the store-free cluster. The 03-06 UAT gate confirms the include/exclude call against a real reloaded upload permalink; if it resolves `status==='ready'` there, a follow-up can layer the (already-reskinned, 03-02) player behind that gate.
- **The 3 unreachable-by-tap PanelEmpty todos resolved by asserting the verified fact, not by exporting internals.** The `<composed_cluster_contract>` says "real test if now reachable, else keep documented-unreachable — do not fabricate." All three are genuinely unreachable by tap (verified against `driver-rows.tsx` L67 + the cloud's shared `buildPersonaNodes`), and the panel functions are internal (not exported). Rather than fabricate an impossible tap path or widen the test surface by exporting `HookPanel`/`ShareabilityPanel`/`PersonasPanel`, each test asserts the **reachable consequence** — that the both-absent state removes the only tap source — which is a real, true behavioral assertion that resolves the staging.

## Deviations from Plan

The plan was executed as written for the core swap (the composed cluster, the imports, the recipe, the units, the store-free invariant). Three test-design corrections were required because the rich cluster introduced a new `useQuery` hook the 03-01 scaffold didn't anticipate, and one guard-logic widening was needed to satisfy the plan's own acceptance criterion. No Rule 4 (architectural) changes. No package installs.

### Auto-fixed Issues

**1. [Rule 1 — test-design correction] usePermalinkFilmstrips needs a mock (No QueryClient set)**
- **Found during:** Task 1 (first GREEN run).
- **Issue:** `usePermalinkFilmstrips` calls `useQuery`, which requires a `QueryClientProvider`. The 03-01 panels scaffold (and the sibling `reading.no-cut-data.test.tsx`) render `<Reading />` without one — so opening the retention cluster threw `No QueryClient set`. This is the exact ripple 03-04 hit with `useComparisons`.
- **Fix:** Added `vi.mock('@/hooks/queries/use-permalink-filmstrips', …)` to both `reading.panels.test.tsx` (default `{}` = no frames → the filmstrip self-gates to neutral cells, the realistic test default) and `reading.no-cut-data.test.tsx` (a real signed-URL map for the richest READ-10 sweep surface). Mirrors the established `useComparisons` mock pattern exactly. Reset in `beforeEach`.
- **Files modified:** `reading.panels.test.tsx`, `reading.no-cut-data.test.tsx`.
- **Verification:** `npx vitest run src/components/reading` exits 0 (106 pass / 0 fail).
- **Committed in:** `9406e25b` (Task 1) for both panels.test + no-cut-data.

**2. [Rule 1 — guard-logic correction] D-13 guard widened to cover makeEmptySegmentsResult**
- **Found during:** Task 1 (the degradation test failed under the plan's literal guard).
- **Issue:** The plan's literal guard `curve == null && segments.length === 0` does NOT fire for `makeEmptySegmentsResult`, because that fixture keeps a non-null `weighted_curve` (it overrides only `segments:[]`). Additionally, `toRetentionCurve([]) === []` (a 0-length array, not null), so an empty `weighted_curve` would also leak past a `curve == null` check.
- **Fix:** Widened the guard to `segments.length === 0 || curve == null` and coerced an empty curve to null (`raw && raw.length > 0 ? … : null`). A composed watch-journey with no timeline segments has nothing to align — PanelEmpty is the honest degrade. This satisfies the plan's acceptance criterion (both `makeEmptySegmentsResult` and `makeEmptyHeatmapResult` degrade).
- **Files modified:** `reading.tsx`.
- **Verification:** both degradation tests pass; the healthy cluster still renders (segments present → guard passes).
- **Committed in:** `9406e25b` (Task 1).

**3. [Rule 1 — test-design correction] The retired native list testid + the 3 unreachable PanelEmpty todos**
- **Found during:** Task 1 (the old P2 "segment list mounts" test asserted the now-retired `panel-retention` list) and Task 2 (the plan asked to resolve the staged unreachable todos).
- **Issue:** (a) The composed cluster retires the native `panel-retention` `<ul>`; the P2 test asserting it would fail. (b) The 03-01/03-04 scaffold left 3 sheet-level PanelEmpty cases as `it.todo` ("unreachable by tap, 03-05 direct-mount").
- **Fix:** (a) Repurposed the P2 test to assert the whole cluster mounts (all 3 rich charts) + the native list is gone; named the cluster wrapper `panel-retention-cluster` so "native list retired" stays assertable. (b) Converted the 3 unreachable `it.todo`s to real passing assertions of the verified architectural fact (no tap source in the both-absent state) — honest resolution per the contract, not a fabricated tap. Zero `it.todo()` calls remain.
- **Files modified:** `reading.panels.test.tsx`.
- **Verification:** 23 active panels tests pass / 0 todo; full reading suite 106 pass / 0 fail.
- **Committed in:** `9406e25b` (retention todos, Task 1), `97ecae99` (hook 0–10 test + the 3 unreachable resolutions, Task 2).

---

**Total deviations:** 3 Rule-1 corrections (2 test-design — the new useQuery mock + the retired-testid/todo-resolution; 1 guard-logic widening). 0 architectural. 0 package installs (T-03-SC not triggered). The cluster's intent — render the real composed watch-journey, degrade calmly, never throw/fabricate, stay store-free — is fully honored.
**Impact on plan:** None to scope. The guard widening is strictly more correct (covers both degradation fixtures the plan demands); the mocks are the same pattern 03-04 established; the todo-resolutions turn honest staging into honest coverage.

## CraftFilmstrip audio-band note (for the 03-06 UAT — RESEARCH Open-Q1 / A2)

On the **test fixtures**, the CraftFilmstrip renders its **emotion-arc-derived energy band** (the base fixture has a 5-point `emotion_arc`, so `buildWaveBars` produces bars) but **NOT the audio activity band** — `data.audio_signals` is absent on the fixtures (and there is no `variants.craft.audio_signals` either), so `audio == null` → the filmstrip falls to its flat thin-line audio fallback + the `AUDIO_NONE_CAPTION` caption. This is the **graceful, no-throw, no-grey-cell** path (D-13), NOT a bug. `cta_segment` is also absent → `ctaPresent === false` → the coral "no-close" end-cap scalpel renders.

**What 03-06 must watch:** on a **real reloaded upload permalink**, if `emotion_arc` / `audio_signals` land under `variants` (the way Apollo does via `variants.apollo`) rather than top-level, the filmstrip's audio band + energy grading would read flat/empty. `readCraftSignals()` already dual-reads `variants.craft` for `audio_signals`/`cta_segment` (so those survive the nesting); **`emotion_arc` is read top-level only** (per RESEARCH it persists top-level today). If UAT shows a flat band on a reloaded upload, the one-line follow-up is to add `variants.craft.emotion_arc` (and confirm `audio_signals`) to the dual-read — it degrades cleanly until then (no throw, no grey-cell), so it is NOT an SC-2 blocker.

## Issues Encountered

- **`No QueryClient set`** when the retention cluster mounted in the panels + no-cut-data tests — resolved by mocking `usePermalinkFilmstrips` (Deviation 1). No production change.
- The pre-existing recharts "width(-1)/height(-1)" console warning appears during `npm run build` static generation — it is from an unrelated showcase/test page (the reading cluster charts are SVG, not recharts), present before this plan, and the build exits 0 ("Compiled successfully"). Out of scope; logged here for the reviewer's eye, not fixed.

## Verification

- `npx vitest run src/components/reading` → **exit 0** — 106 pass / 0 fail / 0 todo (was 98 pass + 3 todo pre-plan; +4 net active retention + the 3 resolved unreachable + the hook 0–10 test).
- `npx tsc --noEmit` → **12 pre-existing errors, 0 in `src/components/reading/`** (unchanged baseline).
- **Store-free invariant → CLEAN**: `grep -nE "^import" reading.tsx | grep -iE "AudienceNode|ContentAnalysisFrame|VerdictNode|BoardStore|FactorBars|InsightHero|choreography|client-weights"` returns nothing. `git grep RetentionPlayer -- reading.tsx` → nothing (not mounted). `git grep usePermalinkFilmstrips -- reading.tsx` → present. All three of `RetentionChart|CraftFilmstrip|SegmentTable` present.
- **Matte-lint → 9/9 GREEN** (unchanged — this plan mounts, doesn't reskin).
- **Bar math intact** → `git grep "Math.min(10" -- reading.tsx` still returns the 0–10 path (Pitfall 3).
- **Full repo suite → 2073 pass / 0 fail** (≥ the ~2035 VALIDATION threshold; was 2065 after 03-04).
- **Clean `npm run build` → EXIT 0 ("Compiled successfully in 10.8s")** — the 03-06 UAT precondition is met.

## D-07 human-UAT notes (carried to the 03-06 phase-close gate)

The composed retention "watch journey" is now LIVE in the Reading's drill-downs — net-new for the human-UAT gate. To confirm by eye on a real Simulation:
- **Retention panel:** tapping the Retention row opens the cluster top-to-bottom — RetentionChart (curve + dashed niche/ghost overlay + the coral drop dot + the "−NN%" delta + the time-aligned darkened keyframe strip), then CraftFilmstrip (energy-graded cells + the audio/energy band), then SegmentTable (who-leaves cohorts, the worst ~<40% row coral). Confirm the three **line up on the same timeline** — the curve's coral drop time, the filmstrip drop cell, and the cohort drop frame should all read the same `M:SS`.
- **Alignment / units:** verify the drop time reads a sensible `0:NN` (NOT `0:00`/garbage — the sec-vs-ms trap). On the test path the drop is ~0:08 (fixture `weighted_top_dropoff_t: 8`).
- **Filmstrip on a reloaded upload:** watch the audio band — if it's flat on a real reloaded `video_upload`, that's the A2 `variants` persistence question (see the audio-band note above); it degrades cleanly, so confirm it's not throwing, just flat.
- **Degradation:** on a thin/absent heatmap the panel should show the calm "Not available for this read." — never an empty SVG, empty table, or a fabricated 0.
- **Hook panel:** confirm it still reads flat-warm with its 0–10 modality rows + the weakest flagged (reskin-only — no chart, by design).
- **RetentionPlayer:** confirmed EXCLUDED this plan. The include/exclude call is yours to make at this gate against a real reloaded upload — if the signed-URL source resolves `status==='ready'` there, a follow-up can layer the reskinned player in behind that gate; otherwise the static composition ships.

## Next Phase Readiness

- **03-06 (phase-close D-07 human-UAT gate, BLOCKING):** all 5 drill-downs (score/personas/shareability from 03-04, retention/hook from this plan) are code-complete + matte-lint-clean + suite-green + build-clean — the precondition for the live UAT is met. The notes above flag what to verify live (cluster alignment, units, the filmstrip audio band on reload, the RetentionPlayer include/exclude call).
- **04 (stage-reveal):** the retention cluster is prop-driven + side-effect-light (its only effect is the panel-local `usePermalinkFilmstrips` cached query, fired on panel mount, not on the container's reveal path) — Phase-4's container-driven `useAnalysisStream` reveal can animate the headline blocks without fighting it. `tabular-nums` preserved in the transplanted charts (no digit jitter on reveal).

## Self-Check: PASSED

- Files: `reading.tsx`, `reading.panels.test.tsx`, `reading.no-cut-data.test.tsx`, `03-05-SUMMARY.md` — all FOUND.
- Commits: `9406e25b` (Task 1 — composed cluster), `97ecae99` (Task 2 — hook verify + todo resolution) — both FOUND on `milestone/numen-rework`.
- Gate state confirmed: `src/components/reading` exit 0 (106 pass / 0 fail / 0 todo); tsc 12 pre-existing / 0 in reading/; store-free import grep CLEAN; RetentionPlayer not imported; usePermalinkFilmstrips present; all 3 rich charts present; matte-lint 9/9; bar math `Math.min(10` intact; full suite 2073 pass / 0 fail; `npm run build` EXIT 0.

---
*Phase: 03-rich-visuals-as-drill-downs*
*Completed: 2026-06-15*
