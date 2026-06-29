---
phase: 02-trustworthy-sim-spike
plan: 03
subsystem: testing
tags: [spike, verdict, go-no-go, determinism, provenance, tiering, teardown, trust-03]

# Dependency graph
requires:
  - phase: 02-02
    provides: live probe evidence (determinism NON-DETERMINISTIC genuine, provenance+tiering GREEN)
  - phase: 02-01
    provides: signature-equality.ts + signature-determinism.test.ts (KEEP replay gate)
provides:
  - "SPIKE-VERDICT.md — the phase gate: per-leg PASS/FAIL + explicit NO-GO (conditional) + fallback plan"
  - "Phase 2 closed with a defensible go/no-go for the Phase 3 General surface"
  - "Throwaway scripts/spike scaffolding torn down (D-05); KEEP gate + 2 prod fixes survive"
affects: [03, trustworthy-sim, determinism-gate, calibration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hard 3-gate go/no-go: each trust leg scored PASS/FAIL, not a fuzzy qualitative verdict (D-04)"
    - "Throwaway-scaffolding teardown with evidence captured verbatim into the verdict doc + recoverable from git history (D-05)"

key-files:
  created:
    - .planning/phases/02-trustworthy-sim-spike/SPIKE-VERDICT.md
  modified: []
  deleted:
    - scripts/spike/trustworthy-sim-probe.ts
    - scripts/spike/chat-bundle-adapter.ts
    - scripts/spike/fixtures/socials-bundle.fixture.json

key-decisions:
  - "Verdict = NO-GO (conditional) per the hard D-04 gate: determinism leg FAILED genuinely (matched watch counts rule out Pitfall-2 transport), so a failed gate is a NO-GO with a written fallback — but provenance+tiering GREEN + bake-once-freeze production reality make it NO-GO-pending-one-mitigation, not model-invalidating"
  - "Recommended fallback: drop thinking-mode (enable_thinking:false) on the synth bake — Pitfall-3 jitter source; temp:0 greedy decoding survives without it. Re-run double-bake = GO confirmation"
  - "Torn down scripts/spike per D-05; evidence lives verbatim in SPIKE-VERDICT.md; 2 production fixes (synth timeout, subtitleLinks:null) explicitly retained as non-throwaway"

patterns-established:
  - "A spike closes by scoring each trust leg PASS/FAIL against a pre-committed hard gate, choosing GO/NO-GO honestly from the evidence, and writing a concrete fallback path when a leg is RED"

requirements-completed: [TRUST-03]

# Metrics
duration: ~6min
completed: 2026-06-26
---

# Phase 02 Plan 03: Spike Verdict + Teardown Summary

**Spike closed: SPIKE-VERDICT.md renders a NO-GO (conditional) against the hard 3-gate — Determinism FAIL (genuine thinking-mode synth non-determinism), Provenance + Tiering PASS — with a one-mitigation fallback (drop thinking-mode synth) clearing it to GO; throwaway scaffolding torn down, KEEP gate + 2 prod fixes survive green.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-26
- **Tasks:** 2 (verdict doc; teardown + gate re-run)
- **Files:** 1 created (SPIKE-VERDICT.md), 3 deleted (scripts/spike throwaway)

## Accomplishments

- Wrote `SPIKE-VERDICT.md` — the primary D-05 deliverable and the Phase 2 gate — scoring all three D-04 legs PASS/FAIL with the 02-02 probe evidence quoted verbatim:
  - **Gate 1 Determinism: FAIL (genuine).** Two bakes of the identical frozen `khaby.lame` input diverged on load-bearing LLM-derived fields (`signatureEqual:false`). Matched watch counts (A=3, B=3, `watchedMismatch:false`) rule out the Pitfall-2 transport/INCONCLUSIVE escape — this is real thinking-mode synth non-determinism (Pitfall 3). The KEEP replay gate (assembly+normalization+tiering, non-LLM half) IS deterministic and stays green as the CI-safe backstop.
  - **Gate 2 Provenance: PASS.** 40/40 reactor-personas grounded across all four bakes; ungrounded distinguishable; `source=user` custom-context surfaced first-class (`provenance.custom_context`).
  - **Gate 3 Tiering: PASS.** No-calibration General SIM → Directional by rule, never Validated.
- Rendered an explicit **OVERALL VERDICT: NO-GO** (conditional) — honest to D-04 (any leg fails → NO-GO) while weighing the bake-once-freeze production reality (prod never re-bakes, so cross-bake non-determinism is theoretical not operational).
- Wrote the required **fallback plan** (3 ordered options; recommended = disable thinking-mode for the synth bake) — the path to GO before Phase 3.
- Captured P3 carry-forward: the `source=user` structural-shape recommendation (Open Question 3 — promote probe-local `provenance.custom_context` to a real SIM-scoped field), the `videos_watched=INCONCLUSIVE` Pitfall-2 caveat (did NOT trigger here), the KEEP gate as P3's regression foundation, and the 2 retained production fixes.
- **Tore down** `scripts/spike/` (probe + adapter + fixture) per D-05; confirmed no `src/` import referenced it; **re-ran the KEEP gate green post-teardown** (5/5 replay test; 135/135 full `src/lib/audience` suite).

## Task Commits

1. **Task 1: Write SPIKE-VERDICT.md** — `a14af4b9` (docs)
2. **Task 2: Tear down throwaway scaffolding** — `362ef8df` (chore)

## Files Created/Modified/Deleted

- **Created:** `.planning/phases/02-trustworthy-sim-spike/SPIKE-VERDICT.md` — per-leg 3-gate + NO-GO + fallback + P3 carry-forward + budget actuals (PRIMARY, KEEP)
- **Deleted (THROWAWAY, D-05):** `scripts/spike/trustworthy-sim-probe.ts`, `scripts/spike/chat-bundle-adapter.ts`, `scripts/spike/fixtures/socials-bundle.fixture.json`
- **Untouched (KEEP / production):** `src/lib/audience/signature-equality.ts`, `src/lib/audience/__tests__/signature-determinism.test.ts` (+fixtures), `src/lib/audience/enrich-signature.ts` (timeout fix), `src/lib/schemas/competitor.ts` (subtitleLinks:null fix)

## Decisions Made

- Chose **NO-GO (conditional)** over a soft GO: D-04 is a hard gate and the determinism leg genuinely failed; a fuzzy "good enough" GO is exactly what D-04 rejects. But the verdict frames it as NO-GO-pending-one-mitigation (not model-invalidating) because provenance+tiering are GREEN and the bake-once-freeze production reality bounds the blast radius to the re-bake/drift path (v2, CAL-01).
- Recommended **disabling thinking-mode for the synth bake** as the primary fallback — it is the documented Pitfall-3 jitter source and `temp:0` greedy decoding is the actual determinism lever.

## Deviations from Plan

None — plan executed exactly as written. Both task `<automated>` verifies passed; KEEP gate green pre- and post-teardown.

## Issues Encountered

- Auto-wip daemon active in this worktree (per CLAUDE.md hazard note) — any mid-work snapshot is on-branch (`milestone/numen-gsi`), linear, and harmless; no force-push or remediation needed.

## Next Phase Readiness

- **Phase 2 CLOSED** with a defensible go/no-go. Verdict: NO-GO pending the determinism mitigation, then GO for the Phase 3 General surface.
- **Before Phase 3 build:** apply the §Fallback mitigation (drop thinking-mode synth) and re-run the live double-bake to confirm `signatureEqual:true` (the GO confirmation). Provenance + tiering need no further work.
- **P3 inherits:** the green `signature-equality.ts` + `signature-determinism.test.ts` regression gate (TRUST-01 foundation); the `source=user` → first-class `provenance.custom_context` field recommendation; the badge resolver (TRUST-01) to build in `src/`.

## Self-Check: PASSED
