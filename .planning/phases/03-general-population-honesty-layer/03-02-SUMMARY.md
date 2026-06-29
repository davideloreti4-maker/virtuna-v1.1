---
phase: 03-general-population-honesty-layer
plan: 02
subsystem: audience
tags: [typescript, audience, domain-pack, trust-tier, honesty-layer]

# Dependency graph
requires:
  - phase: 02-trustworthy-sim-spike
    provides: "spike-locked tier RULE (DomainPack.calibration→Validated else Directional) + source=user custom_context carry-forward"
  - phase: 01-engine-pack-seam
    provides: "DomainPack contract + SOCIALS_PACK.calibration.baselineRef (the Validated anchor)"
provides:
  - "Audience.mode ('socials' | 'general') first-class domain axis"
  - "Audience.success_criterion? (editable free-text 'what good means')"
  - "Audience.custom_context? (top-level CustomContext[] — user-added grounding)"
  - "CustomContext interface (source/note/persona_evidence_link?)"
  - "resolveTier + tierFromCalibration + TrustTier (production trust-tier resolver)"
affects: [03-03, 03-repo, 03-ui, 03-run-badge, 05-simulate, 07-audience-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tier keys off DomainPack.calibration (the pack), NEVER Audience.calibration (scrape provenance)"
    - "Additive-optional field idiom (mirrors creator_persona?/signature? guardrail) so existing literals stay valid"
    - "custom_context stored TOP-LEVEL (not in SignatureProvenance) so it survives signature:null"

key-files:
  created:
    - src/lib/audience/resolve-tier.ts
    - src/lib/audience/__tests__/resolve-tier.test.ts
  modified:
    - src/lib/audience/audience-types.ts

key-decisions:
  - "mode is REQUIRED + first-class (D-04) — NOT derived from is_general"
  - "custom_context top-level on Audience (Pitfall 2) — conceptually provenance-level, physically top-level"
  - "resolveTier returns Directional for non-socials directly — no General pack in P3 (D-02), never widen DomainPack"

patterns-established:
  - "Pack-not-audience tiering: resolveTier reads SOCIALS_PACK.calibration, asserted by grep (zero audience.calibration refs)"
  - "Split resolver: tierFromCalibration (verbatim spike predicate) + resolveTier (mode→tier) for reuse on run-badge mounts"

requirements-completed: [POP-01, POP-02, TRUST-01]

# Metrics
duration: 8min
completed: 2026-06-27
---

# Phase 3 Plan 02: General Population Domain Foundation Summary

**Extended the Audience contract with a first-class `mode` axis + editable `success_criterion` + top-level `custom_context[]`, and productionized the spike-locked tier rule into a `resolveTier` resolver with a green truth-table gate.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-27T15:50:00Z
- **Completed:** 2026-06-27T15:56:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- `Audience` now carries a first-class `mode: "socials" | "general"` axis (D-04), explicitly NOT derived from `is_general`
- `Audience.success_criterion?` (D-03) and `Audience.custom_context?` (D-07) added as additive-optional fields — every existing Audience literal stays valid
- `CustomContext` interface exported (`source: "user"`, `note`, optional `persona_evidence_link`), stored TOP-LEVEL so it survives `signature: null`
- `resolveTier` / `tierFromCalibration` / `TrustTier` shipped as production exports; the never-Validated-for-general rule is locked by a green 4-assertion truth table

## Task Commits

1. **Task 1: Add mode + success_criterion + custom_context + CustomContext to Audience** - `40148540` (feat)
2. **Task 2 (RED): failing resolveTier truth-table gate** - `17ffdb87` (test)
3. **Task 2 (GREEN): productionize resolveTier + tierFromCalibration** - `d16046f2` (feat)

_TDD task 2 = test (RED) → feat (GREEN); no refactor needed._

## Files Created/Modified
- `src/lib/audience/audience-types.ts` - Added `CustomContext` interface + 3 fields on `Audience` (`mode` required; `success_criterion?`, `custom_context?` optional)
- `src/lib/audience/resolve-tier.ts` - NEW: `resolveTier(Pick<Audience,"mode">)`, `tierFromCalibration({baselineRef?})`, `type TrustTier`
- `src/lib/audience/__tests__/resolve-tier.test.ts` - NEW: truth table (socials→Validated; general/undefined/{}/{baselineRef:''}→Directional, never Validated)

## Decisions Made
- None beyond the plan. Followed D-04/D-03/D-07/D-06 as specified: `mode` first-class (not derived from `is_general`), `custom_context` top-level (Pitfall 2), resolver keys off `SOCIALS_PACK.calibration` and returns Directional for non-socials directly (no General pack widening, D-02).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED failed as expected (missing module), GREEN passed 4/4, full audience suite green.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/resolve-tier.test.ts` → 4 passed
- `node ./node_modules/vitest/vitest.mjs run src/lib/audience` → 11 files / **139 passed** (was 135 pre-plan; +4 new, determinism gate kept green)
- `! npx tsc --noEmit | grep -E 'src/lib/audience/(audience-types|resolve-tier)\.ts'` → no new errors on touched files (repo tsc baseline is non-zero by design)
- grep gates: `mode: "socials" | "general"` present; exactly 1 `interface CustomContext`; `custom_context` top-level only (absent from `SignatureProvenance`); `resolve-tier.ts` references `SOCIALS_PACK.calibration` (1) and `audience.calibration` (0)
- ENGINE_VERSION untouched (no bump — not called for)

## Threat Model
- **T-03-03** (mis-tiering general as Validated) — MITIGATED: `resolveTier` has no Validated path for non-socials; truth table asserts `resolveTier({mode:"general"}) !== "Validated"`.
- **T-03-SC** (package installs) — N/A: zero package installs this plan.
- No new trust boundaries (pure type + pure-predicate module, no I/O).

## Next Phase Readiness
- Domain contracts are interface-first ready: 03-03 (repo), the UI plans, and the run-badge can import `Audience.mode` / `CustomContext` / `resolveTier` without a scavenger hunt.
- The run-badge mount (TRUST-01 "each run") and repo round-trip of `mode`/`success_criterion`/`custom_context` are downstream — this plan ships only the contract + resolver.

## Self-Check: PASSED

- All 3 source files + SUMMARY.md exist on disk.
- All 3 task commits (40148540, 17ffdb87, d16046f2) present in git history.

---
*Phase: 03-general-population-honesty-layer*
*Completed: 2026-06-27*
