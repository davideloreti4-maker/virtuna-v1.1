# Phase 4: Audience-Sim Fold (Brain 2) — THE BET - Research

**Researched:** 2026-06-05
**Domain:** LLM call-folding (20 persona calls → 1 grounded reasoning call) + A/B retention-curve referee
**Confidence:** HIGH (codebase-grounded; the entire fold target + output contracts + referee scaffolding exist in-repo and were read directly)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep **all 10 archetypes** in the folded call's output (`high_engager, saver, lurker, sharer, tough_crowd, purposeful_viewer, niche_deep_buyer, niche_deep_scout, loyalist, cross_niche_curiosity`). Win is 10 calls → 1, not fewer archetypes.
- **D-02 (fallback, A/B-triggered — NOT default):** If the single call provably cannot hold 10 distinct curves, collapse to ~5 cores (`tough_crowd, lurker, high_engager, sharer, loyalist`). Decide by A/B evidence, never upfront.
- **D-03:** Pass bar = **3-metric composite** vs the live 10-pass on the same video: (1) behavioral parity ±5 on `behavioral_score`; (2) diversity preserved — folded avg curve-range ≥ **0.8×** the 10-pass; (3) drop-point agreement within ±1 for ≥6/10 archetypes. "Reproduce" = inside all bands; "beat" = parity + diversity ≥1.0× + tighter/comparable drop points.
- **D-04:** **6 fixed real videos** spanning hook strength + niche (reuse P2 baseline `gwxLeHphZCxK` + the "bestfriend" clip). Referee = a **script** (real API calls, like `measure-pipeline.ts`) reviving `eval-harness.ts` + `eval-runner.ts` — NOT a unit test.
- **D-05:** Bar is **gating but advisory** — numbers guide; user makes the final call. Don't let a brittle threshold block a qualitatively-good fold.
- **D-06:** Mitigate homogenization inside the single call: per-archetype structured output; feed each archetype's byte-stable `persona-registry.ts` definition verbatim + explicit "these MUST diverge" instruction; require relative drop-point ordering grounded in the defs.
- **D-07:** Add a **post-parse diversity check** reusing the A/B curve-range metric (D-03.2) — warn/flag when curves collapse below the floor. Guard + referee share one metric.
- **D-08:** **Bounded thinking** sized **up** vs Pass-2's `thinking_budget: 2000` (10 archetypes in one pass), bounded to avoid the P3 unbounded-CoT timeout. Single call, `temp:0` + `seed`.
- **D-09:** **Build + prove + flip in P4**, gated on the A/B pass. `behavioralSource` seam in `aggregator.ts` is the swap point + one-flag rollback. Keep the 10-pass **dormant-not-deleted**.
- **D-10 (contingency):** If A/B borderline, ship the fold in **shadow** (logged + compared, 10-pass stays production); defer the production flip to P5.

### Claude's Discretion (researched below — NOT user decisions)
1. Folded-call **prompt architecture** + how byte-stable archetype defs become the cached system prefix (mirror `STABLE_PASS2_SYSTEM_PROMPT` / KNOWLEDGE_CORE contract). Confirm DashScope input-cache mechanics.
2. Exact `thinking_budget` / `max_tokens` envelope for the 10-archetype single call.
3. **Lossless mapping** of the folded output onto `HeatmapPayload` + `PersonaBehavioralAggregate` (board + aggregator stay untouched — D-11/D-12).
4. Keyframe + emotion-arc **feeding mechanics** into the single call.

### Deferred Ideas (OUT OF SCOPE — all roadmap-placed in P5/next milestone)
- Audience-aware rewrites (R4), full score rederivation (R5), grounded engagement estimate (R11), board rendering of the heatmap, outcome test-rig beyond a P4 tool, chat surface.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R3 | Audience-Sim (Brain 2): a single grounded call folds the persona calls; knowledge = `persona-registry.ts`; fed verbatim + segments + keyframes + emotion arc; emits per-archetype × per-segment matrix → heatmap + behavioral aggregate | §Architecture Patterns (Pattern 1 fold call), §Output Mapping (lossless onto HeatmapPayload + PersonaBehavioralAggregate), §Code Examples |
| R7 | ~3 LLM calls: video hot path = Omni + Audience-Sim + Apollo. Fold collapses **20** persona calls (Pass 1 ×10 + Pass 2 ×10) → **1** | §Architectural Responsibility Map (the 20→1 count is the headline win), §Common Pitfalls (P1: the fold must reproduce BOTH passes' outputs, not just Pass 2) |
| R10 | Fold proven, not assumed: A/B folded vs current on real videos; must reproduce/beat curve quality before going live | §Validation Architecture (the 3-metric composite referee), §Don't Hand-Roll (the existing eval-harness is the WRONG harness — build a new retention-curve referee) |
</phase_requirements>

## Summary

The current Audience-Sim is **two waves of 10 calls each = 20 calls** (this is the R7 "~24-25 → ~3" headline). **Pass 1** (`wave3.ts`, 10× `qwen3.6-flash`, non-thinking) emits per-persona behavioral intents (`watch_through_pct`, `share_intent`, `comment_intent`, `save_intent`, `rewatch_intent`, `scroll_past_second`) → `aggregatePersonaResults` → **`PersonaBehavioralAggregate`** (the `behavioral_score` driver, 40% of the blend). **Pass 2** (`pass2.ts`, 10× `qwen3.6-plus`, thinking, `thinking_budget:2000`) emits per-persona × per-segment `segment_reactions[]` (`attention` 0-1 + `swipe_predicted`) → `buildWeightedCurve` + `assembleHeatmapPayload` → **`HeatmapPayload`** (the retention heatmap). The fold must collapse BOTH passes into ONE `qwen3.6-plus` call producing BOTH output families, then map losslessly back onto the two existing output shapes so the aggregator and board stay byte-untouched.

The mapping IS lossless and the seam to swap is real: `aggregator.ts:847-862` already has the `behavioralSource: "deepseek" | "personas"` flag (Phase 7 D-14) — but it only switches the **behavioral aggregate**, not the heatmap. The heatmap is built unconditionally from `pass2Outcome.pass2Results`. **Key planning consequence:** the fold's swap point is NOT a single flag today — it requires (a) a new `behavioralSource: "fold"` branch AND (b) building a fold-shaped `Pass2PersonaResult[]` array that `assembleHeatmapPayload` can consume unchanged. Both `aggregatePersonaResults` and `assembleHeatmapPayload`/`buildWeightedCurve` are pure functions over those two array shapes — if the fold emits arrays of the same shape, the aggregator/board are genuinely untouched.

The biggest planning trap is the **referee**: the existing `corpus/eval-harness.ts` + `eval-runner.ts` are a **corpus bucket-classifier benchmark** (macro-F1 over viral/average/under buckets, persisted to `benchmark_results`, driven by `training_corpus` DB rows). They are the WRONG harness for D-03's fold-vs-10-pass retention-curve A/B. Reviving them verbatim does not produce the 3-metric composite. The correct deliverable is a **new** referee script modeled on `measure-pipeline.ts` (which already computes the exact "avg curve range" + per-archetype curve printout D-03.2/D-07 need) that runs BOTH paths on 6 fixed videos and emits the composite.

**Primary recommendation:** Build the fold as a new `wave3/fold.ts` (one `qwen3.6-plus` thinking call, byte-stable system prefix built from `ARCHETYPE_DEFINITIONS`, `max_tokens:8000` / `thinking_budget:4000` starting envelope) that emits a per-archetype object carrying BOTH the behavioral intents AND the per-segment reactions; adapt its output into the existing `PersonaSimulationResult[]` (Pass-1 shape) + `Pass2PersonaResult[]` (Pass-2 shape) arrays so `aggregatePersonaResults` + `assembleHeatmapPayload` run unchanged; wire a `behavioralSource: "fold"` branch in `aggregator.ts`; and build the referee as a standalone script (model on `measure-pipeline.ts`, NOT the corpus harness) that runs both paths on 6 fixed videos with 2 runs each to absorb the R8 noise band.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Folded reasoning call (10 archetypes × N segments in one pass) | Engine `wave3/fold.ts` (new) | DashScope `qwen3.6-plus` | Mirrors `pass2.ts` orchestration; one call replaces 20 |
| Behavioral intents per archetype (`watch_through_pct`, `share/comment/save/rewatch_intent`, `scroll_past_second`) | Folded call output | `aggregatePersonaResults` (unchanged) | Currently Pass 1 (`wave3.ts`); fold must reproduce |
| Per-segment reaction matrix (`attention[]`, `swipe_predicted`) | Folded call output | `buildWeightedCurve` + `assembleHeatmapPayload` (unchanged) | Currently Pass 2 (`pass2.ts`); fold must reproduce |
| Heatmap assembly + weighted curve | `wave3/weighted-aggregator.ts` (untouched) | `aggregator.ts` | Pure over `Pass2PersonaResult[]` — fold feeds same shape |
| Behavioral aggregate build | `wave3/aggregator.ts` (untouched) | — | Pure over `PersonaSimulationResult[]` — fold feeds same shape |
| Source swap (fold vs 10-pass) + rollback | `aggregator.ts` `behavioralSource` flag (extend) + `pipeline.ts` branch | — | D-09 one-flag rollback; needs a new `"fold"` value + heatmap branch |
| Homogenization guard (curve-range floor) | `wave3/fold.ts` post-parse | shares metric w/ referee | D-07 |
| A/B referee (3-metric composite on 6 videos) | New script in `scripts/` (model `measure-pipeline.ts`) | NOT `corpus/eval-harness.ts` | D-04; existing harness is a bucket classifier, wrong shape |

## Standard Stack

This is an **internal engine refactor** — no new external packages. The fold reuses the existing DashScope/Qwen stack already proven in-codebase.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` (SDK) | in-repo | DashScope OpenAI-compatible client (`getQwenClient`) | Already the sole engine LLM client; `maxRetries:0`, baseURL `dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| `zod` | in-repo | Output boundary validation (mirror `Pass2ResponseSchema`) | Every engine call validates with Zod at the parse boundary |
| `qwen3.6-plus` | env `QWEN_REASONING_MODEL` | Reasoning model for the fold (thinking mode + vision) | Already the Pass-2 + Apollo model; accepts `image_url` items (proven in `persona-prompts-pass2.ts:124-129`) |

### Supporting (existing, reused)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@sentry/nextjs` | Error capture per call | Mirror `pass2.ts` Sentry tags |
| `calculateCost` (`qwen/cost.ts`) | Cost telemetry from `response.usage` | Roll fold cost into `wave3CostCents` |
| `dotenv` + `tsconfig-paths` | Script bootstrap | Referee script header (copy `measure-pipeline.ts:14-21`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `wave3/fold.ts` | Extend `pass2.ts` in place | In-place editing risks breaking the dormant 10-pass needed for D-09 rollback + the A/B baseline. Keep both alive side-by-side. |
| One call emitting BOTH families | Two folded calls (1 behavioral + 1 heatmap) | Two calls is 2, not 1 — weaker R7 win and double the prompt-cache prefix. One call is the bet; D-08 thinking budget sized for it. |

**Installation:** None — no new packages. (Slopcheck / Package Legitimacy Audit: N/A, no external installs this phase.)

## Package Legitimacy Audit

**N/A** — this phase installs no external packages. All work is internal engine code reusing the existing DashScope/Qwen/zod/Sentry stack already in `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
                       AnalysisInput (video_upload)
                                 │
                                 ▼
                     pipeline.ts  runPredictionPipeline
                                 │
            ┌────────────────────┼─────────────────────────┐
            ▼                    ▼                          ▼
        Omni (Wave1)       Apollo/deepseek (Wave2)     Wave3 (audience-sim)
   verbatim + segments[]   composite + rewrites              │
   + emotion_arc[]                                           │
   + keyframeUris                          ┌─────────────────┴──────────────────┐
            │                              │  behavioralSource switch (NEW: fold)│
            └──────────────┬───────────────┤                                     │
                           │               ▼                                     ▼
                           │      ┌─── CURRENT (10-pass, dormant after flip) ─┐  FOLD (new)
                           │      │ Pass1 wave3.ts  10× qwen-flash            │  wave3/fold.ts
                           │      │   → PersonaSimulationResult[]             │  ONE qwen-plus
                           │      │   → aggregatePersonaResults               │  thinking call
                           │      │   → PersonaBehavioralAggregate            │     │
                           │      │ Pass2 pass2.ts  10× qwen-plus(thinking)   │     │ emits 10 archetypes,
                           │      │   → Pass2PersonaResult[]                  │     │ each w/ intents
                           │      │   → buildWeightedCurve/assembleHeatmap    │     │ + segment_reactions[]
                           │      └───────────────────────────────────────────┘    │
                           │                                                        ▼
                           │                          fold output → adapt into:
                           │                            • PersonaSimulationResult[]  (Pass-1 shape)
                           │                            • Pass2PersonaResult[]        (Pass-2 shape)
                           │                                                        │
                           └────────────────────────┬───────────────────────────────┘
                                                     ▼
                              aggregator.ts aggregateScores
                              • aggregatePersonaResults → behavioral_score (40%)
                              • assembleHeatmapPayload   → HeatmapPayload
                                                     │
                                                     ▼
                                            PredictionResult  (UNCHANGED shape)
                                                     │
                              ┌──────────────────────┴───────────────────┐
                              ▼                                           ▼
                       board (UNTOUCHED)                       Referee script (D-04)
                                                          runs BOTH paths on 6 videos,
                                                          2 runs each → 3-metric composite
```

### Recommended Project Structure
```
src/lib/engine/wave3/
├── fold.ts                   # NEW — one folded qwen-plus thinking call; orchestrator mirroring pass2.ts
├── fold-prompts.ts           # NEW — STABLE_FOLD_SYSTEM_PROMPT (built from ARCHETYPE_DEFINITIONS) + buildFoldUserContent + FoldResponseSchema
├── pass2.ts                  # KEEP — 10-pass dormant-not-deleted (D-09 baseline + rollback)
├── wave3.ts                  # KEEP — Pass 1 dormant-not-deleted
├── persona-registry.ts       # REUSE — ARCHETYPE_DEFINITIONS feed the cached prefix (byte-stable)
├── aggregator.ts             # UNTOUCHED — aggregatePersonaResults pure over PersonaSimulationResult[]
└── weighted-aggregator.ts    # UNTOUCHED — assembleHeatmapPayload pure over Pass2PersonaResult[]
scripts/
└── ab-fold-referee.ts        # NEW — model on measure-pipeline.ts; runs both paths × 6 videos × 2 runs → composite
```

### Pattern 1: The Folded Call (one thinking call, byte-stable cached prefix)
**What:** A single `qwen3.6-plus` thinking-mode call. System message = byte-stable prefix carrying ALL 10 `ARCHETYPE_DEFINITIONS` + the divergence instruction (D-06). User message = volatile per-video payload (verbatim + segments + emotion arc + keyframe `image_url` items). Output = one JSON object with a `personas[]` array, each entry carrying the archetype's behavioral intents AND its per-segment `segment_reactions[]`.

**When to use:** This phase's core deliverable.

**Cache discipline (mirrors `STABLE_PASS2_SYSTEM_PROMPT` / `APOLLO_SYSTEM_PROMPT`):** DashScope implicit cache is automatic, prefix-matched, ≥256-token threshold, cached tokens billed at **20% of input price**, TTL not guaranteed (periodically cleared) `[CITED: alibabacloud.com/help/en/model-studio/context-cache]`. **The entire 10-archetype definition block is the cache win** — it is identical across every video, so put it (plus the static task/schema instructions) at the very start of the system message and NEVER interpolate `Date.now()`/`Math.random()`/request IDs (the existing D-17 rule). In-codebase, `wave3.ts:171-187` already reads `prompt_cache_hit_tokens`/`prompt_cache_miss_tokens` from `usage` for cache-aware cost — reuse that exact telemetry path. Note: the web doc says the field is `cached_tokens`; the codebase reads `prompt_cache_hit_tokens`/`prompt_cache_miss_tokens` `[VERIFIED: wave3.ts]` — keep the codebase's field names (they are what DashScope actually returns to this account).

**Example (structure, not literal):**
```typescript
// Source: pattern from src/lib/engine/wave3/pass2.ts:159-181 + deepseek.ts:373-393
const callParams = {
  model: QWEN_REASONING_MODEL,              // qwen3.6-plus
  messages: [
    { role: "system", content: STABLE_FOLD_SYSTEM_PROMPT },   // ALL 10 ARCHETYPE_DEFINITIONS — cache prefix
    { role: "user", content: buildFoldUserContent(slots, segments, keyframeUris, verbatim, emotionArc) },
  ],
  response_format: { type: "json_object" },
  temperature: 0,                            // D-08 / R8
  seed: QWEN_SEED,                           // 7
  max_tokens: 8000,                          // D-08 envelope (see Pitfall 3 for sizing)
  enable_thinking: true,
  thinking_budget: 4000,                     // D-08: sized UP from pass2's 2000 (10 archetypes in one pass)
};
```

### Pattern 2: Lossless output adaptation (fold → two existing array shapes)
**What:** The fold emits 10 archetype objects. A pure adapter splits each into (a) a `PersonaSimulationResult` (Pass-1 shape) and (b) a `Pass2PersonaResult` (Pass-2 shape). Feed those arrays to the UNCHANGED `aggregatePersonaResults` + `assembleHeatmapPayload`. This is what makes "board + aggregator untouched" (D-11/D-12) literally true.

**When to use:** Immediately after parsing the fold response, before the aggregator runs.

### Anti-Patterns to Avoid
- **Editing `aggregator.ts`/`weighted-aggregator.ts` math:** The whole D-11/D-12 ethos is that these stay byte-untouched. If you find yourself changing them, you've broken the contract — adapt the fold output to their inputs instead.
- **Reviving `corpus/eval-harness.ts` as the referee:** It's a bucket classifier (macro-F1), not a curve-quality A/B. See Don't Hand-Roll.
- **Putting verbatim/keyframes in the system message:** Volatile per-video data MUST be in the user message or it destroys the cache prefix (D-17).
- **Unbounded thinking:** The P3 CR-03 timeout was fixed twice. Always set `thinking_budget` + `max_tokens` + the abort timer (`pass2.ts:153-154`).
- **Trusting a single run's `behavioral_score` in the A/B:** R8 = noise band. Run each path 2× per video.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heatmap assembly from per-segment attentions | New curve/heatmap builder | `assembleHeatmapPayload` + `buildWeightedCurve` (`weighted-aggregator.ts`) unchanged | Already handles weight normalization over survivors, niche-only sub-curve, vs-niche diff, hook score, top-dropoff. Fold just feeds `Pass2PersonaResult[]`. |
| Behavioral aggregate (top-3-enthusiast weighting) | New aggregation | `aggregatePersonaResults` (`wave3/aggregator.ts`) unchanged | D-06 per-metric rules (completion=mean, share/comment/save=top-3-weighted) already encoded; fold feeds `PersonaSimulationResult[]`. |
| Source swap + rollback | New routing | Extend `behavioralSource` flag in `aggregator.ts:847` (add `"fold"`) | Seam exists (Phase 7 D-14); D-09 one-flag rollback. |
| "avg curve range" diversity metric | New metric | The exact computation in `measure-pipeline.ts:144-160` (`max-min` per persona, averaged) | D-03.2 + D-07 explicitly share this one metric; copy the formula verbatim. |
| Cache-aware cost telemetry | New cost code | `wave3.ts:171-187` cache-hit/miss pricing pattern | Already reads DashScope cache fields. |
| **A/B referee** | **Reviving `corpus/eval-harness.ts`** | **A NEW script modeled on `measure-pipeline.ts`** | The corpus harness computes macro-F1 over viral/average/under buckets on `training_corpus` DB rows + persists to `benchmark_results` — it is a CORPUS CLASSIFIER BENCHMARK, structurally unrelated to a fold-vs-10-pass retention-curve A/B. See Pitfall 2. |

**Key insight:** Two engine modules (`aggregator.ts`, `weighted-aggregator.ts`) are pure functions over two array shapes (`PersonaSimulationResult[]`, `Pass2PersonaResult[]`). The fold's entire job on the output side is to produce those two arrays. Everything downstream is reuse.

## Runtime State Inventory

> Refactor/swap phase — explicit inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None that the fold changes.** Analysis rows persist `heatmap` (JSONB), `persona_behavioral_aggregate`, `persona_simulation_results`, `variants.craft`. The fold emits the SAME shapes, so no migration. New analyses written by the fold are schema-identical. | None — verified by reading `aggregator.ts:1004,1027,1028` (heatmap + aggregate + sim results all retain existing types). |
| Live service config | **None.** No external service stores fold config. The 10-pass model IDs (`QWEN_FAST_MODEL`, `QWEN_REASONING_MODEL`) are env-overridable but unchanged. | None — verified by grep of `qwen/client.ts`. |
| OS-registered state | **None.** No cron/scheduler involved in audience-sim. | None — verified; the only cron (`retrain-ml`) was dormanted in P1 (ROADMAP 01-05). |
| Secrets/env vars | `DASHSCOPE_API_KEY` (unchanged), `PASS2_THINKING_BUDGET` (env override for the dormant pass; the fold should add its own e.g. `FOLD_THINKING_BUDGET`/`FOLD_MAX_TOKENS` env knob mirroring `pass2.ts:44`). No secret renamed. | Add new env knobs for fold tuning (code-only; no secret rotation). |
| Build artifacts | **None.** Pure TS; no compiled/installed artifacts carry archetype state. | None. |

**The canonical question — after every file is updated, what runtime systems still have old state cached/stored/registered?** Answer: only the DashScope implicit prompt cache, which is self-healing (prefix changes simply produce cache misses on first use, then re-warm). The 10-pass stays callable for the A/B + rollback (D-09), so nothing is destructively removed.

## Common Pitfalls

### Pitfall 1: Forgetting the fold must reproduce BOTH passes (the 20→1 trap)
**What goes wrong:** Treating this as "fold the 10 Pass-2 calls" and only emitting `segment_reactions[]`. Then `behavioral_score` (40% of the blend) has no source and the A/B's behavioral-parity metric (D-03.1) is uncomputable.
**Why it happens:** CONTEXT/ROADMAP say "10-archetype Pass-2" prominently, but R7 says "20 persona calls" and the code has TWO 10-call waves. Pass 1 (`wave3.ts`) produces the behavioral intents; Pass 2 (`pass2.ts`) produces the curves.
**How to avoid:** The fold's per-archetype output object MUST carry BOTH the Pass-1 intents (`watch_through_pct`, `share_intent`, `comment_intent`, `save_intent`, `rewatch_intent`, `scroll_past_second`) AND the Pass-2 `segment_reactions[]`. Adapt to both arrays.
**Warning signs:** `behavioral_score` reads as the FALLBACK (0) or is missing in the A/B.

### Pitfall 2: Reviving the wrong harness
**What goes wrong:** Planning tasks to "revive `eval-harness.ts` + `eval-runner.ts`" verbatim, then discovering they classify corpus videos into viral/average/under buckets and compute macro-F1 — not retention curves.
**Why it happens:** CONTEXT names those exact files (good faith — the ROADMAP placeholder said "revive them"). But they were built for a different milestone (Engine Foundation corpus benchmark), read `training_corpus`, persist to `benchmark_results`, and depend on `eval-config.ts` (NICHES, Bucket, NICHE_THRESHOLDS).
**How to avoid:** Build a **new** referee script. The reusable scaffolding to copy is `measure-pipeline.ts` (it already uploads a video, runs the real pipeline, prints "avg curve range" + per-archetype curves + `behavioral_score`). The referee = run that twice (once `behavioralSource: "personas"`/10-pass, once `"fold"`) per video × 6 videos × 2 runs each, then compute the 3-metric composite. The `eval-harness` files can stay dormant.
**Warning signs:** Tasks reference `training_corpus`, `Bucket`, `macro-F1`, or `benchmark_results` for the fold A/B.

### Pitfall 3: Mis-sized thinking budget (timeout vs flat curves)
**What goes wrong:** Too low → 10 archetypes reasoned shallowly → homogenized flat curves (the medium-high risk). Too high → unbounded CoT → 90s timeout (the P3 CR-03 bug, fixed twice).
**Why it happens:** Pass-2 used `thinking_budget:2000` for ONE archetype per call. The fold reasons all 10 in one pass, so it needs more — but `qwen3.6-plus` max output is ~16K tokens; thinking + the 10-archetype JSON must fit.
**How to avoid:** Start at `thinking_budget:4000`, `max_tokens:8000` (2× Pass-2's budget for thinking; output sized for 10 archetypes × N segments — a 10-archetype × ~6-segment matrix with sparse reasons is roughly 2-4K output tokens, leaving headroom). Make BOTH env-overridable (`FOLD_THINKING_BUDGET`, `FOLD_MAX_TOKENS`) exactly like `PASS2_THINKING_BUDGET`. Set `PER_CALL_TIMEOUT_MS` ≥ 90_000 (match `pass2.ts:36`). **Tune empirically via the referee:** the same script that measures curve quality measures latency — raise the budget until avg curve-range stops improving (the documented Pass-2 A/B method: 8000 vs 2000 showed no curve gain, so they cut to 2000). `thinking_budget` defaults to model max CoT if unset `[CITED: alibabacloud.com/help/en/model-studio/deep-thinking]`.
**Warning signs:** `avg curve range` < 0.8× the 10-pass (homogenization) OR `AbortError` timeouts in fold telemetry.

### Pitfall 4: Breaking the cache prefix
**What goes wrong:** Putting verbatim/segments/keyframes in the system message, or interpolating any per-video value into the prefix → every call is a cache miss → cost + latency blow up.
**Why it happens:** Natural to want "all context in the system prompt."
**How to avoid:** System message = ONLY the 10 byte-stable `ARCHETYPE_DEFINITIONS` + static task/schema/divergence instructions. ALL volatile data (verbatim, segments JSON, emotion arc, `image_url` keyframes) goes in the user message, with keyframe `image_url` items first and the text block last (mirror `buildPass2UserContent:124-134`). Verify cache hits via `prompt_cache_hit_tokens` in telemetry.
**Warning signs:** `prompt_cache_hit_tokens` near 0 on the 2nd+ video.

### Pitfall 5: `slot_type` enum mismatch between fold output and heatmap consumer
**What goes wrong:** `assembleHeatmapPayload` maps `"niche_deep"` → `"niche"` (`weighted-aggregator.ts:240`), and `Pass2PersonaResult.slot_type` is `"fyp"|"niche"|"loyalist"|"cross_niche"` while `PersonaSlot.slot_type` is `"fyp"|"niche_deep"|"loyalist"|"cross_niche"`. The fold must emit the right slot_type per archetype or the weight bucketing/vs-niche sub-curve breaks (the documented WR-05 bug).
**How to avoid:** Reuse `selectPersonaSlots(contentType, niche)` to get the canonical 10 slots (with archetype_definition, slot_type, niche already attached) and carry `slot.slot_type` through to the adapted `Pass2PersonaResult`, applying the same `niche_deep → niche` map the existing code does.
**Warning signs:** `vs_niche_diff_pct` null / "normalizeWeights: all-zero input" warning.

## Code Examples

### The "avg curve range" diversity metric (D-03.2 + D-07 — shared)
```typescript
// Source: scripts/measure-pipeline.ts:146-160 (copy verbatim into referee + post-parse guard)
const ranges: number[] = [];
for (const persona of personas) {            // each persona's attentions[]
  const att = persona.attentions ?? [];
  if (!att.length) continue;
  const range = +(Math.max(...att) - Math.min(...att)).toFixed(2);  // per-archetype curve range
  ranges.push(range);
}
const avgRange = ranges.length
  ? +(ranges.reduce((a, b) => a + b, 0) / ranges.length).toFixed(2)  // THE diversity number
  : 0;
// D-03.2 pass: foldAvgRange >= 0.8 * tenPassAvgRange
// D-07 guard:  warn if foldAvgRange < FLOOR (same metric, reused)
```

### Bounded-thinking call (the fold call envelope)
```typescript
// Source: src/lib/engine/wave3/pass2.ts:159-181 + deepseek.ts:373-393
const callParams = {
  model: QWEN_REASONING_MODEL,
  messages: [
    { role: "system" as const, content: STABLE_FOLD_SYSTEM_PROMPT },
    { role: "user" as const, content: buildFoldUserContent(...) as never },
  ],
  response_format: { type: "json_object" as const },
};
// @ts-expect-error DashScope extensions not in OpenAI types
callParams.enable_thinking = true;
// @ts-expect-error
callParams.thinking_budget = FOLD_THINKING_BUDGET;   // default 4000, env-overridable
// @ts-expect-error
callParams.temperature = 0;
// @ts-expect-error
callParams.seed = QWEN_SEED;
// @ts-expect-error
callParams.max_tokens = FOLD_MAX_TOKENS;             // default 8000
const response = await ai.chat.completions.create(callParams as never, { signal: controller.signal });
```

### Lossless output mapping (field-by-field — the heart of D-11/D-12)
The fold's per-archetype output must produce every field both downstream consumers read. Trace:

**For `PersonaBehavioralAggregate` (via `aggregatePersonaResults`, reads `PersonaSimulationResult`):**
| Aggregate field | Source field on each persona | Fold must emit |
|-----------------|------------------------------|----------------|
| `completion_pct` (mean) | `watch_through_pct` | ✅ per-archetype `watch_through_pct` 0-100 |
| `share_pct` (top-3-weighted) | `share_intent` | ✅ `share_intent` 0-100 |
| `comment_pct` | `comment_intent` | ✅ `comment_intent` 0-100 |
| `save_pct` | `save_intent` | ✅ `save_intent` 0-100 |
| `loop_pct` | `rewatch_intent` | ✅ `rewatch_intent` 0-100 |
| (`scroll_past_second`) | `scroll_past_second` | ✅ — also feeds `applyPass1DropFallback` (pass2.ts:73). Fold can skip the fallback since it emits real swipes, but emit it for parity. |

**For `HeatmapPayload` (via `assembleHeatmapPayload`, reads `Pass2PersonaResult`):**
| Heatmap field | Source | Fold must emit |
|---------------|--------|----------------|
| `personas[].id` | `persona_id` | ✅ from `selectPersonaSlots` |
| `personas[].slot_type` | `slot_type` (niche_deep→niche map) | ✅ from slot |
| `personas[].archetype` | `archetype` | ✅ from slot |
| `personas[].attentions[]` | `segment_reactions[].attention` | ✅ per-segment 0-1 |
| `personas[].swipe_predicted_at` | first `segment_reactions[].swipe_predicted=true` t_start | ✅ per-segment boolean |
| `personas[].segment_reasons` | sparse `segment_reactions[].reason` | ✅ inflection-point reasons (≤200 chars) |
| `segments[]`, `weighted_curve`, `weights`, `niche_completion_pct`, `vs_niche_diff_pct`, `weighted_*` | derived by `assembleHeatmapPayload`/`buildWeightedCurve` | ✅ no fold emission needed — derived from attentions + segments |

**Fields the fold canNOT natively produce (FLAGGED):**
- **`keyframe_uri`** — always `null` at assembly time regardless of path (`weighted-aggregator.ts:229`); filled later by the filmstrip job. NOT a fold concern. ✅ no gap.
- **`completion_percentile`/`share_percentile`/etc. labels** — set by `aggregatePersonaResults` via `percentileLabel()`, NOT by the model. ✅ derived, no gap.
- **No gaps found.** Every consumer field is either a direct fold emission or a pure derivation from fold emissions. The mapping is **lossless**, confirming the D-11/D-12 ethos holds.

## State of the Art

| Old Approach | Current (this phase) | When Changed | Impact |
|--------------|----------------------|--------------|--------|
| 20 calls (Pass1 ×10 flash + Pass2 ×10 plus-thinking) | 1 folded `qwen-plus` thinking call | P4 | R7 call-count win; ~20× fewer audience-sim calls |
| Behavioral source `"deepseek" \| "personas"` | + `"fold"` branch | P4 | D-09 swap point |
| `corpus/eval-harness` (bucket F1 benchmark) | new retention-curve A/B referee | P4 | R10 gate; the harness files stay dormant |

**Deprecated/outdated:**
- `corpus/eval-harness.ts` + `eval-runner.ts` for THIS phase's referee — they remain valid for their own (corpus-benchmark) purpose but are the wrong tool here.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `max_tokens:8000` / `thinking_budget:4000` is a safe starting envelope for a 10-archetype × ~6-segment fold | Pitfall 3, Code Examples | If output truncates or times out, tune via the referee (env-overridable knobs make this cheap). Low risk — empirically tunable. |
| A2 | One folded call holds 10 distinct curves well enough to pass D-03.2 (diversity ≥0.8×) | Summary, Pattern 1 | This IS the bet (medium-high homogenization risk per ROADMAP). D-02 fallback to ~5 cores exists. The A/B is precisely what tests this — assumption is intentionally unproven until the referee runs. |
| A3 | DashScope returns `prompt_cache_hit_tokens`/`prompt_cache_miss_tokens` (codebase field names) rather than `cached_tokens` (doc name) to this account | Pattern 1 | Cost telemetry only; the existing `wave3.ts` path already handles both (`hasBreakdown` fallback). Low risk. |
| A4 | `gwxLeHphZCxK` + "bestfriend" clip are available as local video files / re-runnable through `video_upload` mode for the referee | Validation Architecture | If only DB rows (not raw bytes) exist, the referee needs the source mp4s. CONTEXT D-04 says reuse the P2 baseline — confirm the files are on disk. Medium risk — verify before building the script. |

## Open Questions

1. **Where do the 6 fixed referee videos physically live?**
   - What we know: `gwxLeHphZCxK` was the P2 determinism baseline; "bestfriend" clip ran through the live pipeline. `measure-pipeline.ts` takes a local `.mp4` path and uploads it.
   - What's unclear: Are all 6 source mp4s on disk / in the `videos` bucket, re-runnable via `video_upload`? The corpus harness used `text` mode (caption only) because "the corpus does not store raw video bytes" (`eval-runner.ts:111`).
   - Recommendation: First referee task = locate/stage the 6 mp4s (or signed URLs). The A/B is video-mode only (the heatmap requires segments + keyframes); text mode cannot exercise the fold.

2. **Does the fold run in `pipeline.ts` (production hot path) or only the referee in P4?**
   - What we know: D-09 = flip production at END of P4 gated on A/B pass; D-10 = if borderline, shadow-only and defer flip to P5.
   - What's unclear: The default state at P4 merge.
   - Recommendation: Build the fold callable from BOTH the pipeline (behind `behavioralSource: "fold"`, default OFF) and the referee. Plan the production flip as a final, separately-revertable task gated on the A/B result + user sign-off (D-05).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `DASHSCOPE_API_KEY` | Fold call + referee (real API) | Assumed ✓ (used by all engine stages + `measure-pipeline.ts`) | — | None — referee is real-API by design (D-04) |
| `qwen3.6-plus` reasoning model | Fold call | ✓ (already Pass-2 + Apollo model) | `QWEN_REASONING_MODEL` | None |
| Supabase service role (video upload/storage) | Referee video-mode runs | ✓ (`measure-pipeline.ts` uses it) | — | None |
| 6 source video files | Referee A/B | ⚠ UNVERIFIED (see Open Question 1) | — | Stage them before building the script |

**Missing dependencies with no fallback:** None confirmed missing; the 6 video files need verification (Open Question 1).

## Validation Architecture

> This phase IS a validation phase — the A/B referee is the deliverable's proof (R10). `nyquist_validation: true` in config.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing engine test convention) for unit tests; **standalone tsx script** for the real-API referee (D-04 — NOT a unit test) |
| Config file | existing repo vitest config; referee bootstraps via `tsx` + `tsconfig-paths` (copy `measure-pipeline.ts:14-21`) |
| Quick run command | `npx vitest run src/lib/engine/wave3/__tests__/fold*.test.ts` (schema/adapter unit tests) |
| Full suite command | `npx tsx scripts/ab-fold-referee.ts` (real API, 6 videos × 2 paths × 2 runs) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R3 | Fold emits a per-archetype object with intents + segment_reactions; adapter produces valid `PersonaSimulationResult[]` + `Pass2PersonaResult[]`; `assembleHeatmapPayload` builds a non-null heatmap | unit | `npx vitest run src/lib/engine/wave3/__tests__/fold-adapter.test.ts` | ❌ Wave 0 |
| R3 | `FoldResponseSchema` validates the 10-archetype × N-segment shape (attention 0-1, monotonic swipe) | unit | `npx vitest run src/lib/engine/wave3/__tests__/fold-schema.test.ts` | ❌ Wave 0 |
| R7 | Fold path issues exactly 1 audience-sim LLM call (stage-event count) vs 20 for the 10-pass | integration (referee logs call count) | `npx tsx scripts/ab-fold-referee.ts` (asserts 1 call) | ❌ Wave 0 |
| R10.1 | Behavioral parity: \|fold behavioral_score − 10-pass\| ≤ 5 | real-API referee | `npx tsx scripts/ab-fold-referee.ts` | ❌ Wave 0 |
| R10.2 | Diversity: fold avgRange ≥ 0.8 × 10-pass avgRange | real-API referee (shared metric) | same | ❌ Wave 0 |
| R10.3 | Drop-point agreement: fold swipe segment within ±1 for ≥6/10 archetypes | real-API referee | same | ❌ Wave 0 |
| D-07 | Post-parse guard warns when fold avgRange < floor | unit | `npx vitest run src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts` | ❌ Wave 0 |
| R8 | Fold path tolerates provider noise: 2 runs per video, compare within band (not byte-identity) | real-API referee | same (2-run loop) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant `vitest run` for the unit tests touched (schema, adapter, guard) — < 30s, no API.
- **Per wave merge:** full `vitest run` on `wave3/__tests__/fold*` + a single-video referee smoke (1 video × both paths) to catch shape breaks cheaply.
- **Phase gate:** full `npx tsx scripts/ab-fold-referee.ts` (6 videos × 2 paths × 2 runs) GREEN/advisory-pass per the D-03 composite before the production flip; user sign-off per D-05.

### The 3-metric composite (the core sampling instrument — D-03)
For each of 6 videos, run BOTH `behavioralSource: "personas"` (10-pass baseline) and `"fold"`, each **2×** (R8 band). Compute:
1. **Behavioral parity** — `|fold.behavioral_score − tenpass.behavioral_score| ≤ 5` (averaged over the 2 runs to absorb noise).
2. **Diversity** — `fold.avgCurveRange ≥ 0.8 × tenpass.avgCurveRange` (the `measure-pipeline.ts:146-160` metric).
3. **Drop-point agreement** — for each archetype, `|fold.swipe_segment − tenpass.swipe_segment| ≤ 1`; pass if ≥6/10 archetypes agree.
"Reproduce" = all bands met; "beat" = parity + diversity ≥1.0× + tighter/comparable drop points. Output a per-video table + an overall verdict; advisory per D-05.

### Wave 0 Gaps
- [ ] `src/lib/engine/wave3/__tests__/fold-schema.test.ts` — `FoldResponseSchema` cases (R3)
- [ ] `src/lib/engine/wave3/__tests__/fold-adapter.test.ts` — fold→`PersonaSimulationResult[]`+`Pass2PersonaResult[]` lossless mapping (R3)
- [ ] `src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts` — D-07 floor warn
- [ ] `scripts/ab-fold-referee.ts` — the real-API A/B (R7/R10) — model on `measure-pipeline.ts`, NOT `eval-harness.ts`
- [ ] Stage the 6 referee video files (Open Question 1) before the referee task

## Security Domain

> `security_enforcement` is **absent** from `.planning/config.json` (= enabled by default). This phase is **internal engine refactor + an internal eval script** — no new user-facing input surface, no auth/session/access-control change, no new persistence schema. The fold consumes already-validated pipeline data (verbatim/segments from Omni, all Zod-validated upstream).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface |
| V3 Session Management | no | No session change |
| V4 Access Control | no | No new endpoint; referee is a local script |
| V5 Input Validation | yes | `FoldResponseSchema` (zod) at the model-output boundary — mirror `Pass2ResponseSchema`; clamp attention to [0,1], enforce segment-count match (the `pass2.ts:197` guard) |
| V6 Cryptography | no | None |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/oversized model output (10-archetype JSON could be large) | DoS / Tampering | `max_tokens` cap + `thinking_budget` + abort timer (`PER_CALL_TIMEOUT_MS`) + zod validation + segment-count guard |
| Prompt-cache poisoning (irrelevant here — single-tenant prefix) | — | Prefix is static archetype defs; no user data in the cached prefix (D-17) |
| Cost runaway (real-API referee × 6 × 2 × 2 = 24 fold runs + 24 ten-pass) | DoS (self-inflicted) | Reuse `wave3.ts` cost telemetry + a referee-level cost cap log (the corpus harness's `maxTotalCostCents` pattern is the idiom, though the harness itself isn't reused) |

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/lib/engine/wave3/pass2.ts` — 10-call Pass-2 orchestrator, thinking envelope, `applyPass1DropFallback`, telemetry
- `src/lib/engine/wave3.ts` — 10-call Pass-1 orchestrator, behavioral intents, cache-aware cost (lines 171-187)
- `src/lib/engine/wave3/persona-registry.ts` — `ARCHETYPE_DEFINITIONS` (byte-stable), `selectPersonaSlots`, `PersonaSlot`
- `src/lib/engine/wave3/persona-prompts-pass2.ts` — `STABLE_PASS2_SYSTEM_PROMPT`, `buildPass2UserContent` (keyframe image_url + text-last), `Pass2ResponseSchema`
- `src/lib/engine/wave3/persona-prompts.ts` — `PersonaResponseSchema` (Pass-1 intents)
- `src/lib/engine/wave3/aggregator.ts` — `aggregatePersonaResults` (D-06 per-metric weighting, pure)
- `src/lib/engine/wave3/weighted-aggregator.ts` — `buildWeightedCurve` + `assembleHeatmapPayload` (pure; HeatmapPayload assembly)
- `src/lib/engine/aggregator.ts` — `behavioralSource` seam (847-862), heatmap branch (911-931), PredictionResult assembly
- `src/lib/engine/pipeline.ts` — Wave3 + Pass2 invocation + PipelineResult wiring (790-909)
- `src/lib/engine/types.ts` — `HeatmapPayload`, `PersonaBehavioralAggregate`, `BehavioralPredictions`, `PersonaSimulationResult`, `SegmentGrid`, `EmotionArcPoint`
- `src/lib/engine/deepseek.ts` — Apollo bounded-thinking call template (373-393): `max_tokens:3000`, `thinking_budget:3000`, temp0+seed
- `src/lib/engine/qwen/client.ts` — model IDs, `QWEN_SEED=7`, `maxRetries:0`, DashScope endpoint
- `scripts/measure-pipeline.ts` — avg-curve-range metric (146-160), per-archetype curve printout, `behavioral_score` line — the referee scaffolding
- `src/lib/engine/corpus/eval-harness.ts` + `eval-runner.ts` + `eval-config.ts` — confirmed to be a corpus bucket-classifier benchmark (macro-F1, training_corpus, benchmark_results), NOT a curve A/B

### Secondary (MEDIUM confidence)
- DashScope context cache doc — implicit cache: automatic, prefix-match, ≥256 tokens, 20% cached-token price, TTL not guaranteed `[CITED]`
- DashScope deep-thinking doc — `enable_thinking` / `thinking_budget` semantics; budget defaults to model max CoT `[CITED]`

### Tertiary (LOW confidence — cross-checked against codebase, which supersedes)
- WebSearch: `qwen-plus` 129K context / 16K max output; `qwen3.x-plus` accepts image+text reasoning input (codebase already proves vision input to the reasoning model, so this is HIGH in practice)

## Metadata

**Confidence breakdown:**
- Output mapping (lossless onto existing shapes): HIGH — traced field-by-field against the actual pure functions; no gaps found.
- Fold call architecture + cache discipline: HIGH — direct mirror of two proven in-repo patterns (`STABLE_PASS2_SYSTEM_PROMPT`, Apollo call) + confirmed cache mechanics.
- Referee design: HIGH on "the existing harness is wrong + measure-pipeline is the right scaffold"; MEDIUM on the exact composite implementation (new code) and the video-file availability (Open Question 1).
- Thinking-budget envelope: MEDIUM — starting values are reasoned, explicitly env-tunable, and validated empirically by the referee (the same A/B method used for Pass-2's 8000→2000 cut).

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable — internal engine; the only external surface, DashScope cache/thinking semantics, is slow-moving)
