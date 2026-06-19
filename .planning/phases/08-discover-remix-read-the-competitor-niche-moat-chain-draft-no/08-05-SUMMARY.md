---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
plan: 05
subsystem: ui
tags: [zod, react, typed-blocks, audience, flash, honesty-spine]

# Dependency graph
requires:
  - phase: 08-01
    provides: BlockUnionSchema + block-registry typed-block system, BandBlockSchema honesty template
  - phase: 08-03
    provides: aggregateFlash band math (Strong/Mixed/Weak + fraction), FlashPersona shape
  - phase: 08-04
    provides: active-audience wiring + CalibratedPersona steer context
provides:
  - deriveWhoNotFor(personas) — pure low-disposition "Scrolls past" segment (D-10, no model call)
  - multi-audience-read Zod block schema (bands only, .strict() rejects numeric score, array W4-ready)
  - MultiAudienceReadBlockRenderer — single-audience static Read card (sketch 005 .read spine)
affects: [08-06, phase-09-living-audience]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read card = grade glyph + interpretation + Lever (sketch 005 .read interpret+lever spine)"
    - ".strict() Zod object as the bands-only honesty gate (rejects smuggled numeric score)"
    - "block carries an audiences array; renderer maps over it → multi-audience compare is additive (D-09)"

key-files:
  created:
    - src/lib/engine/flash/who-not-for.ts
    - src/lib/engine/flash/__tests__/who-not-for.test.ts
    - src/lib/tools/__tests__/blocks.test.ts
    - src/components/thread/multi-audience-read-block.tsx
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/components/thread/message-blocks.tsx
    - src/components/thread/band-block.tsx

key-decisions:
  - "who-not-for derived from cold scroll-prone dispositions (skeptic/lurker/scanner); all-hot panel → '' (no fabricated segment)"
  - "exported band-block BAND_COLOR for reuse instead of re-rolling a coral verdict map"
  - "interpretation coral highlight uses canonical --color-accent (text-accent) token; .read panel border/bg = exact sketch rgba inline"
  - "bands-only enforced structurally via .strict() on each audience entry — not just by omitting a score field"

patterns-established:
  - "Pattern: Read block schema is array-shaped (audiences[]) so the W4 2-audience compare needs no schema change"
  - "Pattern: static-card-only renderers explicitly document the P9 boundary (no live cloud / scale toggle / chat)"

requirements-completed: [READ-01, READ-03]

# Metrics
duration: 5min
completed: 2026-06-19
---

# Phase 08 Plan 05: Single-Audience Read (multi-audience-read block) Summary

**The Read lands as a real typed card — coral interpret+lever panel with a grade glyph, a low-disposition "Scrolls past" who-not-for line (no model call), and a per-persona drill — bands only, SIM-1 Flash provenance, array-shaped W4-ready.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-19T08:50:56Z
- **Completed:** 2026-06-19T08:55:27Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- `deriveWhoNotFor(personas)` — pure derivation of the "Scrolls past: {segment}" line from cold scroll-prone dispositions (skeptic/lurker/scanner); all-hot panel returns `""` (D-10, no model call, no fabrication)
- `multi-audience-read` Zod block schema added to `BlockUnionSchema` + registered in `BLOCK_REGISTRY` — per-audience band + fraction + interpretation + Lever + whoNotFor + persona drill; `.strict()` rejects any smuggled numeric 0-100 score (Pitfall 5); `model: z.literal("sim1-flash")` provenance; `audiences` array shape W4-ready
- `MultiAudienceReadBlockRenderer` — single-audience static Read card per UI-SPEC B1 + sketch 005 `.read`: verdict row (band colored via the reused band-block `BAND_COLOR`, never coral), coral-bordered Read panel (grade glyph + interpretation + `Lever →`), `Scrolls past` line, collapsible per-audience persona drill; registered in `BLOCK_COMPONENTS`
- Honesty spine intact: no `z.number` score field anywhere in the read schema; no 0–100 number in the renderer

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests for who-not-for + multi-audience-read schema** - `7335910` (test)
2. **Task 1 (GREEN): deriveWhoNotFor + multi-audience-read schema** - `e753852` (feat)
3. **Task 2: multi-audience-read renderer + dispatcher registration** - `9d977b1` (feat)

_Task 1 was TDD (test → feat). No refactor commit needed._

## Files Created/Modified
- `src/lib/engine/flash/who-not-for.ts` - `deriveWhoNotFor(personas)`: cold scroll-prone disposition → segment label, pure, no model call (created)
- `src/lib/engine/flash/__tests__/who-not-for.test.ts` - low-disposition → segment, all-hot → '', purity, empty input (created)
- `src/lib/tools/__tests__/blocks.test.ts` - validates single-audience payload, rejects numeric score / bad band / non-flash model, validates 2-audience (created)
- `src/components/thread/multi-audience-read-block.tsx` - single-audience static Read renderer, maps audiences array (created)
- `src/lib/tools/blocks.ts` - `MultiAudienceReadBlockSchema` + union member (modified)
- `src/lib/tools/block-registry.ts` - registry entry (modified)
- `src/components/thread/message-blocks.tsx` - `BLOCK_COMPONENTS` registration (modified)
- `src/components/thread/band-block.tsx` - exported `BAND_COLOR` for reuse (modified)

## Decisions Made
- **who-not-for source:** the cold scroll-prone dispositions (skeptic/lurker/scanner) name the scrolls-past segment; an all-hot/warm panel yields `""` so the renderer shows no fabricated who-not-for line. Output order is canonical (iterates the fixed disposition set), making the function deterministic regardless of persona array order.
- **Reused, not re-rolled:** exported the existing `BAND_COLOR` map from `band-block.tsx` rather than duplicating a coral verdict map — verdict bands stay semantic (success/warning/error), coral reserved for the interpretation highlight + Lever.
- **Structural honesty gate:** used `.strict()` on each audience entry so a payload smuggling a `score` field is rejected at validation, not merely absent from the schema.
- **Array shape:** the block emits a single audience here but the schema + renderer both operate over an `audiences` array, so Plan 08-06's 2-audience compare is additive.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED failed as expected (missing module + missing schema member); GREEN passed; full suite 2704 passed / 27 skipped, no regressions. tsc + eslint clean on touched files.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. The block is array-ready for the W4 2-audience compare (Plan 08-06) and the verbatim quote wall; this is a planned forward extension, not a stub — the single-audience form is fully wired (schema → registry → renderer → dispatcher).

## Next Phase Readiness
- Plan 08-06 (W4) extends this SAME block to the 2-audience compare (active calibrated audience vs General) + verbatim wall — no schema change needed, the `audiences` array and the renderer's `.map` already support it.
- The live cloud / scale toggle (Panel·10 ⇄ Population·1,000) / audience chat are deliberately NOT built (P9 boundary respected).
- The Read block is registered in both the schema registry and the renderer dispatcher; an invalid payload falls back to `UnsupportedBlock`.

## Self-Check: PASSED

All 4 created files exist on disk; all 3 task commits found in git history.

---
*Phase: 08-discover-remix-read-the-competitor-niche-moat-chain-draft-no*
*Completed: 2026-06-19*
