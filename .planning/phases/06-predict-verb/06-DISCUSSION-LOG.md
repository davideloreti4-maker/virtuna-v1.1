# Phase 6: Predict Verb - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 6-predict-verb
**Areas discussed:** Probability form, Reasoning mechanic, Panel scope, Cut line + trigger, Range provenance (follow-up)

---

## Probability form (the honesty collision)

| Option | Description | Selected |
|--------|-------------|----------|
| Likelihood band (Claude rec) | Likely/Lean/Toss-up/Unlikely band on the dial; no number, oracle-proof, matches every other card | |
| Band + coarse range | A band PLUS a rough range it maps to ("Lean yes, ~60-70%"), never a point estimate | ✓ |
| Point probability % | A single % (e.g. 64%) — matches literal wording but breaks bands-only + reads as an oracle | |

**User's choice:** Band + coarse range
**Notes:** Founder diverged from the recommended pure-band: wants a bounded NUMBER on the gauge, but not a point estimate. This triggered the range-provenance follow-up to keep it honest.

---

## Reasoning mechanic

| Option | Description | Selected |
|--------|-------------|----------|
| New analyst-reasoning frame (Claude rec) | New `predict` FlashFraming: analysts reason about likelihood + name a factor → aggregate; reuses engine spine, drops stop/scroll content frame; fixes the P5 barbell | ✓ |
| Reuse stop/scroll verbatim | Map the existing react fraction → likelihood; cheapest, but inherits the content-framing mismatch | |
| Multi-branch fork | Generate N scenario branches, reason each, aggregate; closest to literal wording but most build/cost | |

**User's choice:** New analyst-reasoning frame (Recommended)
**Notes:** Reuses the Flash engine plumbing but with a reasoning frame, not a content-react frame. Directly addresses the filed `simulate-reaction-person-framing` barbell todo for Predict.

---

## Panel scope

| Option | Description | Selected |
|--------|-------------|----------|
| Any panel, default Analyst, reject person (Claude rec) | Runs against any panel-type General audience; defaults to the zero-setup Analyst Panel template; person SIMs redirected with a nudge | ✓ |
| Analyst template only | Hardwired to the Analyst Panel; simplest, but under-delivers audience-first | |
| Any audience incl. person | A person SIM yields a single-analyst read; broadest, but dilutes the honesty + "panel" framing | |

**User's choice:** Any panel, default Analyst, reject person (Recommended)
**Notes:** Audience-first (vision §16.4); the Analyst Panel template already exists. Person rejection keeps the "panel forecast" honest.

---

## Cut line + trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal trigger, rest deferred (Claude rec) | Chain-CTA / minimal entry so the thread works end-to-end; front-door + Mode-scoped menu stay P7; history/multi-scenario/calibration deferred | ✓ |
| Headless verb only | Build the verb, no trigger in P6; surfaced in P7. Tightest, but can't human-verify the wow | |
| Fuller surface now | Predict gets its own entry + history; pulls P7 forward, risks the locked composer rule | |

**User's choice:** Minimal trigger, rest deferred (Recommended)
**Notes:** Mirrors P5's tight cut exactly.

---

## Range provenance (follow-up — locked the band+range choice)

| Option | Description | Selected |
|--------|-------------|----------|
| Panel spread = the range (Claude rec) | The range IS the panel's disagreement (min-max of analyst leans); band = center; confidence = range tightness; honest by construction, fuses probability+range+confidence into one object | ✓ |
| Fixed band→range map | Each band maps to a static range; decorative digits, confidence needs a separate source | |
| Model emits the range | The reasoning call outputs a range directly; highest hallucinated-precision/oracle risk | |

**User's choice:** Panel spread = the range (Recommended)
**Notes:** Resolves both the "where does the number come from" honesty question AND defines confidence (= range tightness) in one decision. The range is the only sanctioned numeric and must be panel-derived, never model-emitted.

---

## Claude's Discretion

- Exact Zod schema for the `prediction-gauge` block (co-locate in `profile-blocks.ts`/`blocks.ts`).
- The `predict` `FlashFraming` wiring + per-persona likelihood-lean/factor parsing.
- The likelihood→band+range+confidence aggregation (a `predict-aggregate.ts` sibling or in-runner).
- Module layout: `predict-runner.ts` + `/api/tools/predict/route.ts` (mirror simulate).
- The minimal trigger shape + the person-SIM rejection UX (route 400 + nudge copy).

## Deferred Ideas

- Front-door picker + Mode-scoped skill menu + generalized ambient reactor → Phase 7.
- Multi-branch scenario fork → v2 depth.
- Multi-scenario / batch compare → later.
- Prediction history / saving predictions → later (thread-only in P6).
- Outcome calibration (Directional → Validated) → v2 (CAL-01).
- Point probability % → rejected (oracle). Person SIMs predicting → rejected (not a panel).
- Reviewed-not-folded todos: `simulate-reaction-person-framing` (informed D-02; Simulate-side fix stays P5), `p05-code-review-followups` WR-03 folded into D-08, rest = P5 hardening pass.
