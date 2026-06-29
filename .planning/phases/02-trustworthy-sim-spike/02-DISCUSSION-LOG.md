# Phase 2: Trustworthy-SIM Spike - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 2-trustworthy-sim-spike
**Areas discussed:** Determinism proof method, No-calibration input source, Go/no-go verdict bar, Spike deliverable + throwaway, Custom context

---

## Determinism proof method

| Option | Description | Selected |
|--------|-------------|----------|
| Live double-bake + fixture | Freeze 1 Apify scrape, re-run enrich-signature ×2 with real Qwen (temp0+seed), assert identical signature JSON (normalize timestamps/ids), save one as replay fixture | ✓ |
| Live double-bake only | Same live test, no fixture kept (throwaway) | |
| Fixture-replay only | Skip the live LLM determinism test; record one bake, replay | |

**User's choice:** Live double-bake + fixture — "option 1 but 15-20 qwen is too much"
**Notes:** User asked for the exact Apify + Qwen call count before deciding. Grounded answer: 1 Apify scrape (frozen, reused), 4-6 Qwen per socials bake (3-5 omni-flash watches + 1 synthesis). Then requested a tighter budget → settled on **~10 Qwen, double-bake @ MIN_WATCH=3** (socials 4×2 = 8 + General 1×2 = 2), <$0.50. Rejected ~6 split-probe and ~4 synth-only (latter leaves omni-flash watch unproven).

---

## No-calibration input source

| Option | Description | Selected |
|--------|-------------|----------|
| General bundle + socials control | Real General evidence bundle (chat/doc) through thin throwaway proto bake + socials enrich on real @handle as known-good control | ✓ |
| Socials enrich only | Bake from a real @handle via existing enrich-signature (fastest, but only re-proves socials) | |
| General bundle only | Hand-crafted General bundle, no socials control | |

**User's choice:** General bundle + socials control
**Notes:** Tests the actual General no-calibration path while anchoring against the proven socials baseline.

---

## Go/no-go verdict bar

| Option | Description | Selected |
|--------|-------------|----------|
| Hard 3-gate, all must pass | determinism 2/2 identical; provenance 100% personas ≥1 evidence quote + ungrounded flagged; tiering Directional-by-rule; any fail → no-go + written fallback | ✓ |
| Determinism-only hard gate | Hard threshold on determinism only; provenance + tiering qualitative | |
| Soft qualitative verdict | Written judgment per leg, no numeric thresholds | |

**User's choice:** Hard 3-gate, all must pass
**Notes:** Crisp, defensible gate for P3.

---

## Spike deliverable + throwaway

| Option | Description | Selected |
|--------|-------------|----------|
| Verdict doc + keep harness | SPIKE-VERDICT.md primary; keep the determinism harness as a committed test (P3 foundation); throw away proto General-bundle scaffolding | ✓ |
| Verdict doc only | Pure throwaway — write verdict, delete all code | |
| Keep everything | Verdict + harness + proto General bake path, all committed | |

**User's choice:** Verdict doc + keep harness
**Notes:** Reusable determinism gate without hoarding un-reviewed throwaway proto.

---

## Custom context

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into provenance leg | User custom-context note = first-class evidence (source=user); spike proves grounded-vs-ungrounded across scraped AND user-supplied evidence + confirms it strengthens grounding; double-bake with note to confirm determinism; full UI = P3 | ✓ |
| Defer fully to P3 | Keep spike on bake determinism + scraped provenance only | |
| Determinism-check only | Bake twice with same custom note, but don't model it as evidence | |

**User's choice:** Fold into provenance leg
**Notes:** Raised by the founder unprompted — "i want users to be able to add custom context to any audience they create." Proven at the provenance/determinism layer now; full input + UI + editing built for real in Phase 3.

---

## Claude's Discretion

- Harness + proto bake-path location/shape (test runner: `node ./node_modules/vitest/vitest.mjs run`).
- Signature-equality normalization rule (which fields are volatile vs load-bearing).
- Concrete `@handle` (socials control) + the specific chat/doc (General bundle) — founder may supply.
- `SPIKE-VERDICT.md` location + structure.

## Deferred Ideas

- Custom-context full capability (input + UI + editing on any audience) → Phase 3 (POP/TRUST).
- General population object (audiences generalization, library, success-criterion, UI badges) → Phase 3.
- Profile verb (real Profile-from-evidence path) → Phase 5.
- Drift re-bake / optional self-calibration (Directional → Validated) → v2 (CAL-01).
