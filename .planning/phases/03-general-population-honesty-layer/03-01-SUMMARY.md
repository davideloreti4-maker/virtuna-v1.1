---
phase: 03-general-population-honesty-layer
plan: 01
subsystem: audience-signature / determinism
status: COMPLETE — D-01 gate resolved via Fallback Option 2 (bake-once-freeze)
tags: [determinism, D-01, wave-0-gate, qwen, enrich-signature, bake-once-freeze]
requires:
  - src/lib/audience/enrich-signature.ts (defaultSynthesize)
  - src/lib/audience/signature-equality.ts (signatureEqual/normalizeSignature/stableStringify)
provides:
  - "D-01 fix: thinking-mode dropped on the synth bake (enable_thinking:false, thinking_budget removed) — reduced (did not eliminate) synth jitter"
  - "scripts/rebake-determinism.ts — paid live double-bake harness (now the v2/CAL-01 re-bake-drift tool)"
  - "Determinism contract RESOLVED: scoped to the frozen persisted signature (bake-once-freeze) + green zero-network replay gate"
affects:
  - "Wave-0 GATE: RESOLVED via Option 2 — Phase 3 (migration/repo/UI) is CLEARED to proceed"
tech-stack:
  added: []
  patterns:
    - "greedy temp:0 + seed reduces but does NOT remove qwen-3.7-plus synth jitter (MoE batch-routing non-determinism)"
    - "bake-once-freeze: determinism contracted on the frozen artifact, not cross-bake reproducibility"
key-files:
  created:
    - scripts/rebake-determinism.ts
    - scripts/fixtures/socials-bundle.fixture.json
  modified:
    - src/lib/audience/enrich-signature.ts
decisions:
  - "D-01 close-out applied in-place; ENGINE_VERSION NOT bumped (synth-call config only)"
  - "Harness is standalone tsx/node-runnable, deliberately NOT in the vitest suite (paid + live)"
  - "GATE FAILED (signatureEqual:false, structural drift) → operator adopted Fallback Option 2 (bake-once-freeze). Cross-bake reproducibility deferred to v2 (CAL-01). Thinking-off change KEPT (strict jitter reduction)."
metrics:
  tasks_completed: 3
  tasks_total: 3
  files_touched: 3
  completed: "2026-06-27"
---

# Phase 3 Plan 01: D-01 Determinism Close-out Summary (COMPLETE)

**One-liner:** Dropped thinking-mode on the `qwen-3.7-plus` synthesis bake (`enable_thinking:false`, `thinking_budget` removed) and re-created the paid live double-bake harness; the live gate proved the synth is **still non-deterministic** (structural drift, even isolated) — root cause is MoE batch-routing, not a config bug — so the D-01 leg was resolved by adopting **Fallback Option 2 (bake-once-freeze)**: the determinism contract is now scoped to the frozen persisted signature + the green zero-network replay gate, with cross-bake reproducibility deferred to v2 (CAL-01).

## Status

**COMPLETE.** Tasks 1–2 implemented + committed; Task 3 (the blocking-human live gate) was RUN by the operator. The gate returned `signatureEqual:false`; per the plan's failure path this STOPPED the phase and escalated to SPIKE-VERDICT §Fallback. The operator selected **Option 2 (bake-once-freeze)** as the resolution, which clears Wave 1.

## Tasks Completed

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Drop thinking-mode on the synthesis bake (D-01) | auto | `c4c7b5c9` | src/lib/audience/enrich-signature.ts |
| 2 | Re-create the live double-bake harness | auto | `6d5854a2` | scripts/rebake-determinism.ts, scripts/fixtures/socials-bundle.fixture.json |
| 3 | D-01 live gate (human-action) | checkpoint | — (resolved by decision, see below) | — |

### Task 1 — Drop thinking-mode (D-01)

In `defaultSynthesize` (enrich-signature.ts ~line 345-355): set `enable_thinking: false`, removed `thinking_budget: 2000`. Retained `temperature: 0` and `seed: QWEN_SEED`. ENGINE_VERSION NOT bumped. Replay gate `signature-determinism.test.ts` → **5 passed**. This change is KEPT — the live gate (below) showed it materially *reduces* jitter (interest_tags, temperature_mix, follower_tier, writing_style_sample became cross-bake-stable), it is a strict improvement, and it is faster/cheaper without thinking-mode staging.

### Task 2 — Re-create the live double-bake harness

Restored from the torn-down spike probe (`git 362ef8df^`) as `scripts/rebake-determinism.ts` + the frozen secret-scrubbed `khaby.lame` fixture. See header for the (now v2/CAL-01) framing.

## Task 3 — D-01 GATE EVIDENCE (live paid run)

Two paid runs (~$0.15 total, under the <$0.50 budget — "test it cheaper" honored). Throwaway cost-trimmed variants were used and deleted; the canonical `scripts/rebake-determinism.ts` was left pristine.

**Run A — full-pipeline, trimmed to 1 video (real watch + real synth):** `signatureEqual: false`.
Confounded: the omni *watch* call produced different notes across bakes (watch cost 0.264¢ vs 0.266¢; `writing_style_sample` differed "...Tranquility Cape..." vs "...The sign's right there James..."), feeding different input into the synth. Could not attribute the failure to the synth alone. (The committed canonical harness has this same confound — it does not isolate the synth.)

**Run B — synth-ISOLATED (watch + subtitle stubbed to identical/null input, 2 real synth calls only):** `signatureEqual: false`.
With byte-identical synth input on both bakes, the synth STILL diverged — so this is genuine synth non-determinism, not a watch artifact:
- **Structural drift (load-bearing):** `persona_weights` loyalist 0.15↔0.10, niche 0.05↔0.10; persona `share` values (tough_crowd 0.08↔0.05, high_engager 0.07↔0.08, saver 0.05↔0.04, purposeful_viewer 0.04↔0.06, niche_deep_scout 0.02↔0.03).
- **Prose drift:** `reaction_frame`, `evidence`, `summary` reworded each bake.
- **Stable across bakes:** `follower_tier` (mega), `maturity` (established), `interest_tags`, `temperature_mix` (cold 0.65 / hot 0.1 / warm 0.25), archetype set + order, `writing_style_sample`, `persona_weights.fyp` (0.75) + `cross_niche` (0.05).

**Quality (A2 guard):** PASS — the synth output reads coherently (mega-tier global silent-comedy audience, FYP-driven cold lurker majority, saver/share segments), no quality collapse from dropping thinking-mode.

**Root cause:** `qwen-3.7-plus` is an MoE model on shared serving infra; expert routing is batch-dependent, so `temp:0`+`seed` cannot guarantee bitwise cross-bake reproducibility. This independently reproduces spike 02-02's finding and is **not a fixable config bug**. Because the drift is *structural* (weights/shares), Fallback Option 3 (prose-only tolerance) is invalid by its own terms ("do not use to paper over structural divergence").

### Resolution — Fallback Option 2 (bake-once-freeze) [operator decision, 2026-06-27]

The determinism contract (D-04) is reframed to production reality:
- **Determinism is contracted on the FROZEN, persisted signature** (stable by construction — production bakes once at calibration and freezes the signature on the row; it never re-bakes the same input). Cross-bake LLM reproducibility is NOT a v1 guarantee.
- The existing **zero-network replay gate** `signature-determinism.test.ts` (5/5 green) remains the standing determinism guarantee for assembly/normalization.
- **Cross-bake reproducibility / re-bake drift → v2 (CAL-01)**, where re-bake is an actual feature. `scripts/rebake-determinism.ts` is retained as the v2/CAL-01 drift-detection tool.
- The honesty layer is unaffected: no-calibration audiences are already tiered **Directional** (Tiering GREEN in 02-03); grounding/provenance (Provenance GREEN) is untouched.

## Deviations from Plan

1. **Gate did not pass as written; resolved by mitigation.** The plan's happy path expected `signatureEqual:true` from Option 1 (thinking-off) alone. The live gate disproved that. Per the plan's own failure clause ("If `signatureEqual:false`: STOP the phase and escalate to §Fallback"), the phase stopped and the operator chose Option 2. The plan named Option 3 as the escalation target; the live evidence (structural, not just prose, drift) ruled Option 3 out and Option 2 in.
2. **Cost-trimmed gate runs.** Per operator instruction ("run it but test it cheaper"), the gate was run via two throwaway cost-trimmed harness variants (1-video full-pipeline, then synth-isolated) instead of the full 3-video canonical harness — isolating the synth both reduced cost and produced a cleaner verdict. Temp files deleted; canonical harness untouched.
3. **Minor (comment hygiene):** corrected stale "thinking ON" comments in enrich-signature.ts after the Task-1 edit.

## Self-Check

- `src/lib/audience/enrich-signature.ts` — FOUND (modified, committed `c4c7b5c9`)
- `scripts/rebake-determinism.ts` — FOUND (committed `6d5854a2`, header reframed to v2/CAL-01)
- `scripts/fixtures/socials-bundle.fixture.json` — FOUND (committed `6d5854a2`)
- Throwaway gate variants (`scripts/rebake-cheap.tmp.ts`, `scripts/rebake-isolate.tmp.ts`) — DELETED (never committed)
- Replay gate `signature-determinism.test.ts` — 5/5 green
- D-01 leg — RESOLVED (Option 2, bake-once-freeze)

## Self-Check: PASSED
