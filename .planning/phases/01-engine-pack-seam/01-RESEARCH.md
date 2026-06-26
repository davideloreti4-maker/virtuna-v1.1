# Phase 1: Engine / Pack Seam - Research

**Researched:** 2026-06-26
**Domain:** Internal engine refactor — domain-blind `DomainPack` seam + Socials → Pack #1 (TypeScript / Next.js, zero external deps)
**Confidence:** HIGH (live-code structural read; all claims traced to file:line)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** In-place, test-gated cut — no runtime/env flag. Socials becomes Pack #1 in one move; core refactored in place. Rollback = git + smoke test, NOT a parallel code path. (Rejected: strangler-behind-a-flag; incremental sub-extractions.)
- **D-02:** ⚠️ Relaxes ROADMAP SC#4 and PACK-04. Byte-identical regression-locked guarantee is **DROPPED**. (Founder: creator I/O will be reworked next milestone — an exact-byte fixture rig is wasted effort.)
- **D-03:** Phase gate = light **smoke + structural check**: assert the Socials run **completes** + output schema **structurally valid** (all expected fields present, `overall_score` within a sane band). NOT exact values. Cheap insurance against crashes/dropped-fields/wiring errors, no brittle golden-master.
- **D-04:** Re-read PACK-04 and ROADMAP SC#4 through this lens — "byte-identical" is superseded by D-02/D-03. (Requirement text not edited; this CONTEXT decision governs.)
- **D-05:** Define the **full 7-field typed `DomainPack` interface now** — `populations / grounding / stimulusTypes / reactionFrame / scoring / outputSchema / calibration` — but **implement ONLY Socials**. The contract is the expensive, hard-to-re-cut part. (Rejected: minimal-grow-later; +stub General pack.)
- **D-06:** Pack #1's `scoring` wraps the **entire existing scoring chain** — `apollo-core` → `aggregator` → `overall_score` virality fold — as **one opaque unit**. Core holds **zero scoring logic**; just calls `pack.scoring.run(...)`. `apollo-core` math runs **unchanged** inside the wrapper.
- **D-07:** Do **NOT** refactor `aggregator.ts` into a domain-blind parameterized fold. Wrap it whole.
- **D-08:** **Pure invisible refactor.** Ships only the seam + Socials Pack #1. No user-facing change, no General surface, no second/stub pack, no UI, no P3 data-model groundwork. Keep the diff reviewable.

### Claude's Discretion
- Exact file/module layout of the `DomainPack` interface and the Socials pack (where it lives under `src/lib/engine/`, naming).
- Location and shape of the smoke-test harness (D-03). NOTE: `npm test`/`npx vitest` print fake PASS(0); run via `node ./node_modules/vitest/vitest.mjs run`.
- The `mode` dispatch axis (domain-mode socials/general vs the existing `input_mode` video/text/url) — surfaced, not locked. Planner decides how `pack[mode]` keys without breaking the `input_mode` branches. **Keep `input_mode` as the stimulus axis; pack key is the domain axis.**

### Deferred Ideas (OUT OF SCOPE)
- General pack implementation → Phase 3 (POP-*). Interface defined here, not implemented.
- Predict pack → Phase 6.
- Stub General pack to prove domain-blindness → rejected for P1 scope purity (D-08). The full typed interface (D-05) is the proof instead.
- `mode` dispatch axis broader UX formalization → later phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACK-01 | Engine runs domain-blind via a `DomainPack` interface; Socials assumptions extracted into Pack #1, no socials-specific logic on the core run path | §"Seam Cut Map" identifies the exact 4 call sites and the socials-specific code that must move behind the pack: the `aggregateScores` virality fold (aggregator.ts:883-902), the Apollo system prompt (deepseek.ts:541), the fold archetype selection (pipeline.ts:794-813). |
| PACK-02 | Scoring pluggable — success criterion + aggregation supplied by the pack; frozen Apollo/virality math *wrapped* as Pack #1's scorer, behaviour unchanged | §"The Wrap Boundary" maps the exact opaque unit. `pack.scoring.run` = `aggregateScores` (the overall_score success criterion lives at aggregator.ts:883-902); Apollo math (apollo-core.ts constants → deepseek.ts runtime) referenced, not refactored (D-06/D-07). |
| PACK-03 | `DomainPack` schema defined (7 fields) and Socials populated as Pack #1 | §"DomainPack 7-Field Map" maps each field to its existing live concept + module. Interface lands in/beside `types.ts`. |
| PACK-04 | (RELAXED per D-02/D-03) creator pipeline produces byte-identical output | Superseded → §"Validation Architecture" defines the D-03 smoke/structural gate (run completes + PredictionResult shape valid + `overall_score ∈ [0,100]` sane band) replacing the byte-identical fixture rig. |
</phase_requirements>

## Summary

The engine's run path is **not one function** — it is a deliberate **two-call sequence** invoked at **4 call sites**: `runPredictionPipeline(input, opts) → PipelineResult` (orchestration: input-mode branching, perception, simulation) followed by `aggregateScores(pipelineResult, …) → PredictionResult` (the scoring fold that computes the headline `overall_score`). The pipeline is *already substantially domain-blind* — its stages (validate → normalize → Omni perception → Wave-1 text analysis → Wave-2 Apollo reasoning → Wave-3 fold) are generic orchestration. The **socials-specific scoring lives in three places**: (1) the `overall_score` virality success-criterion in `aggregateScores` (aggregator.ts:883-902), (2) the Apollo expert-read grounding (`APOLLO_SYSTEM_PROMPT` from apollo-core.ts, consumed by deepseek.ts:541), and (3) the 10-archetype socials fold (pipeline.ts:794-813). This split is the single most important structural fact for the planner.

**The cleanest seam that honors D-06/D-07/D-08:** make `pack.scoring.run` wrap `aggregateScores` whole (the literal `overall_score`/virality fold + success-criterion weighting — the load-bearing "socials" math PACK-01 says must leave the core), and have the Socials pack **reference** (not move) the Apollo grounding + fold so the pipeline reads them through `pack.*` instead of hardcoded imports. The route, eval-runner, and learning harness stop importing `aggregateScores` directly and instead call `pack[mode].scoring.run`. `input_mode` (the stimulus axis) stays exactly where it is inside the pipeline; the pack key is the orthogonal domain axis. There is one literal-vs-pragmatic ambiguity in D-06 (does "scoring" also swallow the Apollo reasoning + fold *stages*, which currently run inside the pipeline?) — **this is the #1 decision the planner must lock** (see §"The Wrap Boundary: Two Defensible Cut Lines").

**Primary recommendation:** Define the full 7-field `DomainPack` interface in/beside `types.ts`; populate one `SOCIALS_PACK` whose `scoring.run` wraps `aggregateScores` unchanged and whose `grounding`/`reactionFrame` reference the existing Apollo + fold modules; route all 4 call sites through `pack[mode]`; gate with a fast, mocked-LLM structural smoke test fed by the existing `__tests__/factories.ts` fixtures. **First: `npm install` — this worktree has no `node_modules`.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run-path dispatch (`pack[mode].run`) | Engine core (lib) | API route | Route already orchestrates the two-call sequence; the pack dispatch is a thin indirection over the existing imports |
| Stimulus handling (video/url/text) | Engine pipeline | — | `input_mode` branching is the stimulus axis — stays in `runPredictionPipeline`, orthogonal to the pack/domain axis |
| Perception (Omni, text analysis) | Engine pipeline | — | Domain-blind already; produces raw reactions, not a verdict |
| Simulation (Apollo read, 10-archetype fold) | Engine pipeline | Socials Pack (grounding/reactionFrame refs) | Socials-grounded today; pack *references* the grounding (D-08: don't move files) |
| Scoring / success criterion (`overall_score` fold) | **Socials Pack `.scoring`** | — | The virality weighting IS socials-specific (PACK-01); must live behind the seam (D-06) |
| Output schema (`PredictionResult`) | Engine types | Socials Pack `.outputSchema` | Single shared shape this phase; pack names it as its `outputSchema` |

## Standard Stack

**No external packages are installed or added this phase.** This is a pure internal TypeScript refactor. The "stack" is the existing engine + its tooling:

### Core (already in `package.json`, must be installed — see Environment Availability)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | ^5 | Types the `DomainPack` interface (D-05) | Project standard; `tsc --noEmit` is the structural gate |
| `zod` | ^4.3.6 | `AnalysisInputSchema` (types.ts:154) — stimulus validation | Already the engine's boundary validator |
| `vitest` | ^4.0.18 | Smoke/structural test runner (D-03) | Project test framework; engine has 45 existing `__tests__` files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `DomainPack` as a TS `interface` + const objects | Class hierarchy / DI container | Over-engineered for 1 pack; D-08 wants a reviewable diff. Plain typed object is idiomatic to this codebase (cf. `SCORE_WEIGHTS`, `DEFAULT_PERSONA_WEIGHT_CONFIG`). |
| Wrap `aggregateScores` whole (D-06/D-07) | Parameterize the fold into a domain-blind aggregator | **Explicitly rejected by D-07** — brushes the wrap-never-refactor constraint. |

**Installation:** none new. Run `npm install` to restore the existing lockfile (worktree has no `node_modules`).

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** It is a pure internal refactor (D-08). The only dependency action is restoring the existing lockfile via `npm install` (deps already vetted on `main`).

## Architecture Patterns

### System Architecture Diagram — the run path AS IT IS TODAY

```
                          ┌─────────────────── 4 CALL SITES ───────────────────┐
                          │ route.ts JSON (790→809) · route.ts SSE (1000→1027) │
                          │ eval-runner.ts (123→127) · learning/predict (70→71)│
                          └────────────────────────┬───────────────────────────┘
                                                    │ (input, opts)
                                                    ▼
        ┌─────────────────── runPredictionPipeline (pipeline.ts:332) ───────────────────┐
        │  Stage 1 validate (AnalysisInputSchema)   Stage 2 normalize                    │
        │                                                                                 │
        │  ── input_mode BRANCH (the STIMULUS axis) ──                                    │
        │     video_upload → signed URL (415)                                             │
        │     tiktok_url   → Apify resolve + re-host (452)                                │
        │     (both)       → analyzeVideoWithOmni (564)   [perception]                    │
        │     text/url     → Qwen text analysis (608-661) [perception]                    │
        │                                                                                 │
        │  Wave 2: deepseek_reasoning (706) ── APOLLO read [SIMULATION, socials grounding]│
        │            └─ deepseek.ts:541 consumes APOLLO_SYSTEM_PROMPT (apollo-core.ts)    │
        │  Wave 3: runFold (805) ── 10 socials archetypes [SIMULATION, socials reaction]  │
        │            └─ selectPersonaSlots (794) + buildAudienceRepaint (804)             │
        │                                                                                 │
        │  RETURNS raw stage outputs as PipelineResult (NO overall_score here)            │
        └────────────────────────────────────┬────────────────────────────────────────-─┘
                                              │ pipelineResult
                                              ▼
        ┌──────────────── aggregateScores (aggregator.ts:520) — THE SCORING FOLD ─────────┐
        │  apollo_score   = deepseek.composite_score        (848)                          │
        │  fold_audience  = 0.50·completion + 0.25·share + 0.15·save + 0.10·comment (864)  │ ← SOCIALS
        │  overall_score  = 0.5·apollo + 0.5·fold_audience  (883-902) ← SUCCESS CRITERION  │ ← VIRALITY
        │  + anti-virality gate (1128) + CTA penalty (138) + engagement range (185)        │ ← MATH
        │  RETURNS PredictionResult (types.ts:300) — the headline verdict                  │
        └─────────────────────────────────────────────────────────────────────────────-──┘
```

A reader can trace any run: input → pipeline (perception+simulation, input_mode-branched) → aggregator (the socials scoring fold) → `PredictionResult`. **The seam target is the `pipelineResult → PredictionResult` edge (the aggregator call) plus the two simulation stages that reference socials grounding.**

### Pattern: the seam is a dispatch indirection, not a rewrite

**What:** Today each call site does `const pr = await runPredictionPipeline(...); const result = await aggregateScores(pr);`. After the seam, callers resolve a pack and call through it: `pack[mode]` returns the run + scoring entrypoints. The pipeline body is unchanged; only its hardcoded *socials scoring references* (Apollo prompt, fold archetypes, aggregator import) are read through the pack.

**When to use:** Every one of the 4 call sites (§"Seam Cut Map").

**Example — recommended `DomainPack` shape (Claude's discretion on exact layout):**
```typescript
// Source: synthesized from vision §5 DomainPack sketch + live aggregator/pipeline signatures
export interface DomainPack {
  id: "socials";                              // domain axis key (NOT input_mode)
  populations: PopulationsSpec;               // → audience-types.ts Audience + persona-registry archetypes
  grounding: GroundingSpec;                   // → apollo-core.ts KNOWLEDGE_CORE / APOLLO_SYSTEM_PROMPT + creator-rulebook
  stimulusTypes: readonly StimulusType[];     // → ["text","tiktok_url","video_upload"] (the input_mode enum)
  reactionFrame: ReactionFrameSpec;           // → wave3 persona prompts + buildAudienceRepaint projection
  scoring: {                                  // ← THE NEW SEAM (D-06)
    systemPrompt: string;                     //   = APOLLO_SYSTEM_PROMPT (referenced, unchanged)
    run(pipelineResult: PipelineResult,
        onStageEvent?: StageEventCallback,
        options?: AggregateScoresOptions): Promise<PredictionResult>; // = aggregateScores, wrapped whole
  };
  outputSchema: { /* PredictionResult shape descriptor */ };  // → types.ts:300
  calibration: CalibrationSpec;               // → calibration-baseline.json + flywheel/signature.ts (Socials-only)
}
```

### Anti-Patterns to Avoid
- **Refactoring `aggregator.ts` into a parameterized fold.** Explicitly forbidden by D-07. Wrap `aggregateScores` as-is.
- **Moving `apollo-core.ts` / `deepseek.ts` / fold modules into the pack folder.** D-08 wants a reviewable diff and the wrap-don't-refactor constraint; the pack should *reference* these by import, not relocate them. Moving files inflates the diff and risks the "Socials still works" check.
- **Collapsing `input_mode` into the pack key.** They are orthogonal (CONTEXT discretion + vision §16). `input_mode` = stimulus; pack = domain. A General pack (P3) will still need text/file stimulus handling.
- **Bumping `ENGINE_VERSION`.** A behavior-preserving wrap must keep `3.20.0` (the cache key + regression gate assert it — see Runtime State Inventory). If a bump becomes necessary, output drifted → the wrap was not behavior-preserving.

## The Wrap Boundary: Two Defensible Cut Lines (PLANNER MUST LOCK)

D-06 says `scoring` wraps "`apollo-core` → `aggregator` → `overall_score` virality fold as one opaque unit." But in the live code, **Apollo and the fold run *inside* `runPredictionPipeline` (the simulation stages), while `overall_score` is computed in `aggregateScores`.** So "the scoring chain" is not one contiguous block. Two readings:

**Cut Line A — minimal / module-boundary (RECOMMENDED):**
- `pack.scoring.run` = `aggregateScores` wrapped whole. This is *literally* where the success criterion + `overall_score` virality fold live (aggregator.ts:883-902) — the exact socials math PACK-01 says must leave the core.
- Apollo + fold stay as pipeline *simulation* stages, but the pipeline reads `pack.scoring.systemPrompt` (= `APOLLO_SYSTEM_PROMPT`) and `pack.reactionFrame` (= fold archetype config) instead of hardcoded socials imports.
- **Satisfies:** "core holds zero scoring logic" (the aggregator import leaves the route; the headline-number math is behind the pack); D-07 (aggregator wrapped, not refactored); D-08 (smallest reviewable diff — the pipeline body is untouched, only its socials *references* indirect through the pack).
- **Risk:** a strict reading of D-06 ("apollo-core … as one opaque unit") may want Apollo *execution* inside `scoring` too. Mitigated by treating `apollo-core` as *grounding the pack supplies to the reasoner*, which matches vision §5 (`grounding` field) and §14.1 (box 4 = "pack scorer", box 3 = "brain/simulate").

**Cut Line B — literal D-06 (heavier):**
- `pack.scoring.run` swallows the Apollo reasoning stage + the fold stage + `aggregateScores`. The pipeline's `deepseek_reasoning` (706) and `wave_3_fold` (778-820) blocks move behind `pack.scoring`.
- **Satisfies** the most literal reading of "apollo-core → aggregator as one unit."
- **Risk:** large, invasive cut through the middle of `runPredictionPipeline`; fights D-08 (reviewable diff) and raises the chance the "Socials still works" smoke fails on wiring. The fold also produces `personaBehavioralAggregate`/`wave3Result` consumed by `PredictionResult` *and* the audience-viz UI — extracting it cleanly is non-trivial.

**Recommendation:** **Cut Line A.** It puts the genuine socials *success-criterion* math behind the seam (the load-bearing PACK-01/PACK-02 concern), keeps Apollo/fold as referenced grounding+reaction (the `grounding`/`reactionFrame` pack fields they conceptually ARE), and yields the reviewable diff D-08 demands. Document the interpretation in the plan so plan-checker treats "byte-identical scoring chain wrap" as superseded by D-02/D-03 and "core holds zero scoring logic" as satisfied by the aggregator-import removal + prompt/archetype indirection.

## Seam Cut Map (the concrete edit surface)

**The 4 call sites that must route through `pack[mode]`** (all do the identical two-call sequence):

| # | File | Lines | Current | After seam |
|---|------|-------|---------|------------|
| 1 | `src/app/api/analyze/route.ts` (JSON branch) | 790, 809 | `runPredictionPipeline` then `aggregateScores(pipelineResult, undefined)` | `pack.run(...)` then `pack.scoring.run(pr, undefined)` |
| 2 | `src/app/api/analyze/route.ts` (SSE branch) | 1000, 1027 | same, with `onStageEvent` | `pack.scoring.run(pr, onStageEvent)` |
| 3 | `src/lib/engine/corpus/eval-runner.ts` | 123, 127 | same, with `behavioralSource` option | `pack.scoring.run(pr, undefined, {behavioralSource})` |
| 4 | `src/lib/engine/learning/predict.ts` | 70, 71 | same | `pack.scoring.run(pr)` |

**Socials-specific references inside the pipeline to indirect through the pack (Cut Line A):**
- `deepseek.ts:13,541` — `APOLLO_SYSTEM_PROMPT` import + use → read from `pack.grounding`/`pack.scoring.systemPrompt`.
- `pipeline.ts:794` — `selectPersonaSlots(content_type, niche)` (socials archetype routing) → `pack.reactionFrame`.
- `pipeline.ts:804` — `buildAudienceRepaint` (socials audience projection) → `pack.reactionFrame`.
- `route.ts:10` + `eval-runner.ts:5` + `learning/predict.ts:15` — direct `aggregateScores` imports → removed; reached via `pack.scoring.run`.

**`aggregateScores` signature to preserve verbatim in the wrap** (aggregator.ts:520):
```typescript
aggregateScores(
  pipelineResult: PipelineResult,
  onStageEvent?: StageEventCallback,
  options?: AggregateScoresOptions,   // { behavioralSource?, videoContext?, deferCounterfactuals? }
): Promise<PredictionResult>
```

## DomainPack 7-Field Map (D-05 — define all 7, populate Socials only)

| Field | Socials value (Pack #1) | Lives in (existing) | P1 status |
|-------|-------------------------|---------------------|-----------|
| `populations` | `Audience` + 10 persona archetypes + `AudienceSignature` | `src/lib/audience/audience-types.ts`; `src/lib/engine/wave3/persona-registry.ts`; `src/lib/flywheel/signature.ts` | reference (Socials-only); fully consumed P3 |
| `grounding` | Apollo `KNOWLEDGE_CORE` / `APOLLO_SYSTEM_PROMPT`; creator rulebook | `apollo-core.ts:40,254`; `creator-rulebook.ts:190` | reference, unchanged |
| `stimulusTypes` | `["text","tiktok_url","video_upload"]` + `content_type` enum | `types.ts:157,169` (`AnalysisInputSchema`) | the `input_mode` enum = stimulus axis |
| `reactionFrame` | fold persona prompts + `selectPersonaSlots` + `buildAudienceRepaint` | `wave3/persona-registry.ts`; `engine/flash/build-reaction-panel.ts` | reference, unchanged |
| `scoring` | `{ systemPrompt: APOLLO_SYSTEM_PROMPT, run: aggregateScores }` | `aggregator.ts:520` (wrap whole, D-06/D-07) | **the new seam** |
| `outputSchema` | `PredictionResult` | `types.ts:300` | single shared shape; pack names it |
| `calibration` | `calibration-baseline.json`; realized/flywheel signatures | `engine/calibration-baseline.json`; `flywheel/realized-signature.ts` | reference (Socials-only); P3+ |

**Where the interface lands (Claude's discretion):** `types.ts` already holds `AnalysisInput`, `ContentPayload`, `PredictionResult` (the contract surface) — a sibling `domain-pack.ts` importing from `types.ts` keeps `types.ts` from ballooning (it is already 1047 lines) while keeping the contract co-located. Either is defensible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| The virality success criterion / `overall_score` fold | A new domain-blind aggregator | Wrap `aggregateScores` whole (D-07) | The math (anti-virality gate, CTA penalty, engagement range, confidence agreement) is load-bearing + interlocked; re-deriving it is the deep-surgery risk vision §10 warns against |
| Apollo expert read | Re-prompting | Reference `APOLLO_SYSTEM_PROMPT` (apollo-core.ts:254) | It's a byte-stable cached prefix (DashScope prefix-cache); changing bytes busts the cache + shifts scores (version.ts history) |
| `PipelineResult` fixtures for the smoke test | Hand-written mock objects | `src/lib/engine/__tests__/factories.ts` | Already provides typed builders the existing 45 engine tests use |
| Audience projection into the fold | New mapping | `buildAudienceRepaint` (build-reaction-panel.ts) | Same projection the text SIM uses; General/null/is_general → no-op (regression-safe) |

**Key insight:** Every "socials" thing the seam touches already exists as a discrete, tested module. The phase is **indirection + interface definition**, not new logic. The temptation to "clean up while we're in here" (e.g., parameterize the fold) is the exact failure D-07 forbids.

## Runtime State Inventory

> This is a structural refactor, not a string-rename. There is no stored user-facing string to migrate. The runtime-state concerns are **cache + version + test-gate** coupling.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `analysis_results` rows persist `engine_version` (aggregator.ts:1232) + the full `PredictionResult`. A behavior-preserving wrap does NOT change the schema or values. | None — provided output is unchanged (the D-03 sane-band check guards this). |
| Live service config | None. No external service holds a socials/pack string. | None — verified by grep (no pack/mode registration anywhere outside this milestone's `.planning`). |
| OS-registered state | None. | None. |
| Secrets/env vars | `APIFY_TOKEN` (pipeline.ts:464), Qwen/DashScope creds (qwen/client.ts) — referenced by name in the pipeline that stays put. Code-only, names unchanged. | None. |
| Build artifacts | **`node_modules` is absent in this worktree** (verified). `prediction_cache` rows are keyed `${contentHash}::${ENGINE_VERSION}::${userId}` (prediction-cache.ts:21) — if the refactor accidentally changes output without bumping `ENGINE_VERSION` (3.20.0), stale cache could mask or mix the change. | `npm install` (Wave 0). Keep `ENGINE_VERSION` at `3.20.0`; the smoke test + `audience-regression-gate.test.ts` (asserts `=== "3.20.0"`) guard this. |

**The canonical question:** after the seam is cut, the only runtime system that could "remember" old behavior is the `prediction_cache` (ENGINE_VERSION-keyed). Because the wrap is behavior-preserving and the version is unchanged, cached rows remain valid — *which is correct*. The regression risk is the inverse: a wrap bug that changes output while leaving the version pinned. The D-03 sane-band smoke is the guard.

## Common Pitfalls

### Pitfall 1: Treating the run path as a single function
**What goes wrong:** Planner writes one task "wrap `runPredictionPipeline` in `pack.run`" and misses that scoring is a *separate second call* (`aggregateScores`) at 4 sites.
**Why it happens:** pipeline.ts:856-861 comment says "Stage 9: Aggregate (delegated — caller uses PipelineResult)" — the scoring is intentionally outside the pipeline.
**How to avoid:** Two seam entrypoints (`pack.run` for orchestration, `pack.scoring.run` for the fold) or one combined `pack.predict` that does both. Update **all 4** call sites (route JSON, route SSE, eval-runner, learning/predict).
**Warning sign:** Only `route.ts` is edited; eval-runner/learning still import `aggregateScores` directly → "no socials logic on core" is violated for those entrypoints.

### Pitfall 2: ENGINE_VERSION drift
**What goes wrong:** A wrap subtly reorders a computation; `overall_score` shifts; cache mixes eras silently.
**Why it happens:** `ENGINE_VERSION` is the cache invalidation key AND a blocking-test invariant.
**How to avoid:** Keep `3.20.0`. The seam is behavior-preserving by construction (wrap, don't refactor). `audience-regression-gate.test.ts` + `version.test.ts` must stay green.
**Warning sign:** Either test goes red, or the D-03 smoke `overall_score` falls outside its sane band on a fixed fixture.

### Pitfall 3: The test runner emits fake PASS(0)/FAIL(0)
**What goes wrong:** `npm test` / `npx vitest` report 0 tests passing/failing → a red suite looks green.
**Why it happens:** **`node_modules` is absent** → the `vitest` binary resolves to nothing/stale; the shim no-ops (memory: "Vitest rtk shim").
**How to avoid:** `npm install` first, then run `node ./node_modules/vitest/vitest.mjs run` (CONTEXT discretion note). Do NOT trust `npm test` output.
**Warning sign:** Test output shows `Test Files 0` / `Tests 0`.

### Pitfall 4: Moving files instead of referencing them
**What goes wrong:** Relocating `apollo-core.ts`/`deepseek.ts`/fold into a `packs/socials/` folder explodes the diff and breaks ~20 importers (deepseek.ts, kc/compiled.ts, version.ts docs, tests).
**Why it happens:** "extract Socials into Pack #1" reads like "move the files."
**How to avoid:** The pack *references* existing modules by import (Cut Line A). Extraction = a new `DomainPack` object that points at them, not a filesystem migration.
**Warning sign:** Diff touches >15 files or churns import paths across the engine.

## Code Examples

### Resolving + dispatching the pack at a call site (route.ts JSON branch, after seam)
```typescript
// Source: synthesized from route.ts:787-809 (current two-call) + recommended seam
const pack = resolvePack("socials");                 // P1: always socials (domain axis)
const pipelineResult = await pack.run(validated, {    // = runPredictionPipeline, input_mode-branched inside
  requestId, bypassCache, userId: user.id, audience: activeAudience,
});
const result = await pack.scoring.run(pipelineResult, undefined); // = aggregateScores, wrapped whole (D-06)
```

### The behavior-preserving scoring wrap (Socials pack)
```typescript
// Source: aggregator.ts:520 signature — wrapped verbatim, no refactor (D-07)
import { aggregateScores } from "@/lib/engine/aggregator";
import { APOLLO_SYSTEM_PROMPT } from "@/lib/engine/apollo-core";

export const SOCIALS_PACK_SCORING: DomainPack["scoring"] = {
  systemPrompt: APOLLO_SYSTEM_PROMPT,   // referenced, unchanged (byte-stable cache prefix)
  run: aggregateScores,                 // the entire overall_score virality fold, opaque
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 10× Pass-1 + 10× Pass-2 audience loops | Single `runFold` call (pipeline.ts:769) | Phase 4 Plan 05 | Fold is the sole audience-sim path; the seam wraps `runFold` output via `personaBehavioralAggregate`, not a loop |
| `overall_score` = one Apollo call graded twice | True ensemble `0.5·apollo + 0.5·fold_audience` (aggregator.ts:883) | 2026-06-06 (v3.10.0) | The success criterion to wrap is the ensemble fold, not the old single-source score |
| gemini term in the blend | `behavioral + apollo` two-signal blend (`SCORE_WEIGHTS`, aggregator.ts:78) | v3.3.0 (D-04) | The pack's `scoring` success criterion is the current 2-signal/ensemble math; gemini is provenance-only |

**Deprecated/outdated:** ROADMAP SC#4 + PACK-04 "byte-identical regression lock" — superseded by CONTEXT D-02/D-03 (sane-band smoke replaces the golden-master fixture rig).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-06's "scoring chain as one opaque unit" is satisfied by wrapping `aggregateScores` (Cut Line A) + referencing Apollo/fold as grounding, rather than physically moving Apollo+fold execution into `pack.scoring` (Cut Line B). | The Wrap Boundary | If the founder intended the literal Cut Line B, the planner must instead extract the `deepseek_reasoning` + `wave_3_fold` stages — a much larger diff. **Recommend confirming in discuss/plan before locking.** |
| A2 | The `DomainPack` interface may live in a new `domain-pack.ts` beside `types.ts` (vs inside `types.ts`). | DomainPack 7-Field Map | Pure layout; low risk (explicitly Claude's discretion per D-05). |
| A3 | The D-03 smoke can run with a mocked LLM layer over `factories.ts` fixtures (fast, deterministic) rather than a live (slow, costly) end-to-end run. | Validation Architecture | If the gate must exercise real LLM calls, add a guarded live smoke; but live calls are nondeterministic in *content* (temp:0+seed gives stability, not byte-equality across providers) and cost money — a structural fixture test better matches D-03's "cheap insurance" intent. |
| A4 | A behavior-preserving wrap keeps `ENGINE_VERSION` at `3.20.0`. | Runtime State Inventory / Pitfall 2 | If the wrap legitimately changes output, the version must bump AND the regression-gate test updates — signals the wrap was not behavior-preserving. |

## Open Questions

1. **Cut Line A vs B (the wrap boundary).**
   - What we know: `overall_score`/virality math is in `aggregateScores`; Apollo + fold *execute* in the pipeline.
   - What's unclear: whether D-06 requires Apollo+fold *execution* inside `pack.scoring`, or whether referencing them as grounding/reaction (with the aggregator as the wrapped scorer) suffices.
   - Recommendation: lock **Cut Line A** (reviewable, satisfies PACK-01/02, honors D-07/D-08). Surface explicitly to the planner; cheap to confirm.

2. **One combined `pack.predict(input, opts)` vs two entrypoints (`pack.run` + `pack.scoring.run`).**
   - What we know: all 4 sites do the same two-call sequence; route adds latency timing between them (route.ts:807-810, 1023-1027).
   - What's unclear: whether the route's inter-call timing/logging needs the two calls kept separate.
   - Recommendation: keep two entrypoints (mirrors the current structure, preserves the route's `aggregateMs` timing) — `pack.run` + `pack.scoring.run`. Lowest-friction.

3. **Smoke harness location.**
   - What we know: engine tests live in `src/lib/engine/__tests__/`; `factories.ts` provides fixtures; `audience-regression-gate.test.ts` is the existing blocking-gate pattern to mirror.
   - Recommendation: add `src/lib/engine/__tests__/pack-seam-smoke.test.ts` modeled on `audience-regression-gate.test.ts` (a self-contained BLOCKING anchor).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node_modules` (installed deps) | tsc, vitest, any test run | ✗ | — | **`npm install` — BLOCKING Wave 0 step** |
| `vitest` | D-03 smoke test | ✗ (until install) | ^4.0.18 (in package.json) | none — required |
| `typescript` (`tsc --noEmit`) | structural type gate on `DomainPack` | ✗ (until install) | ^5 | none — required |
| `zod` | `AnalysisInputSchema` | ✗ (until install) | ^4.3.6 | none — required |
| LLM creds (Qwen/DashScope, Apify) | live end-to-end run only | n/a | — | smoke test mocks the LLM layer (A3) → not needed for the gate |

**Missing dependencies with no fallback:**
- `node_modules` — the worktree has none. **Wave 0 MUST run `npm install` before any tsc/vitest task.** This is also the root cause of the "fake PASS(0)" quirk (Pitfall 3).

**Missing dependencies with fallback:**
- Live LLM creds — the D-03 structural smoke runs offline against `factories.ts` fixtures with a mocked Qwen client (cf. how `pipeline.test.ts` / `route.test.ts` `vi.mock` the pipeline).

## Validation Architecture

> `workflow.nyquist_validation: true` (config.json:61) — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` (node env; `include: src/**/*.test.ts`; `exclude: **/_dormant/**`) |
| Quick run command | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/pack-seam-smoke.test.ts` |
| Full suite command | `node ./node_modules/vitest/vitest.mjs run` |

⚠️ **Do NOT use `npm test` / `npx vitest`** — they emit fake PASS(0)/FAIL(0) (Pitfall 3). Always the `node ./node_modules/vitest/vitest.mjs run` form, AFTER `npm install`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PACK-01 | No `aggregateScores`/Apollo socials import on the core path; all 4 sites dispatch via `pack[mode]` | unit (static + structural) | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/pack-seam-smoke.test.ts` | ❌ Wave 0 |
| PACK-02 | `pack.scoring.run` produces a valid `PredictionResult` from a fixture `PipelineResult`; `overall_score ∈ [0,100]`; wrap = `aggregateScores` | unit (fixture → fold) | same | ❌ Wave 0 |
| PACK-03 | `SOCIALS_PACK` satisfies the typed `DomainPack` (all 7 fields present + typed) | type + unit | `tsc --noEmit` + the smoke | ❌ Wave 0 |
| PACK-04 (relaxed, D-03) | Socials run **completes** + schema **structurally valid** + sane-band score (NOT byte-identical) | structural smoke | same | ❌ Wave 0 |
| (guard) | `ENGINE_VERSION === "3.20.0"` unchanged | unit | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/audience-regression-gate.test.ts src/lib/engine/__tests__/version.test.ts` | ✅ exists |

### Sampling Rate
- **Per task commit:** quick smoke + `tsc --noEmit` on touched files.
- **Per wave merge:** `node ./node_modules/vitest/vitest.mjs run src/lib/engine` (engine suite — exercises aggregator, pipeline, version, regression-gate).
- **Phase gate:** full suite green + the new pack-seam smoke green before `/gsd-verify-work`.

### What the D-03 smoke asserts (structural, not byte-identical)
1. A representative `PipelineResult` fixture (from `factories.ts`, video + text variants) fed to `pack.scoring.run` returns without throwing.
2. The returned `PredictionResult` has all required fields present (`overall_score`, `confidence`, `confidence_label`, `behavioral_predictions`, `factors`, `signal_availability`, `engine_version`, `input_mode`, …) — assert the keys, not the values.
3. `overall_score` is a finite number in `[0, 100]` (the sane band).
4. `engine_version === "3.20.0"`.
5. The core path imports no `aggregateScores`/`apollo-core` directly (assert via the dispatch indirection — mirror `explore-runner.test.ts:316`'s "code does not match `/aggregateScores|ENGINE_VERSION/`" regex pattern for the new core dispatcher).

### Wave 0 Gaps
- [ ] `npm install` — **no `node_modules` in worktree** (blocks every test/tsc task).
- [ ] `src/lib/engine/__tests__/pack-seam-smoke.test.ts` — covers PACK-01..04 (model on `audience-regression-gate.test.ts`).
- [ ] Confirm `factories.ts` exposes a `PipelineResult` builder for both video and text/url shapes (it backs 45 existing tests — likely yes; verify the builder covers `foldOutcome`/`personaBehavioralAggregate`).

## Security Domain

> `security_enforcement` is not set in config.json (treated as enabled). This phase is a **pure internal refactor with no new external input surface, no new packages, no new network calls, no schema change.** The existing input boundary (`AnalysisInputSchema`, types.ts:154, zod) is unchanged and untouched.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | unchanged | `AnalysisInputSchema` (zod) at the pipeline boundary — not modified |
| V6 Cryptography | no | none introduced |
| V2/V3/V4 (auth/session/access) | no | route auth (`user.id`) unchanged; no new endpoints |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via tiktok re-host token leak | Information Disclosure | Already mitigated (pipeline.ts:442-464 — token used server-side only, never in the Omni URL). The wrap must NOT relocate or alter this block. |
| Cache poisoning via ENGINE_VERSION mismatch | Tampering | Keep `ENGINE_VERSION` pinned (Pitfall 2); behavior-preserving wrap. |

**No new attack surface is introduced.** The only security-relevant invariant is: do not disturb the existing tiktok re-host token-handling block (pipeline.ts:442-552) when indirecting the fold's grounding references.

## Sources

### Primary (HIGH confidence — live code, this session)
- `src/lib/engine/pipeline.ts` (full read) — run path, input_mode branches, Apollo/fold stages, two-call delegation.
- `src/lib/engine/aggregator.ts` (key sections 40-340, 500-620, 820-920, 1120-1250) — `aggregateScores` signature, `overall_score` virality fold, `SCORE_WEIGHTS`, `PredictionResult` assembly.
- `src/lib/engine/apollo-core.ts`, `deepseek.ts:520-545`, `anti-virality.ts`, `version.ts`, `creator.ts`, `types.ts:154-216,300` — wrap-boundary modules.
- `src/app/api/analyze/route.ts:780-839,1000-1027`, `corpus/eval-runner.ts:120-130`, `learning/predict.ts:65-82` — the 4 call sites.
- `vitest.config.ts`, `__tests__/audience-regression-gate.test.ts`, `__tests__/version.test.ts`, `qwen/client.ts:21-28` — test infra + determinism (temp:0, `QWEN_SEED=7`).
- `.planning/phases/01-engine-pack-seam/01-CONTEXT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `NUMEN-GSI-VISION.md` (§5,§6,§14), `STATE.md`, `config.json`.
- Verified: `node_modules` absent (`ls`); `git worktree list`.

### Secondary / Tertiary
- None — no external research needed (internal refactor; no new packages).

## Metadata

**Confidence breakdown:**
- Seam cut map / call sites: HIGH — every site read at file:line.
- Wrap boundary recommendation: HIGH on the facts, MEDIUM on the A-vs-B interpretation of D-06 (flagged A1 — confirm with planner).
- DomainPack 7-field map: HIGH — each field traced to an existing module.
- Validation/test infra: HIGH — config + existing gate tests read; `node_modules`-absent verified.

**Research date:** 2026-06-26
**Valid until:** stable internal code — ~30 days, or until the engine scoring chain changes (watch `ENGINE_VERSION`).
