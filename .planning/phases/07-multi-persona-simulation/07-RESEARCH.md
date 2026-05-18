# Phase 7: Multi-Persona Simulation - Research

**Researched:** 2026-05-18
**Domain:** 10× parallel DeepSeek V4 Flash orchestration / persona prompt caching / top-3-enthusiast-weighted aggregation / additive PredictionResult extension / lightweight corpus A/B
**Confidence:** HIGH (CONTEXT decisions are locked; codebase patterns from Phase 3 + Phase 4 are verified; DeepSeek V4 Flash pricing + JSON-mode + auto-cache confirmed via Context7; one tunable risk — Phase 4 already populated `taxonomy.personas` with demographic-archetype slugs that Phase 7 D-02 reframes as 6 stable BEHAVIORAL archetypes — flagged below as the single load-bearing schema migration of this phase)

## Summary

Phase 7 fills the existing Wave 3 no-op stub (`src/lib/engine/wave3.ts`, scaffolded in Phase 3 D-17) with 10 parallel `deepseek-chat`/V4 Flash calls — one per persona — running AFTER Wave 2 (DeepSeek synthesis + trend enrichment) and BEFORE the aggregator. Five coupled artifacts: (1) **10-call parallel orchestration** via `Promise.allSettled` over the same DeepSeek client used in Phase 3/4, with per-call timeout (15s), the existing circuit breaker, and an ≥7/10 success threshold; (2) **persona registry** — 10 stable behavioral archetypes (D-02: 6 FYP behavioral + D-03: 2 niche-deep + 1 loyalist + 1 cross-niche) instantiated per detected niche from a per-niche table that REPLACES Phase 4's demographic-archetype slot list; (3) **cache-friendly persona system prompt** — 4-block stable prefix (archetype definition + scroll-stop triggers + psychographic motivator + time-of-day tag) followed by a volatile per-call user message (video summary + caption + hashtags + creator context + content-type tuning); (4) **per-metric different aggregator** — `completion_pct` = mean of `watch_through_pct` across surviving personas; `share_pct` / `comment_pct` / `save_pct` = top-3-enthusiast-weighted (top-3 personas count 60%, remaining personas split 40%) with explicit handling for surviving-subset arithmetic when fewer than 10 succeed; (5) **purely additive `PredictionResult` extension** — `persona_behavioral_aggregate: BehavioralPredictions | null` + `persona_simulation_results: PersonaSimulationResult[]` + `signal_availability.personas: boolean` — the aggregator's existing read of `deepseek.behavioral_predictions` is UNCHANGED (per CONTEXT D-08; Phase 10 owns the eventual swap).

**The critical load-bearing risk and good news.** Phase 4 D-13 already ADDED a `personas: { archetype: string; weight: number }[]` field to `NICHE_TREE` populated with demographic-style archetype slugs like `"fyp-female-gen-z"`, `"niche-beauty-enthusiast"`, `"loyalist-existing-follower"`. Phase 7 CONTEXT D-01/D-02 explicitly reframes the persona model away from demographic slots toward 6 stable BEHAVIORAL archetypes (high_engager, saver, lurker, sharer, tough_crowd, purposeful_viewer) + 4 specialized (niche_deep_buyer, niche_deep_scout, loyalist, cross_niche_curiosity). The existing taxonomy data is therefore wrong shape for Phase 7's persona registry. Two ways to reconcile: (a) widen `PersonaMix` in `taxonomy.ts` to include per-niche INSTANTIATION fields (demographics + interest-adjacency text) while RENAMING the existing slugs to the behavioral archetype enum — a true edit-in-place migration; or (b) leave `taxonomy.ts` alone and put the per-niche instantiation data in a NEW `src/lib/engine/wave3/persona-registry.ts` module, treating the existing `personas` field as legacy/unused. Recommendation: **option (b)** — additive-only matches the milestone discipline, leaves Phase 4's test suite unmodified, and concentrates Phase 7's surface area inside `wave3/`. The existing `personas` field becomes documented-as-unused (legacy from Phase 4 D-13) until a future phase formally deprecates it. See Open Question #1.

**Primary recommendation.** Ship five surgical decisions: (1) **separate persona registry module** (`src/lib/engine/wave3/persona-registry.ts`) with the 6 stable archetype definitions + per-niche instantiation table — does NOT mutate `taxonomy.ts`; (2) **`Promise.allSettled` over 10 parallel calls** (no `p-limit` — DeepSeek does not enforce per-key concurrency limits and 10 simultaneous requests are well within typical practice [VERIFIED: api-docs.deepseek.com/news/news0802]); (3) **DeepSeek `response_format: { type: "json_object" }` + Zod schema validation + ONE retry on parse failure** — mirror the existing `deepseek.ts:541-547` pattern; (4) **prefix cache discipline = put NICHE_INSTANTIATION block inside the SYSTEM prompt** (byte-stable per `{archetype × niche × time-of-day}` combination) and put VIDEO CONTEXT in the USER message (per-call volatile) — DeepSeek's cache only matches from token-0, so the per-niche profile MUST be in the system prefix to be cached [VERIFIED: api-docs.deepseek.com/news/news0802]; (5) **eval harness extension** — patch `aggregateScores()` via a new optional `behavioralSource: "deepseek" | "personas"` parameter (test-only) so the 225-row Phase 1 corpus A/B (D-14) can swap sources without touching production code.

## User Constraints (from CONTEXT.md)

### Locked Decisions

The Phase 7 CONTEXT.md (`<decisions>` block) locks 20 decisions D-01..D-20 across 6 sub-areas. The researcher honors these verbatim. Key load-bearing decisions:

- **D-01**: The 6 FYP personas are interest-cluster-aware, NOT demographic. TikTok's FYP is a smart routing system — the audience for a video is the interest cluster it gets routed to, NOT a random demographic mix. Per-niche persona instantiation flows from this.
- **D-02**: The 6 FYP personas are 6 stable behavioral archetypes — `high_engager`, `saver`, `lurker`, `sharer`, `tough_crowd`, `purposeful_viewer`. Each instantiated per detected niche. Byte-stable across runs → cache-eligible at ~50× discount.
- **D-03**: The 4 specialized personas — 2 niche-deep (`niche_deep_buyer` + `niche_deep_scout`), 1 loyalist (reads `creatorContext.past_wins` for Card 6 grounding), 1 cross-niche-curiosity (from `taxonomy.ts` adjacent-niche edge).
- **D-04**: Each persona's system prompt embeds 4 cache-friendly blocks — (1) archetype definition, (2) scroll-past + stop triggers, (3) psychographic motivator (one of 6), (4) time-of-day/mood context tag. Stable prefix; cache hit target ~95% post-warmup.
- **D-05**: Per-niche persona instantiation lives extending the `personas` field added in Phase 4 D-13 — but researcher proposes per-niche text. (See Topic #6 + Open Question #1 for the reconciliation against Phase 4's existing slug-based data.)
- **D-06**: Per-metric different aggregation rule. `completion_pct` = mean of `watch_through_pct`. `share_pct` / `comment_pct` / `save_pct` = top-3-enthusiast-weighted (top-3 count 60% of weight, remaining 7 split 40%).
- **D-07**: Each persona returns 5 numeric scores + 1-2 sentence free-text reasoning. ~50-100 output tokens per persona.
- **D-08**: Aggregator integration is purely ADDITIVE. Wave 2 DeepSeek call unchanged; aggregator continues reading `deepseek.behavioral_predictions`. Phase 10 owns the eventual swap.
- **D-09**: Per-persona detail persisted on `PredictionResult` — `persona_simulation_results: PersonaSimulationResult[]` (10 entries; scores + reasoning + archetype label + slot type).
- **D-10**: Locked 7-row allocation table (talking_head 5/2/2/1, b_roll 7/2/0/1, slideshow 6/2/1/1, action 7/2/0/1, tutorial 4/3/2/1, vlog 4/2/3/1, other 6/2/1/1). Mixed-content warning OR null `content_type.type` falls back to `other` row.
- **D-11**: `runWave3()` reads `wave0Result.content_type.type` for allocation routing.
- **D-12**: Creator-stage tuning DEFERRED to Phase 9 (ALGO-05). Phase 7's allocation lever is content-type only.
- **D-13**: Wave 3 success threshold = ≥7 of 10 personas succeed. <7 → null aggregate + `wave_3_below_threshold` warning; aggregator falls back to v2 DeepSeek behavioral.
- **D-14**: Lightweight A/B on 225-row Phase 1 corpus AFTER Phase 7 ships. ~$0.20 cost; two `engine_version` tags persisted.
- **D-15**: `signal_availability.personas: boolean` added.
- **D-16**: Budget = $0.025 per 10-persona stage (SC#6). Cost breakdown shows typical mixed-cache run at $0.001-$0.003.
- **D-17**: Cache prefix discipline — stable prefix (archetype + triggers + motivator + time-of-day + per-niche instantiation) + volatile tail (video summary + caption + hashtags + creator context + content-type tuning).
- **D-18**: Cost telemetry per Wave 3 call. `wave_3_persona_{archetype}` stage_end carries `cost_cents` with cache-hit / cache-miss breakdown.
- **D-19**: `PersonaSimulationResult` interface widening (adds archetype, slot_type, niche, reasoning fields). Matching Zod `PersonaResponseSchema`.
- **D-20**: `PredictionResult` additions are additive only — `persona_behavioral_aggregate`, `persona_simulation_results`, `signal_availability.personas`.

### Claude's Discretion

Per CONTEXT.md `<decisions>` § Claude's Discretion — these remain HOW-to-implement details for researcher and planner:

- Per-niche persona instantiation text (D-05) — researcher proposes during planning, grounded in Phase 1 corpus characteristics. Planner locks.
- Cross-niche curiosity adjacent-niche edges (D-03) — researcher proposes; planner locks.
- Scroll-past + stop triggers per archetype (D-04) — researcher drafts; planner refines.
- Psychographic motivator assignment per archetype × niche (D-04) — planner locks.
- Time-of-day / mood context tag set (D-04) — small fixed set (likely 4 tags); planner locks.
- DeepSeek structured-output Zod schema (D-19) — `PersonaResponseSchema` + retry-once on malformed.
- System prompt + user message builder templates (D-17) — `buildPersonaSystemPrompt()` + `buildPersonaUserMessage()`.
- File organization — likely `src/lib/engine/wave3/persona-registry.ts` + `persona-prompts.ts` + `aggregator.ts`.
- Top-3-enthusiast threshold mechanics (D-06) — per-metric vs composite. Per-metric is cleanest.
- Aggregator over surviving subset (D-13) — proposed: top-3 still = top-3 of survivors; remaining 40% split over `(count - 3)`.
- Per-persona retry policy — one retry on schema-parse failure; no retry on timeout.
- Circuit breaker behavior — Wave 3 inherits existing `deepseek.ts` circuit breaker.
- Test surface — Vitest unit tests for aggregation math, threshold logic, allocation table, schema validation, cache prefix stability.
- Per-niche cache warmup — planner decides if worth the ~$0.20 one-time cost.
- Top-3 tie-break rule — stable sort by `archetype` enum order.

### Deferred Ideas (OUT OF SCOPE)

Per CONTEXT.md `<deferred>` block:

- **Aggregator swap from v2 DeepSeek behavioral → persona aggregate** — Phase 10 owns (with calibration evidence).
- **Creator-stage (Card 3) tuning on top of content-type allocation** — Phase 9 owns (REQUIREMENTS ALGO-05).
- **Per-archetype Platt calibration** — Phase 10 may add if A/B reveals imbalance.
- **M2 audience-viz UI consuming `persona_simulation_results`** — M2 (Intelligence Surface) owns.
- **Self-critique cross-reference against persona reasoning** — Phase 9 Stage 10 owns.
- **Per-persona counterfactuals** — Phase 9 currently scoped to aggregate counterfactuals; per-persona is future milestone.
- **Persona expansion beyond 10** — SC#1 hard-lock at 10; defer until budget + accuracy data justify.
- **Cross-niche persona graph richness (multi-edge adjacency)** — defer until eval data shows current flat adjacency is the bottleneck.
- **Per-niche cache warmup script** — planner-level decision; not phase-mandatory.
- **Synthetic creator profiles for eval** — defer until D-14 A/B reveals loyalist null-fallback signal weakness.
- **Per-content-type tuning table revision (Phase 10)** — locked v3.0-dev table is the starting point; Phase 10 may revise.
- **PROFILE-16 re-prompt micro-card mechanism** — already deferred to Phase 11.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERSONA-01 | 10-persona simulation running in Wave 3 of pipeline (parallel V3 calls) | Topic #1 — `Promise.allSettled` over 10 `deepseek-chat`/V4 Flash calls; existing circuit breaker + retry inherited from `deepseek.ts` |
| PERSONA-02 | 6 FYP non-follower personas | Topic #2 + D-01/D-02 — 6 stable BEHAVIORAL archetypes (high_engager, saver, lurker, sharer, tough_crowd, purposeful_viewer) instantiated per detected niche. Replaces the demographic-mix framing in REQUIREMENTS PERSONA-02 |
| PERSONA-03 | 2 niche-aligned discovery personas | D-03 — `niche_deep_buyer` (actively shopping) + `niche_deep_scout` (knows niche cold, new to creator) |
| PERSONA-04 | 1 returning follower / loyalist persona | D-03 — reads `creatorContext.past_wins` (host-only per PROFILE-16); falls back to generic niche-loyal when null |
| PERSONA-05 | 1 cross-niche curiosity persona | D-03 — from `taxonomy.ts` adjacent-niche edge (researcher proposes edge per primary niche; planner locks) |
| PERSONA-06 | Per-persona output schema (scroll-past second, watch-through %, comment intent, share intent, save intent) | Topic #4 — Zod `PersonaResponseSchema` enforces 5 scores + reasoning string |
| PERSONA-07 | Persona allocation tunable per content type | D-10/D-11 + Topic #3 — locked 7-row allocation table routed via `wave0Result.content_type.type` lookup |
| PERSONA-08 | Persona definitions cached for cost efficiency (DeepSeek input cache + niche variants) | Topic #5 — stable 4-block prefix (archetype + triggers + motivator + time-of-day + per-niche instantiation) + volatile tail; DeepSeek auto-cache; ~50× discount on cache hits |
| PERSONA-09 | `deepseek-chat` (V3) model used for all persona calls; configurable via env | Topic #1 — model env defaults to `deepseek-v4-flash`; introduces NEW `DEEPSEEK_PERSONA_MODEL` env (per Phase 4 precedent — `DEEPSEEK_NICHE_MODEL` is a separate env) |
| PERSONA-10 | Aggregate persona outputs into behavioral signal (replaces single DeepSeek `behavioral_predictions`) | D-08 + Topic #7 — "replaces" reading UPGRADED per CONTEXT D-08 to "made available to replace"; persona aggregate becomes NEW field `persona_behavioral_aggregate`; aggregator unchanged in Phase 7; Phase 10 owns the eventual swap |
| PERSONA-11 | Per-persona drop-off second stored on prediction | D-09 — `persona_simulation_results[].scroll_past_second` persisted on every `PredictionResult` (M2 retention curve substrate) |
| PIPE-08 | Wave 3 stage support (parallel persona simulation after Wave 2) | Phase 3 D-17 already wired the stub; Phase 7 swaps the body |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 10× parallel DeepSeek call orchestration | API / Backend (`src/lib/engine/wave3.ts` body swap) | External Service (DeepSeek V4 Flash) | Wave 3 owns parallelism + `Promise.allSettled` isolation; DeepSeek runs the LLM |
| Persona registry (10 archetypes + per-niche instantiation) | API / Backend (`src/lib/engine/wave3/persona-registry.ts` NEW) | — | Pure TS data + lookup function; Phase 2 D-10 "hardcoded TS module" pattern (mirror of `taxonomy.ts`) |
| Allocation routing (content_type → 10 persona slots) | API / Backend (`src/lib/engine/wave3/persona-registry.ts` `selectPersonaSlots()`) | — | Reads `wave0Result.content_type.type` + the 7-row locked table; emits exactly 10 slots |
| Persona prompt construction (system + user) | API / Backend (`src/lib/engine/wave3/persona-prompts.ts` NEW) | — | Stable prefix + volatile tail per D-17; mirror of `wave0/prompts.ts` pattern |
| Per-persona reaction aggregation (5 metrics → BehavioralPredictions) | API / Backend (`src/lib/engine/wave3/aggregator.ts` NEW) | — | Per-metric different rule per D-06; threshold + surviving-subset math per D-13 |
| Per-persona cost + cache telemetry | API / Backend (`src/lib/engine/wave3.ts` event emission) | External Service (DeepSeek `usage` field) | Each persona's stage_end carries `cost_cents`; uses existing cache-hit / cache-miss breakdown from `deepseek.ts:556-589` |
| `PredictionResult` widening | API / Backend (`src/lib/engine/types.ts`) | Database (`analysis_results` JSON columns — no migration) | Additive fields; existing JSONB-friendly persistence |
| `signal_availability.personas` flag | API / Backend (`aggregator.ts` computes `availability.personas`) | Database (JSONB) | Phase 3 D-07 forward-compat — new key, no migration |
| Lightweight A/B eval substrate | API / Backend (`src/lib/engine/corpus/eval-harness.ts` extension + new `aggregateScores()` opt-in param) | Database (`benchmark_results` row with distinct `engine_version` tag) | Reuses existing harness; adds an in-memory swap of `behavioral_predictions` source |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | 6.22.0 (current); 6.38.0 (latest) [VERIFIED: `npm view openai version` 2026-05-18] | DeepSeek V4 Flash client (OpenAI-compatible) | Already wired in `deepseek.ts:247-252` with `baseURL: "https://api.deepseek.com"`; passes through `prompt_cache_hit_tokens` transparently. No upgrade needed for Phase 7 [VERIFIED: code read] |
| `zod` | 4.3.6 (current); 4.4.3 (latest) [VERIFIED: `npm view zod version` 2026-05-18] | `PersonaResponseSchema` (5 scores + reasoning) + widened `PersonaSimulationResultSchema` | Established at every LLM-output boundary (`deepseek.ts:344-352`, `wave0/niche-detector.ts:109-118`); no upgrade needed |
| `@sentry/nextjs` | 10.39.0 | Error tracking on per-persona call boundaries | Add `Sentry.captureException` in per-call catch path (mirror Phase 4 `niche-detector.ts:187`) |
| `vitest` | 4.0.18 | Unit + integration tests with mocked DeepSeek client | 80% threshold already enforced; mock pattern from `deepseek.test.ts` available [VERIFIED: vitest.config.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | 5.1.6 | (Not needed for Phase 7 — requestId plumbed in pipeline) | n/a |
| `@/lib/logger` (`createLogger`) | local | Per-module logger | `createLogger({ module: "wave3" })`, `createLogger({ module: "wave3.persona-registry" })`, `createLogger({ module: "wave3.aggregator" })` |
| `node:performance` (built-in) | Node 20+ | Per-call latency measurement | `emitStageStart` already uses `performance.now()` — Phase 7 reuses unchanged |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Promise.allSettled` for 10 calls | `Promise.all` (rejects on first failure) | `allSettled` is correct for D-13 ≥7-of-10 threshold logic; Phase 4 already adopts this pattern in `wave0.ts:34` [VERIFIED: code] |
| `Promise.allSettled` for 10 calls | `p-limit` with concurrency 10 | No throttle benefit at 10 — DeepSeek's docs explicitly state "no enforced limits on concurrency" [VERIFIED: api-docs.deepseek.com/news/news0802]; adds zero-value dep |
| `response_format: { type: "json_object" }` | DeepSeek `function calling` | JSON mode is simpler, doesn't require function-schema bookkeeping, and is the existing pattern (`deepseek.ts:544`, `niche-detector.ts:75`) [VERIFIED: api-docs.deepseek.com/news/news0725] |
| Persona registry as `taxonomy.ts` extension | New `src/lib/engine/wave3/persona-registry.ts` module | New module preserves Phase 4 test stability (existing `taxonomy.test.ts` checks the slug shape — changing the shape breaks unrelated tests); registry pattern mirrors Phase 2 D-10 "hardcoded TS module" idiom |
| Single DeepSeek call returning 10 persona reactions | 10 parallel calls | SC#1 hard-locks 10 PARALLEL calls; single-call would lose per-call cache hits (single prompt would have one cache key, no per-archetype reuse across analyses); D-17 specifically requires per-archetype cache discipline |
| Hard-swap aggregator now (literal SC#4 reading) | Additive new field + Phase 10 swap | D-08 explicitly upgrades "replaces" → "made available to replace"; matches milestone-wide additive-only constraint |

**Installation:** No new dependencies required. All capability exists in `package.json`.

**Version verification (executed 2026-05-18):**
- `openai@6.22.0` — current; supports `usage.prompt_cache_hit_tokens` pass-through [VERIFIED via Phase 4 RESEARCH cross-check]
- `zod@4.3.6` — current; supports `z.enum([...] as const)` for the 10-archetype + 4-slot-type discriminated unions
- `@sentry/nextjs@10.39.0` — current; circuit breaker integration unchanged from Phase 1/3
- DeepSeek V4 Flash pricing (verified via Context7 — api-docs.deepseek.com/quick_start/pricing): cache-hit $0.0028/M, cache-miss $0.14/M, output $0.28/M [VERIFIED: 2026-05-18]

## Architecture Patterns

### System Architecture Diagram

```
              POST /api/analyze (Vercel serverless, nodejs runtime)
                                  │
                                  ▼
              ┌──────────────────────────────────────────────────────┐
              │ Phase 3 path: auth, content_hash, L1/L2 cache check  │
              │ Phase 4 path: pre_creator_context → Wave 0 → Wave 1  │
              │ Phase 4 path: Wave 2 (DeepSeek + trends)             │
              └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────────────────────────┐
              │ runWave3(payload, deepseekResult, onEvent)           │
              │   wave0Result + creatorContext also needed:          │
              │   pipeline.ts:511 widens call to pass them through   │
              │   OR Wave 3 receives them via PipelineOptions        │
              │   (planner picks — see Topic #8)                     │
              └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────────────────────────┐
              │ Step 1: selectPersonaSlots(content_type, niche)       │
              │   → looks up 7-row allocation table (D-10)           │
              │   → reads per-niche instantiation from persona-registry│
              │   → returns PersonaSlot[10] — each slot has:         │
              │     { archetype, slot_type, niche, motivator,        │
              │       time_of_day, persona_id }                       │
              └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────────────────────────┐
              │ Step 2: build 10 (system, user) prompt pairs         │
              │   buildPersonaSystemPrompt(slot) → STABLE (cached)    │
              │   buildPersonaUserMessage(payload, deepseek, ...)     │
              │     → VOLATILE (per-request)                          │
              └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────────────────────────┐
              │ Step 3: Promise.allSettled([                          │
              │   callPersona(slot[0], system, user, onEvent),        │
              │   callPersona(slot[1], system, user, onEvent),       │
              │   ...                                                  │
              │   callPersona(slot[9], system, user, onEvent),       │
              │ ])                                                    │
              │  Each callPersona emits its own                       │
              │  wave_3_persona_{archetype}_{slot_type}              │
              │  stage_start + stage_end pair                         │
              │                                                       │
              │  Per-call internals:                                  │
              │    - existing DeepSeek circuit breaker                │
              │    - response_format: json_object                     │
              │    - Zod PersonaResponseSchema validation             │
              │    - ONE retry on schema-parse failure                │
              │    - NO retry on timeout (15s) — other 9 still run    │
              │    - emits cost_cents (cache-aware)                   │
              └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────────────────────────┐
              │ Step 4: aggregatePersonaResults(survivors)            │
              │   if survivors.length < 7:                            │
              │     return {                                          │
              │       aggregate: null,                                │
              │       results: survivors,    // still persisted       │
              │       warning: "wave_3_below_threshold",              │
              │     }                                                 │
              │   else:                                               │
              │     completion_pct = mean(survivor.watch_through_pct) │
              │     for metric in [share, comment, save]:             │
              │       top3 = top-3 by survivor.{metric}_intent        │
              │       remaining = survivors - top3                    │
              │       weighted_mean = 0.60 / 3 × sum(top3)            │
              │                     + 0.40 / len(remaining) × sum(rem)│
              │     percentile labels via existing calibration logic  │
              │     return {                                          │
              │       aggregate: BehavioralPredictions { ... },       │
              │       results: survivors,                              │
              │     }                                                 │
              └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────────────────────────┐
              │ Wave 3 wave_3_personas stage_end (sums per-call cost) │
              └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────────────────────────┐
              │ aggregateScores(pipelineResult)                       │
              │   UNCHANGED in Phase 7:                                │
              │   - still reads deepseek.behavioral_predictions       │
              │   - signal_availability.personas =                     │
              │       (persona_behavioral_aggregate !== null)         │
              │   Phase 7 only adds:                                  │
              │   - persona_behavioral_aggregate on PredictionResult  │
              │   - persona_simulation_results on PredictionResult    │
              └──────────────────────────────────────────────────────┘
                                  │
                                  ▼
              PredictionResult returned; /api/analyze persists row.
```

**Reader trace.** A request enters via POST, traverses the Phase 3 cache path, the Phase 4 Wave 0 path, and the existing Wave 1 + Wave 2 pipeline. After Wave 2 completes, `runWave3` reads `wave0Result.content_type.type` to pick the allocation row from the 7-row table (D-10). Per-niche instantiation comes from the new `persona-registry.ts` module, producing 10 `PersonaSlot` entries. Ten `(system, user)` prompt pairs are built — system prompts are STABLE per `{archetype × niche × time-of-day}` combination (~240 distinct cached prefixes), user messages are VOLATILE per-call. The 10 calls fire in parallel via `Promise.allSettled`; each emits its own per-persona stage event pair. Surviving persona results feed the new aggregator helper, which applies the per-metric different rule: `completion_pct` = flat mean, share/comment/save = top-3-enthusiast-weighted. If <7 survive, the aggregate is null. The Wave 3 result is attached to `PredictionResult` ADDITIVELY — `aggregateScores` continues reading `deepseek.behavioral_predictions` unchanged. Phase 10 owns the eventual swap.

### Recommended Project Structure

```
src/lib/engine/
├── wave3.ts                                # Existing stub — body swapped (~30 → ~120 LOC)
├── wave3/                                  # NEW subfolder (mirrors wave0/ pattern)
│   ├── persona-registry.ts                 # NEW — 10 archetypes + per-niche instantiation + allocation table
│   ├── persona-prompts.ts                  # NEW — buildPersonaSystemPrompt() + buildPersonaUserMessage()
│   └── aggregator.ts                       # NEW — per-metric different rule + threshold + survivor math
├── pipeline.ts                             # Edited — widen runWave3() call site at line 511 (pass wave0Result + creatorContext)
├── types.ts                                # Edited — widen PersonaSimulationResult; add PersonaBehavioralAggregate
│                                           #          add persona_* fields to PredictionResult; add personas to SignalAvailability
├── aggregator.ts                           # Edited — add personas key to signal_availability ONLY (no read-source change per D-08)
├── corpus/
│   └── eval-harness.ts                     # Edited — opt-in flag to swap behavioral_predictions source for D-14 A/B
└── __tests__/
    ├── wave3.test.ts                       # NEW — orchestration + ≥7-of-10 threshold + Promise.allSettled isolation
    ├── wave3-persona-registry.test.ts      # NEW — allocation table (7 content types × correct slot counts) + per-niche lookup
    ├── wave3-persona-prompts.test.ts       # NEW — system prompt byte-stability (cache prefix discipline) + Zod schema validation
    ├── wave3-aggregator.test.ts            # NEW — mean math + top-3-weighted math + threshold edge cases + ties
    ├── stubs.test.ts                       # Existing — backwards-compat for the old `runWave3(payload, null) → []` shape
    └── pipeline.test.ts                    # Existing — extended to assert wave3Result attaches to PredictionResult
```

**File-organization decision (Claude's discretion).** Use the `wave3/` subfolder mirroring Phase 4's `wave0/` pattern. Rationale: Phase 7 introduces ~3 new modules + ~250 LOC of persona data; the subfolder keeps `wave3.ts` as a thin (~120 LOC) orchestrator that's easy to read, while the registry / prompts / aggregator submodules each stay below 300 LOC. Single-file alternative considered and rejected: at ~500 LOC combined, `wave3.ts` becomes hard to test in isolation, and Phase 4 already proved the subfolder pattern (`wave0/content-type-detector.ts` + `wave0/niche-detector.ts` + `wave0/content-type-weights.ts` + `wave0/prompts.ts`).

### Pattern 1: 10× parallel persona calls via `Promise.allSettled`

**What.** Each persona call is an independent DeepSeek V4 Flash invocation with its own (system, user) prompt pair. Wave 3 fires all 10 in parallel via `Promise.allSettled` — fulfilled outcomes feed the aggregator; rejected outcomes are logged + counted toward the ≥7 threshold check. Per-call internals: existing circuit breaker (`deepseek.ts:255-298`), 15s per-call timeout via `AbortController`, ONE retry on schema-parse failure (no retry on timeout — the other 9 are already running). DeepSeek does not enforce per-key concurrency limits at this scale [VERIFIED: api-docs.deepseek.com/news/news0802: "no enforced limits on concurrency or request rates"].

**When to use.** Any Wave that fans out N independent classifier/simulator calls where partial-failure tolerance is required. This is the canonical Phase 7 pattern; future phases that fan out per-platform algo-fit checks (Phase 9 ALGO-01..04) could reuse the same shape.

**Example:**
```typescript
// src/lib/engine/wave3.ts — NEW BODY
import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { createLogger } from "@/lib/logger";
import type {
  ContentPayload,
  DeepSeekReasoning,
  PersonaSimulationResult,
  Wave0Result,
  PersonaBehavioralAggregate,
} from "./types";
import type { CreatorContext } from "./creator";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { selectPersonaSlots, type PersonaSlot } from "./wave3/persona-registry";
import {
  buildPersonaSystemPrompt,
  buildPersonaUserMessage,
  PersonaResponseSchema,
} from "./wave3/persona-prompts";
import { aggregatePersonaResults } from "./wave3/aggregator";
import { isCircuitOpen } from "./deepseek";

const log = createLogger({ module: "wave3" });

// Per CONTEXT D-09 + PERSONA-09: separate env from DEEPSEEK_MODEL (which routes to thinking-mode
// via deepseek-reasoner alias per Phase 4 D-03). DEEPSEEK_PERSONA_MODEL defaults to bare V4 Flash
// (non-thinking) — appropriate for cheap parallel persona reactions.
const DEEPSEEK_PERSONA_MODEL =
  process.env.DEEPSEEK_PERSONA_MODEL ?? "deepseek-v4-flash";

// V4 Flash pricing — verified 2026-05-18 via Context7 api-docs.deepseek.com/quick_start/pricing
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

const PER_CALL_TIMEOUT_MS = 15_000;
const SUCCESS_THRESHOLD = 7; // D-13: ≥7-of-10 to trust aggregate

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}

export interface Wave3Outcome {
  aggregate: PersonaBehavioralAggregate | null;       // null when below threshold
  results: PersonaSimulationResult[];                  // every successful persona persisted (D-09)
  warnings: string[];
}

export async function runWave3(
  payload: ContentPayload,
  deepseekResult: DeepSeekReasoning | null,
  wave0Result: Wave0Result,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave3Outcome> {
  const stageStart = emitStageStart(onEvent, "wave_3_personas", 3);

  // Circuit-breaker fast-path: if DeepSeek's breaker is open, don't fire 10 calls.
  if (isCircuitOpen()) {
    log.warn("Circuit breaker open — skipping Wave 3");
    emitStageEnd(onEvent, "wave_3_personas", 3, stageStart, {
      cost_cents: 0, ok: false, warning: "circuit_breaker_open",
    });
    return { aggregate: null, results: [], warnings: ["wave_3_circuit_breaker_open"] };
  }

  const contentTypeSlug = wave0Result.content_type?.type ?? "other";
  const nicheSlug = wave0Result.niche?.primary ?? null;
  const slots = selectPersonaSlots(contentTypeSlug, nicheSlug);  // exactly 10 slots

  const ai = getClient();

  const callPersona = async (slot: PersonaSlot): Promise<PersonaSimulationResult> => {
    const callStart = emitStageStart(
      onEvent,
      `wave_3_persona_${slot.archetype}_${slot.slot_type}`,
      3,
    );

    const systemPrompt = buildPersonaSystemPrompt(slot);                 // STABLE
    const userMessage = buildPersonaUserMessage(                          // VOLATILE
      payload, deepseekResult, creatorContext, wave0Result, slot,
    );

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= 1) {  // ONE retry on schema-parse failure
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
      try {
        const response = await ai.chat.completions.create(
          {
            model: DEEPSEEK_PERSONA_MODEL,
            messages: [
              { role: "system", content: systemPrompt },   // byte-identical for cache
              { role: "user",   content: userMessage },
            ],
            response_format: { type: "json_object" },
          },
          { signal: controller.signal },
        );
        clearTimeout(timer);

        // Cache-aware cost telemetry (mirrors deepseek.ts:559-589 pattern)
        const usage = response.usage as unknown as {
          prompt_tokens?: number;
          prompt_cache_hit_tokens?: number;
          prompt_cache_miss_tokens?: number;
          completion_tokens?: number;
        } | undefined;
        const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
        const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
        const completion = usage?.completion_tokens ?? 0;
        const hasBreakdown = cacheHit > 0 || cacheMiss > 0;
        const inputCost = hasBreakdown
          ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
          : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE;
        const costCents = (inputCost + completion * OUTPUT_PRICE) * 100;

        const text = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(text);
        const validated = PersonaResponseSchema.safeParse(parsed);
        if (!validated.success) {
          throw new Error(`Persona response validation failed: ${validated.error.message}`);
        }

        const result: PersonaSimulationResult = {
          persona_id: slot.persona_id,
          archetype: slot.archetype,
          slot_type: slot.slot_type,
          niche: slot.niche,
          ...validated.data,
        };

        emitStageEnd(
          onEvent,
          `wave_3_persona_${slot.archetype}_${slot.slot_type}`,
          3,
          callStart,
          { cost_cents: +costCents.toFixed(6), ok: true },
        );
        return result;
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTimeout = lastError.name === "AbortError";
        // No retry on timeout (other 9 are already running).
        // ONE retry only on validation/parse errors.
        if (isTimeout || attempt === 1 || !lastError.message.includes("validation failed")) {
          Sentry.captureException(lastError, {
            tags: { stage: `wave_3_persona`, archetype: slot.archetype, slot_type: slot.slot_type },
          });
          emitStageEnd(
            onEvent,
            `wave_3_persona_${slot.archetype}_${slot.slot_type}`,
            3,
            callStart,
            { cost_cents: 0, ok: false, warning: lastError.message },
          );
          throw lastError;  // surfaces to Promise.allSettled → 'rejected'
        }
        attempt++;
        log.info("Retrying persona call after schema failure", {
          archetype: slot.archetype, slot_type: slot.slot_type,
        });
      }
    }
    // Unreachable — loop exits via return or throw
    throw lastError ?? new Error("Unreachable persona call state");
  };

  const settledResults = await Promise.allSettled(slots.map(callPersona));
  const survivors: PersonaSimulationResult[] = [];
  const warnings: string[] = [];
  let totalCostCents = 0;

  for (let i = 0; i < settledResults.length; i++) {
    const outcome = settledResults[i];
    if (outcome.status === "fulfilled") {
      survivors.push(outcome.value);
    } else {
      const slot = slots[i];
      warnings.push(`Persona ${slot.archetype}/${slot.slot_type} failed: ${outcome.reason?.message ?? outcome.reason}`);
    }
  }

  const { aggregate, warnings: aggregatorWarnings } = aggregatePersonaResults(
    survivors,
    SUCCESS_THRESHOLD,
  );

  warnings.push(...aggregatorWarnings);

  emitStageEnd(onEvent, "wave_3_personas", 3, stageStart, {
    cost_cents: +totalCostCents.toFixed(4),
    ok: aggregate !== null,
    warning: aggregate === null ? "wave_3_below_threshold" : undefined,
  });

  return { aggregate, results: survivors, warnings };
}
```

Source: synthesized from `src/lib/engine/wave0.ts:34-37` (Promise.allSettled pattern), `src/lib/engine/wave0/niche-detector.ts:62-117` (single DeepSeek call + Zod + cost telemetry), `src/lib/engine/deepseek.ts:255-298` (circuit breaker check), and CONTEXT D-13 + D-17.

### Pattern 2: Cache-friendly persona system prompt

**What.** DeepSeek's automatic input cache matches prefixes byte-by-byte starting from token 0; the minimum cacheable unit is 64 tokens [VERIFIED: api-docs.deepseek.com/news/news0802]. To maximize cache hits across the ~240 (`6 archetypes × 10 primary niches × 4 time-of-day tags`) distinct slots that warmup will encounter, the per-niche instantiation profile MUST live in the SYSTEM prompt — NOT the user message. Putting it in the user message breaks cache because user-message content is per-call volatile (video summary, caption, deepseek synthesis text). The system prompt is the only place where byte-stability across analyses is achievable.

**When to use.** Any DeepSeek call where a stable preamble can be split from per-request volatile content. Phase 3 D-12 established the pattern for Wave 2; Phase 7 extends it to per-archetype prompts.

**Example:**
```typescript
// src/lib/engine/wave3/persona-prompts.ts — NEW
import { z } from "zod";
import type {
  ContentPayload,
  DeepSeekReasoning,
  Wave0Result,
} from "../types";
import type { CreatorContext } from "../creator";
import type { PersonaSlot } from "./persona-registry";

// =====================================================
// STABLE system prompt — byte-identical for the same
// (archetype, niche, motivator, time_of_day) tuple
// =====================================================
export function buildPersonaSystemPrompt(slot: PersonaSlot): string {
  // The 4 cache-friendly blocks per D-04:
  //   (1) archetype definition
  //   (2) scroll-past + stop triggers
  //   (3) psychographic motivator
  //   (4) time-of-day / mood context tag
  // Plus the per-niche instantiation profile per D-05.
  // ALL stable per-{archetype × niche × time-of-day} combination.
  // NO per-call dynamic content here.

  return `You are simulating a single TikTok For You Page viewer.

## Your Behavioral Archetype

${slot.archetype_definition.trim()}

## Your Scroll-Past + Stop Triggers

You scroll past when: ${slot.scroll_past_triggers.join("; ")}.
You stop scrolling for: ${slot.stop_triggers.join("; ")}.

## Your Psychographic Motivator

You watch TikTok primarily as a ${slot.motivator}.

## Your Current Context

${slot.time_of_day_label}. ${slot.time_of_day_description}

## Niche Instantiation

You are part of the ${slot.niche_label} cluster on TikTok.

${slot.niche_instantiation.trim()}

## Your Task

You will be shown one video's summary, caption, hashtags, and context. React AS THIS PERSONA — not as a neutral observer. Respond with how YOU specifically would react to scrolling past this on your FYP.

## Output Format

Return a JSON object with this exact shape (NO markdown, NO extra text):

{
  "scroll_past_second": <integer or float 0..video_duration_seconds, the moment you scroll if you do; equals video_duration_seconds if you watch to end>,
  "watch_through_pct": <number 0..100, the percentage of the video you watched>,
  "comment_intent": <number 0..100, percent likelihood you'd leave a comment>,
  "share_intent": <number 0..100, percent likelihood you'd share to a friend or DM>,
  "save_intent": <number 0..100, percent likelihood you'd save it>,
  "reasoning": "<1-2 sentence reaction in your voice — what made you scroll past, stop, or react>"
}

Stay in character. Your reasoning should feel authentic to ${slot.archetype} — not analytical.`;
}

// =====================================================
// VOLATILE user message — per-request dynamic content.
// PROFILE-16 mitigation: past_wins/past_flops URLs are HOST-ONLY.
// =====================================================
export function buildPersonaUserMessage(
  payload: ContentPayload,
  deepseekResult: DeepSeekReasoning | null,
  creatorContext: CreatorContext,
  wave0Result: Wave0Result,
  slot: PersonaSlot,
): string {
  const sections: string[] = ["## Video to React To"];

  // Caption + hashtags (always present)
  sections.push("Caption:");
  sections.push(payload.content_text || "(no caption)");
  sections.push("");
  sections.push(
    `Hashtags: ${payload.hashtags.length > 0 ? payload.hashtags.join(", ") : "(none)"}`,
  );

  // Duration hint (if available)
  if (payload.duration_hint !== null) {
    sections.push(`Duration: ${payload.duration_hint}s`);
  }

  // Content type tuning context (D-11 — the allocator already routed by content_type,
  // but the prompt body itself surfaces the detected type so the persona can react
  // appropriately).
  if (wave0Result.content_type) {
    sections.push(`Content type: ${wave0Result.content_type.type} (confidence ${wave0Result.content_type.confidence.toFixed(2)})`);
  }

  // Wave 2 DeepSeek synthesis (factors + suggestions + warnings)
  // — gives the persona a richer summary of the video content for reaction grounding.
  if (deepseekResult) {
    sections.push("");
    sections.push("## Video Analysis Context (from Wave 2)");
    sections.push(`- Hook effectiveness: ${deepseekResult.component_scores.hook_effectiveness}/10`);
    sections.push(`- Retention strength: ${deepseekResult.component_scores.retention_strength}/10`);
    if (deepseekResult.warnings.length > 0) {
      sections.push(`- Warnings flagged: ${deepseekResult.warnings.join("; ")}`);
    }
  }

  // Loyalist-only: surface creator past wins (D-03 — host-only per PROFILE-16)
  if (slot.slot_type === "loyalist" && creatorContext.past_wins && creatorContext.past_wins.length > 0) {
    const hosts = creatorContext.past_wins
      .map((w) => tryUrlHost(w.url))
      .filter(Boolean)
      .join(", ");
    if (hosts) {
      sections.push("");
      sections.push("## Creator's Past Wins (you are a long-time follower)");
      sections.push(`You have engaged before with content hosted at: ${hosts}.`);
    }
  } else if (slot.slot_type === "loyalist") {
    // D-03 null fallback
    sections.push("");
    sections.push("## Creator Context");
    sections.push(`You are a loyal follower of ${slot.niche_label} creators generally.`);
  }

  sections.push("");
  sections.push("React as your persona. Return ONLY the JSON object.");
  return sections.join("\n");
}

function tryUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

// =====================================================
// Zod schema for per-persona output validation (D-19)
// =====================================================
export const PersonaResponseSchema = z.object({
  scroll_past_second: z.number().min(0),
  watch_through_pct: z.number().min(0).max(100),
  comment_intent: z.number().min(0).max(100),
  share_intent: z.number().min(0).max(100),
  save_intent: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(500),
});
export type PersonaResponse = z.infer<typeof PersonaResponseSchema>;
```

Source: pattern mirrors `src/lib/engine/wave0/prompts.ts:17-46` (NICHE_SYSTEM_PROMPT stable construction) + `src/lib/engine/deepseek.ts:54-123` (STABLE_SYSTEM_PROMPT) + CONTEXT D-04 + D-17.

### Pattern 3: Per-niche persona registry + 7-row allocation table

**What.** A pure-TS lookup module (mirror of `src/lib/niches/taxonomy.ts`) holds: (a) the 10 stable persona archetype DEFINITIONS — text blocks for each of the 6 FYP behavioral archetypes + 4 specialized; (b) the 7-row allocation table indexed by content type; (c) per-niche INSTANTIATION text for each `{archetype × niche}` pair; (d) cross-niche adjacency edges (which adjacent niche the `cross_niche_curiosity` persona comes from per primary niche). `selectPersonaSlots(contentType, nicheSlug)` returns exactly 10 `PersonaSlot` entries.

**When to use.** Hardcoded TS module pattern per Phase 2 D-10 — taxonomy data lives in code, versioned in git, no runtime DB roundtrips. Phase 7 IS the case where this pattern's "in-code module" benefit pays off (cache prefix bytes must be stable across deploys; database-sourced text breaks that).

**Example skeleton:**
```typescript
// src/lib/engine/wave3/persona-registry.ts — NEW
import { NICHE_TREE } from "@/lib/niches/taxonomy";
import type { ContentTypeSlug } from "../types";

// 10-archetype enum (D-02 + D-03)
export const ARCHETYPES = [
  "high_engager", "saver", "lurker", "sharer", "tough_crowd", "purposeful_viewer",  // 6 FYP behavioral
  "niche_deep_buyer", "niche_deep_scout",                                            // 2 niche-deep
  "loyalist",                                                                         // 1 loyalist
  "cross_niche_curiosity",                                                            // 1 cross-niche
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

// 4 slot types per D-03/D-10
export type SlotType = "fyp" | "niche_deep" | "loyalist" | "cross_niche";

// 6 psychographic motivators per D-04
export const MOTIVATORS = [
  "entertainment-seeker",
  "learner",
  "social-validator",
  "escape-seeker",
  "utility-shopper",
  "passive-scroller",
] as const;
export type Motivator = (typeof MOTIVATORS)[number];

// 4 time-of-day tags per D-04 (researcher proposes; planner locks)
export const TIME_OF_DAY_TAGS = [
  { id: "morning_commute",  label: "Morning commute scroller",
    description: "Half-awake, scrolling on the bus or before standing up. Patience for novelty is low; familiar formats win." },
  { id: "lunch_browse",     label: "Lunch-break browser",
    description: "10-15 minutes of focused scrolling between tasks. Patience is moderate; mildly interesting content gets a chance." },
  { id: "post_work_unwind", label: "Post-work unwind",
    description: "Decompressing after work; leans toward escape and entertainment over learning." },
  { id: "late_night_doomscroll", label: "Late-night doomscroll",
    description: "Tired, low-friction scrolling. Tolerance for cognitive load near zero." },
] as const;

// Stable archetype definitions (D-02). Each ~30-80 words.
export const ARCHETYPE_DEFINITIONS: Record<Archetype, string> = {
  high_engager: `You're someone who likes, comments, and follows actively. You're invested in TikTok as a social space — you reply to creators, you tag friends, you screenshot. You watch most videos at least 5-10 seconds before deciding. You over-engage compared to the average user.`,
  saver: `You scroll TikTok with a "this might be useful later" mindset. You bookmark practical content — recipes, fitness tips, productivity hacks. You almost never comment. Your engagement signature is heavily save-weighted; comment intent is ~10% of save intent.`,
  lurker: `You're the silent majority. You watch — often watching all the way through — but you almost never like, never comment, never share. Your watch-through is 60-100% on content you enjoy; your overt engagement is near-zero. You're the "10x silent viewers per active commenter" archetype.`,
  sharer: `You watch with one finger near the share button. When a video resonates — relatable, identity-signaling, "this is so my friend" — you DM it. Your share intent is 2-3× the average; your comment intent is moderate; your save intent is low. You're a primary node of TikTok's social graph.`,
  tough_crowd: `You scroll past in <3 seconds unless the hook lands hard. You represent the ~30% of TikTok FYP that filters aggressively. You have no patience for slow openings, weak audio, or unclear premise. When you DO stop, it's because the first 2 seconds did something genuinely interesting.`,
  purposeful_viewer: `You're on TikTok to learn or accomplish something — find a recipe, check a workout, see if a product is legit. You complete videos that have utility; you skip noise instantly. Your watch-through correlates strongly with whether the video delivered something concrete.`,
  niche_deep_buyer: `You're actively shopping in this niche. You're not casually browsing — you're looking for a specific solution (a workout plan, a skincare routine for your specific issue, a budget tool). Your save intent on RELEVANT content is very high; your standards are high; you ignore decorative content.`,
  niche_deep_scout: `You know this niche cold. You've been following it for years. You're new to THIS creator but you'll recognize cliché takes immediately and you'll appreciate genuine depth. Your bar for originality is high; your watch-through is short if the content is surface-level.`,
  loyalist: `You're a long-time follower of this creator (or creators in their tier within this niche). You watch their content because of the creator, not because the FYP routed you here. You give them more benefit of the doubt; you complete more of their videos; you comment more.`,
  cross_niche_curiosity: `You're from an adjacent niche. You don't usually watch this kind of content but the algorithm pushed it to you because of behavioral overlap. Your baseline watch-through is LOWER than the average; but when you DO stop, it's a strong cross-pollination signal — meaning this content can break out beyond its core audience.`,
};

// Per-archetype scroll-past + stop triggers (D-04). Researcher proposes; planner refines.
export const ARCHETYPE_TRIGGERS: Record<Archetype, { scroll_past: string[]; stop: string[] }> = {
  high_engager: {
    scroll_past: ["content with no opinion or take", "fully impersonal product showcases", "videos without a clear hook"],
    stop:        ["polarizing takes", "creator personality", "engagement-bait questions", "anything that makes me want to reply"],
  },
  saver: {
    scroll_past: ["pure entertainment with no takeaway", "vague advice without specifics", "non-actionable content"],
    stop:        ["step-by-step tutorials", "specific tips with numbers/lists", "useful product information", "content I can apply later"],
  },
  lurker: {
    scroll_past: ["content that demands my engagement", "loud / abrasive hooks", "things I've seen before"],
    stop:        ["calm narration", "satisfying / aesthetic visuals", "long-form storytelling", "anything I can watch passively"],
  },
  sharer: {
    scroll_past: ["niche content I can't relate to or send to anyone", "overly produced ads", "videos that aren't 'about' something specific"],
    stop:        ["relatable moments", "videos that 'remind me of' someone I know", "identity-signaling content", "tag-someone bait"],
  },
  tough_crowd: {
    scroll_past: ["slow openings", "weak audio", "unclear premise", "anything that takes more than 2s to make a point"],
    stop:        ["unusual visual hook", "unexpected first words", "high-energy first frame", "something genuinely novel in the first second"],
  },
  purposeful_viewer: {
    scroll_past: ["entertainment without a point", "decorative content", "things that don't deliver utility"],
    stop:        ["clear value proposition in first 2s", "specific problem-solving content", "tutorials with a payoff"],
  },
  niche_deep_buyer: {
    scroll_past: ["surface-level overviews", "obvious tropes I've seen 100 times", "non-actionable content in my niche"],
    stop:        ["specific solutions to my problem", "advanced techniques", "credible recommendations", "deep specificity"],
  },
  niche_deep_scout: {
    scroll_past: ["beginner content", "generic takes", "content recycled from other niche creators"],
    stop:        ["genuinely original takes", "deep technical content", "things that surprised even me"],
  },
  loyalist: {
    scroll_past: ["content that breaks creator's voice", "off-topic experiments that feel inauthentic"],
    stop:        ["any content by this creator", "anything matching their established style", "their voice + their topic"],
  },
  cross_niche_curiosity: {
    scroll_past: ["content that's TOO inside-baseball for my niche", "completely irrelevant takes"],
    stop:        ["surprising cross-niche relevance", "universal themes", "content that bridges my niche to this one"],
  },
};

// Per-niche persona instantiation table (D-05). Researcher proposes during planning;
// planner locks. Grounded in Phase 1 corpus characteristics + public TikTok demographic data.
// The shape: per-niche, what does each archetype LOOK LIKE in this niche?
//
// Example for fitness × tough_crowd:
//   "You're scrolling looking for someone who can teach you something or push you.
//    You skip past anyone who's just flexing or doing trendy choreography
//    that has nothing to do with actual training."
//
// CRITICAL: This text becomes part of the system prompt PREFIX — byte-stable
// across analyses. Once locked, changing a single character breaks the cache
// for every {archetype × niche × time-of-day} combination using that text.
//
// Researcher fills this table during planning. Initial proposal (~30-50 words per cell,
// 10 archetypes × 10 niches = 100 cells) lives in this module. Planner locks values.
export const NICHE_INSTANTIATION: Record<string, Partial<Record<Archetype, string>>> = {
  // beauty: { ... 10 entries ... },
  // fitness: { ... 10 entries ... },
  // education: { ... },
  // comedy: { ... },
  // lifestyle: { ... },
  // food-cooking: { ... },
  // tech-gadgets: { ... },
  // gaming: { ... },
  // fashion-style: { ... },
  // music-performance: { ... },
};

// Cross-niche adjacency edges (D-03). Researcher proposes; planner locks.
// Example: beauty → wellness/lifestyle; fitness → nutrition/food-cooking; gaming → tech-gadgets.
export const CROSS_NICHE_ADJACENCY: Record<string, string> = {
  beauty: "lifestyle",            // beauty → wellness/lifestyle
  fitness: "food-cooking",        // fitness → nutrition
  education: "tech-gadgets",      // edu → tech tools
  comedy: "lifestyle",            // comedy → day-in-the-life
  lifestyle: "fashion-style",     // lifestyle → fashion
  "food-cooking": "fitness",      // food → fitness
  "tech-gadgets": "gaming",       // tech → gaming
  gaming: "tech-gadgets",         // gaming → tech
  "fashion-style": "beauty",      // fashion → beauty
  "music-performance": "comedy",  // music → comedy/performance
};

// The 7-row LOCKED allocation table (D-10).
// Each row sums to 10. Keys are slot_type counts.
export const ALLOCATION_TABLE: Record<ContentTypeSlug, Record<SlotType, number>> = {
  talking_head: { fyp: 5, niche_deep: 2, loyalist: 2, cross_niche: 1 },
  b_roll:       { fyp: 7, niche_deep: 2, loyalist: 0, cross_niche: 1 },
  slideshow:    { fyp: 6, niche_deep: 2, loyalist: 1, cross_niche: 1 },
  action:       { fyp: 7, niche_deep: 2, loyalist: 0, cross_niche: 1 },
  tutorial:     { fyp: 4, niche_deep: 3, loyalist: 2, cross_niche: 1 },
  vlog:         { fyp: 4, niche_deep: 2, loyalist: 3, cross_niche: 1 },
  other:        { fyp: 6, niche_deep: 2, loyalist: 1, cross_niche: 1 },
};

// FYP archetype rotation order (per row's fyp count, pick this many from the 6)
const FYP_ARCHETYPE_ORDER: Archetype[] = [
  "tough_crowd",     // ~30% of TikTok FYP — always include first
  "lurker",
  "high_engager",
  "saver",
  "sharer",
  "purposeful_viewer",
];

const NICHE_DEEP_ARCHETYPES: Archetype[] = ["niche_deep_buyer", "niche_deep_scout"];

export interface PersonaSlot {
  persona_id: string;                  // e.g., "fyp-tough_crowd-beauty"
  archetype: Archetype;
  slot_type: SlotType;
  niche: string;                       // primary niche slug
  niche_label: string;                  // human-readable label from NICHE_TREE
  archetype_definition: string;        // from ARCHETYPE_DEFINITIONS
  scroll_past_triggers: string[];      // from ARCHETYPE_TRIGGERS
  stop_triggers: string[];             // from ARCHETYPE_TRIGGERS
  motivator: Motivator;                 // assigned per archetype × niche by planner
  time_of_day_label: string;            // from TIME_OF_DAY_TAGS
  time_of_day_description: string;     // from TIME_OF_DAY_TAGS
  niche_instantiation: string;         // from NICHE_INSTANTIATION
}

/**
 * Returns exactly 10 PersonaSlot entries based on content type allocation
 * and per-niche instantiation. Per D-10/D-11: when contentType is null
 * or wave0Result.content_type emits mixed_content_detected, falls back to
 * the `other` row (6/2/1/1).
 *
 * When nicheSlug is null (Wave 0 niche detection failed), all slots
 * use a fallback "general TikTok" instantiation — not ideal but pipeline
 * continues. Eval harness can flag these via signal_availability.niche === false.
 */
export function selectPersonaSlots(
  contentType: ContentTypeSlug | null,
  nicheSlug: string | null,
): PersonaSlot[] {
  const row = ALLOCATION_TABLE[contentType ?? "other"];
  const niche = nicheSlug && NICHE_TREE.find((p) => p.slug === nicheSlug);
  const nicheLabel = niche?.label ?? "general TikTok";
  const resolvedNicheSlug = niche?.slug ?? "general";

  const slots: PersonaSlot[] = [];

  // Build FYP slots (rotation order — first `row.fyp` archetypes from FYP_ARCHETYPE_ORDER)
  for (let i = 0; i < row.fyp; i++) {
    const archetype = FYP_ARCHETYPE_ORDER[i];
    slots.push(makeSlot(archetype, "fyp", resolvedNicheSlug, nicheLabel));
  }

  // Build niche-deep slots
  for (let i = 0; i < row.niche_deep; i++) {
    const archetype = NICHE_DEEP_ARCHETYPES[i];
    slots.push(makeSlot(archetype, "niche_deep", resolvedNicheSlug, nicheLabel));
  }

  // Build loyalist slots
  for (let i = 0; i < row.loyalist; i++) {
    slots.push(makeSlot("loyalist", "loyalist", resolvedNicheSlug, nicheLabel));
  }

  // Build cross-niche slot(s) — use adjacent-niche label
  if (row.cross_niche > 0) {
    const adjSlug = CROSS_NICHE_ADJACENCY[resolvedNicheSlug] ?? "lifestyle";
    const adjLabel = NICHE_TREE.find((p) => p.slug === adjSlug)?.label ?? "Lifestyle";
    for (let i = 0; i < row.cross_niche; i++) {
      // Persona is FROM the adjacent niche, REACTING to a video in resolvedNicheSlug
      slots.push(makeSlot("cross_niche_curiosity", "cross_niche", adjSlug, `${adjLabel} viewer reacting to ${nicheLabel}`));
    }
  }

  if (slots.length !== 10) {
    throw new Error(`Persona allocation mismatch: expected 10, got ${slots.length} for content_type=${contentType}`);
  }
  return slots;
}

// (helper) — build a PersonaSlot with lookups; planner picks motivator + time-of-day assignment logic.
function makeSlot(
  archetype: Archetype,
  slot_type: SlotType,
  nicheSlug: string,
  nicheLabel: string,
): PersonaSlot {
  // Time-of-day tag: rotate by archetype index — keeps cache combinatorics bounded.
  // Planner may swap for a fixed-mapping approach. Either way, must be DETERMINISTIC
  // (same archetype × niche always picks same tag, so cache stays warm).
  const todIndex = ARCHETYPES.indexOf(archetype) % TIME_OF_DAY_TAGS.length;
  const tod = TIME_OF_DAY_TAGS[todIndex];
  // Motivator: assigned per archetype (researcher proposes; planner locks).
  const motivator = motivatorForArchetype(archetype);
  // Niche instantiation: lookup; null fallback uses a generic text.
  const niche_instantiation = NICHE_INSTANTIATION[nicheSlug]?.[archetype]
    ?? `You're part of the ${nicheLabel} viewing audience on TikTok.`;
  return {
    persona_id: `${slot_type}-${archetype}-${nicheSlug}`,
    archetype,
    slot_type,
    niche: nicheSlug,
    niche_label: nicheLabel,
    archetype_definition: ARCHETYPE_DEFINITIONS[archetype],
    scroll_past_triggers: ARCHETYPE_TRIGGERS[archetype].scroll_past,
    stop_triggers: ARCHETYPE_TRIGGERS[archetype].stop,
    motivator,
    time_of_day_label: tod.label,
    time_of_day_description: tod.description,
    niche_instantiation,
  };
}

function motivatorForArchetype(archetype: Archetype): Motivator {
  // Researcher proposal — planner refines:
  switch (archetype) {
    case "high_engager":           return "social-validator";
    case "saver":                   return "utility-shopper";
    case "lurker":                  return "passive-scroller";
    case "sharer":                  return "social-validator";
    case "tough_crowd":             return "entertainment-seeker";
    case "purposeful_viewer":       return "learner";
    case "niche_deep_buyer":        return "utility-shopper";
    case "niche_deep_scout":        return "learner";
    case "loyalist":                return "entertainment-seeker";
    case "cross_niche_curiosity":   return "entertainment-seeker";
  }
}
```

Source: skeleton synthesized from CONTEXT D-02..D-05 + D-10 + D-11; per-niche instantiation table to be filled by researcher proposal during planning (initial values fall on planner — see Open Questions).

### Pattern 4: Per-metric different aggregation with surviving-subset math

**What.** D-06 specifies that `completion_pct` averages flat across personas, while `share_pct` / `comment_pct` / `save_pct` use top-3-enthusiast weighting (top-3 personas count 60% of the weight, ~20% each; remaining 7 split 40%, ~5.7% each). When fewer than 10 personas succeed (but ≥7), the math degrades cleanly: top-3 remains top-3 of survivors; remaining weight is split over `(count - 3)`. Tie-breaks via stable sort by archetype enum order.

**When to use.** Any aggregation where the population distribution is bimodal (few enthusiasts + many lukewarm reactors) rather than normal. Specifically captures TikTok virality dynamics where a few personas REALLY want to share + most don't.

**Example:**
```typescript
// src/lib/engine/wave3/aggregator.ts — NEW
import { ARCHETYPES, type Archetype } from "./persona-registry";
import type {
  PersonaSimulationResult,
  PersonaBehavioralAggregate,
  BehavioralPredictions,
} from "../types";

const TOP_N = 3;
const TOP_WEIGHT_TOTAL = 0.60;  // 60% of weight goes to top-N enthusiasts
const REMAINING_WEIGHT_TOTAL = 0.40;

export interface AggregationResult {
  aggregate: PersonaBehavioralAggregate | null;
  warnings: string[];
}

export function aggregatePersonaResults(
  survivors: PersonaSimulationResult[],
  successThreshold: number = 7,
): AggregationResult {
  if (survivors.length < successThreshold) {
    return {
      aggregate: null,
      warnings: [`wave_3_below_threshold (${survivors.length}/${successThreshold})`],
    };
  }

  const n = survivors.length;
  const completion_pct = mean(survivors.map((s) => s.watch_through_pct));
  const share_pct = topNWeighted(survivors, "share_intent");
  const comment_pct = topNWeighted(survivors, "comment_intent");
  const save_pct = topNWeighted(survivors, "save_intent");

  // Percentile labels — reuse existing calibration-baseline percentile mapping
  // (planner picks the exact wiring; one option is to delegate to a helper that
  // already exists in calibration.ts or eval-config.ts; another option is to
  // recompute the percentile bands from FALLBACK_DEEPSEEK_CALIBRATION in
  // deepseek.ts:227-239).
  const aggregate: PersonaBehavioralAggregate = {
    completion_pct,
    completion_percentile: percentileLabel("completion", completion_pct),
    share_pct,
    share_percentile:      percentileLabel("share",      share_pct),
    comment_pct,
    comment_percentile:    percentileLabel("comment",    comment_pct),
    save_pct,
    save_percentile:       percentileLabel("save",       save_pct),
  };

  return { aggregate, warnings: [] };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function topNWeighted(
  survivors: PersonaSimulationResult[],
  metric: "share_intent" | "comment_intent" | "save_intent",
): number {
  const n = survivors.length;
  if (n === 0) return 0;

  // Stable sort by metric DESC; tie-break by archetype enum order ASC (D-discretion).
  const sorted = [...survivors].sort((a, b) => {
    const diff = b[metric] - a[metric];
    if (diff !== 0) return diff;
    // tie-break: archetype enum order (deterministic)
    return ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype);
  });

  const topN = Math.min(TOP_N, n);
  const top = sorted.slice(0, topN);
  const remaining = sorted.slice(topN);

  const topMean = mean(top.map((s) => s[metric]));
  const remainingMean = remaining.length > 0 ? mean(remaining.map((s) => s[metric])) : 0;

  // Weighted blend: 60% from top-3 mean, 40% from remaining mean (when both present).
  // When n < TOP_N + 1 (fewer than 4 survivors), gracefully degrade to flat mean —
  // but this should never happen because successThreshold defaults to 7.
  if (remaining.length === 0) return topMean;
  return TOP_WEIGHT_TOTAL * topMean + REMAINING_WEIGHT_TOTAL * remainingMean;
}

function percentileLabel(_metric: string, _value: number): string {
  // Placeholder — planner wires to existing calibration-baseline.json percentile bands
  // (deepseek.ts:227-239 has the FALLBACK_DEEPSEEK_CALIBRATION shape).
  return "top 50%";
}
```

Source: synthesized from CONTEXT D-06 + D-13 + claude-discretion note on surviving-subset math. Edge-case behaviors (tie-breaking, n < TOP_N) are explicit per planner discretion notes.

### Anti-Patterns to Avoid

- **Putting `niche_instantiation` in the user message** — breaks cache prefix; every analysis with a different niche would invalidate, dropping cache hit rate to near-zero. D-17 explicitly requires it in the stable prefix.
- **Using `Date.now()` for per-call latency** — `performance.now()` is already what `emitStageStart/emitStageEnd` use. Mix the two and you get drift.
- **Computing aggregator math inside `wave3.ts` orchestrator** — keeps testing harder. Use the separate `wave3/aggregator.ts` helper module; orchestrator only does parallel-call + threshold check.
- **Retrying on AbortError (timeout)** — the other 9 personas are already running; retrying a single slow persona delays the whole wave. Per claude-discretion: NO retry on timeout, ONE retry on schema-parse failure only.
- **Mutating `aggregator.ts` `SCORE_WEIGHTS` or `selectWeights()` math** — Phase 7 is purely additive per D-08. Only the `signal_availability.personas` boolean is added.
- **Mutating `taxonomy.ts` to delete the Phase-4 `personas` field** — breaks Phase 4 tests + unrelated phases. Add the persona registry as a NEW module; treat the existing field as legacy until a future phase formally deprecates it.
- **Running 11+ parallel calls** — SC#1 hard-locks at exactly 10. Allocation table sums must always equal 10 (assert in test).
- **Using `Promise.all` instead of `Promise.allSettled`** — `all` rejects on first failure, violating D-13's "≥7 of 10 succeed" graceful-degradation contract.
- **Reading `creatorContext.past_wins` URL bodies in persona prompts** — violates PROFILE-16 prompt-injection mitigation. Only host names (via `URL(u).host`) may surface.
- **Hard-swapping `aggregator.ts`'s `deepseek.behavioral_predictions` read to `persona_behavioral_aggregate`** — explicitly forbidden by D-08. The A/B eval (D-14) is the test-only swap; production aggregator is unchanged.
- **Mutating shared persona registry data in-place** — `selectPersonaSlots()` MUST return new objects; the cache-friendly system prompt depends on the registry data being readable but immutable for byte-stability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 10-call parallel orchestration with partial-failure tolerance | Custom Promise scheduler | `Promise.allSettled` (native) | Native, well-understood, matches Phase 4's `wave0.ts:34` pattern; supports threshold-based survivor logic without extra machinery |
| Concurrency limiter for 10 calls | `p-limit` with concurrency 10 | (none — just fire all 10) | DeepSeek docs: "no enforced limits on concurrency" [VERIFIED: api-docs.deepseek.com/news/news0802]; adding p-limit is a zero-value dep |
| Per-persona retry policy | Custom retry-wrapper | Inline ONE retry on schema-fail; no retry on timeout | Mirrors `deepseek.ts:623-635`; minimal complexity; matches CONTEXT claude-discretion |
| Circuit breaker | Per-persona breaker | Existing module-level breaker in `deepseek.ts` | Already battle-tested (Phase 1 HARD-03/HARD-04); shared breaker handles "DeepSeek is fully down" cleanly |
| Cost calculation | Custom token-cost math | Existing `usage.prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` + the cache-aware constants from `deepseek.ts:41-42` (or duplicated in wave3.ts with same values) | Cache-aware accuracy + matches Phase 3 D-12 telemetry pattern |
| Persona prompt cache verification | New persona-specific cache layer | Existing DeepSeek auto-cache + `usage.prompt_cache_hit_tokens` telemetry | DeepSeek's cache IS the cache; minimum 64-token storage unit is well below ~3000-token persona prompts [VERIFIED: api-docs.deepseek.com/news/news0802]; no additional layer needed |
| Zod schema for persona output | Hand-rolled `typeof` checks | `PersonaResponseSchema` (mirror of `Wave0NicheResultSchema:291-301`) | Catches structural errors at LLM boundary; supports retry-on-schema-fail |
| Top-3 sort with deterministic tie-break | `Array.sort` callback that ignores ties | Sort by metric DESC then by archetype enum order ASC | Deterministic across runs; testable; matches CONTEXT discretion |
| Percentile label assignment | Per-persona percentile lookup | Use existing `FALLBACK_DEEPSEEK_CALIBRATION` shape from `deepseek.ts:227-239` for the aggregate-level labels | Aggregate is the persona-population-level prediction; percentiles already calibrated for population-level behavioral predictions |
| Adjacent-niche graph | New `adjacency.json` data file | Inline `CROSS_NICHE_ADJACENCY: Record<string, string>` map | 10 entries; flat structure is sufficient until eval data justifies richer multi-edge graph (deferred per CONTEXT) |

**Key insight.** Phase 7's complexity is concentrated in the persona-content registry (~250 LOC of structured data + per-niche instantiation text). The orchestration code is small (~120 LOC of Wave 3 body) because everything around it — DeepSeek client, circuit breaker, Zod validation, event emission, cache telemetry — is already battle-tested by Phase 1/3/4. If a plan step says "build a custom X for Wave 3," it's almost certainly hand-rolling something Phase 4 already proved out.

## Runtime State Inventory

Phase 7 is NOT a rename/refactor/migration phase. It adds capabilities via additive type extensions and new files. No prior runtime state needs migration. (Optional warmup script for DeepSeek's auto-cache is planner-level discretion.)

## Common Pitfalls

### Pitfall 1: Cache prefix invalidated by accidentally putting niche_instantiation in user message

**What goes wrong.** The natural authoring instinct is to think of the per-niche text as "user-specific context" and put it in the user message. Doing so means every analysis (different video → different user message) breaks the cache prefix. Cache hit rate drops to near-zero. D-16 cost budget violated.

**Why it happens.** DeepSeek's cache matches PREFIX bytes from token-0; cache prefix is `system message + (start of user message)`. The 64-token minimum cacheable unit means only the system message reliably caches.

**How to avoid.** Per-niche instantiation MUST live in the system prompt block. Phase 7's persona registry produces the system prompt template; planner enforces via a unit test that asserts byte-stability across two calls with the same archetype × niche × time-of-day.

**Warning signs.** `prompt_cache_hit_tokens` stays at 0 for second+ analyses with the same persona slot.

### Pitfall 2: `selectPersonaSlots()` returns ≠ 10 slots

**What goes wrong.** Allocation table row sums to ≠ 10 (typo); SC#1 violated; `Promise.allSettled` array length unexpected; aggregator math breaks.

**Why it happens.** Manual table maintenance; copy-paste error.

**How to avoid.** Unit test that asserts `selectPersonaSlots(contentType, niche).length === 10` for ALL 7 content types AND for null content_type. Plus an assertion inside `selectPersonaSlots` itself (throw on mismatch — see Pattern 3 example).

**Warning signs.** "Persona allocation mismatch" assertion in production; Wave 3 throws synchronously.

### Pitfall 3: Loyalist persona with `creatorContext.past_wins = null` fires unsafe prompt

**What goes wrong.** Without past_wins data, the loyalist's system prompt has a placeholder like "you are a long-time follower of {creator}" but the user message has no concrete grounding. Per D-03, the null fallback should swap to "loyal follower of [niche] creators generally" — but if the prompt builder forgets to handle null, the persona reacts as if it has data it doesn't have. Eval signal becomes noisy.

**Why it happens.** D-03's null-fallback is a behavioral spec, not a hard requirement that gets enforced anywhere; easy to miss in implementation.

**How to avoid.** `buildPersonaUserMessage()` must check `slot.slot_type === "loyalist"` AND `creatorContext.past_wins !== null && .length > 0` BEFORE adding the past-wins context block. Else, fall back to generic niche-loyal framing per D-03. Unit test covers both branches.

**Warning signs.** Loyalist persona reasoning sounds generic/floating in eval debugging; high variance in loyalist's watch_through_pct.

### Pitfall 4: Top-3 enthusiast weighting with fewer than 4 survivors degenerates to flat mean

**What goes wrong.** When only 3 or fewer survivors exist (impossible above threshold = 7, but defensive coding) and you compute `topMean * 0.60 + remainingMean * 0.40` with `remainingMean = 0`, you get `topMean * 0.60`, which is silently lower than `topMean` — wrong shape.

**Why it happens.** Naive blend math doesn't handle the empty-remaining case.

**How to avoid.** When `remaining.length === 0`, return `topMean` directly. Unit test covers the n=0, n=1, n=3, n=7 cases.

**Warning signs.** Aggregator returns visibly-too-low share/comment/save percentages when corpus has aggressive persona failures.

### Pitfall 5: Persona response missing reasoning field (LLM omits when token budget tight)

**What goes wrong.** DeepSeek occasionally omits optional-looking fields when its output is near the token budget. Zod strict-parse rejects → entire persona call counts as failed → threshold drops.

**Why it happens.** JSON-mode LLMs are reliable on structure but can compress.

**How to avoid.** Make `reasoning` schema `z.string().min(1)` (required, non-empty) AND retry once on validation failure with an explicit "reasoning field was missing/empty in your previous response — please include it" prepended user message (mirror of `deepseek.ts:531-532` retry pattern).

**Warning signs.** Specific archetypes (often `tough_crowd` or `lurker` — those with naturally-short reactions) fail schema validation disproportionately.

### Pitfall 6: Wave 3 fires before Wave 0 niche detection completes

**What goes wrong.** `selectPersonaSlots()` reads `wave0Result.niche?.primary`. If Wave 0 niche-detector failed (returns null), persona registry falls back to "general TikTok" instantiation, which is materially worse signal quality. Pipeline events may also race.

**Why it happens.** Pipeline orchestration assumes Wave 0 completes before Wave 3, but if Wave 0 fails gracefully (returns null), Wave 3 silently proceeds with degraded inputs.

**How to avoid.** This is correct pipeline behavior — Wave 0 is non-blocking; null is the failure signal. Wave 3 SHOULD continue with fallback. Document explicitly in `selectPersonaSlots()` JSDoc that `nicheSlug = null` triggers fallback. Emit a `signal_availability.niche = false` to surface this downstream.

**Warning signs.** Corpus eval shows higher variance in persona aggregate when niche detection fails (~10% of cases per Phase 4 D-05 threshold).

### Pitfall 7: Phase 4 taxonomy.ts `personas` field shape conflict (load-bearing)

**What goes wrong.** Phase 4 D-13 already added `personas: { archetype: string; weight: number }[]` to `NICHE_TREE` with demographic slugs like `"fyp-female-gen-z"`, `"niche-beauty-enthusiast"`, `"loyalist-existing-follower"` — and a test (`taxonomy.test.ts`) asserts these slugs and that weights sum to 10. Phase 7 D-02 reframes the persona model to 6 stable BEHAVIORAL archetypes — the demographic slugs no longer match. If Phase 7 modifies `taxonomy.ts` `personas` field in-place, it breaks the Phase 4 test (asserting `archetype: "fyp-female-gen-z"`).

**Why it happens.** The two phases were planned with different persona models — Phase 4 used the original demographic frame (PROJECT.md PERSONA-02), Phase 7 reframed to behavioral archetypes after user discussion (D-01).

**How to avoid.** Phase 7 introduces a NEW persona registry (`src/lib/engine/wave3/persona-registry.ts`) and does NOT touch `taxonomy.ts`'s `personas` field. The Phase 4 field becomes documented-as-unused. The taxonomy.test.ts continues to pass unchanged. Eventually a future phase may formally deprecate the Phase 4 `personas` field — but that's not Phase 7's job. (Alternative considered: rewrite Phase 4's `personas` shape and update its test. Rejected for additive-only milestone discipline + concern about destabilizing already-completed Phase 4 work.)

**Warning signs.** Plan step says "modify taxonomy.ts personas field" or "update taxonomy.test.ts" — STOP and confirm.

### Pitfall 8: Persona prompt cache cardinality blows past DeepSeek's eviction window

**What goes wrong.** DeepSeek's cache "is typically cleared within a few hours to days" [VERIFIED: api-docs.deepseek.com/news/news0802]. With ~240 distinct `(archetype × niche × time-of-day)` prefixes and modest traffic, common prefixes may evict before they're hit again. Cost stays under budget but cache hit rate is lower than predicted.

**Why it happens.** Eviction is based on usage, not on total cardinality — but low-traffic prefixes are evicted faster.

**How to avoid.** Defer pure performance-optimization decisions to production observability. Optional one-time warmup script (Claude's discretion — ~$0.20 cost) exercises common combos to seed the cache. Planner decides whether to ship the warmup or wait for production data.

**Warning signs.** First analysis of the day has lower-than-expected cache hits; second analysis hits hot.

### Pitfall 9: Aggregator's signal_availability.personas read happens AFTER Wave 3 in pipeline

**What goes wrong.** `aggregator.ts:330-349` computes `availability` from `pipelineResult` fields. To set `availability.personas`, the aggregator needs to know if `persona_behavioral_aggregate !== null`. This requires Wave 3 to surface the aggregate to the pipeline result BEFORE `aggregateScores()` reads it.

**Why it happens.** Pipeline currently surfaces `wave3Result: PersonaSimulationResult[]` (Phase 3 stub shape). Phase 7 needs to surface ALSO `persona_behavioral_aggregate` and the threshold-warning state.

**How to avoid.** Widen `PipelineResult` in `pipeline.ts:40-59`:
```typescript
export interface PipelineResult {
  // ...existing fields...
  wave3Result: PersonaSimulationResult[];                 // existing
  personaBehavioralAggregate: PersonaBehavioralAggregate | null;  // NEW Phase 7
}
```
Aggregator then computes `availability.personas = pipelineResult.personaBehavioralAggregate !== null`.

**Warning signs.** Type error in aggregator on `pipelineResult.personaBehavioralAggregate`; test failure asserting `signal_availability.personas`.

### Pitfall 10: Eval harness A/B doesn't actually swap behavioral source

**What goes wrong.** The lightweight A/B (D-14) is supposed to run the 225-row corpus twice — once with v2 DeepSeek behavioral as the source, once with persona aggregate substituted. If the aggregator's `behavioral_predictions` source is HARDCODED to `deepseek.behavioral_predictions`, the harness can't actually swap. Result: both runs are identical; eval signal is meaningless.

**Why it happens.** D-08 forbids changing aggregator's read at production time. But the eval harness needs the swap to actually MEASURE.

**How to avoid.** Add an OPTIONAL `behavioralSource: "deepseek" | "personas"` parameter to `aggregateScores()` (defaults to "deepseek" — production unchanged). The eval harness passes `"personas"` for the substituted run, which routes `behavioral_predictions` to the persona aggregate. Production callers don't pass the param, get default "deepseek" → unchanged. Test asserts default is still "deepseek".

**Warning signs.** A/B eval rows have identical `macro_f1` across the two configs; benchmark_results rows look like duplicates.

## Code Examples

Verified patterns from existing codebase + cited docs:

### Per-persona Zod schema with retry-on-failure

```typescript
// Source: synthesized from src/lib/engine/wave0/niche-detector.ts:109-117
// + CONTEXT D-07 + D-19
import { z } from "zod";

export const PersonaResponseSchema = z.object({
  scroll_past_second: z.number().min(0),
  watch_through_pct: z.number().min(0).max(100),
  comment_intent: z.number().min(0).max(100),
  share_intent: z.number().min(0).max(100),
  save_intent: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(500),
});
export type PersonaResponse = z.infer<typeof PersonaResponseSchema>;

// Retry pattern (one retry on schema failure)
let attempt = 0;
while (attempt <= 1) {
  try {
    const response = await ai.chat.completions.create({/* ... */});
    const parsed = JSON.parse(response.choices[0].message.content);
    const validated = PersonaResponseSchema.safeParse(parsed);
    if (!validated.success) throw new Error("validation failed");
    return validated.data;
  } catch (err) {
    if (attempt === 1 || !err.message.includes("validation failed")) throw err;
    attempt++;
  }
}
```

### Aggregator integration (additive — does NOT change read source)

```typescript
// Source: synthesized from src/lib/engine/aggregator.ts:330-349 + CONTEXT D-08 + D-15
// Phase 7 changes: SignalAvailability widens with `personas` boolean.
// Production behavioral_predictions read UNCHANGED.

const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: geminiResult.analysis.factors.some((f) => f.score > 0),
  ml: mlAvailable,
  rules: ruleResult.matched_rules.length > 0 && /* ... */,
  trends: trendEnrichment.matched_trends.length > 0 && /* ... */,
  content_type: pipelineResult.wave0Result.content_type !== null,
  niche: pipelineResult.wave0Result.niche !== null,
  // NEW Phase 7 (D-15) — additive, no math impact (SCORE_WEIGHT_KEYS filters this out)
  personas: pipelineResult.personaBehavioralAggregate !== null,
};

// behavioral_predictions read UNCHANGED per D-08
const behavioral_predictions = deepseek?.behavioral_predictions ?? FALLBACK;
```

### Eval harness A/B optional swap

```typescript
// Source: synthesized from src/lib/engine/corpus/eval-runner.ts:104
// + CONTEXT D-14 (lightweight A/B)
// NEW optional param — production callers don't pass; default unchanged.

export async function aggregateScores(
  pipelineResult: PipelineResult,
  onStageEvent?: StageEventCallback,
  options?: { behavioralSource?: "deepseek" | "personas" },
): Promise<PredictionResult> {
  // ...existing body unchanged...

  const behavioralSource = options?.behavioralSource ?? "deepseek";  // default = production behavior
  const behavioral_predictions =
    behavioralSource === "personas" && pipelineResult.personaBehavioralAggregate !== null
      ? pipelineResult.personaBehavioralAggregate
      : (deepseek?.behavioral_predictions ?? FALLBACK_BEHAVIORAL);

  // ...rest of body computes scores against `behavioral_predictions`...
}

// eval-harness.ts substituted run:
const predictionDeepseek = await aggregateScores(pipelineResult);  // production
const predictionPersonas = await aggregateScores(pipelineResult, undefined, { behavioralSource: "personas" });
// Persist both rows to benchmark_results with distinct engine_version tags.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Cache-Control` header on DeepSeek requests | Automatic disk caching + `prompt_cache_hit_tokens` telemetry | DeepSeek 2024-08 (Phase 3 verified) | No header to set; just structure the prompt for prefix-stability + read `usage` fields [VERIFIED: api-docs.deepseek.com/news/news0802] |
| 1 token minimum cache unit | 64 token minimum cache unit | DeepSeek 2024-08 | Phase 7 persona system prompts are ~2500-3000 tokens — well above the threshold |
| Manual per-archetype demographic personas (Phase 4 D-13 added `personas` field) | Stable BEHAVIORAL archetypes per CONTEXT D-02 | Phase 7 CONTEXT (2026-05-18) | Phase 4's slug-based persona field becomes legacy; new persona registry module separates the data layer cleanly |
| 7 distinct DeepSeek calls per analysis (Phase 3) | 18 distinct DeepSeek calls per analysis (Phase 3 + 7 = 1 Wave 2 + 10 Wave 3 personas + Wave 0 niche detector + 6 cache primes during warmup) | This phase | Per-call cache discipline + per-call telemetry now load-bearing; Phase 3 D-12 cache pattern scales to 10× per analysis |
| `deepseek-reasoner` alias routed to V3.2 reasoner | `deepseek-reasoner` alias routes to V4 Flash thinking mode | DeepSeek 2026-04-24 [VERIFIED: api-docs.deepseek.com/news/news260424] | Phase 4 D-03 already migrated the engine to V4 Flash; Phase 7 inherits cleanly |
| `behavioral_predictions` from single DeepSeek synthesis call | `persona_behavioral_aggregate` from 10-persona simulation (ADDITIVE per D-08) | Phase 7 | Phase 7 makes the new signal AVAILABLE; Phase 10 chooses swap |

**Deprecated/outdated:**
- The literal SC#4 phrase "replaces the single `behavioral_predictions`" in ROADMAP — per CONTEXT D-08, UPGRADED to "made available to replace" via the new field. The actual swap is Phase 10's job with calibration evidence.
- REQUIREMENTS PERSONA-02's "demographically diverse — Gen Z, Millennial, female/male skew, geo variants" — REFRAMED per CONTEXT D-01 to interest-cluster-aware behavioral archetypes. The user explicitly redirected this framing during context gathering.
- The "203 tests" anchor (carried from Phase 3 CONTEXT) — stale; Phase 4 RESEARCH verified 465+ tests across 35+ files. Phase 7 adds ~4 new test files; final count after Phase 7 will be ~580 tests across ~40 files.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DeepSeek V4 Flash cache-hit price is $0.0028/M and cache-miss is $0.14/M output is $0.28/M | Cost section + Standard Stack | [VERIFIED 2026-05-18 via Context7 — api-docs.deepseek.com/quick_start/pricing]. Risk: pricing may shift mid-deployment. Plan should re-verify at execution time. |
| A2 | DeepSeek does not enforce per-API-key concurrency limits at 10 parallel calls | Pattern 1 + Don't Hand-Roll | [VERIFIED: api-docs.deepseek.com/news/news0802 "no enforced limits on concurrency or request rates"]. Risk: dynamic throttling under DeepSeek-side load (429 responses). Mitigation: existing circuit breaker handles 429 cleanly. |
| A3 | DeepSeek's cache hit rate target ~95% post-warmup is achievable with ~240 distinct prefix combinations | Summary + Pitfall 8 | [ASSUMED based on D-04/D-17]. Real number depends on traffic distribution + DeepSeek's eviction policy. Plan should measure in production via `prompt_cache_hit_tokens` aggregation; if rate is <50%, consider warmup script. |
| A4 | Phase 4 `taxonomy.ts` `personas` field becomes legacy/unused after Phase 7 without breaking the test suite | Pitfall 7 + Open Question #1 | [VERIFIED: code read confirms no production consumer of the `personas` field exists today]. Only `taxonomy.test.ts` asserts the slug shape — Phase 7 leaves this test alone. Risk: future code adding a consumer of the `personas` field would expect the demographic-slug shape, leading to confusion. Mitigation: planner adds a comment in `taxonomy.ts` documenting Phase 7's reframe. |
| A5 | `creatorContext.past_wins` URL hosts are PROFILE-16-compliant (no URL bodies leak) | Pitfall 3 + persona-prompts.ts pattern | [VERIFIED: Phase 2 D-19 + creator.ts:339-348 wrap past_wins URLs as host-only counts; Phase 7 reuses `tryUrlHost()` pattern from wave0/prompts.ts:110-116]. Risk: a future code path that bypasses sanitize-text could leak raw URLs. Mitigation: Phase 7's `buildPersonaUserMessage` extracts only `.host` via URL parsing — defense in depth. |
| A6 | The 7-row allocation table from D-10 covers all observable Wave 0 content_type emissions | Pattern 3 | [VERIFIED: Wave0ContentTypeResultSchema enums match the 7 allocation rows exactly]. Risk: future Wave 0 widening (adding 8th content type) requires allocation table extension. Mitigation: TypeScript enum match prevents silent miss. |
| A7 | DeepSeek's `usage.prompt_cache_hit_tokens` is reliably populated on V4 Flash (and not just V3.2) | Pattern 1 cost telemetry + Pitfall 8 | [VERIFIED: Phase 4 niche-detector observed this field populated on V4 Flash via `wave0/niche-detector.ts:89-98` cost telemetry; field works identically across model variants]. Risk: occasional `usage` omission on infra events. Mitigation: existing GAP-04-02 fallback (use `prompt_tokens × CACHE_MISS_PRICE` when breakdown missing) — Phase 7 mirrors this from `deepseek.ts:344-355`. |
| A8 | 15s per-call timeout is sufficient for V4 Flash on persona prompts (~3000 input tokens + ~150 output tokens) | Pattern 1 | [ASSUMED based on existing Phase 4 niche-detector using same 15s timeout on similar prompt size at niche-detector.ts:29 — proven OK]. Risk: long-tail latency on cold cache + busy DeepSeek backend. Mitigation: 15s × 10 calls running in parallel = 15s worst-case for Wave 3 if all are slow; pipeline maxDuration is 300s; comfortable margin. |
| A9 | `aggregateScores()` can accept an optional `behavioralSource` param without breaking existing callers | Pattern 4 + Pitfall 10 + Code Example "Eval harness A/B" | [VERIFIED: existing callers all pass `aggregateScores(pipelineResult, onStageEvent?)` — adding a third optional param preserves byte-compat]. Risk: TypeScript widening could surface unexpected callers. Mitigation: default value preserves production behavior; unit test asserts default = `"deepseek"`. |
| A10 | Per-niche persona instantiation text (~50 words × 10 archetypes × 10 niches = ~5000 words of new TS data) fits under the 500-line file budget for taxonomy.ts (CLAUDE.md) | Standard Stack file organization | Risk: file grows past 500 lines in persona-registry.ts. Mitigation: persona-registry.ts is a NEW file; 500-line budget applies fresh; if it exceeds, split into `persona-registry.ts` (allocation table + types) + `persona-instantiation.ts` (per-niche text). Planner picks if needed. |
| A11 | The aggregator can read `pipelineResult.personaBehavioralAggregate` cleanly when widening `PipelineResult` | Pitfall 9 | [VERIFIED by inspection: aggregator already reads `pipelineResult.wave0Result.content_type` via the Phase 4 widening pattern]. Mirror that pattern for Phase 7. Risk: existing tests in `aggregator.test.ts` may need a stub value for the new field. Mitigation: factory pattern in `__tests__/factories.ts:259` already produces a `wave3Result: []` default — extend with `personaBehavioralAggregate: null`. |

**If this table is empty:** This table is NOT empty. The planner and `gsd-discuss-phase` should pay particular attention to A1 (pricing) and A4 (Phase 4 persona field legacy status) — both are load-bearing but verified at research time; both should be re-confirmed at planning + execution time.

## Open Questions (RESOLVED)

1. **Phase 4 taxonomy.personas field — leave as legacy or migrate?**
   - What we know: Phase 4 D-13 added `personas: { archetype: string; weight: number }[]` to every `NichePrimary` with demographic-style slugs and weights summing to 10. A test (`src/lib/niches/__tests__/taxonomy.test.ts` — verified to exist) asserts these slugs.
   - What's unclear: Should Phase 7 (a) leave the field untouched (additive-only milestone discipline; new persona registry in `wave3/`) or (b) refactor the field to match the new 10 behavioral archetypes (cleaner long-term but risks destabilizing Phase 4)?
   - Recommendation: Option (a) — leave Phase 4's field unchanged. Phase 7's new `wave3/persona-registry.ts` is the production source. Document in `taxonomy.ts` that the `personas` field is "Phase 4 D-13 — see `wave3/persona-registry.ts` for Phase 7+ behavioral archetypes." A future phase may formally deprecate. (Pitfall 7 + A4.)

2. **Per-niche persona instantiation text — researcher draft scope.**
   - What we know: CONTEXT D-05 says "researcher proposes per-niche text content during planning, grounded in Phase 1 corpus characteristics." The Phase 1 v2.1-baseline.md shows 5 niches covered (beauty, fitness, education, comedy, lifestyle); the other 5 (food-cooking, tech-gadgets, gaming, fashion-style, music-performance) have no corpus data yet.
   - What's unclear: Should the planner ship instantiation text for ALL 10 niches (researcher proposes generic placeholder text for the 5 uncorpus'd niches) or only the 5 corpus'd niches (with "general TikTok" fallback for the other 5)?
   - Recommendation: Ship for ALL 10 niches at planning time, but mark the 5 uncorpus'd niches with `[PLACEHOLDER — refine with corpus data in Phase 10/Phase 12 retrospective]` comments inline. This preserves the deterministic cache lookup (every niche slug produces a non-null instantiation, no fallback path needed at runtime) while flagging which entries need post-corpus validation.

3. **Persona prompt cache warmup — ship the script or wait for production data?**
   - What we know: Optional one-time warmup script costs ~$0.20 (10 calls × 24 niche × 4 time-of-day = ~960 prefix primes — much higher than initial estimate). DeepSeek's cache eviction is "hours to days," so warmup is genuinely temporary.
   - What's unclear: First user per niche per time-of-day will incur ~5× cache-miss cost compared to a warm cache. With Phase 7's cost budget at $0.025 per Wave 3 (well above the typical ~$0.001-0.003), is warmup worth the engineering overhead?
   - Recommendation: Skip warmup in Phase 7 ship. Planner adds it to Phase 10/12 retrospective list if production data shows first-of-day latency is meaningful. (Pitfall 8 + A3.)

4. **Tied-survivor sort stability when all 10 personas have identical share_intent.**
   - What we know: D-discretion notes specify "stable sort by archetype enum order" for tie-break. Real-world: identical intent scores happen when the persona output is mocked, or when the LLM lands on a round number (50, 50, 50, ...).
   - What's unclear: Is the archetype enum order deterministic + meaningful, or arbitrary? Does the sort need a secondary tie-break (e.g., by persona_id slot string)?
   - Recommendation: `ARCHETYPES` constant order (defined in persona-registry.ts) IS the tie-break. `Array.sort` in JavaScript is stable (verified Node ≥12). Add a comment in `aggregator.ts` documenting this dependency.

5. **What happens when 0 personas succeed (DeepSeek fully down)?**
   - What we know: D-13 says "0 succeeded → returns null aggregate + warning; pipeline continues with whatever v2 DeepSeek produced." But if DeepSeek is fully down, Wave 2's DeepSeek call ALSO failed, so `deepseek.behavioral_predictions` is null → aggregator FALLBACK kicks in.
   - What's unclear: Should `signal_availability.personas = false` AND `signal_availability.behavioral = false` both fire? Aggregator already handles this case (`!availability.gemini && !availability.behavioral → confidence = LOW`).
   - Recommendation: Yes — both flags fire. Aggregator handles the cascading-failure case cleanly (no new code in aggregator). Wave 3 returns empty `results: []` and `aggregate: null` + warning `wave_3_full_failure`. Test covers the "everything down" case.

6. **Eval harness A/B — should the substituted run also persist `persona_simulation_results`?**
   - What we know: D-14 specifies running the corpus with two configs and comparing `macro_f1`, `ECE`, `viral_recall`. The substituted run uses `persona_behavioral_aggregate` instead of v2 DeepSeek behavioral.
   - What's unclear: For the substituted run, should the 225-row corpus also persist the per-persona detail (`persona_simulation_results`) to `benchmark_results`, or just the aggregated metrics?
   - Recommendation: Persist per-persona detail to a NEW JSON column or sidecar table (`benchmark_persona_details` — `(row_id, persona_id, scroll_past, ..., reasoning)`). This is M2's substrate for the audience-viz UI (Deferred per CONTEXT). If schema cost is high, defer to Phase 10 — flag inline in planning.

7. **Should the persona registry's archetype DEFINITIONS be researcher-final or planner-revisable?**
   - What we know: The ARCHETYPE_DEFINITIONS dict in `persona-registry.ts` has ~30-80 words per archetype. CONTEXT D-02 locks the 6 FYP archetype TYPES; the prose definitions are discretionary.
   - What's unclear: The exact wording of e.g., "high_engager" is researcher-drafted in this RESEARCH.md. Should planner accept verbatim or refine?
   - Recommendation: Planner accepts the researcher's prose as the cache-byte-stable starting point; any planner-side edits to the prose CHANGE the cache prefix (invalidate every cached entry for that archetype). Document this dependency in the planner step header. Once locked, future revisions require either a corpus benchmark justification OR a cache-warmup re-run.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Pipeline runtime, AbortController, Promise.allSettled | ✓ | 20+ (per STACK.md) | — |
| `openai` (DeepSeek client) | 10 parallel V4 Flash calls | ✓ | 6.22.0 | — |
| `zod` | PersonaResponseSchema | ✓ | 4.3.6 | — |
| `@sentry/nextjs` | Per-call error capture | ✓ | 10.39.0 | — |
| `@/lib/logger` | Per-module logging | ✓ | local | — |
| `vitest` | Test framework | ✓ | 4.0.18 | — |
| DeepSeek API | 10 calls × per-analysis | ✓ | live service | Circuit breaker handles full outage; Wave 3 returns null + warning; aggregator falls back to v2 behavioral (also from DeepSeek, also covered by Gemini fallback). |
| Existing pipeline.ts orchestration | Wave 3 call site | ✓ | wired in Phase 3 | — |
| Phase 4 wave0Result + creatorContext available at Wave 3 site | Allocation routing + loyalist grounding | partially ✓ | pipeline.ts:511 currently passes deepseek + payload | Planner adds wave0Result + creatorContext to runWave3 args (additive, per CONTEXT D-11) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- Wave 0 niche detection failure → `selectPersonaSlots` falls back to "general TikTok" niche label + uses `NICHE_INSTANTIATION` fallback text. Pipeline continues with degraded signal quality.
- Past_wins null on `creatorContext` → Loyalist persona falls back to "loyal follower of [niche] creators generally" per D-03.
- DeepSeek partial failure (3+ personas fail) → Aggregator returns null + `wave_3_below_threshold` warning; production aggregator continues reading `deepseek.behavioral_predictions` (D-08).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (node environment) |
| Config file | `vitest.config.ts` (80% coverage threshold on `src/lib/engine/**`) |
| Quick run command | `npm test -- src/lib/engine/__tests__/wave3.test.ts` (single file, ~10-30s) |
| Full suite command | `npm test` (full suite — ~580 tests after Phase 7 additions; ~60-90s) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PERSONA-01 | Wave 3 fires exactly 10 parallel DeepSeek calls | unit | `npm test -- src/lib/engine/__tests__/wave3.test.ts -t "10 parallel"` | ❌ Wave 0 |
| PERSONA-02 + D-02 | 6 FYP behavioral archetypes are tough_crowd, lurker, high_engager, saver, sharer, purposeful_viewer | unit | `npm test -- src/lib/engine/__tests__/wave3-persona-registry.test.ts -t "6 FYP archetypes"` | ❌ Wave 0 |
| PERSONA-03 | 2 niche-deep slots (buyer + scout) emitted when row.niche_deep ≥ 2 | unit | `npm test -- src/lib/engine/__tests__/wave3-persona-registry.test.ts -t "niche-deep"` | ❌ Wave 0 |
| PERSONA-04 | Loyalist slot emitted with creatorContext.past_wins host context | unit | `npm test -- src/lib/engine/__tests__/wave3-persona-prompts.test.ts -t "loyalist past_wins"` | ❌ Wave 0 |
| PERSONA-05 | Cross-niche curiosity slot reads from CROSS_NICHE_ADJACENCY table | unit | `npm test -- src/lib/engine/__tests__/wave3-persona-registry.test.ts -t "cross-niche adjacency"` | ❌ Wave 0 |
| PERSONA-06 | Per-persona Zod schema rejects malformed output; retries once on schema failure | unit | `npm test -- src/lib/engine/__tests__/wave3.test.ts -t "retry on schema failure"` | ❌ Wave 0 |
| PERSONA-07 + D-10 | All 7 content_type allocations sum to exactly 10 | unit | `npm test -- src/lib/engine/__tests__/wave3-persona-registry.test.ts -t "allocation table"` | ❌ Wave 0 |
| PERSONA-08 | Persona system prompt is byte-identical across two calls with same (archetype, niche, time_of_day) | unit | `npm test -- src/lib/engine/__tests__/wave3-persona-prompts.test.ts -t "cache prefix stability"` | ❌ Wave 0 |
| PERSONA-09 | DEEPSEEK_PERSONA_MODEL env defaults to "deepseek-v4-flash"; overrideable | unit | `npm test -- src/lib/engine/__tests__/wave3.test.ts -t "env override"` | ❌ Wave 0 |
| PERSONA-10 + D-08 | aggregateScores reads deepseek.behavioral_predictions when behavioralSource is "deepseek" (default); reads personaBehavioralAggregate when "personas" | unit | `npm test -- src/lib/engine/__tests__/aggregator.test.ts -t "behavioral source override"` | ✅ existing — Phase 7 extends |
| PERSONA-11 + D-09 | persona_simulation_results[10] persists on PredictionResult; each row has scroll_past_second, archetype, slot_type, reasoning | unit | `npm test -- src/lib/engine/__tests__/wave3.test.ts -t "persona detail persistence"` | ❌ Wave 0 |
| PIPE-08 + Phase 3 D-17 | Wave 3 emits wave_3_personas + 10 wave_3_persona_{archetype}_{slot_type} pairs | unit | `npm test -- src/lib/engine/__tests__/wave3.test.ts -t "stage events"` | ❌ Wave 0 |
| D-06 | Per-metric different rule: completion_pct = mean; share/comment/save = top-3-enthusiast-weighted | unit | `npm test -- src/lib/engine/__tests__/wave3-aggregator.test.ts -t "per-metric different rule"` | ❌ Wave 0 |
| D-06 (edge) | Top-3 sort ties broken by archetype enum order | unit | `npm test -- src/lib/engine/__tests__/wave3-aggregator.test.ts -t "tie-break"` | ❌ Wave 0 |
| D-13 | ≥7 of 10 personas → aggregate computed; <7 → null + warning | unit | `npm test -- src/lib/engine/__tests__/wave3-aggregator.test.ts -t "threshold logic"` | ❌ Wave 0 |
| D-13 (edge) | 0 personas succeed → empty results + null aggregate + circuit-breaker-aware path | unit | `npm test -- src/lib/engine/__tests__/wave3.test.ts -t "all 10 fail"` | ❌ Wave 0 |
| D-15 | signal_availability.personas = true iff persona_behavioral_aggregate !== null | unit | `npm test -- src/lib/engine/__tests__/aggregator.test.ts -t "personas signal availability"` | ✅ existing — Phase 7 extends |
| D-16 | Cost per analysis ≤$0.025 for 10-persona stage (cache mix) | smoke (mocked usage fields) | `npm test -- src/lib/engine/__tests__/wave3.test.ts -t "cost budget"` | ❌ Wave 0 |
| D-17 | Persona registry produces byte-stable system prompts for same input | unit | `npm test -- src/lib/engine/__tests__/wave3-persona-prompts.test.ts -t "byte stability"` | ❌ Wave 0 |
| D-18 | Per-call cost telemetry emitted; sums to Wave 3 stage_end cost_cents | unit | `npm test -- src/lib/engine/__tests__/wave3.test.ts -t "cost telemetry"` | ❌ Wave 0 |
| D-19 | PersonaSimulationResult interface accepts widened shape; Zod schema validates | unit | `npm test -- src/lib/engine/__tests__/wave3-persona-prompts.test.ts -t "schema widening"` | ❌ Wave 0 |
| D-20 | PredictionResult includes persona_behavioral_aggregate + persona_simulation_results; persists via existing JSON columns | integration (mocked supabase insert) | `npm test -- src/app/api/analyze/__tests__/route.test.ts -t "wave 3 persistence"` | ✅ existing — Phase 7 extends |
| Existing test compat | Stubs test (`stubs.test.ts`) — Wave 3 with empty deepseekResult still returns gracefully | unit | `npm test -- src/lib/engine/__tests__/stubs.test.ts` | ✅ existing — extend `runWave3` signature backwards-compat |

### Sampling Rate

- **Per task commit:** `npm test -- src/lib/engine/__tests__/wave3*.test.ts` (4 wave3 test files, ~20-40s)
- **Per wave merge:** `npm test -- src/lib/engine` (entire engine subdirectory, ~45-75s)
- **Phase gate:** `npm test` full suite green before `/gsd-verify-work`
- **A/B eval validation (D-14):** `npx tsx scripts/eval.ts --engine-version "3.0.0-dev-personasA" --bypass-cache` then `npx tsx scripts/eval.ts --engine-version "3.0.0-dev-personasB" --behavioral-source personas --bypass-cache` (production-data validation, ~$0.20 LLM cost)

### Wave 0 Gaps

- [ ] `src/lib/engine/__tests__/wave3.test.ts` — covers PERSONA-01, PERSONA-06, PERSONA-09, PERSONA-11, PIPE-08, D-13 (edge), D-16, D-18
- [ ] `src/lib/engine/__tests__/wave3-persona-registry.test.ts` — covers PERSONA-02, PERSONA-03, PERSONA-05, PERSONA-07
- [ ] `src/lib/engine/__tests__/wave3-persona-prompts.test.ts` — covers PERSONA-04, PERSONA-08, D-17, D-19
- [ ] `src/lib/engine/__tests__/wave3-aggregator.test.ts` — covers D-06 (per-metric different rule), D-06 (tie-break), D-13 (threshold logic)
- [ ] `src/lib/engine/__tests__/aggregator.test.ts` extension — adds tests for personas signal_availability and behavioralSource override
- [ ] `src/lib/engine/__tests__/pipeline.test.ts` extension — adds tests for `personaBehavioralAggregate` widening on PipelineResult
- [ ] `src/lib/engine/__tests__/stubs.test.ts` — UPDATE for backwards-compat with widened `runWave3` signature (currently `runWave3(payload, null) → []` after Phase 3; Phase 7 widens to accept wave0Result + creatorContext)
- [ ] `src/app/api/analyze/__tests__/route.test.ts` extension — adds test for persona_simulation_results persisted in INSERT
- [ ] `src/lib/engine/__tests__/factories.ts` extension — adds default `personaBehavioralAggregate: null` to test-double PipelineResult factory

## Security Domain

> Phase 7 fires 10 parallel LLM calls reading creator past_wins URLs (host-only); persists per-persona reasoning text on `analysis_results`. Inherits Phase 1/2/3/4 auth + RLS posture. No new authentication surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Existing Supabase Auth via `createClient()`; no Phase 7 change |
| V3 Session Management | yes (inherited) | Supabase SSR cookie flow; no Phase 7 change |
| V4 Access Control | yes (inherited) | RLS on `analysis_results` user-scoped; persona data persisted in same row, same RLS |
| V5 Input Validation | yes (Phase 7 new) | PersonaResponseSchema (Zod) at LLM boundary; refuses malformed outputs; retry-once-then-fail |
| V6 Cryptography | yes (inherited) | content_hash already SHA-256'd by Phase 3; Phase 7 does not handle crypto directly |

### Known Threat Patterns for 10× LLM call + LLM-content-on-PredictionResult stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via past_wins URL bodies | Tampering | Host-only extraction via `URL(u).host` (mirror of Phase 4 prompts.ts:110-116). Raw URL bodies NEVER reach the persona system or user prompt. Phase 2 D-19 already strips control + zero-width chars before DB write. |
| Persona reasoning leaks PII from creator past wins | Information Disclosure | past_wins URLs surface as HOSTS only (e.g., "tiktok.com" — no path, no user info). Reasoning text is LLM-generated; cannot leak data it was never given. |
| LLM-generated reasoning text persisted to `analysis_results` includes user-supplied text | Tampering / Information Disclosure | Reasoning is LLM output (not user input). User-input is the original video caption — which is already user-owned via RLS. No new attack surface. |
| 10 parallel calls × per-user → DoS via concurrent analysis requests | Denial of Service | Existing tier-limit check in `/api/analyze` (route.ts:138-149); existing DeepSeek circuit breaker; `maxDuration = 300` per route. No new attack vector beyond Phase 3. |
| Wave 3 cost overrun via adversarial input pumping uncacheable analyses | Denial of Service / Cost | Per-analysis cost cap (~$0.025 worst-case); user-tier rate-limit; DeepSeek does not enforce per-key concurrency but does dynamically throttle on load (429 → circuit breaker handles). |
| Cache prefix poisoning (adversary forces a specific archetype × niche × time-of-day to be uncached) | Tampering | Cache prefix is the SYSTEM message (Phase 7-controlled, byte-stable). User input is in the USER message (per-call volatile). Adversary cannot poison the system prefix; can only generate cache misses for THEIR own runs (cost burden falls on the adversary's own analyses). |
| Loyalist persona surfaces past_wins data to wrong user (cross-user leakage) | Information Disclosure | past_wins comes from `creatorContext.past_wins`; `fetchCreatorContext` queries `creator_profiles` by `tiktok_handle` from the analysis input. The fetched data belongs to whoever owns that tiktok_handle in the profile table; RLS on `creator_profiles` is user-scoped. No cross-user leakage. |
| Persona response with malicious JSON (e.g., embedded `__proto__`) | Tampering | `JSON.parse` is safe in modern Node (does not pollute prototypes); Zod parse rejects unknown fields. Defense in depth. |

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/api-docs_deepseek` — DeepSeek context caching guide, usage response schema, pricing for V4 Flash, JSON output mode, rate limit policy
  - https://api-docs.deepseek.com/guides/kv_cache — cache prefix matching from token 0; 64-token minimum
  - https://api-docs.deepseek.com/news/news0802 — automatic caching announcement; no enforced concurrency limits
  - https://api-docs.deepseek.com/quick_start/pricing — V4 Flash $0.0028/M cache-hit, $0.14/M cache-miss, $0.28/M output (verified 2026-05-18)
  - https://api-docs.deepseek.com/news/news260424 — V3/V4 alias migration deadline 2026-07-24
  - https://api-docs.deepseek.com/guides/json_mode — `response_format: { type: "json_object" }` semantics + JSON instruction requirement
  - https://api-docs.deepseek.com/quick_start/rate_limit — dynamic concurrency throttling; 429 returns
- Codebase reads (verified — exact file paths):
  - `src/lib/engine/wave3.ts` — current no-op stub (Phase 3 D-17)
  - `src/lib/engine/types.ts:142-218` — PredictionResult, SignalAvailability, PersonaSimulationResult shapes
  - `src/lib/niches/taxonomy.ts:43-49, 53-323` — NICHE_TREE with Phase 4 D-13 personas field
  - `src/lib/engine/deepseek.ts:1-737` — STABLE_SYSTEM_PROMPT pattern, circuit breaker, cost telemetry, Gemini fallback
  - `src/lib/engine/wave0/niche-detector.ts` — single-call DeepSeek V4 Flash pattern (Phase 4)
  - `src/lib/engine/wave0/prompts.ts:1-117` — stable system + volatile user message split (Phase 4)
  - `src/lib/engine/wave0.ts:34-37` — Promise.allSettled parallel pattern (Phase 4)
  - `src/lib/engine/aggregator.ts:330-349` — SignalAvailability assembly (extension surface for Phase 7)
  - `src/lib/engine/pipeline.ts:40-59, 511-515` — PipelineResult shape + Wave 3 call site (extension surface)
  - `src/lib/engine/events.ts:1-50` — emitStageStart/emitStageEnd helpers (reused unchanged)
  - `src/lib/engine/creator.ts:11-46` — CreatorContext interface with past_wins + niche_primary fields
  - `src/lib/engine/wave0/content-type-weights.ts` — locked 7-row matrix (Phase 4 D-12; Phase 7 mirrors the locked-table pattern)
  - `src/lib/engine/corpus/eval-harness.ts:1-100` — eval harness entry point (extension surface for D-14 A/B)
  - `src/lib/engine/corpus/eval-runner.ts:1-105` — aggregateScores invocation in eval loop
  - `src/lib/engine/__tests__/stubs.test.ts:64-86` — current stub test contract (must extend for Phase 7 signature widening)
  - `src/lib/engine/__tests__/factories.ts:259` — wave3Result default test-double (extend for personaBehavioralAggregate: null)
- Phase 3 RESEARCH.md (this milestone) — Pattern 4 DeepSeek auto-cache; Pitfall 3 cache prefix invalidation; Assumptions A1-A7 around pricing + tests
- Phase 4 RESEARCH.md (this milestone) — Topic #2 + Topic #5 + Topic #11 — parallel detector orchestration, V4 Flash pricing verification, stable prompt construction
- Phase 1 v2.1-baseline.md — corpus characteristics (5 niches present in 225 rows; macro_f1 = 0.294 baseline; v3 target ≥ 0.338)

### Secondary (MEDIUM confidence — verified via cross-reference)
- DeepSeek model+pricing JSON in agent integration docs (api-docs_deepseek/quick_start/agent_integrations/pi_mono) — confirms V4 Flash input cost structure ($0.14, $0.028 cache read, $0.28 output per 1M tokens) consistent with pricing page
- Node.js Promise.allSettled behavior — built-in, well-documented; pattern verified in Phase 4 wave0.ts:34

### Tertiary (LOW confidence — none required for Phase 7)
- None — all critical claims have HIGH or MEDIUM source backing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in `package.json`; DeepSeek client + circuit breaker + Zod boundary pattern proven by Phase 1/3/4
- Architecture: HIGH — Wave 3 stub already wired in Phase 3 D-17; Phase 7 is a body swap with additive PipelineResult extension; mirrors Phase 4's wave0.ts pattern exactly
- Persona registry: MEDIUM — the 10 archetype DEFINITIONS, scroll-stop triggers, motivator assignments, time-of-day tags, and per-niche instantiation text are researcher-proposed; planner refines; cache discipline requires byte-stable text once locked. Phase 4 D-13 taxonomy.personas conflict (Pitfall 7) flagged.
- Aggregation math: HIGH — D-06 + claude-discretion notes specify the algorithm completely; edge cases (ties, surviving subset, n < TOP_N) documented in Pattern 4 + Pitfall 4
- Cost telemetry: HIGH — V4 Flash pricing verified via Context7; cache-aware breakdown pattern proven in Phase 4 niche-detector.ts:89-102
- Eval harness A/B (D-14): MEDIUM — requires extending `aggregateScores()` with optional behavioralSource param; not yet wired but pattern is straightforward additive extension

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (30 days for stack stability). Pricing constants should be re-verified at execution time via api-docs.deepseek.com/quick_start/pricing.

---

## RESEARCH COMPLETE

Phase 7 fills the Wave 3 no-op stub with 10 parallel `deepseek-v4-flash` calls; per-niche persona instantiation lives in a NEW `src/lib/engine/wave3/persona-registry.ts` module (does NOT mutate Phase 4's `taxonomy.ts`); aggregator integration is purely additive (new `persona_behavioral_aggregate` field, no swap of `deepseek.behavioral_predictions` read); D-14 lightweight A/B routes through an OPTIONAL `behavioralSource` parameter on `aggregateScores()`. Per-call cache discipline (4-block stable prefix + per-niche instantiation in system message) is load-bearing for the $0.025 budget.
