---
phase: 11-explore-audience-curated-discovery
plan: 01
subsystem: discover
tags: [outlier-ranking, audience-fit, typed-blocks, zod, vitest, pure-math, honesty-spine]

# Dependency graph
requires:
  - phase: 08-discover-remix-read
    provides: "rankOutliers + RankedOutlier shape (outlier-compute.ts), OutlierGridBlockSchema (the in-thread outlier-grid typed block)"
  - phase: 07-audience-manager
    provides: "Audience domain object (audience-types.ts) — is_general/is_preset/calibration.thin, personas[].temperature/share, profile.temperature_mix"
provides:
  - "rankWithAudienceFit — pure deterministic audience-relative fit re-rank (EXPLORE-03 / D-01): RankedOutlier[] → FitRankedOutlier[] with a quantized Strong|Fair|Weak level or fit:null on honest degrade"
  - "FitLevel + FitRankedOutlier types (the producer contract every downstream Explore plan consumes)"
  - "OutlierGridBlockSchema extended with fit / trackable / trackHandle (nullable-optional, no migration) — the typed contract the /api/tools/explore route emits and the outlier tile renders against (EXPLORE-05 producer-half plumbing)"
affects: [explore-route, explore-runner, explore-thread-view, outlier-tile, tracked-accounts, "Phase 11 plans 02-08"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audience-fit re-rank as pure runner/route-layer math (no engine touch, ENGINE_VERSION stays 3.19.0) — same precedent as resolveNicheKey living outside selectPersonaSlots"
    - "Honest degrade gate (hasFitSignal) returning a null annotation rather than a fabricated/zero value (D-02 honesty spine)"
    - "Typed-block field extension via nullable-optional (mirrors predictedFailureMode) — zero migration, zero registry edit"

key-files:
  created:
    - src/lib/discover/explore-rank.ts
    - src/lib/discover/explore-rank.test.ts
  modified:
    - src/lib/tools/blocks.ts

key-decisions:
  - "Fit-score formula constants are [ASSUMED A2] tunables: STRONG=0.66 / FAIR=0.4 thresholds, re-rank α=0.5 (measured signal stays primary), niche-token min length 3, neutral calibration-fit 0.5 on empty mix — tune in UAT like the Flash thresholds"
  - "calibrationFit maps the tile's measured signature to a cold/warm/hot demand vector (multiplier→cold FYP reach; saves/views→warm; shares/views→hot) and dot-products it with the audience temperature mix (profile.temperature_mix, else summed persona share by temperature)"
  - "serendipity is clamped to [0,1] and only down-weights niche-match (nicheWeight = 1 - serendipity); it fabricates nothing — the valve widens what surfaces, never invents a signal"
  - "fit:null degrade preserves P8's exact rankOutliers order (General/preset/thin/empty-personas); the calibrated path spreads tiles immutably (input array never mutated)"

patterns-established:
  - "Pattern: pure audience-fit re-rank (explore-rank.ts) wraps rankOutliers output, same honest-math family as the vs-niche baseline — no SIM, no network, no fabricated reaction (D-02/D-03)"
  - "Pattern: outlier-grid tile extension carries an explicit audience-fit ESTIMATE (level word only) while keeping the no-band/no-model/no-numeric-score honesty contract on the MEASURED tile (Pitfall 5)"

requirements-completed: [EXPLORE-03, EXPLORE-05]

# Metrics
duration: 22min
completed: 2026-06-20
---

# Phase 11 Plan 01: Explore Fit-Rank Foundation Summary

**Pure deterministic audience-fit re-rank (`rankWithAudienceFit`) turning P8's measured `RankedOutlier[]` into Strong/Fair/Weak fit-annotated tiles with an honest degrade gate, plus a zero-migration `OutlierGridBlockSchema` extension carrying `fit`/`trackable`/`trackHandle`.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-20T03:48:00Z
- **Completed:** 2026-06-20T04:10:00Z
- **Tasks:** 2 (Task 1 TDD: RED → GREEN)
- **Files modified:** 3 (2 created, 1 extended)

## Accomplishments

- **`rankWithAudienceFit` (EXPLORE-03 / D-01)** — a pure, deterministic, side-effect-free re-rank that annotates each measured outlier with a quantized audience-fit level. NO SIM call, NO network, NO engine scoring; lives at the runner/route layer so `ENGINE_VERSION` stays `3.19.0` (Pitfall 6) and the SIM-1 Max regression gate is untouched.
- **The D-02 honesty degrade gate (`hasFitSignal`)** — General / preset / thin-calibration / empty-personas audiences return `fit: null` on every tile and preserve P8's exact `rankOutliers` order. Never an empty/zero bar, never a fabricated level.
- **Two honest 0..1 scorers** — `nicheMatch` (Jaccard token overlap between tile caption+hashtags and audience name+goal_label, punctuation-stripped, <3-char tokens dropped) and `calibrationFit` (tile temperature-demand vector dot-product the audience temperature mix). Blended `fitScore` quantizes at 0.66/0.4 into the exact enum `Strong|Fair|Weak`.
- **`OutlierGridBlockSchema` extension (EXPLORE-05 producer half / D-08)** — `fit` (nullable-optional enum), `trackable` (optional boolean), `trackHandle` (optional string) added to each tile. Nullable-optional (mirrors `predictedFailureMode`) so existing persisted blocks stay valid with zero migration and zero registry change.
- **Behaviour-locking test suite** — 13 tests covering the degrade gate, level quantization, niche-match ordering, serendipity widening, determinism, measured-signal primacy, and no-mutation.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing test for rankWithAudienceFit** - `99af7f89` (test)
2. **Task 1 (GREEN): implement rankWithAudienceFit** - `a5ac31f4` (feat)
3. **Task 2: extend OutlierGridBlockSchema with fit/trackable/trackHandle** - `ebce7e04` (feat)

_Task 1 followed the TDD RED → GREEN cycle (no REFACTOR needed — the implementation was already minimal and clean)._

## Files Created/Modified

- `src/lib/discover/explore-rank.ts` (created) - `rankWithAudienceFit` + `FitLevel` + `FitRankedOutlier`; the `hasFitSignal` degrade gate; private `nicheMatch` / `calibrationFit` / `tokenize` / temperature-vector helpers. Pure math, imports only the `RankedOutlier` and `Audience`/`Temperature` types.
- `src/lib/discover/explore-rank.test.ts` (created) - 13 behaviour-proof tests (`./explore-rank` relative import; co-located per plan).
- `src/lib/tools/blocks.ts` (modified) - `OutlierGridBlockSchema.props.tiles[*]` gains `fit` / `trackable` / `trackHandle` (+19/-2 lines); honesty comment block updated to note the fit field is an estimate, not a SIM verdict.

## Decisions Made

- **Formula constants are tunable [ASSUMED A2]:** thresholds 0.66/0.4, re-rank α=0.5, min-token-length 3, neutral-fit 0.5. The *structure* (honest re-rank, degrade gate, level-word-only output) is load-bearing and locked by D-01/D-02; the constants tune in UAT exactly as the Flash thresholds did.
- **Calibration demand mapping:** high `multiplier` → cold (broad FYP reach); high `saves/views` → warm (loyalist save play); high `shares/views` → hot (advocacy). Each raw signal is monotonically squashed into 0..1 so no single magnitude dominates, then L1-normalized before the dot-product with the audience mix.
- **Audience mix source priority:** `profile.temperature_mix` when present, else summed `personas[].share` by `temperature`. Empty mix → neutral 0.5 (guarded, never NaN).
- **Serendipity semantics:** clamped to [0,1]; `nicheWeight = 1 - serendipity`. Widening surfaces the calibration signal of off-niche tiles without fabricating anything.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected test relative-import path (`../` → `./`)**
- **Found during:** Task 1 (GREEN — first test run)
- **Issue:** The test file is co-located at `src/lib/discover/explore-rank.test.ts` (per the plan's `files_modified` + `<verify>` path), but I initially copied the `../module` import convention from the existing `src/lib/discover/__tests__/` suite. From a co-located file `../explore-rank` resolves one directory too high (`src/lib/explore-rank`), producing a "Cannot find module" collection error.
- **Fix:** Changed the test imports to `./explore-rank` and `./outlier-compute`.
- **Files modified:** src/lib/discover/explore-rank.test.ts
- **Verification:** `@/`-alias scratch import proved the module resolved; after the fix, 13/13 tests pass via the authoritative `node ./node_modules/vitest/vitest.mjs` invocation.
- **Committed in:** `a5ac31f4` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Fixed invalid Archetype slug in a test fixture (`"the_loyalist"` → `"loyalist"`)**
- **Found during:** Task 1 (GREEN — typecheck)
- **Issue:** The `persona()` test builder used `archetype: "the_loyalist"`, which is not a member of the `Archetype` union (valid slug is `"loyalist"`). One TS2820 error in the test file.
- **Fix:** Changed to `"loyalist"` (tsc's own suggestion).
- **Files modified:** src/lib/discover/explore-rank.test.ts
- **Verification:** `tsc --noEmit` reports my files clean; total project error count dropped 47 → 46.
- **Committed in:** `a5ac31f4` (Task 1 GREEN commit)

**3. [Rule 1 - Test correctness] Strengthened the serendipity-widening fixture**
- **Found during:** Task 1 (GREEN — first full test run, 12/13 pass)
- **Issue:** The "raising serendipity lifts an off-niche tile's level" test used a tile whose `calibrationFit` (≈0.34) landed just below the FAIR threshold (0.4), so the level stayed `Weak` at both serendipity 0 and 1 and the strict-rise assertion failed. The implementation correctly followed the prescribed formula; the *fixture* didn't construct a clean threshold crossing.
- **Fix:** Reworked the fixture to a warm-dominant audience (`temperature_mix` warm 0.85) and a pure-save (warm) off-niche tile (saveRate 0.6, low multiplier/shares), so `calibrationFit` ≈ 0.50 and the level cleanly rises Weak → Fair when the valve widens.
- **Files modified:** src/lib/discover/explore-rank.test.ts
- **Verification:** 13/13 green; the assertion now proves the valve mechanic (niche-match weight shrinks → calibration signal surfaces) rather than relying on a borderline value.
- **Committed in:** `a5ac31f4` (Task 1 GREEN commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — test path, invalid fixture slug, fixture calibration). All confined to the test file; the production module (`explore-rank.ts`) was written correct per the prescribed formula and needed no fixes. No scope creep.

## Issues Encountered

- **`vitest` invocation is wrapped by an `rtk` tee shim** in this environment that prints only `PASS (0) FAIL (0)` and writes a JSON-only log to `~/Library/Application Support/rtk/tee/`. The wrapper also **replays a stale cached log** for the `npx vitest run` path (it kept reporting the old `../explore-rank` import error even after the fix). Resolved by running the test through the direct, authoritative entry `node ./node_modules/vitest/vitest.mjs run … --reporter=default`, which shows the real, current result (13/13 pass). The plan's `<verify>` command (`npx vitest run …`) is satisfied — the stale-log artifact is environmental, not a real failure.

## Deferred / Out-of-Scope Issues

- **46 pre-existing `tsc` errors** in unrelated test files (`src/lib/threads/__tests__/`, `src/lib/engine/**/__tests__/`, `src/lib/tools/runners/__tests__/`, a few component tests) exist independently of this plan (present at commit `27a966de`, before any of my work). Per the scope boundary they were **not** touched. My three files contribute **zero** errors to that count.

## Known Stubs

None. `trackable`/`trackHandle` are intentionally unpopulated schema plumbing for this plan (producer-half contract, D-08); they are consumed by the downstream Explore route/runner/tile plans (11-02..08) and the `tracked_accounts` write, exactly as the plan scopes them.

## User Setup Required

None - no external service configuration required (pure module + schema extension; no env vars, no migration).

## Next Phase Readiness

- The two pure foundation modules every downstream Explore plan depends on are live: `rankWithAudienceFit` (the always-present honest "scored for YOUR audience" signal) and the extended `outlier-grid` block contract.
- **Ready for:** 11-02+ — the `/api/tools/explore` SSE route (calls `rankWithAudienceFit` after `rankOutliers`), `explore-runner.ts`, `use-explore-stream.ts`, `ExploreThreadView`, the outlier-tile fit bar + Track button, and the `tracked_accounts` table/repo/route.
- **No blockers.** Constants flagged `[ASSUMED A2]` are intentional UAT tunables, not gaps.

## Self-Check: PASSED

- Created files verified on disk: `explore-rank.ts`, `explore-rank.test.ts`, `11-01-SUMMARY.md`.
- Modified file verified: `blocks.ts` carries `fit`/`trackable`/`trackHandle`.
- Commits verified in git: `99af7f89` (RED), `a5ac31f4` (GREEN), `ebce7e04` (Task 2).

---
*Phase: 11-explore-audience-curated-discovery*
*Completed: 2026-06-20*
