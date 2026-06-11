# Phase 2: View-Model + Data Contract (ENG-06 D-12) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 2-View-Model + Data Contract (ENG-06 D-12)
**Areas discussed:** Block taxonomy + borderline keeps, Verdict derivation + band source, Identical-render contract, Block shape + degraded signals

---

## Gray area selection

User selected **all 4** gray areas and added: *"give me your thought-through recommended answer."* Claude drove each with a recommendation; user approved all 4 with the instruction *"audit and reverify right decision before continuing."*

---

## A. Block taxonomy + borderline keeps

| Option | Description | Selected |
|--------|-------------|----------|
| Claude-recommended KEEP set (~10) + DROP set + borderline rulings | 10 value-bearing blocks; drop dead scorecards/reasoning/predicted_engagement/retrieval/platform_fit/critique/emotion_arc; audio_fingerprint conditional | ✓ |

**User's choice:** Approve as written (with audit refinement to retention block).
**Notes:** Audit knock-on (D-13/D-01 #4) — retention/heatmap block KEEP only if normalizer resolves heatmap deterministically; else degrades rather than rendering a fabricated curve.

---

## B. Verdict derivation + band source

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing band scale + engine `hero.verdict_line` | Extract `bandLabel` thresholds to a Phase-3-tunable constant; prefer engine-authored why w/ deterministic fallback; confidence in band language; "Mixed signals" first-class; number demoted | ✓ |
| Compute "why" fresh in view-model from a chosen signal | Ignore engine `hero`, derive why from scratch | |

**User's choice:** Approve as written.
**Notes:** Held unchanged through the audit pass.

---

## C. Identical-render contract (DATA-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Lock refined C + A | Pure deterministic reload-normalizer both paths funnel through; consolidate `[id]/route.ts` shims; retention degrades if heatmap unfaithful; researcher maps reconstructable fields | ✓ |
| Normalizer = research question | Same direction but planner decides scope (normalizer vs persistence fix vs hybrid) | |
| Narrow DATA-02 scope | Identical-render holds only for byte-identical-persisted blocks; exclude reconstructed-field blocks from the guarantee (smaller phase, weaker promise) | |

**User's choice:** Lock refined C + A.
**Notes:** AUDIT FINDING drove the refinement — verified via `[id]/route.ts` that replay reconstructs (`synthHeatmap` w/ `Math.random`, recomputed `optimal_post_window`, derived `analysis_unavailable`) and apollo/hero ride a racing `variants` JSONB bag → DATA-02 currently FALSE for reconstructed fields. Original "consume the intersection" rule (D-09) is necessary but insufficient; D-11 reload-normalizer added as load-bearing scope.

---

## D. Block shape + degraded signals

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union, pure data + two-tier degradation | No presentation hints; individual missing field → omit silently; whole-analysis degradation → first-class honest block | ✓ |

**User's choice:** Approve as written.
**Notes:** Aligns with existing `verdict-derive.ts` "omit/never-fabricate" philosophy.

---

## Claude's Discretion

- Exact `ReadingBlock` union member names + per-block field shapes.
- File layout within `lib/reading/`.
- Whether `fromPersistedRow` is imported by `[id]/route.ts` or lives in a shared module.
- Confidence band-language wording map.
- Which `variants`-bag race conditions the normalizer defensively handles (researcher maps).

## Deferred Ideas

- `emotion_arc` as a Reading block — revisit Phase 4.
- `retrieval_evidence` "similar videos" — possible Phase 6 agentic-tool result, not a core block.
- Persisting real heatmap as a first-class column (migration) — only if the pure normalizer can't reconstruct faithfully; planner/Phase 3+ decision.
- Band threshold *values* — Phase 3 calibrates; Phase 2 only exposes the constant.
