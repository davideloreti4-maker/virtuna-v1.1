---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
plan: 06
subsystem: engine+ui
tags: [flash, audience, two-audience-read, honesty-spine, verbatim-wall, react, zod]

# Dependency graph
requires:
  - phase: 08-01
    provides: BlockUnionSchema + multi-audience-read registration path
  - phase: 08-04
    provides: active-audience wiring (thread active_audience_id), CalibratedPersona repaint
  - phase: 08-05
    provides: multi-audience-read schema (audiences array, W4-ready) + single-audience renderer + deriveWhoNotFor
provides:
  - runTwoAudienceRead(concept, [audA, audB]) — per-audience aggregate + DELTA interpretation + Lever (READ-02)
  - POST /api/tools/read — pick-2 audiences (default active-vs-General), two resolves, emits multi-audience-read block
  - 2-audience compare render (side-by-side verdict header + per-audience Read panels)
  - VerbatimWall — focus-group quote wall over already-emitted persona quotes (D-11)
affects: [phase-09-living-audience]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-audience separate resolve: resolveAudienceWeights([aud]) once PER audience (the real second resolve, D-08)"
    - "DELTA interpretation + Lever derived PURELY from two band ranks — no extra model call (honesty-clean)"
    - "Verbatim wall = presentation over already-emitted FlashPersona quotes; sharpest = longest quote leads"
    - "Compare render is additive: side-by-side verdict header + reused single-audience AudienceRead block"

key-files:
  created:
    - src/lib/engine/flash/two-audience-read.ts
    - src/lib/engine/flash/__tests__/two-audience-read.test.ts
    - src/app/api/tools/read/route.ts
    - src/components/thread/verbatim-wall.tsx
  modified:
    - src/components/thread/multi-audience-read-block.tsx

key-decisions:
  - "DELTA interpretation + Lever are pure derivation from the two band ranks (Weak<Mixed<Strong) — no fabricated model call, honesty-spine clean"
  - "Default pair handled in runTwoAudienceRead: 1 audience → [active, General]; explicit General-only deduped to avoid General-vs-General; >2 capped to first 2 (D-09)"
  - "Read route reads the PRIMARY audience id from the thread (active_audience_id), never the body; an optional secondAudienceId is still resolved via getAudience under the session (RLS-scoped)"
  - "VerbatimWall sorts by quote length (sharpest=longest leads), stable so equal-length quotes keep audience order — deterministic, no model call"
  - "Coral reserved for Lever + interpretation only; verdict bands reuse BAND_COLOR (success/warning/error); verbatim wall labels semantic (success/muted), never coral"

patterns-established:
  - "Pattern: 2-audience compare = side-by-side verdict header + per-audience Read panels + verbatim wall, all static (P9 live-cloud boundary respected)"
  - "Pattern: the second audience resolve is a real separate resolveAudienceWeights call (asserted in test), not a shared run"

requirements-completed: [READ-02, READ-03]

# Metrics
duration: 6min
completed: 2026-06-19
---

# Phase 08 Plan 06: Multi-Audience Read (2-audience compare + verbatim wall) Summary

**The killer feature lands: score one concept against TWO audiences side by side (default active calibrated audience vs General) with the DELTA as a one-line Read + Lever (wins for growth, bombs for buyers), plus a static focus-group verbatim quote wall — bands only, no extra model call, the live cloud explicitly deferred to P9.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-19T08:58:06Z
- **Completed:** 2026-06-19T09:04:21Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `runTwoAudienceRead(concept, audiences)` — resolves EACH audience separately (`resolveAudienceWeights([aud])` once per audience, the real second resolve), runs Flash per audience steered by that audience's repaint, aggregates each to `{band, fraction}` (reusing `aggregateFlash`, no re-roll), derives per-audience who-not-for (`deriveWhoNotFor`), and computes the DELTA interpretation + Lever from the two band ranks. Default pair = active calibrated audience vs General (D-09); cap at 2 (object stays array-ready for N). Bands only — no numeric score anywhere.
- `POST /api/tools/read` — mirrors the ideas route security spine: auth BEFORE any Flash run, the primary audience id from the thread (`active_audience_id`) never the body (CR-01), optional `secondAudienceId` resolved under the session via `getAudience` (RLS-scoped), `insertMessage` re-validates the block + KC_GEN_VERSION stamp, concept length cap (WARNING-5).
- 2-audience compare render — `multi-audience-read-block.tsx` extended with a side-by-side verdict header (`CompareVerdictRow`, wins-for-X/bombs-for-Y, band-colored via reused `BAND_COLOR`) above the per-audience Read panels (each with its own DELTA interpretation + Lever coral panel + collapsible persona drill). The 1-entry single-audience path (Plan 05) is preserved unchanged — the 2-entry path is additive.
- `VerbatimWall` — focus-group quote wall over the block's already-emitted persona quotes, grouped into "Stopped the scroll" / "Scrolled past", each quote audience-tagged, the sharpest pulled as a lead, reusing the remix-card italic blockquote styling (2px left border) verbatim. NO new model call (D-11).
- Honesty spine intact: bands only, no `z.number` score, the DELTA framing is pure derivation from band ranks (no fabricated model call). Coral stays on the Lever/interpretation; verdict bands semantic. Static card only — no live cloud / scale toggle / chat (P9 boundary).

## Task Commits

Each task committed atomically:

1. **Task 1 (RED): failing tests for runTwoAudienceRead** - `3d2a8a5b` (test)
2. **Task 1 (GREEN): runTwoAudienceRead compute + POST /api/tools/read** - `46ecc5b4` (feat)
3. **Task 2: 2-audience compare render + verbatim quote wall** - `2628c28e` (feat)

_Task 1 was TDD (test → feat). No refactor commit needed._

## Files Created/Modified
- `src/lib/engine/flash/two-audience-read.ts` - `runTwoAudienceRead`: per-audience separate resolve + Flash + aggregate + who-not-for + pure DELTA interpretation/Lever; default pair + cap-2 logic (created)
- `src/lib/engine/flash/__tests__/two-audience-read.test.ts` - 7 tests: 2 entries, bands-only (no score), delta present, default active-vs-General, resolve-per-audience, per-audience who-not-for, cap-2 (created)
- `src/app/api/tools/read/route.ts` - POST: auth-first, audience id from thread not body, pick-2 default active-vs-General, emit + persist the block (created)
- `src/components/thread/verbatim-wall.tsx` - `VerbatimWall`: grouped+tagged focus-group quotes, sharpest leads, reused blockquote, no model call (created)
- `src/components/thread/multi-audience-read-block.tsx` - added `CompareVerdictRow` side-by-side header + mounted `VerbatimWall`; 1-entry path preserved (modified)

## Decisions Made
- **DELTA is pure derivation:** the interpretation line + Lever are computed from the two band ranks (`Weak<Mixed<Strong`), framed "{Self} {wins/splits/bombs} ({band}) — {Other} {verb} ({band})." with a Lever that names the gap to close. No extra model call — honesty-spine clean, deterministic.
- **Default-pair + dedupe in the compute, not the route:** `runTwoAudienceRead` fills General as the pair for a single active audience and dedupes an explicit General-only call (so we never compare General to General); the route only resolves the candidates. Cap at 2 lives in the compute (`MAX_AUDIENCES`).
- **Security parity with the ideas route:** primary audience id from `thread.active_audience_id` (never body, CR-01); the optional `secondAudienceId` is still RLS-scoped via `getAudience` — an attacker cannot inject raw weights, only reference an audience they own.
- **Verbatim wall reuse, not re-roll:** the remix-card `border-l-2 border-white/[0.12]` italic blockquote is reused verbatim per UI-SPEC; quotes are sorted by length (sharpest leads) deterministically; no new generation (D-11).
- **Coral discipline preserved:** coral only on the Lever + interpretation highlight in the Read panel; the side-by-side verdict header and the verbatim section labels use semantic colors (success/warning/error/muted), never coral.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED failed as expected (missing module); GREEN passed all 7 new tests; full suite 2711 passed / 27 skipped, no regressions. `tsc --noEmit` and `eslint` clean on all touched files.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. The verbatim wall consumes already-emitted quotes (real data), the DELTA is derived from real aggregates, and the route persists a registry-validated block. The live interactive cloud / scale toggle (Panel·10 ⇄ Population·1,000) / audience chat are deliberately NOT built — that is the P9 boundary, documented in both the compute and the renderer, not a stub.

## Next Phase Readiness
- W4 complete: one concept reads against 2 audiences side by side (default active-vs-General) with a real delta verdict + Lever and a focus-group verbatim wall, all on the static `multi-audience-read` card, honesty-spine clean.
- Phase 09 (Living Audience) owns the live interactive cloud, the Panel·10 ⇄ Population·1,000 scale toggle, and audience-scoped chat — the static card here is the landing point those features mount onto.
- The `multi-audience-read` block is registered (schema + renderer dispatcher from Plan 05); the read route emits it; an invalid payload falls back to `UnsupportedBlock`.

## Self-Check: PASSED

All 5 files (4 created, 1 modified) exist on disk; all 3 task commits found in git history.

---
*Phase: 08-discover-remix-read-the-competitor-niche-moat-chain-draft-no*
*Completed: 2026-06-19*
