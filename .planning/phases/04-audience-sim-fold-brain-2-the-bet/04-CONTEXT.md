# Phase 4: Audience-Sim Fold (Brain 2) — THE BET - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Fold the current **10-archetype Pass-2** persona simulation (10 separate Qwen calls in `wave3/pass2.ts`) into **one grounded reasoning call** that emits the per-archetype × per-segment reaction matrix → retention **heatmap** + **behavioral aggregate**. Knowledge = `persona-registry.ts` archetype definitions; fed verbatim + segments + keyframes + emotion arc. Revive the dormant `corpus/eval-harness.ts` + `eval-runner.ts` as the **R10 A/B referee** to prove the fold reproduces/beats the 10-pass curve quality on real videos before it goes live.

**Delivers:** R3 (heatmap from one call), R7 (call-count drop toward ~3), R10 (fold proven, not assumed).

**NOT in this phase (P5):** the `Omni → Audience-Sim → Apollo` *sequencing*, audience-aware rewrites (R4 — "loses tough_crowd at 0:02"), the full Apollo + Audience-Sim score rederivation (R5), grounded engagement estimate (R11), board rendering of the heatmap. P4 builds + proves + swaps the *behavioral source*; P5 wires the sequence and surfaces it.
</domain>

<decisions>
## Implementation Decisions

### Archetype count
- **D-01:** Keep **all 10 archetypes** in the folded call's output (`high_engager, saver, lurker, sharer, tough_crowd, purposeful_viewer, niche_deep_buyer, niche_deep_scout, loyalist, cross_niche_curiosity`). The fold's win is **10 calls → 1 call** (R7), not fewer archetypes — trimming saves only output tokens while forfeiting signal P5's audience-aware rewrites (R4) need (they reference *specific* archetypes), and keeping 10 makes the R10 A/B apples-to-apples against the current 10-pass.
- **D-02 (fallback, A/B-triggered — NOT default):** If the single call provably cannot hold 10 distinct curves (fails the diversity metric in D-04), collapse to **~5 most behaviorally-divergent cores** — `tough_crowd, lurker, high_engager, sharer, loyalist`. Decide by A/B evidence, never upfront.

### R10 A/B referee (the gate that lets the fold go live)
- **D-03:** Pass bar is a **3-metric composite** (a single threshold is brittle — the R8 noise-band lesson), comparing the folded call vs the live 10-pass on the same video:
  1. **Behavioral parity** — folded `behavioral_score` within **±5** of the 10-pass (it feeds the live blend → user-visible).
  2. **Diversity preserved** — folded avg curve-range ≥ **0.8×** the 10-pass avg curve-range (directly measures homogenization; `measure-pipeline.ts` already prints "avg curve range").
  3. **Drop-point agreement** — folded swipe segment within **±1** for **≥6/10** archetypes.
  - "Reproduce" = inside all bands; "beat" = behavioral parity + diversity ≥1.0× + tighter/comparable drop points.
- **D-04:** **6 fixed real videos** spanning hook strength + niche (reuse the P2 determinism baseline `gwxLeHphZCxK` + others already analyzed). Build the referee as a **script** (real API calls, like `measure-pipeline.ts`) reviving `eval-harness.ts` + `eval-runner.ts` — NOT a unit test.
- **D-05:** Bar is **gating but advisory** — the numbers guide the decision; if the fold misses on 1 video but curves are clearly good, human judgment (the user) makes the final call. Don't let a brittle threshold block a qualitatively-good fold.

### Homogenization guardrails (the medium-high risk: one call flattening 10 curves)
- **D-06:** Mitigate inside the single call: **per-archetype structured output** (the schema is already per-archetype × per-segment — forces addressing each); **feed each archetype's byte-stable `persona-registry.ts` definition verbatim** + an explicit instruction *"these MUST diverge; near-identical curves across archetypes is a failure"*; **require relative drop-point ordering** grounded in the defs (tough_crowd bounces early, loyalist stays latest).
- **D-07:** Add a **post-parse diversity check** reusing the A/B's curve-range metric (D-03.2) — warn/flag when curves collapse below the floor. Guard + referee share one metric.
- **D-08:** **Bounded thinking** (the unbounded-CoT timeout fixed twice in P3 — deepseek + adapt), but sized **up** vs Pass-2's `thinking_budget: 2000` since it's 10 archetypes reasoned in one pass. Single call, `temp:0` + `seed` (D-10 from P3 carries forward).

### Swap timing
- **D-09:** **Build + prove + flip in P4**, gated on the A/B pass. The `behavioralSource` seam already exists in `wave3/aggregator.ts` (Phase 7 D-14) → instant rollback. Flipping production to the fold at the END of P4 banks the R7 call-count win earlier and keeps P5 focused purely on sequencing + surfacing (not source-swapping). Keep the 10-pass **dormant-not-deleted** (one-flag rollback).
- **D-10 (contingency):** If the A/B is borderline, ship the fold in **shadow** (logged + compared, 10-pass stays production) and defer the production flip to P5.

### Claude's Discretion (left for research/planner — NOT user decisions)
- The exact folded-call **prompt architecture** + how the byte-stable archetype defs become the cached system prefix (mirror the `STABLE_PASS2_SYSTEM_PROMPT` / KNOWLEDGE_CORE byte-stability contract).
- Exact `thinking_budget` / `max_tokens` values for the 10-archetype call (size empirically; the determinism-band + latency targets bound it).
- How the folded output maps onto the existing `HeatmapPayload` + `PersonaBehavioralAggregate` shapes (D-11/D-12 ethos from P3: preserve output contracts so the board + aggregator stay untouched) — researcher confirms the mapping is lossless.
- Keyframe/emotion-arc feeding mechanics into the single call.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 4: Audience-Sim Fold" — goal, gate (R10), success (R3/R7/R10), risk
- `.planning/REQUIREMENTS.md` — R3 (Audience-Sim Brain 2), R7 (~3 calls), R10 (fold proven), R4/R5/R11 (P5 dependents — context only)
- `.planning/phases/03-apollo-reasoner-brain-1-the-moat-shared-knowledge-core/03-CONTEXT.md` §D-05 — behavioral stays its own term until P4 folds it; full score rederivation is P5
- `.planning/ENGINE-MAP.md` — engine teardown map (wave3/pass2 current path)
- `.planning/VISION.md` — value-pillar framing (Audience-Sim = "the bet")

### Code to fold / revive (full paths)
- `src/lib/engine/wave3/pass2.ts` — current 10-persona Pass-2 path being folded (SUCCESS_THRESHOLD 7/10, PASS2_THINKING_BUDGET, per-persona attention curves)
- `src/lib/engine/wave3/persona-registry.ts` — 10 archetype enum + byte-stable archetype definition text (the knowledge for the fold)
- `src/lib/engine/wave3/persona-prompts-pass2.ts`, `persona-prompts.ts` — current pass2 prompt construction
- `src/lib/engine/wave3/aggregator.ts` — `behavioralSource` seam (Phase 7 D-14), PersonaBehavioralAggregate build
- `src/lib/engine/corpus/eval-harness.ts` + `src/lib/engine/corpus/eval-runner.ts` — A/B referee to revive (also `_dormant/corpus/` copies)
- `src/lib/engine/types.ts` — `HeatmapPayload` + `PersonaBehavioralAggregate` shapes (output contracts to preserve)
- `scripts/measure-pipeline.ts` — prints avg curve-range + per-archetype curves (reuse for the A/B diversity metric)
- `src/lib/engine/deepseek.ts` §Apollo call — bounded-thinking pattern (max_tokens + enable_thinking + thinking_budget + temp0/seed) as the template for the folded call

### Determinism context
- `.planning/STATE.md` §"Decisions locked" — R8 determinism = tolerance/provider-noise band, not byte-identity (governs how the A/B handles run-to-run drift)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `wave3/pass2.ts` 10-persona path — the behavior to reproduce; its per-persona attention curves + swipe points are the A/B ground truth.
- `persona-registry.ts` byte-stable archetype defs — feed verbatim into the folded call (knowledge source + cache prefix).
- `HeatmapPayload` + `PersonaBehavioralAggregate` (types.ts) — target output contracts; folded call should emit the same shapes so the board + aggregator are untouched (D-11/D-12 ethos).
- `corpus/eval-harness.ts` + `eval-runner.ts` (dormant) — A/B referee scaffolding to revive.
- `aggregator.ts` `behavioralSource` flag — the swap seam + one-flag rollback (D-09).
- `measure-pipeline.ts` curve-range + per-archetype curve printout — reuse for the diversity metric (D-03.2 / D-07).
- `deepseek.ts` Apollo call — bounded-thinking + temp0/seed call template (D-08).

### Established Patterns
- Byte-stable cached system prefix + volatile user message (DashScope input-cache; STABLE_PASS2_SYSTEM_PROMPT / KNOWLEDGE_CORE).
- Bounded thinking to avoid unbounded-CoT timeout (P3 checkpoint + CR-03 lesson) — applies to the 10-archetype single call.
- Determinism = tolerance band, not byte-identity (R8) — the A/B must tolerate provider noise (run fold 2× per video or compare within bands).

### Integration Points
- Folded call slots in where `pass2.ts` runs in the pipeline; output flows through `wave3/aggregator.ts` → `PersonaBehavioralAggregate` + `HeatmapPayload` → `aggregator.ts` behavioral term → blend.
- `behavioralSource` flag selects fold vs 10-pass (production swap + rollback).
</code_context>

<specifics>
## Specific Ideas

- Reuse the P2 determinism-baseline video `gwxLeHphZCxK` and the "bestfriend" clip already run through the live pipeline as part of the 6-video A/B set.
- The A/B "diversity" metric is intentionally the SAME measurement the homogenization post-parse guard uses (curve-range floor) — one metric, two uses.
</specifics>

<deferred>
## Deferred Ideas

- **Audience-aware rewrites** (R4 — "loses tough_crowd at 0:02") → P5, needs the Omni→Audience-Sim→Apollo sequencing.
- **Full Apollo + Audience-Sim score rederivation** (R5) → P5.
- **Grounded engagement estimate** (R11) → P5.
- **Board rendering of the heatmap** → P5 / UI milestone.
- **Outcome test-rig beyond a P4 validation tool** → next milestone (per ROADMAP Deferred).
- **Chat surface (Apollo + engine-as-tool)** → next milestone.

None of the above is scope creep into P4 — all are roadmap-placed later phases.
</deferred>

---

*Phase: 4-audience-sim-fold-brain-2-the-bet*
*Context gathered: 2026-06-05*
