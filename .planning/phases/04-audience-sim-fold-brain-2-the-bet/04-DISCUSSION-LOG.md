# Phase 4: Audience-Sim Fold (Brain 2) — THE BET - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 4-audience-sim-fold-brain-2-the-bet
**Areas discussed:** Archetype count, R10 A/B bar + video set, Homogenization guardrails, Swap timing

---

## Area selection

| Option | Selected |
|--------|----------|
| Archetype count (10 vs ~5) | ✓ |
| R10 A/B pass bar + video set | ✓ |
| Homogenization guardrails | ✓ |
| Swap timing: P4 vs shadow→P5 | ✓ |

User selected all four and asked for Claude's thought-through recommendation on each.

---

## Archetype count

**Recommendation given:** Keep all 10; define a ~5-core fallback (`tough_crowd, lurker, high_engager, sharer, loyalist`) triggered only if the A/B shows the single call can't hold 10 distinct curves.
**Rationale:** the fold's win is 10 calls→1 (R7), not fewer archetypes; trimming forfeits signal P5's audience-aware rewrites (R4) need + breaks A/B apples-to-apples.
**User's choice:** Lock as-is → **D-01 / D-02**

## R10 A/B bar + video set

**Recommendation given:** 3-metric composite bar — behavioral_score ±5, avg curve-range ≥0.8×, swipe segment ±1 for ≥6/10 archetypes — on 6 fixed real videos, built as a script reviving eval-harness/eval-runner, gating-but-advisory.
**Rationale:** single threshold is brittle (R8 noise-band lesson); diversity metric doubles as the homogenization guard.
**User's choice:** Lock as-is → **D-03 / D-04 / D-05**

## Homogenization guardrails

**Recommendation given:** per-archetype structured output + feed registry defs verbatim + explicit divergence instruction + relative drop-point ordering + post-parse diversity check (shared metric) + bounded thinking sized up vs pass2's 2000.
**Rationale:** keep 10 archetypes distinct in one call; A/B is the backstop.
**User's choice:** Lock as-is → **D-06 / D-07 / D-08**

## Swap timing

**Recommendation given:** build + prove + flip in P4 gated on A/B pass, 10-pass kept dormant-not-deleted (one-flag rollback via existing behavioralSource seam); shadow-until-P5 as borderline contingency.
**Rationale:** banks R7 call-count win earlier; keeps P5 focused on sequencing + surfacing.
**User's choice:** Lock as-is → **D-09 / D-10**

---

## Claude's Discretion

- Folded-call prompt architecture + byte-stable cached prefix mechanics
- Exact thinking_budget / max_tokens for the 10-archetype call (size empirically)
- Lossless mapping of folded output onto HeatmapPayload + PersonaBehavioralAggregate
- Keyframe/emotion-arc feeding mechanics

## Deferred Ideas

- Audience-aware rewrites (R4) → P5
- Full Apollo + Audience-Sim score rederivation (R5) → P5
- Grounded engagement estimate (R11) → P5
- Board heatmap rendering → P5 / UI milestone
- Outcome test-rig beyond P4 validation; chat surface → next milestone
