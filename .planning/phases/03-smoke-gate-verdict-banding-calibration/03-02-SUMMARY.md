---
phase: 03-smoke-gate-verdict-banding-calibration
plan: 02
subsystem: reading
tags: [verdict-bands, dead-band, mixed-signals, view-model, vitest, GATE-02]

# Dependency graph
requires:
  - phase: 03-smoke-gate-verdict-banding-calibration
    provides: "measured same-video variance half-width (03-01) — for the buffer>variance PROOF only; DEFERRED (smoke run not yet run)"
provides:
  - "DEAD_BAND_FLOOR (5) + inDeadBand(score, buffer?) in verdict-bands.ts — symmetric dead-band around non-terminal VERDICT_BANDS thresholds (70/40), derived from the array"
  - "confidenceLanguage() ORs inDeadBand(c.overallScore) into the existing Mixed-signals branch — near-boundary scores read 'Mixed signals' first-class"
  - "6 dead-band calibration cases in verdict.test.ts (71/69/41/39 -> Mixed; 85/HIGH -> Confident read; antiViralityGated regression guard)"
affects: [03-03, view-model, Phase-4-Mobile-Reading-Thread]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dead-band as a verdict-derivation OVERLAY, not a 4th ordered band — VERDICT_BANDS stays a clean 3-row table (D-04)"
    - "Thresholds derived from VERDICT_BANDS.map(b => b.min).filter(min => min > 0) — never hard-coded 70/40, tracks any future re-tune"
    - "Load-bearing floor: a non-zero DEAD_BAND_FLOOR keeps 'Mixed signals' first-class even at variance ~= 0 (determinism gate live in 3.19.0)"

key-files:
  created: []
  modified:
    - src/lib/reading/verdict-bands.ts
    - src/lib/reading/view-model.ts
    - src/lib/reading/__tests__/verdict.test.ts

key-decisions:
  - "DEAD_BAND_FLOOR = 5 (planner-chosen ±5pt). Buffer half-width = 5 is the runtime value: confidenceLanguage() calls inDeadBand() with the DEFAULT floor, so the measured variance never flows into the verdict — it only documents the buffer>variance proof."
  - "Runtime is independent of the deferred 03-01 smoke run. The caller-side Math.ceil(Math.max(measuredVarianceHalfwidth, DEAD_BAND_FLOOR)) form is documented in the floor's comment so the proof holds by construction once the number lands."
  - "One-line OR into the existing antiViralityGated branch — no new branch, confidenceLanguage stays pure. Board copies (verdict-constants.ts / verdict-derive.ts) byte-unchanged (D-05); engine + ENGINE_VERSION untouched."

patterns-established:
  - "Buffer half-width recorded for GATE-03: BUFFER_HALFWIDTH=5 (DEAD_BAND_FLOOR). The buffer>variance inequality is FINALIZED in 03-03 once 03-01's VARIANCE_HALFWIDTH exists; given the determinism gate it is expected ~= 0 (5 >= 0 trivially)."

# Verification
verification:
  tests: "pnpm test src/lib/reading/ -> 37/37 GREEN (verdict.test.ts 12, identical-render 2, view-model 8, from-persisted-row 15)"
  build: "pnpm build -> success (no type errors from the new export/import)"
  guards: "git diff empty on board copies + src/lib/engine/; ENGINE_VERSION unchanged"
---

## What was built

GATE-02 verdict-banding calibration: a symmetric dead-band buffer around the
`VERDICT_BANDS` thresholds (70 and 40) so near-boundary scores surface the
first-class **"Mixed signals"** verdict instead of a falsely-confident band.

- **`verdict-bands.ts`** — added `export const DEAD_BAND_FLOOR = 5` (documented
  load-bearing) and `export function inDeadBand(score, buffer = DEAD_BAND_FLOOR)`.
  `inDeadBand` returns true when the score is within `buffer` of any non-terminal
  threshold (70/40), derived from the array; the terminal min 0 is excluded.
- **`view-model.ts`** — one OR clause into the existing branch:
  `if (c.antiViralityGated || inDeadBand(c.overallScore)) return 'Mixed signals';`
  No new branch; the function stays pure.
- **`verdict.test.ts`** — a `describe('dead-band buffer (GATE-02)')` block:
  71/69/41/39 → 'Mixed signals'; 85/HIGH → 'Confident read'; antiViralityGated
  regression guard.

## Buffer vs variance (for GATE-03)

- **BUFFER_HALFWIDTH = 5** (the `DEAD_BAND_FLOOR` runtime default).
- **VARIANCE_HALFWIDTH = pending** — the live 03-01 smoke batch is **deferred**.
  Per the determinism gate (temp:0 + seed:7 + maxRetries:0, live in 3.19.0) the
  measured half-width is expected ~= 0, well under 5. **03-03 (GATE-03) must
  finalize the `buffer > variance` inequality once 03-01-SUMMARY records the
  measured number.** This SUMMARY does not assert that proof — the code is
  complete and floor-correct, but the GATE-01 evidence it composes against is
  not yet captured.

## Deviations

- 03-01-SUMMARY.md does not exist yet (Task 2 deferred per user direction), so
  the measured variance half-width could not be wired into the floor's comment.
  Recorded as a TODO in the comment + flagged for GATE-03 instead of blocking —
  runtime correctness does not depend on the number (floor default is used).

## Self-Check: PASSED
