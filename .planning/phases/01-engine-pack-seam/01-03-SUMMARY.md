---
phase: 01-engine-pack-seam
plan: 03
subsystem: engine
tags: [domain-pack, pack-seam, socials-pack, resolvePack, aggregateScores, in-place-cut, D-01, PACK-02, PACK-03]

# Dependency graph
requires:
  - phase: 01-02
    provides: "DomainPack 7-field type contract + compile-time aggregateScores→scoring.run probe"
  - phase: 01-01
    provides: "restored node_modules (vitest 4.1.9, tsc), green pre-seam baseline, ENGINE_VERSION 3.20.0"
provides:
  - "SOCIALS_PACK: DomainPack (src/lib/engine/packs/socials.ts) — Socials populated as Pack #1, all 7 fields by reference; scoring.run = aggregateScores wrapped whole (D-06/D-07)"
  - "resolvePack(mode) dispatcher (src/lib/engine/packs/index.ts) — core dispatch surface with ZERO scoring logic (PACK-01)"
  - "Behaviour gates: socials-pack.test.ts (reference identities) + packs-index.test.ts (dispatch)"
affects: [01-04 (D-03 smoke asserts PredictionResult via the wrapped scorer), 01-06 (Predict pack mounts same contract via resolvePack)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed-const pack object (`export const SOCIALS_PACK: DomainPack = {...}`) — tsc enforces the 7-field contract; const-object idiom, NOT a class (D-08)"
    - "Behaviour-preserving scoring wrap by REFERENCE identity (`scoring.run: aggregateScores`) — opaque, no re-derivation (D-07)"
    - "Dispatcher reaches scoring only via `pack.scoring.run` — no direct scorer/Apollo/overall_score reference on the dispatch surface (PACK-01)"

key-files:
  created:
    - src/lib/engine/packs/socials.ts
    - src/lib/engine/packs/index.ts
    - src/lib/engine/__tests__/socials-pack.test.ts
    - src/lib/engine/__tests__/packs-index.test.ts
  modified: []

key-decisions:
  - "In-place cut (D-01): no runtime/env flag, no parallel old-vs-new path — Socials becomes Pack #1 in one move; rollback safety = git + Plan 04 smoke."
  - "Every field populated by REFERENCE (Cut Line A, RESOLVED) — apollo-core/deepseek/fold modules NOT moved into packs/; aggregator NOT parameterized; ENGINE_VERSION NOT bumped. Diff = 2 new source files + 2 new tests."
  - "outputSchema.requiredKeys lists the 8 PredictionResult top-level keys the D-03 smoke (Plan 04) asserts: overall_score, confidence, confidence_label, behavioral_predictions, factors, signal_availability, engine_version, input_mode."

patterns-established:
  - "scoring.run reference identity asserted in a test (`SOCIALS_PACK.scoring.run === aggregateScores`) — a behaviour-preservation regression gate (T-01-RR)."
  - "resolvePack switch throws on unknown id — the registration guard for the future General/Predict packs that mount the same contract."

requirements-completed: [PACK-02, PACK-03]

# Metrics
duration: 4min
completed: 2026-06-26
---

# Phase 01 Plan 03: SOCIALS_PACK + resolvePack Summary

**Socials populated as Pack #1 — `SOCIALS_PACK: DomainPack` wraps `aggregateScores` WHOLE (the overall_score virality fold, opaque, behaviour unchanged) and references the existing Apollo/fold/population modules for the other 6 fields; plus the thin `resolvePack(mode)` dispatcher that holds ZERO scoring logic. The in-place cut (D-01) — no flag, no parallel path.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-26T13:10:41Z
- **Completed:** 2026-06-26T13:13:30Z
- **Tasks:** 2 (both tdd="true")
- **Files modified:** 4 (all created — 2 source, 2 tests)

## Accomplishments
- `SOCIALS_PACK: DomainPack` populated as Pack #1: all 7 spec fields + `id`/`run`/`scoring` present and type-checked (`satisfies DomainPack`, tsc clean).
- `scoring.run = aggregateScores` by REFERENCE IDENTITY (D-06/D-07) — the entire `overall_score`/virality/anti-virality/CTA-penalty fold runs unchanged inside it; no re-derivation. Asserted by test (`scoring.run === aggregateScores`).
- `run = runPredictionPipeline` (domain-blind orchestration); `grounding`/`reactionFrame` bind the REAL `APOLLO_SYSTEM_PROMPT`/`KNOWLEDGE_CORE`/`selectPersonaSlots`/`buildAudienceRepaint` (not stubs).
- `resolvePack(mode)` dispatcher added — resolves `"socials"` → `SOCIALS_PACK`, throws on unknown id; the dispatch surface holds no direct `aggregateScores`/Apollo/`overall_score` reference (PACK-01).
- ENGINE_VERSION untouched (3.20.0); no engine file moved; full engine suite green (620 passed / 9 skipped, 48 files) — no regression.

## Task Commits

Each task followed the TDD RED→GREEN cycle, committed atomically:

1. **Task 1 RED — failing SOCIALS_PACK reference-identity gate** - `36301c9b` (test)
2. **Task 1 GREEN — populate SOCIALS_PACK as Pack #1** - `4c6eb44f` (feat)
3. **Task 2 RED — failing resolvePack dispatch gate** - `50f5f04c` (test)
4. **Task 2 GREEN — add resolvePack dispatcher** - `cfc587a4` (feat)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP.

## Files Created/Modified
- `src/lib/engine/packs/socials.ts` - `SOCIALS_PACK: DomainPack` — Socials as Pack #1. `scoring.run = aggregateScores` (wrapped whole), `scoring.systemPrompt = APOLLO_SYSTEM_PROMPT`, `run = runPredictionPipeline`, `grounding` = Apollo prompt + KNOWLEDGE_CORE, `reactionFrame` = real persona/repaint fns, thin `populations`/`calibration` descriptors, `stimulusTypes` = input_mode enum, `outputSchema` = PredictionResult + 8 D-03 keys.
- `src/lib/engine/packs/index.ts` - `resolvePack(mode)` dispatcher (zero scoring logic) + re-exports of `SOCIALS_PACK` and the `DomainPack` type. Header doc records the PACK-01 zero-scoring contract.
- `src/lib/engine/__tests__/socials-pack.test.ts` - 9 assertions: reference identities (scoring.run/run/systemPrompt/grounding/reactionFrame), id, stimulusTypes deep-equal, outputSchema keys, thin descriptors.
- `src/lib/engine/__tests__/packs-index.test.ts` - 3 assertions: `resolvePack("socials") === SOCIALS_PACK`, throws on unknown id, scoring reached via the returned pack.

## Decisions Made
- In-place cut (D-01): Socials becomes Pack #1 in one move; no env/runtime flag, no parallel code path. Rollback safety = git + the Plan 04 smoke gate.
- Cut Line A (RESOLVED, not re-opened): wrap `aggregateScores` by reference; reference Apollo/fold as grounding; do NOT physically extract Apollo+fold execution (Cut Line B, rejected). No module relocation, no aggregator parameterization, no ENGINE_VERSION bump.
- `outputSchema.requiredKeys` enumerates the 8 top-level PredictionResult keys the Plan-04 D-03 smoke asserts present.

## Deviations from Plan

### Tooling-required additions (TDD flow)

**1. [TDD flow] Added two test files not in `files_modified` frontmatter**
- **Reason:** Both tasks carry `tdd="true"`, mandating the RED→GREEN cycle. The frontmatter `files_modified` lists only the 2 source files; the test files are the RED gates the TDD flow requires.
- **Files added:** `src/lib/engine/__tests__/socials-pack.test.ts`, `src/lib/engine/__tests__/packs-index.test.ts`
- **Commits:** `36301c9b`, `50f5f04c`

**2. [Rule 3 - Blocking] Reworded an index.ts doc-comment to pass the plan's literal static verify**
- **Found during:** Task 2 verify.
- **Issue:** The plan's verify greps `! grep -E "import.*aggregateScores" src/lib/engine/packs/index.ts`. My header comment originally read "MUST NOT import or reference `aggregateScores`…", a false-positive match that would fail the literal verify despite there being no actual import.
- **Fix:** Reworded the comment to "holds NO direct reference to the scorer…" — no `import`/`aggregateScores` co-occurrence. The dispatcher still imports no scorer.
- **Files modified:** `src/lib/engine/packs/index.ts` (pre-commit, folded into `cfc587a4`).

## Issues Encountered
None blocking. tsc reports no `packs/` errors; the 12 new pack assertions + the Plan-02 contract gate + the full 48-file engine suite are all green.

## Known Stubs
None. `populations` and `calibration` are intentionally thin-but-precise descriptors per the Plan-02 D-05 contract (declarative this phase, consumed live later) — planned phasing, not unfinished work. `scoring.run`/`run`/`grounding`/`reactionFrame` all bind the REAL functions.

## Threat Flags
None. No new trust boundary, endpoint, input, or schema — pure indirection over existing, tested modules. T-01-RR (regression) is mitigated by the reference-identity assertion + the green engine suite; ENGINE_VERSION stays 3.20.0 so the prediction cache stays valid (T-01-CP). pipeline.ts (SSRF block) untouched (T-01-SSRF, accept — out of Cut Line A scope).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04 (D-03 smoke) can now assert a valid PredictionResult flows through `SOCIALS_PACK.scoring.run` with a sane-band `overall_score`.
- Plan 06 (Predict pack) mounts the same `DomainPack` contract and registers via `resolvePack`'s switch.
- No blockers. ENGINE_VERSION 3.20.0; cache valid; no engine file moved.

## TDD Gate Compliance
Both tasks ran RED (failing import) → GREEN. `test(...)` commits precede each `feat(...)`: `36301c9b`→`4c6eb44f` (Task 1), `50f5f04c`→`cfc587a4` (Task 2). Sequence verified in git log.

## Self-Check: PASSED

- FOUND: src/lib/engine/packs/socials.ts
- FOUND: src/lib/engine/packs/index.ts
- FOUND: src/lib/engine/__tests__/socials-pack.test.ts
- FOUND: src/lib/engine/__tests__/packs-index.test.ts
- FOUND: .planning/phases/01-engine-pack-seam/01-03-SUMMARY.md
- FOUND commit: 36301c9b (Task 1 RED)
- FOUND commit: 4c6eb44f (Task 1 GREEN)
- FOUND commit: 50f5f04c (Task 2 RED)
- FOUND commit: cfc587a4 (Task 2 GREEN)

---
*Phase: 01-engine-pack-seam*
*Completed: 2026-06-26*
