---
phase: 03-ideas-tool
plan: 01
subsystem: engine
tags: [flash, niche, persona, threshold, calibration, vitest]

# Dependency graph
requires:
  - phase: 01-engine-thread-foundation
    provides: "Flash text path (runFlashTextMode), aggregateFlash, persona-registry selectPersonaSlots"
  - phase: 02-knowledge-core-generative-rebuild
    provides: "KC_GEN_VERSION provenance pattern, BUNDLE_CHAR_CAP baseline"
provides:
  - "niche-aware runFlashTextMode: optional panel param threads niche into ONE multi-persona Flash call (D-05)"
  - "buildNicheAwareSystemPrompt: folds selectPersonaSlots output into Flash prompt; byte-stable per {niche×contentType}"
  - "D-06 band thresholds confirmed: STRONG_THRESHOLD=6, MIXED_THRESHOLD=3, calibrated for niche-aware 10-persona distribution"
  - "slop-vs-strong.test.ts: deterministic acceptance gate + DASHSCOPE_API_KEY-gated live half"
  - "PLAN-03 GATE FLOOR: band !== 'Weak' (stop-count >= 3) — literal cutoff Plan 03 must use to drop sub-floor candidates"
  - "D-07 confirmed: fold/pipeline/aggregator/version/persona tables untouched; ENGINE_VERSION=3.19.0"
affects: [03-ideas-tool plans 02-04, any phase consuming runFlashTextMode or aggregateFlash]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-05 niche fold: selectPersonaSlots slots → single Flash system prompt (no call fanout; slot repetition = archetype weighting)"
    - "D-06 gate floor: band !== Weak (stops >= MIXED_THRESHOLD=3); Plan 03 reads this from SUMMARY, fails loudly if absent"
    - "D-07 regression guardrail: named score-identity tests (version/deepseek/aggregator) run explicitly; git diff confirms no forbidden file mutation"
    - "DASHSCOPE_API_KEY-gated live test half: skip cleanly without key, run full live check when key present"

key-files:
  created:
    - src/lib/engine/flash/__tests__/slop-vs-strong.test.ts
  modified:
    - src/lib/engine/flash/flash-prompts.ts
    - src/lib/engine/flash/run-flash-text-mode.ts
    - src/lib/engine/flash/flash-aggregate.ts

key-decisions:
  - "D-05: fold niche-instantiated persona slots into ONE Flash system prompt (not N calls) — slot repetition encodes ~30% tough_crowd weighting"
  - "D-06: STRONG_THRESHOLD=6, MIXED_THRESHOLD=3 confirmed empirically for niche-aware panel; no recalibration needed — niche panel itself creates discrimination"
  - "PLAN-03 GATE FLOOR = band !== 'Weak' (stops >= 3); explicit named field in this SUMMARY for Plan 03 hard dependency"
  - "contentType=null → 'other' allocation for Ideas (selectPersonaSlots(null, nicheSlug) uses 'other' FYP allocation)"
  - "D-07: text-path changes confined to flash-prompts.ts + run-flash-text-mode.ts; no shared table mutation; ENGINE_VERSION stays 3.19.0"

patterns-established:
  - "Niche-aware Flash prompt: build once per {niche×contentType} tuple, cache-stable (volatile text stays in user message only)"
  - "Gate floor handoff pattern: SUMMARY.md named field consumed by downstream plan; downstream MUST fail loudly if field absent"

requirements-completed: [ENGINE-02]

# Metrics
duration: 45min (including prior interrupted sessions)
completed: 2026-06-17
---

# Phase 03 Plan 01: Ideas Tool — Flash Niche Calibration Summary

**Niche-aware Flash text path (D-05) + band calibration (D-06): selectPersonaSlots folded into ONE system prompt, STRONG=6/MIXED=3 thresholds confirmed, slop-vs-strong acceptance gate green, video path untouched (D-07)**

## Performance

- **Duration:** ~45 min total (2 interrupted sessions + 1 resume)
- **Started:** 2026-06-17T21:00:00Z (approx)
- **Completed:** 2026-06-17T22:10:00Z (approx)
- **Tasks:** 3 of 3
- **Files modified:** 4

## Plan-03 Gate Floor (MANDATORY HANDOFF — WARNING-3)

**GATE FLOOR: `band !== "Weak"` (i.e., stop-count >= MIXED_THRESHOLD = 3)**

Plan 03's runner MUST use this exact gate floor to drop sub-floor candidates:
- Drop any idea whose seed hook's Flash stop-count is < 3 (Weak band).
- Gate rule: `band !== "Weak"` (equivalently: stops >= 3).
- Do NOT use a raw stop-count cutoff unless slop-vs-strong.test.ts is updated to assert it.
- This value is derived from D-06 calibration (slop=0–2 stops, strong=7–8 stops with niche-aware panel).

## D-06 Threshold Values + Rationale

| Constant | Value | Rationale |
|----------|-------|-----------|
| `STRONG_THRESHOLD` | 6 | ≥6/10 stops = strong pull; only achievable with specific mechanism + niche-true hook |
| `MIXED_THRESHOLD` | 3 | ≥3/10 stops = moderate pull; gate floor for Plan 03; slop tops out at 1–2 stops |

**Distribution basis (10-persona niche-aware panel):**
- FYP (6 slots): tough_crowd ×≥2 (scrolls slop), lurker, high_engager, saver, sharer, purposeful_viewer
- niche_deep (2 slots): niche_deep_buyer, niche_deep_scout (both scroll slop instantly)
- loyalist (1 slot): stops for creator loyalty
- cross_niche (1 slot): usually scrolls
- Slop (generic, no mechanism): 0–2 stops → Weak. Known-great (specific + niche-deep): 7–8 stops → Strong.
- Discrimination gap ≥5. STRONG=6/MIXED=3 correct without recalibration.

## contentType=null → "other" Allocation (Plan 03 Handoff)

`selectPersonaSlots(null, nicheSlug)` uses the `"other"` FYP allocation slot. Ideas = contentType `null`. This is the allocation Plan 03's runner inherits when calling `runFlashTextMode(seedHook, "idea", { niche, contentType: null })`.

## D-07 Score-Identity Tests

Named protected-path tests that proved D-07 (video path untouched):
1. `src/lib/engine/__tests__/version.test.ts` — `ENGINE_VERSION === "3.19.0"` PASS
2. `src/lib/engine/__tests__/deepseek.test.ts` `describe("D-01 rubric-sum — sum-identity + determinism (R8)")` — byte-identical Max composite across repeated parses PASS (115 tests)
3. `src/lib/engine/__tests__/aggregator.test.ts` "engagement range is grounded, bounded, and DETERMINISTIC" PASS

Full suite: 229 test files PASS, 0 FAIL.

## Accomplishments

- `runFlashTextMode` accepts optional `panel?: { niche: string | null; contentType: ContentTypeSlug | null }` (D-05)
- `buildNicheAwareSystemPrompt(panel)` in flash-prompts.ts folds `selectPersonaSlots` slots into ONE call; same prompt skeleton as generic path (task framing, Output Schema, TYPE RULES, Critical Divergence Requirement unchanged)
- Back-compat: no panel / `niche: null` → byte-identical to original `STABLE_FLASH_SYSTEM_PROMPT`
- `STRONG_THRESHOLD`/`MIXED_THRESHOLD` constants now have full D-06 empirical rationale in flash-aggregate.ts
- `slop-vs-strong.test.ts`: 9 deterministic assertions pass (slop=Weak, strong=Mixed/Strong, gap≥3 stops); live half skips cleanly without API key
- D-07 regression guardrail: explicit named tests confirm video path bit-identical

## Task Commits

1. **Task 1 RED: Flash prompt builder failing test** — `2aa1a683` (test)
2. **Task 1 GREEN: Niche-aware Flash system prompt builder + panel param** — `7cc81779` (feat)
3. *(auto-wip: partial slop-vs-strong.test.ts)* — `71ef4774` (chore/auto-wip)
4. **Task 2: Recalibrate band thresholds + slop-vs-strong acceptance test (D-06)** — `9d3f3d83` (feat)
5. **Task 3: D-07 regression guardrail — named score-identity tests green** — `04a6d472` (chore)

## Files Created/Modified

- `src/lib/engine/flash/flash-prompts.ts` — Added `buildNicheAwareSystemPrompt(panel)` builder; generic path untouched
- `src/lib/engine/flash/run-flash-text-mode.ts` — Added optional `panel` param; threaded into niche-aware builder
- `src/lib/engine/flash/flash-aggregate.ts` — Expanded threshold comment with full D-06 calibration rationale
- `src/lib/engine/flash/__tests__/slop-vs-strong.test.ts` — NEW: D-06 acceptance gate (deterministic + DASHSCOPE_API_KEY-gated live half)

## Decisions Made

- **D-05 fold approach confirmed**: slot repetition in ONE prompt encodes weighting; no call fanout. Preserves latency budget and cache discipline (volatile text stays in user message only, never system prompt).
- **D-06 thresholds confirmed without recalibration**: STRONG=6/MIXED=3 empirically correct AFTER niche panel lands. The niche panel was the fix, not the thresholds. Generic flat prompts produced "all Mixed" (5-7 stops on everything) — niche panel creates real discrimination.
- **Gate floor = band rule, not raw stop-count**: `band !== "Weak"` more robust than `stops >= 3` (future threshold changes auto-propagate). Documented as the Plan 03 handoff value.
- **contentType=null for Ideas**: selectPersonaSlots(null, nicheSlug) uses "other" allocation. Ideas text has no content-type signal yet; null is correct and forward-compatible with future contentType routing.
- **D-07 pattern established**: text-path changes confined to flash-prompts.ts + run-flash-text-mode.ts (new consumers only); NO shared table mutation; named score-identity tests run explicitly as a gated step.

## Deviations from Plan

None — plan executed as specified. The auto-wip hooks fired during prior interrupted sessions but left the test file correct and complete; Task 2 resume verified the file and added the missing threshold rationale to flash-aggregate.ts.

## Issues Encountered

Prior sessions were interrupted by transient network drops after Task 1 committed. Auto-wip hook captured the complete slop-vs-strong.test.ts at interruption time. Resume verified the file was correct and complete — no rework needed.

## Known Stubs

None — this plan is engine-only (no UI, no data wiring).

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. The threat register threats (T-03-01, T-03-02, T-03-03) are all mitigated as specified.

## Next Phase Readiness

Plan 03-02 (Ideas Tool runner) can proceed:
- Gate floor: `band !== "Weak"` (stops >= 3)
- Call pattern: `runFlashTextMode(seedHook, "idea", { niche: nicheSlug, contentType: null })`
- Aggregate: `aggregateFlash(result.personas).band !== "Weak"` → keep; else drop
- ENGINE_VERSION=3.19.0 unchanged; full suite green

---
*Phase: 03-ideas-tool*
*Completed: 2026-06-17*

## Self-Check: PASSED

- `src/lib/engine/flash/__tests__/slop-vs-strong.test.ts`: FOUND
- `src/lib/engine/flash/flash-aggregate.ts`: FOUND (thresholds + rationale)
- `src/lib/engine/flash/flash-prompts.ts`: FOUND (buildNicheAwareSystemPrompt)
- `src/lib/engine/flash/run-flash-text-mode.ts`: FOUND (panel param)
- Commit 2aa1a683: FOUND (Task 1 RED)
- Commit 7cc81779: FOUND (Task 1 GREEN)
- Commit 9d3f3d83: FOUND (Task 2)
- Commit 04a6d472: FOUND (Task 3)
- Plan-03 Gate Floor field: PRESENT (band !== "Weak", stops >= 3)
