---
phase: 01-engine-pack-seam
plan: 04
subsystem: engine
tags: [pack-seam, smoke-gate, structural-gate, D-03, D-04, PACK-04, blocking-gate, regression]

# Dependency graph
requires:
  - phase: 01-03
    provides: "SOCIALS_PACK: DomainPack (scoring.run = aggregateScores wrapped whole) + resolvePack(mode) dispatcher with zero scoring logic"
  - phase: 01-01
    provides: "restored node_modules (vitest 4.1.9), green engine baseline, ENGINE_VERSION 3.20.0"
provides:
  - "pack-seam-smoke.test.ts — the phase's BLOCKING D-03 light smoke + structural gate: pack.scoring.run completes for text + video fixtures, returns a structurally valid PredictionResult (keys present, overall_score finite in [0,100], engine_version 3.20.0); static PACK-01 no-scoring-logic check on packs/index.ts"
affects: [01-05, 01-06 (the gate blocks the phase if the seam regresses Socials)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural (NOT byte-identical) smoke gate — assert KEYS via Object.keys + arrayContaining, sane-band overall_score, version pin; no golden-master/byte-equality rig (D-03/D-04)"
    - "Offline-deterministic scorer run — mock the LLM/IO layer (deepseek.isCircuitOpen→true short-circuits the Stage-11 network call; logger/supabase/sentry/cache stubbed) the way aggregator.test.ts does (RESEARCH A3)"
    - "Static no-scoring-logic proof — fs.readFileSync the dispatcher, strip block+line comments FIRST, then expect(code).not.toMatch(/aggregateScores/) (explore-runner.test.ts:300-319 idiom)"

key-files:
  created:
    - src/lib/engine/__tests__/pack-seam-smoke.test.ts
  modified: []

key-decisions:
  - "D-04 lens applied: PACK-04 / ROADMAP SC#4 'byte-identical' treated as SUPERSEDED by D-02/D-03. No golden-master / byte-equality assertions — the gate is a light structural smoke (keys, sane band, version), the D-01 rollback safety net combined with git, NOT a brittle exact-value harness."
  - "Run the scorer offline+deterministic via the proven aggregator.test.ts mock block (logger/supabase/sentry/cache + gemini/deepseek/flop-warning). deepseek.isCircuitOpen→true short-circuits the only network call so the structural run touches no real IO (RESEARCH A3)."
  - "Video variant built via factory overrides ONLY (makeContentPayload({ input_mode: 'video_upload', content_type: 'video' })) — no hand-rolled PipelineResult (RESEARCH §Don't Hand-Roll)."

patterns-established:
  - "A phase-level BLOCKING gate authored as a self-contained anchor test with a header doc-comment naming the protected invariants + 'The phase CANNOT pass with this red.'"

requirements-completed: [PACK-04]

# Metrics
duration: 3min
completed: 2026-06-26
---

# Phase 01 Plan 04: Pack-Seam Smoke + Structural Gate Summary

**The phase's BLOCKING D-03 safety gate — `pack-seam-smoke.test.ts` feeds a representative `PipelineResult` (text + video variants) to `SOCIALS_PACK.scoring.run` and asserts the run COMPLETES with a structurally valid `PredictionResult` (all 8 required keys present, `overall_score` finite ∈ [0,100], `engine_version === "3.20.0"`), plus a static proof that the `packs/index.ts` dispatch surface holds zero scoring logic. Read through the D-04 lens: "byte-identical" is superseded — this is light structural insurance + the D-01 rollback net, NOT a golden-master rig.**

## Performance

- **Duration:** ~3 min
- **Tasks:** 1 (tdd="true")
- **Files modified:** 1 (created — 1 test)

## Accomplishments
- Authored `src/lib/engine/__tests__/pack-seam-smoke.test.ts` (188 lines) — the BLOCKING phase gate, modeled on `audience-regression-gate.test.ts` (self-contained anchor; header doc-comment names PACK-01..04 + "The phase CANNOT pass with this red.").
- 5 assertions, all GREEN via `node ./node_modules/vitest/vitest.mjs run`:
  1. `resolvePack("socials")` returns a fully-populated `DomainPack` — all 7 spec fields + `id`/`run`/`scoring` present (PACK-02/03).
  2. `pack.scoring.run(makePipelineResult())` (TEXT fixture) resolves without throwing → structurally valid `PredictionResult`; `input_mode === "text"`.
  3. `pack.scoring.run(...video_upload payload...)` (VIDEO fixture, factory overrides only) resolves → structurally valid; `input_mode === "video_upload"`.
  4. `ENGINE_VERSION === "3.20.0"` (T-01-CP, no accidental bump).
  5. Static: `packs/index.ts` source (block + line comments stripped FIRST) does NOT match `/aggregateScores/` — the dispatch surface holds zero scoring logic (PACK-01).
- Structural validity helper asserts KEYS (not values): `Object.keys(result)` contains all 8 required keys, `overall_score` is a finite number in `[0,100]`, `engine_version === "3.20.0"` — D-03/D-04 structural gate, no byte-equality.

## Task Commits

1. **Task 1 — BLOCKING pack-seam smoke + structural gate** - `93f14a05` (test)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP.

## Files Created/Modified
- `src/lib/engine/__tests__/pack-seam-smoke.test.ts` - The D-03 BLOCKING smoke. Imports `resolvePack`/`SOCIALS_PACK` + `DomainPack` type from `../packs`, `makePipelineResult`/`makeContentPayload` from `./factories`, `ENGINE_VERSION` from `../version`, `PredictionResult` type from `../types`. Replicates the aggregator.test.ts mock block (logger/supabase/sentry/cache + gemini/deepseek/flop-warning) for an offline, deterministic structural run.

## Decisions Made
- **D-04 lens (byte-identical superseded):** no golden-master / byte-equality assertions — explicitly avoided per the plan. The gate asserts structure (keys), a sane band, and the version pin only.
- **Offline determinism (RESEARCH A3):** mocked the LLM/IO layer via the proven aggregator.test.ts block; `deepseek.isCircuitOpen→true` short-circuits the only network call (Stage 11). The structural run touches no real IO.
- **Factory overrides only:** the video variant flips the stimulus axis via `makeContentPayload({ input_mode: "video_upload", content_type: "video" })` — no hand-rolled `PipelineResult` (RESEARCH §Don't Hand-Roll). `makePipelineResult`'s defaults (`foldOutcome: null`, `personaBehavioralAggregate: null`) cover both text and video shapes, so no fixture extension was needed.

## Deviations from Plan
None — plan executed exactly as written. The single task carries `tdd="true"`; see TDD Gate Compliance below for why this test-only gate over already-shipped behavior is a degenerate RED.

## Issues Encountered
None. The gate is green on first run (5/5 passed, 273ms). The seam preserved Socials behaviour (Plan 03), so the gate's red condition — a Socials regression — is not present.

## Known Stubs
None. The gate drives the REAL `SOCIALS_PACK.scoring.run` (= `aggregateScores`) over real factory fixtures; only the LLM/IO boundary is mocked for offline determinism (standard engine-test practice, not a stub of the unit under test).

## Threat Flags
None. Test-only; no new trust boundary, endpoint, input, or schema. This gate IS the documented mitigation for the phase's refactor-regression risk (T-01-RR) and the ENGINE_VERSION-drift risk (T-01-CP) — it is a control, not new attack surface.

## User Setup Required
None.

## TDD Gate Compliance
The task is `tdd="true"`, but its deliverable IS a test (the phase's BLOCKING gate) authored OVER behavior already shipped in Waves 0–2 / Plan 03 (`SOCIALS_PACK` + `aggregateScores`). There is no production code to add, so a literal RED→GREEN with a failing-then-passing implementation is degenerate: the gate is GREEN now precisely because the seam preserved Socials. The gate's intrinsic RED condition — "Socials regresses (scoring throws, drops a required key, returns an out-of-band `overall_score`, or bumps `engine_version`)" — is exactly what it exists to catch and would turn it red. Committed as a single `test(...)` commit (`93f14a05`); no `feat(...)` follow-up applies. The MVP+TDD behavior-adding gate does not fire here: `<files>` lists only a test file (no source files), so the task is test-only and exempt.

## Self-Check: PASSED

- FOUND: src/lib/engine/__tests__/pack-seam-smoke.test.ts
- FOUND: .planning/phases/01-engine-pack-seam/01-04-SUMMARY.md
- FOUND commit: 93f14a05 (Task 1 — test)

---
*Phase: 01-engine-pack-seam*
*Completed: 2026-06-26*
