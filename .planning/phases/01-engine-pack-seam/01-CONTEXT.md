# Phase 1: Engine / Pack Seam - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the core engine **domain-blind** via a `DomainPack` interface, and extract Socials into **Pack #1** with pluggable scoring — while the creator (Socials) pipeline keeps working. This is a **pure internal refactor**: zero user-facing change, no General surface, no second pack, no UI. Requirements: PACK-01, PACK-02, PACK-03, PACK-04.

The frozen Apollo/virality math is **wrapped, never refactored**. The signature substrate ("Phase 0", engine-rework) is already on `main` — build on it; do NOT `git merge rework/engine-core`.

</domain>

<decisions>
## Implementation Decisions

### Extraction Strategy
- **D-01:** **In-place, test-gated cut** — no runtime/env flag. Socials becomes Pack #1 in one move; the core is refactored in place. Rollback safety comes from **git + the smoke test**, not a parallel code path. Rejected: strangler-behind-a-flag (would mean maintaining two copies of identical behavior — Socials IS Pack #1, not "old vs new"); incremental sub-extractions (interface churn).

### Safety Bar / Regression Gate
- **D-02:** ⚠️ **Relaxes ROADMAP Phase-1 Success Criterion #4 and PACK-04.** The byte-identical, regression-locked guarantee is **dropped**. Rationale (founder): the creator skill's input/output is not yet optimized/maximized and **will be reworked next milestone** — investing in an exact-byte fixture rig is wasted.
- **D-03:** The phase gate is instead a **light smoke + structural check**: a test asserts the Socials run **completes** and its output schema is **structurally valid** (all expected fields present, `overall_score` within a sane band). **NOT exact values.** Goal: cheap insurance the refactor didn't break Socials (crashes, dropped fields, wiring errors), without a brittle golden-master harness.
- **D-04:** Planner/executor should **re-read PACK-04 and ROADMAP SC#4 through this lens** — treat "byte-identical" as superseded by D-02/D-03. (Requirement text itself is not edited here; this CONTEXT decision governs.)

### Pack Interface Shape
- **D-05:** Define the **full 7-field typed `DomainPack` interface now** — `populations / grounding / stimulusTypes / reactionFrame / scoring / outputSchema / calibration` — but **implement ONLY Socials**. Rationale: the contract is the expensive, hard-to-re-cut part (roadmap already enumerates all 7 fields); General (P3) / Predict (P6) packs are deferred but the seam must not need re-cutting then. Rejected: minimal-grow-later (risks re-cutting mid-milestone); +stub General pack (not chosen — scope stays pure refactor per D-08).

### Scoring Wrap Line
- **D-06:** Pack #1's `scoring` wraps the **entire existing scoring chain** — `apollo-core` → `aggregator` → `overall_score` virality fold — as **one opaque unit**. The **core holds zero scoring logic** and just calls `pack.scoring.run(...)`. Rationale: PACK-01 demands "no socials-specific logic on the core run path," and the `overall_score` weighting/virality IS socials-specific, so the aggregation must live inside the pack. `apollo-core` math runs **unchanged** inside the wrapper.
- **D-07:** Do **not** refactor `aggregator.ts` into a domain-blind parameterized fold (rejected option) — that brushes the wrap-never-refactor constraint. Wrap it whole.

### Phase-1 Scope Lock
- **D-08:** **Pure invisible refactor.** Ships only the seam + Socials Pack #1. No user-facing change, no General surface, no second/stub pack, no UI, no P3 data-model groundwork. Keeps the diff reviewable and the "Socials still works" check clean.

### Claude's Discretion
- Exact file/module layout of the `DomainPack` interface and the Socials pack (where the pack lives under `src/lib/engine/`, naming).
- Location and shape of the smoke-test harness (D-03) — note: `npm test`/`npx vitest` print fake PASS(0); run tests via `node ./node_modules/vitest/vitest.mjs run`.
- The `mode` dispatch axis (domain-mode socials/general vs the existing `input_mode` video/text/url) — surfaced but not locked; planner decides how `pack[mode]` keys without breaking the input_mode branches. Keep `input_mode` as the stimulus axis; pack key is the domain axis.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone vision & requirements
- `.planning/NUMEN-GSI-VISION.md` — the GSI pivot SSOT; §7 = the make-or-break open question the seam de-risks; "engine-rework = GSI Phase 0, land don't stop".
- `.planning/ROADMAP.md` §"Phase 1: Engine / Pack Seam" — goal + 4 success criteria. NOTE: SC#4 (byte-identical) is **superseded by D-02/D-03**.
- `.planning/REQUIREMENTS.md` PACK-01…PACK-04 — pack-seam requirements. PACK-04 (byte-identical regression lock) **relaxed per D-02**.

### Core code to extract / wrap (the seam)
- `src/lib/engine/pipeline.ts` — `runPredictionPipeline` (the run path, ~906 lines, branched on `input_mode` video_upload/tiktok_url/text). Where the `DomainPack` seam is cut.
- `src/lib/engine/apollo-core.ts` — frozen Apollo scorer. Wrapped unchanged inside Pack #1 `scoring`.
- `src/lib/engine/aggregator.ts` — `overall_score` fold + virality weighting (socials-specific). Wrapped whole into Pack #1 `scoring` (D-06/D-07), NOT refactored.
- `src/lib/engine/anti-virality.ts`, `src/lib/engine/version.ts` — scoring-chain neighbors; account for in the wrap boundary.
- `src/lib/engine/creator.ts`, `src/lib/engine/creator-rulebook.ts` — creator output path the smoke check (D-03) exercises.
- `src/lib/engine/types.ts` — engine types; the `DomainPack` interface (D-05) lands alongside.

### Signature substrate (already on main — build on, don't merge)
- `src/lib/flywheel/signature.ts`, `src/lib/flywheel/realized-signature.ts`, `src/lib/audience/enrich-signature.ts` — the substrate the pack populations/calibration sit on later.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runPredictionPipeline` (pipeline.ts) — the single run entry; becomes the thin core that dispatches to `pack[mode].run(...)`.
- `apollo-core.ts` + `aggregator.ts` — existing scoring functions become the body of Pack #1's `scoring` wrapper unchanged.

### Established Patterns
- Engine is heavily `input_mode`-branched (video_upload / tiktok_url / text) inside the pipeline — the pack seam must coexist with this branching, not replace it (input_mode = stimulus axis; pack = domain axis).
- Engine determinism pattern (temp:0 + seed) exists; smoke check (D-03) can lean on it for the structural sanity band without needing full byte-equality.
- Test runner quirk: `npm test`/`npx vitest` emit fake PASS(0)/FAIL(0) — use `node ./node_modules/vitest/vitest.mjs run`.

### Integration Points
- Core run path → `DomainPack.scoring` (the wrap boundary, D-06).
- Pack schema fields `populations / grounding / calibration` connect to the signature substrate already on `main` (consumed fully in P3, defined-but-Socials-only here).

</code_context>

<specifics>
## Specific Ideas

- Founder framing: don't gold-plate the Socials I/O contract — it's a throwaway-soon surface. Spend effort on the *seam shape* (D-05) and a *clean core* (D-06), not on locking exact creator output.

</specifics>

<deferred>
## Deferred Ideas

- **General pack implementation** — Phase 3 (POP-*). Interface defined here, not implemented.
- **Predict pack** — Phase 6.
- **Stub General pack to prove domain-blindness** — considered, rejected for P1 scope purity (D-08); the full typed interface (D-05) is the proof instead.
- **`mode` dispatch axis formalization** (domain-mode vs input_mode) — surfaced; planner resolves within P1, but any broader mode-routing UX is later-phase.

None of the above are in Phase 1 scope.

</deferred>

---

*Phase: 1-engine-pack-seam*
*Context gathered: 2026-06-26*
