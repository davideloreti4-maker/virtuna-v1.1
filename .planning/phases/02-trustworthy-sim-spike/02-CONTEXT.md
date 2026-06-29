# Phase 2: Trustworthy-SIM Spike - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the vision's make-or-break open question (§7) before any General surface (P3) is invested in: **can a user build a *trustworthy* General SIM with zero calibration data?** The trust model rests on three legs, all already partially present in the signature substrate on `main`:

1. **Determinism** — the same SIM baked twice (temp 0 + seed, bake-once) produces an identical signature (not a dice roll).
2. **Provenance** — every reactor persona carries its evidence; ungrounded personas are visibly distinguishable from grounded ones.
3. **Honest tiering** — a no-calibration SIM resolves **Directional** by rule (never Validated).

This is a **SPIKE**: an experiment that closes with a written **go/no-go verdict** on whether the no-calibration trust model holds for the General surface. We clarify HOW to run the experiment and what counts as a GO — we do **not** build the General population (that's P3). Requirement: **TRUST-03**.

**Carry-forward from Phase 1 / substrate:** determinism (`temp:0 + QWEN_SEED`) and provenance (persona `evidence`) already exist in `enrich-signature.ts` / `signature.ts`. Build on the substrate; do **NOT** `git merge rework/engine-core`.

</domain>

<decisions>
## Implementation Decisions

### Determinism Proof Method
- **D-01:** **Live double-bake (×2) + replay fixture.** Freeze ONE Apify scrape, re-run `enrich-signature` **twice** with real Qwen (temp 0 + seed), assert the frozen signature JSON is **identical** (normalize volatile fields — timestamps/ids — before compare). Save one bake as a replay fixture. Rationale: the dice-roll risk lives in the **LLM calls** (omni-flash video watch + qwen-3.7-plus synthesis), not the pure `signature.ts` derivation (which is byte-deterministic by construction). Double (×2, not ×3) is sufficient — determinism is binary; two identical bakes prove it. Rejected: fixture-replay-only (dodges the make-or-break LLM-determinism question); live-only with no fixture (P3 would rebuild the gate).
- **D-01a:** **Freeze the scrape.** The determinism test re-bakes from the **same frozen Apify bundle** — re-scraping per bake would let Apify drift (new videos, changed counts) corrupt the test. Apify = **1 call total**, not ×N.
- **D-01b:** **Call budget ~10 Qwen + 1 Apify, <$0.50.** Cap omni watch at `MIN_WATCH=3`. Socials control: 3 omni + 1 synth = 4 calls ×2 bakes = 8 Qwen. General bundle: 1 synth ×2 = 2 Qwen. Tests **both** omni-flash watch AND synthesis determinism on a representative signature. (Omni determinism is a property of the model — watching the same videos twice proves it; the multi-video bake exists to give one representative signature for the provenance/tiering inspection.) Rejected leaner budgets: synth-only ~4 Qwen (leaves the omni-flash video watch — the bigger unknown — unproven).

### No-Calibration Input Source
- **D-02:** **General bundle + socials control.** Bake a real **General evidence bundle** (a chat `.txt` / doc) through a **thin throwaway proto** bake path, AND run **socials `enrich-signature` on a real `@handle`** as a known-good control. Rationale: the spike must prove the actual **General no-calibration** case, not just re-prove socials — but the socials control anchors results against the proven baseline if the General bake looks off. Rejected: socials-only (doesn't test the General path the spike exists to de-risk); General-only (no proven baseline to compare against).

### Custom Context (user-added grounding)
- **D-03:** **Fold custom context into the provenance leg.** A user-supplied **"custom context" note is treated as first-class evidence** (`source=user`) on the SIM. The spike must prove grounded-vs-ungrounded works for **BOTH scraped AND user-supplied evidence**, and confirm custom context **strengthens** grounding (tagged, provenance-visible) rather than **fakes** it. Also **double-bake with the note present** to confirm the extra free-text input does not break determinism (D-01). Rationale: founder wants users to add custom context to *any* audience; proving the provenance/determinism model holds for user-supplied evidence now de-risks that P3 capability. The full custom-context **input + UI + editing** is **P3** (deferred, D-defer-01).

### Go/No-Go Verdict Bar
- **D-04:** **Hard 3-gate, all must pass.** Concrete bars:
  - **Determinism:** 2/2 bakes produce identical signature JSON (post-normalization).
  - **Provenance:** 100% of reactor personas carry ≥1 evidence quote; ungrounded personas are flagged/distinguishable from grounded ones (across scraped + user-supplied evidence per D-03).
  - **Tiering:** the no-calibration SIM resolves **Directional by rule** (never Validated).
  - **Any gate fails → NO-GO**, with a **written fallback plan** (what to change before P3). Rationale: a crisp, defensible gate for P3; a fuzzy qualitative GO is easy to rationalize. Rejected: determinism-only hard gate (leaves provenance + tiering subjective); soft qualitative verdict (weak P3 gate).

### Spike Deliverable + Throwaway Line
- **D-05:** **Verdict doc (primary) + keep the determinism harness.** `SPIKE-VERDICT.md` (the go/no-go) is the primary artifact. **KEEP** the bake + determinism-assertion harness as a **committed test** — it becomes P3's regression foundation (the reusable determinism gate). **Throw away** the proto General-bundle scaffolding. Rationale: capture the learning + a reusable gate without hoarding un-reviewed throwaway proto in the codebase. Rejected: verdict-doc-only (P3 rebuilds the gate); keep-everything (ships un-reviewed proto General bake path into real code).

### Claude's Discretion
- Exact location/shape of the determinism-assertion harness and the throwaway proto General-bundle bake path (note test-runner quirk: use `node ./node_modules/vitest/vitest.mjs run`, not `npm test`/`npx vitest` which print fake PASS(0)).
- The normalization rule for the signature-equality compare (which fields are "volatile" — timestamps/ids — vs load-bearing).
- The concrete `@handle` for the socials control and the specific chat/doc used as the General evidence bundle (founder may supply; otherwise pick a representative one).
- Where `SPIKE-VERDICT.md` lives and its exact structure (per-leg result + overall verdict + fallback).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone vision & requirements
- `.planning/NUMEN-GSI-VISION.md` §7 — "The make-or-break open question" — the trust model (determinism / provenance / drift re-bake / trust tiering / optional self-calibration) this spike de-risks. Also §6 (verified architecture reality — what the substrate already provides) and §3 (the two-tier Validated/Directional model).
- `.planning/ROADMAP.md` §"Phase 2: Trustworthy-SIM Spike" — goal + 3 success criteria (determinism / provenance / tiering + written go/no-go verdict).
- `.planning/REQUIREMENTS.md` **TRUST-03** — the single requirement this phase covers.
- `.planning/phases/01-engine-pack-seam/01-CONTEXT.md` — Phase 1 decisions; the DomainPack seam + the "build on substrate, don't merge rework/engine-core" constraint.

### Signature substrate (already on `main` — build on, do NOT merge)
- `src/lib/audience/enrich-signature.ts` — the bake "heart": `omni-flash` watches top `MIN_WATCH=3`–`MAX_WATCH=5` videos → 1 `qwen-3.7-plus` synthesis → frozen `AudienceSignature` (creator persona + 10 reactors w/ evidence + provenance + derived weights). Runs `temperature:0, seed:QWEN_SEED`. **This is the bake the determinism test double-runs (D-01).**
- `src/lib/flywheel/signature.ts` — `predictedSignature()`: pure, byte-deterministic derivation (no Date.now / Math.random / I/O). The non-LLM half — not the determinism risk.
- `src/lib/audience/calibration.ts` — bake-once orchestration (`temp 0 + seed`, output frozen on the row); maps signature → legacy profile. Where the no-calibration tiering rule (D-04) is observed.
- `src/lib/audience/audience-types.ts` — `AudienceSignature`, `SignaturePersona`, `GoalIntent` types; persona `evidence`/`provenance` shape the provenance leg inspects.
- `src/lib/engine/qwen/client.ts` — `QWEN_SEED`, `QWEN_OMNI_MODEL`, `QWEN_REASONING_MODEL`; the determinism config under test.

### Test runner
- Use `node ./node_modules/vitest/vitest.mjs run` — `npm test`/`npx vitest` emit fake PASS(0)/FAIL(0).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `enrich-signature.ts` — already runs `temp:0 + seed` and produces evidence-backed personas; the spike harness invokes it twice over a frozen input and diffs the output. No new bake logic needed for the socials control.
- `signature.ts` `predictedSignature()` — pure/deterministic by construction; demonstrates the "free by construction" determinism the LLM bake must be shown to match.
- `calibration.ts` bake-once orchestration — the place the Directional-by-rule tiering (D-04) is read off (no calibration set → Directional).

### Established Patterns
- Bake-once + frozen-on-row: the per-skill hot path never re-calls the LLM, so the engine stays deterministic. The spike validates the **bake** step is itself deterministic.
- Provenance is already modeled: each reactor persona carries `evidence`. The spike's provenance leg is an **inspection** of existing data (+ the new `source=user` custom-context evidence per D-03), not new infrastructure.
- Determinism guard is a property of the model under `temp:0 + seed` — the omni-flash **video watch** is the least-proven call and the one the double-bake most needs to exercise.

### Integration Points
- General bake proto path: a thin throwaway adapter feeding a text chat/doc bundle into the synthesis step (no omni video watch) — the only net-new code, and it's thrown away (D-05).
- Custom-context evidence: a `source=user` tag on persona/SIM evidence — modeled in the spike (D-03), wired for real (input + UI + edit) in P3.
- The kept harness (D-05) becomes P3's determinism regression gate.

</code_context>

<specifics>
## Specific Ideas

- Founder framing: "15-20 Qwen is too much" — keep the spike cheap (~10 Qwen + 1 Apify, <$0.50). Don't over-bake to prove a binary property.
- Founder wants users to add **custom context to any audience** — proven now at the provenance/determinism layer (D-03), built for real in P3.
- Decouple the two levers: "is the LLM deterministic" (cheap probe, double-bake) vs "is this a representative signature" (one full bake for inspection).

</specifics>

<deferred>
## Deferred Ideas

- **D-defer-01: Custom-context full capability** (input affordance + UI + editing on any audience) → **Phase 3** (POP / TRUST). The spike only models custom context as `source=user` evidence to prove provenance + determinism hold for user-supplied grounding.
- **General population object** (`audiences` generalization, library, success-criterion, trust badges in UI) → **Phase 3** (POP-*, TRUST-01/02).
- **Profile verb** (build a person/panel audience from uploaded evidence, the real Profile-from-evidence path) → **Phase 5** (PROF-*). The spike's General bundle bake is a throwaway proto, not this.
- **Drift re-bake / optional self-calibration** (Directional → Validated promotion) → v2 (CAL-01); out of v7.0.

</deferred>

---

*Phase: 2-trustworthy-sim-spike*
*Context gathered: 2026-06-26*
