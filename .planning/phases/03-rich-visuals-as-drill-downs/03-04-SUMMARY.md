---
phase: 03-rich-visuals-as-drill-downs
plan: 04
subsystem: ui
tags: [react, svg-charts, drill-down, closed-union, score-distribution, persona-graph, stat-tile, reduced-motion, security]

# Dependency graph
requires:
  - phase: 02-the-reading
    provides: "reading.tsx container (closed PanelId union + PANEL_TITLE + ONE generic DrillSheet + PanelEmpty); ScoreGauge hero (no tap target); PersonaCloud onOpen seam; DriverRows onRowTap"
  - phase: 03-rich-visuals-as-drill-downs
    plan: 01
    provides: "reading.panels.test.tsx it.todo contract (score/personas/shareability assertions); empty-data fixtures (makeEmptyPersonasResult / makeNoBehavioralResult); reskin-matte gate"
  - phase: 03-rich-visuals-as-drill-downs
    plan: 02
    provides: "ScoreDistribution.tsx reskinned matte (props: score/niche/range/showRangeText) + the VerdictNode recipe to mirror"
  - phase: 03-rich-visuals-as-drill-downs
    plan: 03
    provides: "PersonaGraph.tsx reskinned matte + self-contained tap-to-reveal (only needs reducedMotion); StatTile/StatTileRow reskinned flat-warm"
provides:
  - "reading.tsx: the 5th drill-down panel `score` (D-02) — the hero gauge taps open ScoreDistribution (niche histogram + confidence range); closed-union extended LITERAL-only (T-02-12 safe)"
  - "reading.tsx: personas body → full PersonaGraph (reducedMotion passed); shareability body → StatTileRow (deriveBehavioralTiles) + share_pull evidence — both PanelEmpty-guarded (D-13)"
  - "score-gauge.tsx: an `onOpen` affordance (role=button + Enter/Space) that keeps the gauge matte (focus-visible ring only, no glow); stays role=img when onOpen absent"
  - "PanelContent signature now carries `id` (string|null) for panel-local useComparisons — the wiring seam 03-05's retention case slots into"
affects: [03-05-wiring, gsd-verify-work, D-07-human-uat-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-union panel extension by LITERAL: `| 'score'` + `score: 'Score'` in the Record<PanelId,string> — a missing/extra key fails compile, so PANEL_TITLE[panel] never indexes a reflected key (T-02-12 asserted by tsc + a closed-union test)"
    - "Panel-local lazy fetch (useComparisons(id)) for a drill-down's own data — NOT a second analysis subscription; mocked in tests to avoid a QueryClientProvider"
    - "Conditional interactivity on a hero primitive: role=button + tabIndex + onClick + Enter/Space ONLY when onOpen is wired (mirrors persona-cloud); role=img otherwise — one component, two a11y shapes"
    - "Transplant LEAF charts only (PersonaGraph / StatTileRow / ScoreDistribution) into the store-free reading cluster — re-derive props from `data`; NEVER import a *Node/*Frame/*Hero (would drag useBoardStore back)"

key-files:
  created: []
  modified:
    - "src/components/reading/reading.tsx"
    - "src/components/reading/score-gauge.tsx"
    - "src/components/reading/__tests__/reading.panels.test.tsx"
    - "src/components/reading/__tests__/reading.test.tsx"
    - "src/components/reading/__tests__/reading.degraded.test.tsx"
    - "src/components/reading/__tests__/reading.no-cut-data.test.tsx"

key-decisions:
  - "ScorePanel mirrors VerdictNode.tsx L244–272 byte-for-byte: round(overall_score), confidenceRange(score, confidence), showRangeText = confidence_label !== 'HIGH'; niche from useComparisons(id).niche (null-safe → ScoreDistribution's own absolute/lane mode = the in-panel D-13 degrade)"
  - "PanelContent gained an `id: string | null` param (matches usePermalinkAnalysis) rather than threading a non-null assertion — the score panel is the only consumer today; 03-05's retention case wires into the same widened signature"
  - "ShareabilityPanel PanelEmpty fires ONLY when BOTH tiles AND the share_pull dim are absent; with tiles empty but the dim present it shows the evidence (the reachable honest path) — never a fabricated 0% (deriveBehavioralTiles omits absent *_pct; StatTileRow self-omits on [])"
  - "Weakest behavioral tile marked tone:'accent' by lowest parsed numeric value; the rest stay default (one coral scalpel, matching the brief's lone-accent rule)"
  - "The gauge becoming a 2nd role=button broke 5 sibling assertions across reading.test/degraded/no-cut-data that used getByRole('img', /Score/) or container.querySelector('[role=button]') for the cloud — retargeted by accessible name (gauge=/Score N/, cloud via its svg aria-label). Documented as a Rule 1 test-design correction, not a behavior regression."

patterns-established:
  - "Closed-union allow-list grows by literal + Record-enforced title; the content switch stays exhaustive (tsc proves it) — the canonical safe way to add a drill-down surface"
  - "A hero primitive exposes interactivity behind an optional onOpen, staying a plain role=img when unwired — so the same component is testable in isolation (img) and live (button)"
  - "READ-10 sweep extended to every NEW raw-data surface: the no-cut-data guard now opens the score panel too and asserts no banned/jargon field leaks"

requirements-completed: [READ-09]

# Metrics
duration: 17min
completed: 2026-06-15
---

# Phase 3 Plan 04: The Genuinely-New Wiring — Score Panel + Personas/Shareability Swaps Summary

**The phase's genuinely-new wiring: the hero arc-gauge gets a NEW tap target that opens a 5th drill-down (`score` → `ScoreDistribution`, "where your 71 sits in your niche, and how sure we are"), the closed `PanelId` union grows safely by a literal (T-02-12), and two light panels' P2 native bodies are swapped for their rich visuals — `personas` → the full `PersonaGraph`, `shareability` → `StatTileRow` + the share_pull evidence — every panel D-13-guarded to `PanelEmpty` on thin data, never a throw or a fabricated 0.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-06-15T01:32:11Z (Task 1 commit)
- **Completed:** 2026-06-15T01:49:11Z (Task 2 commit)
- **Tasks:** 2
- **Files modified:** 6 (2 source, 4 test)

## Accomplishments

- **The score drill-down exists (D-02 — the instrument move).** The hero gauge — chosen in P2 precisely to read as an instrument — now taps open a `score` panel rendering `ScoreDistribution` (the niche-cohort histogram + the confidence range). It runs the `VerdictNode` recipe byte-for-byte and degrades to lane/absolute mode on thin niche data (the in-panel honest degrade — no throw, no fabricated 0).
- **The four-touch closed-union edit landed safely (T-02-12).** `PanelId` grew by the literal `| 'score'`; `PANEL_TITLE` got `score: 'Score'` in its `Record<PanelId,string>` (a missing key won't compile); the gauge call site sets `setPanel('score')`; the switch got `case 'score'`. No raw key is ever reflected — `tsc --noEmit` is clean, proving the allow-list compiled.
- **`personas` opens the full PersonaGraph.** The native P2 list is replaced by the 200-dot SVG cloud, fed by the SAME `buildPersonaNodes(...)` call `PersonaCloud` already makes, with `reducedMotion={usePrefersReducedMotion()}` passed (the tap-to-reveal is self-contained per 03-03). Empty nodes → `PanelEmpty`.
- **`shareability` opens behavioral rate tiles + evidence.** `deriveBehavioralTiles(data)` → `StatTileRow` (the weakest tile coral), followed by the `share_pull` lever evidence. Absent `*_pct` are omitted (never a fabricated 0%); `PanelEmpty` only when both tiles and the dim are absent.
- **The store-free invariant held (SC-2 / Pitfall 1).** Only LEAF imports entered `reading.tsx` (`ScoreDistribution`, `PersonaGraph`, `StatTileRow` + the pure `deriveBehavioralTiles`/`confidenceRange`/`useComparisons`) — no `*Node`/`*Frame`/`*Hero`/`useBoardStore`. Grep-confirmed.
- **The 03-01 contract todos this plan owns are now real, passing tests.** Score (open/title/mount/degrade/HIGH-suppress), personas (PersonaGraph mount), shareability (tiles mount + `makeNoBehavioralResult` degrade) — activated; the 3 genuinely-unreachable-by-tap sheet-`PanelEmpty` cases + retention's 3 stay staged for 03-05.

## The four-touch score-panel edit (verbatim)

| Touch | File · anchor | Change |
|---|---|---|
| 1 — extend the union | `reading.tsx` (was L66) | `type PanelId = 'hook' \| 'retention' \| 'shareability' \| 'personas' \| 'score';` |
| 2 — add the title | `reading.tsx` PANEL_TITLE | `score: 'Score',` (the `Record<PanelId,string>` makes a missing key a compile error — kept) |
| 3 — gauge affordance | `score-gauge.tsx` + call site | `onOpen?: () => void`; outer wrapper becomes `role="button"` + `tabIndex={0}` + `onClick` + Enter/Space `onKeyDown` (preventDefault) ONLY when `onOpen` is set, else stays `role="img"`; matte focus-visible ring, no glow. Call site: `<ScoreGauge score={data.overall_score} onOpen={() => setPanel('score')} />` |
| 4 — the switch case | `reading.tsx` PanelContent | `case 'score': return <ScorePanel data={data} id={id} />;` — `ScorePanel` runs the VerdictNode recipe via `useComparisons(id)` + `confidenceRange` + `showRangeText !== 'HIGH'` → `<ScoreDistribution …/>`. `id` threaded into `PanelContent`. |

## PanelContent signature (for 03-05's retention case)

```typescript
function PanelContent({
  panel,
  data,
  dims,
  id,                 // ADDED this plan — string | null, from the container's single subscription
}: {
  panel: PanelId;
  data: PredictionResult;
  dims: ApolloDimension[] | null | undefined;
  id: string | null;  // panel-local useComparisons(id) reads the niche cohort from it
}) { … }
```

03-05's `retention` case slots into this same widened switch unchanged (it already receives `data`/`dims`; `id` is available if its composed cluster wants a panel-local fetch).

## 03-01 todos — active vs still staged

**Activated to passing tests this plan:**
- score: opens from the gauge `onOpen` → `setPanel('score')`, titled "Score" · mounts `ScoreDistribution` (field histogram on a real cohort) · degrades to absolute mode on null niche (no throw) · suppresses the "likely lo–hi" caption on HIGH confidence.
- personas: the full `PersonaGraph` mounts on real data (the native list is gone).
- shareability: `StatTileRow` rate tiles + `share_pull` evidence mount · `makeNoBehavioralResult` degrades gracefully (tiles omitted, NO fabricated 0%, evidence kept).

**Still staged for 03-05 (genuinely deferred, 6 todos):**
- retention (3): mount `RetentionChart` (curve + niche/ghost overlay) · `CraftFilmstrip` timeline-paired (D-04) · `SegmentTable` — the composed "watch journey" cluster is 03-05.
- hook (1): sheet-level `PanelEmpty` when both `hook_decomposition` and the hook dim are absent — unreachable by tap (DriverRows degrades non-clickable).
- shareability (1) + personas (1): sheet-level `PanelEmpty` — **verified unreachable by tap** (emptying the share_pull dim flips DriverRows non-clickable; an empty persona cohort hides the cloud, the only persona tap source). The code guards EXIST in both bodies; covering them needs a direct-mount harness (03-05). Honest staging, not a coverage gap.

## Decisions Made

- **ScorePanel = VerdictNode recipe, panel-local fetch.** Mirrors `VerdictNode.tsx` L244–272 exactly so the score surface reads identically to the board's: `round(overall_score)`, `confidenceRange(score, confidence)`, `showRangeText = confidence_label !== 'HIGH'`. The niche comes from a lazy `useComparisons(id)` (panel-local `useQuery`), NOT a second `usePermalinkAnalysis` subscription — keeping the single-source invariant.
- **`id: string | null` into PanelContent** (matches the hook's return type) rather than a non-null assertion at the call site — clean, and 03-05 inherits the seam.
- **Shareability PanelEmpty is BOTH-absent only.** With tiles empty but the dim present, the panel shows the evidence (reachable honest path); `PanelEmpty` is the both-absent floor. This honors D-13 (never a fabricated 0%) while keeping the reachable behavior useful.
- **Weakest tile = lowest parsed `.v`** → `tone:'accent'`; the lone coral scalpel, matching the matte/flat-warm "coral is the only accent" rule.

## Deviations from Plan

The plan was executed as written for both tasks (the four-touch edit + the two swaps, all D-13-guarded). One Rule-1 test-design correction was required because Task 1's behavior change rippled into sibling test files the plan didn't enumerate:

**1. [Rule 1 — test-design correction] The gauge becoming a `role="button"` broke 5 assertions in 3 sibling test files; retargeted by accessible name.**
- **Found during:** Task 1 (and surfaced fully when the whole `src/components/reading` suite ran after Task 2).
- **Issue:** Adding `onOpen` flips the gauge from `role="img"` to `role="button"` and introduces a SECOND `role="button"` in the hero (gauge=score + cloud=audience). Five existing assertions assumed (a) the gauge is `role="img"` and (b) the cloud is the *only* `role="button"`:
  - `reading.test.tsx` — `getByRole('img', /Score/)` ×2; `container.querySelector('[role="button"]')` for the cloud (now grabs the gauge first → opened "Score" not "Audience").
  - `reading.degraded.test.tsx` — `getByRole('img', /Score/)` ×4 + one `queryByRole('img', …).not`.
  - `reading.no-cut-data.test.tsx` — `getByRole('img', /Score/)` ×1; the cloud `querySelector('[role="button"]')`; AND it crashed with `No QueryClient set` once the score panel could mount (it opens "every drill panel").
- **Fix:** Retargeted the gauge by accessible name (`getByRole('button', { name: /Score N of 100/ })`) and the cloud via its distinguishing svg (`querySelector('svg[aria-label="Audience watch-through by persona"]').closest('[role="button"]')`) — more robust than "any button." Mocked `useComparisons` in `reading.no-cut-data.test.tsx` (the panels test already does), and **extended** its READ-10 sweep to open the new `score` panel and assert no banned/jargon field leaks there too.
- **Files modified:** `reading.test.tsx`, `reading.degraded.test.tsx`, `reading.no-cut-data.test.tsx`.
- **Verification:** full `src/components/reading` suite exits 0 (98 pass / 6 todo / 0 fail).
- **Committed in:** `d1debeda` (Task 2) — the breakages only became fully visible once the whole suite ran post-swap; the gauge change itself is Task 1 (`815b64f7`).

**Two architectural-honesty notes (NOT deviations — the plan and 03-01 anticipated these):**
- The personas/shareability **sheet-level `PanelEmpty` is unreachable by tap** (verified): emptying the share_pull dim flips DriverRows to its non-clickable degraded branch; an empty persona cohort hides the cloud (the only persona tap source). The code guards exist; they're staged as 03-05 direct-mount todos, exactly as 03-01 foresaw. The reachable degradation (tiles omitted / evidence kept; cloud absent; no throw) IS asserted.
- `ScoreDistribution` carries `border-white/[0.06]` and `text-accent/70` in its OWN file (03-02's reskin scope); this plan only mounts it. It is matte-lint GREEN (the lint targets glow/coral-hex/blur, which it has none of). Flagged for the D-07 reviewer's eye only.

**Total deviations:** 1 Rule-1 test-design correction (no production behavior regressed; the swaps' intent — render real output, degrade calmly, never throw/fabricate — is fully honored). 0 architectural changes. 0 package installs (T-03-SC not triggered).

## Issues Encountered

- **`No QueryClient set`** in `reading.no-cut-data.test.tsx` once the score panel could mount — resolved by mocking `useComparisons` (the lazy `useQuery`), matching the panels test's approach. No production change.
- Both task verifications otherwise passed; the only iteration was retargeting the 5 sibling assertions above (within the fix-attempt budget — a single coordinated test-selector pass, not repeated build-chasing).

## Verification

- `npx vitest run src/components/reading` → **exit 0** — 98 active-passing / 6 todo / 0 fail (was 92 active pre-plan; +4 score, +2 reactivated personas/shareability).
- `npx tsc --noEmit` → **12 pre-existing errors, 0 in `src/components/reading/`** — the closed-union allow-list compiled (T-02-12 enforced).
- Store-free invariant → **CLEAN**: `grep -nE "^import" reading.tsx | grep -iE "Node|Frame|Hero|BoardStore|FactorBars"` returns nothing (only leaf imports).
- Matte-lint → **9/9 GREEN** (unchanged — this plan mounts, doesn't reskin).
- Board + reading together → **567 pass / 0 fail** (the transplants didn't regress the board).
- **Full repo suite → 2065 pass / 32 todo / 0 fail** (≥ the ~2035 VALIDATION threshold; was 2041 after P2).

## D-07 human-UAT notes (carried to the phase-close gate)

The score / personas / shareability surfaces are now LIVE in the Reading's drill-downs — net-new for the human-UAT gate. To confirm by eye on a real Simulation:
- **Score panel:** tapping the hero gauge opens "Score" → `ScoreDistribution`. On a real niche cohort it shows the grounded histogram + the "you" marker + the confidence band; on a thin/absent cohort it falls to the absolute lane (still shows your score) — confirm neither path throws or shows a grey box. The "likely lo–hi" caption should be SUPPRESSED on HIGH confidence, present on MEDIUM/LOW.
- **Personas panel:** the cloud opens the full `PersonaGraph` (200 dots, the worst cluster coral). Confirm the `<animate>` pulse respects reduced-motion (carried 03-03 judgment call: drop it if it reads busy), and that a tap on a dot pins/dismisses its card on touch.
- **Shareability panel:** the rate tiles (share/completion/comment/save) render with the weakest coral, followed by the share_pull evidence; tiles with no engine `*_pct` are simply absent (no "0%").
- **Gauge affordance:** the gauge now reads as tappable (cursor + focus ring) but stays MATTE — confirm no hover glow crept in.

## Next Phase Readiness

- **03-05 (retention cluster + hook reskin-verify):** also edits `reading.tsx` (sequential after this). The `PanelContent` switch is widened with `id`; the `retention` case is untouched and ready to swap for the composed `RetentionChart` + `CraftFilmstrip` + `SegmentTable` cluster (D-04/D-06). The 6 staged todos (retention ×3, the 3 unreachable sheet-`PanelEmpty`) are its targets. Default the retention panel to static chart + filmstrip + table; layer `RetentionPlayer` only if `useUploadedVideoSource(...).status === 'ready'` (RESEARCH Landmine 5 — EXCLUDE by default).
- **D-07 human-UAT gate (03-06, BLOCKING):** the score/personas/shareability drill-downs are net-new visual surfaces for the gate; the notes above flag what to verify live.

## Self-Check: PASSED

- Files: `reading.tsx`, `score-gauge.tsx`, `reading.panels.test.tsx`, `reading.test.tsx`, `reading.degraded.test.tsx`, `reading.no-cut-data.test.tsx`, `03-04-SUMMARY.md` — all FOUND.
- Commits: `815b64f7` (Task 1 — score panel + gauge onOpen), `d1debeda` (Task 2 — personas/shareability swaps) — both FOUND on `milestone/numen-rework`.
- Gate state confirmed: `src/components/reading` exit 0 (98 pass / 6 todo / 0 fail); tsc 12 pre-existing / 0 in reading/; store-free grep clean; matte-lint 9/9; full suite 2065 pass / 0 fail. `git grep "case 'score'"` and `git grep -nE "PersonaGraph|StatTileRow" -- reading.tsx` both return hits; the no-`*Node`/no-`useBoardStore` grep returns nothing.

---
*Phase: 03-rich-visuals-as-drill-downs*
*Completed: 2026-06-15*
