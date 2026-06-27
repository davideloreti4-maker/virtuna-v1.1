---
phase: 03-general-population-honesty-layer
plan: 07
subsystem: thread
tags: [react, ui, thread, honesty-layer, trust-badge, flat-warm, blocks]

# Dependency graph
requires:
  - phase: 03-general-population-honesty-layer
    plan: 02
    provides: "resolveTier/TrustTier (the run-level tier the badge renders) + Audience.mode"
  - phase: 03-general-population-honesty-layer
    plan: 05
    provides: "TrustBadge (Validated/Directional) presentation-only component — reused, not rebuilt"
provides:
  - "Additive presentation-only props.tier enum on MultiAudienceReadBlockSchema (run-level honesty badge)"
  - "TrustBadge mounted on the Read result card (multi-audience-read-block.tsx) beside SIM-1 Flash provenance"
  - "two-audience-read emitter sets tier from resolveTier(active/lead audience) so calibrated socials runs read Validated"
affects: [05-simulate, 07-audience-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run-level honesty tier rides ON the result block (mirrors the BandBlock model-tag provenance idiom) so it survives scroll-away — not recomputed in the renderer"
    - "tier is TOP-LEVEL on props, NOT inside the per-audience .strict() entry (run-level not per-audience; .strict() would reject the extra key)"
    - "Renderer falls back to 'Directional' when tier is absent — the honest default, never silently 'Validated' (T-03-15)"

key-files:
  created: []
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/engine/flash/two-audience-read.ts
    - src/components/thread/multi-audience-read-block.tsx
    - src/lib/engine/flash/__tests__/two-audience-read.test.ts

key-decisions:
  - "Wired tier in the emitter (two-audience-read.ts) — NOT in plan files_modified, but Task 1 action explicitly authorizes it when the active audience is in scope; without it every run reads constant 'Directional', a stub that defeats the Validated-vs-Directional deliverable"
  - "tier derives from the LEAD audience (pair[0]) = the active calibrated audience; both the self-pair (single-audience) and the 2-audience compare return paths set it"
  - "resolveTier import pulls SOCIALS_PACK -> scoring pipeline -> deepseek transitively, breaking the emitter test's incomplete qwen mock — added QWEN_APOLLO_MODEL to the mock (no scorer is invoked, only the pack's static calibration field is read; D-02 run-path untouched)"

requirements-completed: [TRUST-01]

# Metrics
duration: ~6min
completed: 2026-06-27
---

# Phase 3 Plan 07: Run/Result Read Card Trust Badge Summary

**Closed the "each run" half of TRUST-01 — the run/result Read card now wears a Validated vs Directional `TrustBadge` derived from the active audience's `resolveTier`, carried as an additive presentation-only `props.tier` enum that rides ON the result block (surviving scroll-away) and falls back to the honest "Directional" default when absent — no new run path, no scoring change, the bands-only honesty spine and `.strict()` per-audience entries intact.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2 (both `auto`)
- **Files modified:** 4 (3 source + 1 test mock)

## Accomplishments

- `MultiAudienceReadBlockSchema.props` gains `tier: z.enum(["Validated","Directional"]).optional()` at the TOP level — alongside `model`, NOT inside the per-audience `.strict()` entry (that entry forbids unknown keys and would reject it; tier is run-level, not per-audience). No score/band field added; `model: z.literal("sim1-flash")` and the bands-only spine untouched. Older persisted payloads omit `tier` → still valid (additive, no migration).
- `two-audience-read.ts` emitter imports `resolveTier` and sets `props.tier = resolveTier(pair[0]!)` on BOTH return paths (the self-pair single-audience Read and the 2-audience compare). The lead/active audience drives the run tier, so a calibrated socials Read reads **Validated** while a general-mode audience reads **Directional** by rule — `resolveTier` stays the single source of truth (T-03-15).
- `multi-audience-read-block.tsx` imports `TrustBadge` (reused from 03-05, no second badge) and renders `<TrustBadge tier={block.props.tier ?? 'Directional'} />` beside the `SIM-1 Flash` provenance line. The fallback to `"Directional"` is the honest default — never silently "Validated". Presentation-only: no fetch/run/scorer call added; the band/glyph/Lever layout and color discipline (no coral beyond reserved usage) are intact.

## Task Commits

1. **Task 1: additive presentation-only tier field on the run-result block + emitter wiring** — `5bdc34c0` (feat)
2. **Task 2: mount TrustBadge on the Read result card** — `a9731b44` (feat)
3. **Deviation fix: add QWEN_APOLLO_MODEL to the emitter qwen mock** — `7d730ae9` (test)

## Files Created/Modified

- `src/lib/tools/blocks.ts` — `props.tier` optional enum on `MultiAudienceReadBlockSchema` (run-level honesty badge, additive).
- `src/lib/engine/flash/two-audience-read.ts` — import `resolveTier`; set `tier` from the lead/active audience on both return paths.
- `src/components/thread/multi-audience-read-block.tsx` — import + mount `TrustBadge` beside the SIM-1 Flash provenance, reading `block.props.tier` with a `"Directional"` fallback.
- `src/lib/engine/flash/__tests__/two-audience-read.test.ts` — added `QWEN_APOLLO_MODEL` to the qwen/client mock (deviation, see below).

## Decisions Made

- **Emitter wiring kept despite being outside `files_modified`.** Task 1's action explicitly authorizes setting `tier` from `resolveTier(activeAudience)` "if the upstream emitter has the active audience in scope" — it does (`pair[0]` is the active/lead audience). Without this wiring `tier` is always `undefined` → the renderer always shows "Directional", a stub that under-claims for calibrated socials Reads and fails the "Validated vs Directional" deliverable. Wiring is the safe-honest direction in production (it can only RAISE a socials run to Validated; general stays Directional by rule).
- **tier rides the result block, not the renderer.** Mirrors the `BandBlock` model-tag provenance idiom so the honesty verdict survives scroll-away and is persisted with the block, rather than being recomputed at render time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added QWEN_APOLLO_MODEL to the emitter's qwen/client mock**
- **Found during:** Task 1 (running the emitter unit test after wiring `resolveTier`)
- **Issue:** `resolveTier` imports `SOCIALS_PACK`, whose module graph (`packs/socials → pipeline → deepseek`) references `QWEN_APOLLO_MODEL` at load time. `two-audience-read.test.ts` already mocks `@/lib/engine/qwen/client` but the mock omitted that export, so the new transitive import failed test collection (`No "QWEN_APOLLO_MODEL" export is defined on the mock`).
- **Fix:** Added `QWEN_APOLLO_MODEL: "qwen3.7-plus"` to the existing mock object. No scorer is invoked at runtime — only the pack's static `calibration` field is read — so the D-02 run-path remains scorer-free.
- **Files modified:** `src/lib/engine/flash/__tests__/two-audience-read.test.ts`
- **Commit:** `7d730ae9`

## Issues Encountered

None blocking beyond the mock-graph fix above. The schema change is additive-optional, so all 206 thread+tools tests and the route suite revalidated the block without change.

## Threat Model

- **T-03-15** (a run mis-badged Validated when its audience is Directional) — MITIGATED: `tier` is a constrained 2-value enum; the emitter sets it via `resolveTier` (the locked never-Validated-for-general rule); the renderer falls back to "Directional" (never "Validated") when absent.
- **T-03-16** (smuggling a score into the bands-only block via the new field) — MITIGATED: `tier` is a 2-value enum (no numeric); the per-audience entries keep `.strict()`; the honesty spine is unchanged.
- **T-03-SC** (package installs) — N/A: zero package installs this plan.
- No new trust boundaries (renders an additive enum on the existing validated result block).

## Known Stubs

None. `tier` is wired end-to-end (emitter `resolveTier` → block → badge); the `"Directional"` renderer fallback is the honest default for pre-07 persisted blocks, not a stub.

## Verification

- `node ./node_modules/vitest/vitest.mjs run src/app/api/tools/read/__tests__/route.test.ts` → **5 passed** (block schema still validates the additive field — the primary behavioral gate).
- `node ./node_modules/vitest/vitest.mjs run src/lib/engine/flash` → **9 files / 116 passed** (emitter green after the mock fix; `runTwoAudienceRead` returns the tier-bearing block).
- `node ./node_modules/vitest/vitest.mjs run src/components/thread src/lib/tools` → **20 files / 206 passed** (no regression on the typed-block renderers/registry).
- `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` → **6 passed** (no coral/glass regression — TrustBadge reuses the flat-warm Badge).
- `! npx tsc --noEmit | grep -E 'src/lib/tools/blocks\.ts|src/components/thread/multi-audience-read-block\.tsx|src/lib/engine/flash/two-audience-read\.ts'` → exits 1 (no new errors on touched paths; repo baseline is non-zero).
- grep gates: `TrustBadge` import + `<TrustBadge tier={block.props.tier ?? 'Directional'}` mount present; no `fetch(`/`resolvePack`/`aggregateScores`/`/api/` added to the renderer; `.strict()` retained on the per-audience entry; `model: z.literal("sim1-flash")` unchanged.

## Next Phase Readiness

- TRUST-01 is now satisfied on BOTH halves: the audience surface (03-05) and the run/result card (this plan). Phase 03 (general-population-honesty-layer) is COMPLETE (7/7 plans). P5 (Simulate) and P7 (audience picker) can surface the same run-level tier over the existing `props.tier` field + `TrustBadge`.

## Self-Check: PASSED

- `src/lib/tools/blocks.ts`, `src/lib/engine/flash/two-audience-read.ts`, `src/components/thread/multi-audience-read-block.tsx`, and `src/lib/engine/flash/__tests__/two-audience-read.test.ts` all exist on disk with the described changes.
- All 3 task commits (5bdc34c0, a9731b44, 7d730ae9) present in git history.

---
*Phase: 03-general-population-honesty-layer*
*Completed: 2026-06-27*
