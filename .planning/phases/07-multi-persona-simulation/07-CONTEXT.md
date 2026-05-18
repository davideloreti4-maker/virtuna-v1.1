# Phase 7: Multi-Persona Simulation - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the existing Wave 3 no-op stub (`src/lib/engine/wave3.ts`, scaffolded in Phase 3 D-17) with 10 parallel DeepSeek V4 Flash (`deepseek-chat`) calls — one per persona — that run AFTER Wave 2 (DeepSeek synthesis + trend enrichment) and BEFORE the aggregator. Three coupled artifacts:

1. **10-persona simulation** — Each persona is one independent `deepseek-chat` call with a stable archetype-defined system prompt + a per-call user message with video context. Default allocation 6 FYP + 2 niche-deep + 1 loyalist + 1 cross-niche; overridden per detected content type (Phase 4 output). Total parallel calls always = 10 (SC#1).

2. **Persona reaction aggregator** — Rolls 10 personas × 5 metric scores up into a single `BehavioralPredictions` shape (`{completion_pct, share_pct, comment_pct, save_pct}` + percentile labels). Per-metric different rule: completion via mean of `watch_through_pct`; share/comment/save via top-3-enthusiast-weighted (top-3 personas count 60%, remaining 7 split 40%).

3. **Additive PredictionResult extension** — A new field `persona_behavioral_aggregate: BehavioralPredictions` (and per-persona detail array `persona_simulation_results: PersonaSimulationResult[]`) added to `PredictionResult`. The aggregator continues reading the legacy v2 DeepSeek `behavioral_predictions` unchanged. Phase 10 (ML audit + calibration) decides swap vs blend based on corpus evidence. Pure additive — no rewrite of `aggregator.ts`.

Plus three orchestration / validation artifacts:

4. **Per-content-type allocation table** (locked 7-row table; each row sums to 10) — Routes the 6/2/1/1 default and 6 overrides through `runWave3()` so the right 10 personas are activated for the detected content type.

5. **Persona registry** — Extends `src/lib/niches/taxonomy.ts` (the `personas` field added in Phase 4 D-13) with the 6 stable behavioral archetypes + their per-niche instantiation profiles. Researcher fills per-niche text content during planning.

6. **Lightweight A/B eval on the Phase 1 corpus** — After Wave 3 ships, the eval harness runs the 225-row corpus with v2-behavioral-active and persona-aggregate-substituted; compares `macro_f1`, `ECE`, `viral_recall`. Flags Phase 10 attention if persona aggregate is materially worse than v2 baseline.

**Out of scope this phase:**
- Aggregator swap from v2 behavioral to persona aggregate — Phase 10 owns this (with calibration evidence).
- Creator-tier-aware adjustment (new / growing / established) — Phase 9 owns this (REQUIREMENTS ALGO-05).
- Per-archetype calibration training — Phase 10's Platt scaling.
- M2 audience-viz UI consuming per-persona data — surfaces in M2 (Intelligence Surface).
- Self-critique cross-reference against persona reasoning — Phase 9 owns this.
- Cross-niche curiosity adjacent-niche mapping data (which adjacent niche per primary) — researcher proposes during planning, planner locks.
- Counterfactuals on a per-persona basis — Phase 9 scope.
- Phase 4 content-type detector behavior, niche taxonomy structure — locked in Phase 4 CONTEXT.md.

</domain>

<decisions>
## Implementation Decisions

### Persona Identities (LOAD-BEARING — the audience model)

- **D-01: The 6 FYP personas are interest-cluster-aware, NOT a random demographic cross-section.** PROJECT.md's "demographically diverse" framing was misread; TikTok's For You Page is a smart routing system that serves a video to its interest cluster, not to a random slice of TikTok users. Variance inside the FYP audience is **behavioral within the cluster**, not demographic across clusters. The 6 FYP personas model this cluster correctly.

- **D-02: The 6 FYP personas are defined by 6 stable behavioral archetypes** — each instantiated per detected niche. The archetypes are byte-stable across runs (cache-eligible at ~50× discount on DeepSeek input cache). The per-niche instantiation profile (demographics + interest-adjacency) varies per detected niche:
  | Archetype | Reaction signature |
  |-----------|--------------------|
  | The high engager | Comments often, follows trends, high overall engagement |
  | The saver | Bookmarks practical content, low comment intent |
  | The lurker | High watch-through (60-100%) but near-zero overt engagement |
  | The sharer | Moderate watch, high share-to-DM intent |
  | The tough crowd | Scrolls past in <3s unless hooked hard (represents the ~30% FYP scroll-past population) |
  | The purposeful viewer | Finishes content with utility, ignores noise |

- **D-03: The 4 specialized personas:**
  - **2 niche-deep** — One high-intent buyer (actively shopping the niche, e.g., looking for a workout plan), one deep-niche scout (knows the niche cold, new to this creator).
  - **1 loyalist** — Loyal follower of creators in the detected niche; reactions calibrated by Card 6 past wins (if creator's wins were comedy-leaning, loyalist reads as comedy-leaning fitness follower). When `creatorContext.past_wins` is null, loyalist falls back to "loyal follower of [niche] creators generally."
  - **1 cross-niche curiosity** — From an adjacent niche per `taxonomy.ts` edges (beauty → wellness; fitness → nutrition; gaming → tech). Lower base watch-through; high signal if they DO stop (cross-pollination prediction).

- **D-04: Each persona's system prompt embeds four cache-friendly enhancements:**
  1. Archetype definition (stable, byte-identical across runs)
  2. Scroll-past + stop triggers (e.g., "scrolls past when X", "stops for Y")
  3. Psychographic motivator (one of: entertainment-seeker / learner / social-validator / escape-seeker / utility-shopper / passive-scroller)
  4. Time-of-day / mood context tag (e.g., "morning commute scroller", "late-night doomscroll", "lunch-break browser")

  These four blocks form the STABLE PREFIX of each persona's system prompt; per-niche instantiation + video context live in the variable suffix. Cache hit rate target ~95% after warmup.

- **D-05: Per-niche persona instantiation lives in `src/lib/niches/taxonomy.ts`** — extends the `personas: { archetype: string; weight: number }[]` field added in Phase 4 D-13. For each primary niche, the taxonomy maps the 6 stable archetypes to niche-tuned demographic + interest-adjacency profiles. Researcher proposes per-niche instantiation text during planning, grounded in Phase 1 corpus characteristics. Planner locks.

### Reaction Aggregation (10 personas × 5 metrics → 1 BehavioralPredictions shape)

- **D-06: Per-metric different aggregation rule.**
  - `completion_pct` = mean of all 10 personas' `watch_through_pct` (completion IS distributed across viewers; flat mean is the population rate).
  - `share_pct` = top-3-enthusiast-weighted aggregation of `share_intent` — the top-3 most enthusiastic personas count 60% of the weight (~20% each), the remaining 7 split 40% (~5.7% each). Mirrors how virality actually works: a few enthusiasts carry the share cascade.
  - `comment_pct` = same top-3-weighted rule applied to `comment_intent` (bursty engagement pattern).
  - `save_pct` = same top-3-weighted rule applied to `save_intent` (saves concentrate in utility content).

  This distinguishes viral content (a few personas REALLY want to share + 8 don't) from average content (10 lukewarm reactions, same mean intent).

- **D-07: Each persona returns 5 scores + 1-2 sentence free-text reasoning.** Each call output:
  ```ts
  {
    scroll_past_second: number;     // 0..video_duration
    watch_through_pct: number;      // 0..100
    comment_intent: number;         // 0..100 (interpreted as % likelihood)
    share_intent: number;           // 0..100
    save_intent: number;            // 0..100
    reasoning: string;              // 1-2 sentence reaction in persona's voice
  }
  ```
  Reasoning adds ~50-100 output tokens per persona (~$0.0004 total cost added). Powers M2 audience viz, gives Phase 9 self-critique cross-reference material, makes eval debugging trivial.

- **D-08: Aggregator integration is purely ADDITIVE — no aggregator.ts rewrite in Phase 7.** ROADMAP SC#4 literal text says persona aggregate "replaces" v2's single-DeepSeek `behavioral_predictions`. Phase 7 honors this BY MAKING THE NEW SIGNAL AVAILABLE (not by literally swapping the source). Concretely:
  - Wave 2 DeepSeek call stays unchanged — still produces factors / suggestions / warnings / legacy `behavioral_predictions`.
  - Wave 3 persona aggregate becomes a NEW field on `PredictionResult`: `persona_behavioral_aggregate: BehavioralPredictions`.
  - The aggregator (`aggregateScores()`) continues reading `deepseek.behavioral_predictions` in Phase 7. No code change to aggregator's signature or weight logic.
  - Phase 10 (ML audit + calibration) decides swap vs blend based on corpus A/B evidence.

  This matches the milestone-wide "additive-only" constraint and the Phase 3 / Phase 4 precedent. The "replaces" reading is upgraded to "made available to replace, pending Phase 10 evidence."

- **D-09: Per-persona detail persisted on `PredictionResult`** — new field `persona_simulation_results: PersonaSimulationResult[]` (10 entries, each carrying scores + reasoning + persona archetype label + slot type "fyp" | "niche_deep" | "loyalist" | "cross_niche"). This satisfies ROADMAP SC#5 (per-persona drop-off second persisted for M2 retention curve) AND gives M2 a labeled audience-viz dataset.

### Per-Content-Type Allocation Tuning (locked 7-row table)

- **D-10: The 7-row allocation table** (each row sums to 10):
  | Content type | FYP | Niche-deep | Loyalist | Cross-niche | Rationale |
  |--------------|-----|-----------|----------|-------------|-----------|
  | `talking_head` | 5 | 2 | 2 | 1 | Personal-brand content; loyalists matter more |
  | `b_roll` | 7 | 2 | 0 | 1 | Storytelling-driven discovery; FYP-heavy, no loyalist |
  | `slideshow` | 6 | 2 | 1 | 1 | Default (mixed use case) |
  | `action` | 7 | 2 | 0 | 1 | Pure performance / discovery; FYP-heavy |
  | `tutorial` | 4 | 3 | 2 | 1 | Utility content; niche-deep + loyalist drive save/share intent |
  | `vlog` | 4 | 2 | 3 | 1 | Community content; loyalist-leaning (adjusted from initial 3/2/4/1 proposal) |
  | `other` | 6 | 2 | 1 | 1 | Default fallback (matches PROJECT.md 6/2/1/1) |

  When Phase 4's content-type detector returns null OR emits `mixed_content_detected` warning, the allocator falls back to the `other` row (default 6/2/1/1).

- **D-11: Allocation routing.** `runWave3()` reads `wave0Result.content_type.type` (from Phase 4); looks up the row in the table; activates exactly the 10 personas listed in that row's slot count. Each persona slot's archetype + niche-instantiation is independent — so swapping the count per content type doesn't break the per-persona prompt cache (10 parallel calls, each cached independently by DeepSeek's automatic prefix cache).

- **D-12: Creator-stage tuning is DEFERRED to Phase 9.** Phase 9 already owns "creator-tier-aware adjustment" per REQUIREMENTS ALGO-05. Phase 7's allocation lever is content-type only. Card 3 (creator stage: new / growing / established) is NOT consulted in Phase 7's allocator. Keeps phase boundaries clean.

### Failure + Eval Strategy

- **D-13: Wave 3 success threshold = ≥7 of 10 personas succeed.** Wave 3 runs 10 parallel `deepseek-chat` calls. Each may fail (timeout, rate-limit, schema-parse fail, content policy). Threshold logic:
  - **≥7 succeeded** → aggregate the surviving personas (using D-06 rules over the surviving subset, scaled appropriately); set `signal_availability.personas = true`.
  - **<7 succeeded** → return `null` persona aggregate; emit `wave_3_below_threshold` warning; aggregator falls back to v2 DeepSeek behavioral (which is still computed per D-08); set `signal_availability.personas = false`.
  - **0 succeeded** (DeepSeek API fully down) → returns `null` aggregate + warning; pipeline continues with whatever v2 DeepSeek produced (or also null if same outage); standard graceful-degradation cascade from Phase 1.

- **D-14: Lightweight A/B eval on the 225-row Phase 1 corpus AFTER Phase 7 ships.** Run the corpus with TWO configs:
  - **(a) v2 baseline:** aggregator uses legacy `deepseek.behavioral_predictions` (current default).
  - **(b) Persona aggregate substituted:** patch the aggregator's `behavioral_predictions` input to use `persona_behavioral_aggregate` instead.
  Compare `macro_f1`, `ECE`, `viral_recall`, `under_precision` from each run. Persist both result-rows to `benchmark_results` with distinct `engine_version` tags (e.g., `3.0.0-dev-personasA`, `3.0.0-dev-personasB`). Cost: ~$0.20 in additional LLM calls for one substituted run on 225 rows. Output: `.planning/research/persona-aggregate-ab-2026-05-XX.md` summarizing the comparison. Flag Phase 10 attention if persona aggregate is materially worse than v2 baseline.

- **D-15: `signal_availability.personas: boolean` key added to SignalAvailability** (matches Phase 3 D-07's forward-compat pattern). `true` when Wave 3 met the ≥7 threshold; `false` otherwise. Persisted to `analysis_results.signal_availability` JSONB.

### Cost + Cache Strategy

- **D-16: Budget = $0.025 per 10-persona stage (SC#6).** Cost breakdown estimate:
  - V4 Flash pricing (verify against api-docs.deepseek.com/quick_start/pricing at deploy time): cache-miss input ~$0.14/M, cache-hit input ~$0.0028/M, output ~$0.42/M.
  - Per-persona prompt: ~3000 input tokens (system + niche profile + video context). Output: ~150 tokens (scores + reasoning).
  - Cache HIT (warm cache, common archetype + niche combo): ~3000 × $0.0028/M = $0.0000084 input + 150 × $0.42/M = $0.000063 output = ~$0.000071/call.
  - Cache MISS (cold cache, e.g., new niche): ~3000 × $0.14/M = $0.00042 input + 150 × $0.42/M = $0.000063 output = ~$0.000483/call.
  - 10 calls all cache-hit: ~$0.0007 total ⇒ well under budget.
  - 10 calls all cache-miss: ~$0.005 total ⇒ still under budget.
  - Mixed (typical): ~$0.001 - $0.003 ⇒ comfortably under $0.025.

- **D-17: Cache prefix discipline.** Each persona's system prompt structure (load-bearing for cache hit rate):
  ```
  ┌─ CACHED PREFIX (byte-stable across runs) ──────────────┐
  │ - Archetype definition (D-02)                          │
  │ - Scroll-past + stop triggers (D-04)                   │
  │ - Psychographic motivator (D-04)                       │
  │ - Time-of-day / mood context tag (D-04)                │
  │ - Per-niche instantiation profile (D-05, byte-stable   │
  │   for {archetype × niche × time-of-day} combinations)  │
  └────────────────────────────────────────────────────────┘
  ┌─ VARIABLE TAIL (per-call, not cached) ─────────────────┐
  │ User message: video summary + caption + hashtags +     │
  │ creator context + content-type-aware tuning context    │
  └────────────────────────────────────────────────────────┘
  ```
  Phase 3 D-12 established the cache pattern. DeepSeek's automatic input cache (no opt-in header needed per `src/lib/engine/deepseek.ts:52` comment) applies as long as prefix bytes match. The combinatorial cache footprint is roughly 6 archetypes × 10 primary niches × 4 time-of-day tags = ~240 cached prefixes per slot type. Realistic; manageable.

- **D-18: Cost telemetry emitted per Wave 3 call.** Each persona's `wave_3_persona_{archetype}` stage_end event carries `cost_cents` (separately tracking cache-hit vs cache-miss tokens via DeepSeek's `usage.prompt_cache_hit_tokens` / `usage.prompt_cache_miss_tokens` per the existing `deepseek.ts` pattern). Wave 3 aggregate `stage_end` event sums the 10 individual costs. Eval harness flags overruns >$0.025.

### Schema + Type Additions

- **D-19: `PersonaSimulationResult` interface (in `src/lib/engine/types.ts:210`) extended.** Current shape:
  ```ts
  interface PersonaSimulationResult {
    persona_id: string;
    scroll_past_second: number;
    watch_through_pct: number;
    comment_intent: number;
    share_intent: number;
    save_intent: number;
  }
  ```
  Phase 7 extends with:
  ```ts
  interface PersonaSimulationResult {
    persona_id: string;        // unique slot id e.g., "fyp-1-saver"
    archetype: "high_engager" | "saver" | "lurker" | "sharer" | "tough_crowd" | "purposeful_viewer" | "niche_deep_buyer" | "niche_deep_scout" | "loyalist" | "cross_niche_curiosity";
    slot_type: "fyp" | "niche_deep" | "loyalist" | "cross_niche";
    niche: string;             // primary niche from Phase 4
    scroll_past_second: number;
    watch_through_pct: number;
    comment_intent: number;     // 0..100
    share_intent: number;       // 0..100
    save_intent: number;        // 0..100
    reasoning: string;          // 1-2 sentence per D-07
  }
  ```
  Matching Zod schema in same file. Plus new `PersonaBehavioralAggregate` (alias of existing `BehavioralPredictions` shape, persisted as separate field for type-level distinguishability).

- **D-20: `PredictionResult` additions** (no removals — additive):
  ```ts
  interface PredictionResult {
    // ... existing fields ...
    persona_behavioral_aggregate: BehavioralPredictions | null;     // null when wave 3 below threshold
    persona_simulation_results: PersonaSimulationResult[];          // empty array on fallback
    signal_availability: SignalAvailability;                         // .personas key added
  }
  ```
  No migration needed if these flow into `analysis_results` via existing JSON columns. Confirm column shape with planner — likely fits in `behavioral_predictions` JSON or a new top-level `persona_*` field. **Planner picks**.

### Claude's Discretion

These remain HOW-to-implement details for researcher and planner to lock without further user input:

- **Per-niche persona instantiation text** (D-05) — Researcher proposes per-niche demographic + interest-adjacency text for each of the 6 archetypes during planning. Grounded in Phase 1 corpus characteristics + public TikTok demographic data. Planner locks.
- **Cross-niche curiosity adjacent-niche edges** (D-03) — `taxonomy.ts` edges defining which adjacent niche the curiosity persona comes from per primary niche (e.g., beauty → wellness). Researcher proposes; planner locks.
- **Scroll-past + stop triggers per archetype** (D-04) — Specific behavioral rules embedded in each archetype's system prompt. Researcher drafts; planner refines.
- **Psychographic motivator assignment** (D-04) — Map each archetype × niche combo to one of 6 motivators (entertainment / learner / social-validator / escape / utility-shopper / passive). Mostly mechanical; planner locks.
- **Time-of-day / mood context tag** (D-04) — A small fixed set (e.g., 4 tags); each archetype gets one. Planner locks.
- **DeepSeek structured-output schema (Zod)** for per-persona output (D-19) — `PersonaResponseSchema` with strict validation, retry-once-on-malformed pattern. Planner locks.
- **System prompt template** for archetype + niche + psychographics + time-of-day composition — Single `buildPersonaSystemPrompt(archetype, niche, motivator, timeOfDay)` builder function. Researcher drafts; planner integrates.
- **User message template** — `buildPersonaUserMessage(videoSummary, caption, hashtags, creatorContext, contentType)` builder. Planner integrates.
- **File organization** — Likely `src/lib/engine/wave3/persona-registry.ts` + `src/lib/engine/wave3/persona-prompts.ts` + `src/lib/engine/wave3/aggregator.ts` + body of `src/lib/engine/wave3.ts` orchestrating the 10 parallel calls. Planner picks final split.
- **Top-3-enthusiast threshold mechanics** (D-06) — Whether "top 3" is by `share_intent` value alone, or by a composite enthusiasm score across share/comment/save. Per metric is cleanest; planner locks.
- **Aggregator over surviving subset** (D-13) — When fewer than 10 personas succeed (but ≥7), how to apply top-3 weighting across the smaller set. Proposed: top-3 still = top-3 of survivors; remaining weight = 40% split over (count - 3). Planner verifies math doesn't double-count edges.
- **Per-persona retry policy** — One retry on schema-parse failure; no retry on timeout (other 9 personas already running). Planner locks; aligns with existing `deepseek.ts` retry pattern.
- **Circuit breaker behavior** — Wave 3 inherits the existing `deepseek.ts` circuit breaker (Phase 1 hardening). When breaker open, Wave 3 returns null aggregate + warning immediately; no retries. Planner verifies inheritance is preserved.
- **Test surface** — Vitest unit tests for: aggregation math (mean, top-3-weighted edge cases), threshold logic (7-of-10), allocation table (all 7 content types × correct slot counts), schema validation (Zod), cache prefix stability (byte-identical assertion), per-persona retry. Integration test for `wave3.ts` emitting 10 stage_start + 10 stage_end events. Mock DeepSeek client with deterministic responses. 80% Vitest threshold per project policy.
- **Per-niche cache warmup** — Whether to ship a one-time warmup script that exercises common {archetype × niche × time-of-day} combos to seed DeepSeek's cache. Cost: ~$0.20 for full warmup. Planner decides if worth it.
- **Top-3 selection when ties** — Tie-break rule for "top 3 enthusiast" when multiple personas have identical intent scores. Stable sort by `archetype` enum order is sufficient; planner locks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 7: Multi-Persona Simulation" — phase goal, depends-on Phase 3, 6 success criteria (#1 exactly 10 parallel V3 calls; #2 6/2/1/1 default, tunable per content type; #3 per-persona output schema; #4 aggregate replaces single behavioral_predictions; #5 per-persona drop-off persisted; #6 cost ≤$0.025 with prompt cache).
- `.planning/REQUIREMENTS.md` §"Multi-Persona Simulation (Wave 3)" (PERSONA-01..11) — 11 requirements covering Wave 3 execution, allocation, output schema, persona definitions caching, V3 model, aggregate signal, per-persona drop-off persistence.
- `.planning/REQUIREMENTS.md` §"Pipeline Infrastructure" PIPE-08 — Wave 3 stage support (stub already wired per Phase 3 D-17).
- `.planning/REQUIREMENTS.md` §"Caching Layer" CACHE-03 — Persona prompt caching via DeepSeek input cache; pattern locked in Phase 3 D-12.
- `.planning/PROJECT.md` §"Engine architecture" Wave 3 spec — 10 personas FYP-weighted (6 FYP + 2 niche + 1 loyalist + 1 cross-niche); persona definitions cached for cost efficiency.
- `.planning/PROJECT.md` §"Creator profile (9-card interview)" — Card 5 (reference creators) + Card 6 (past wins/flops) flow into persona allocation + loyalist grounding.
- `.planning/STATE.md` §"Accumulated Context: Decisions" — milestone-start lock (additive-only engine, persona allocation, DeepSeek V4 Flash post Phase 4 D-03 migration).

### Prior Phase Context (Carry-Forward — MUST READ)
- `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md` — graceful-degradation pattern (Wave 3 must inherit: null + warning, never throw); 225-row Phase 1 corpus = eval substrate for D-14 lightweight A/B; baseline `macro_f1=0.294`, ECE=0.372, target `≥0.338`; eval harness `bypassCache: true` semantics extend to Wave 3.
- `.planning/phases/02-creator-profile-9-card-interview/02-CONTEXT.md` — D-19 `CreatorContext` flat extension (Phase 7 loyalist reads `creatorContext.past_wins` directly); PROFILE-16 prompt-injection mitigation (Card 6 wins/flops URLs surface as host-only in LLM context — applies to loyalist persona's prompt); D-10 hardcoded TS taxonomy module (extend with persona archetypes per D-05).
- `.planning/phases/03-pipeline-infrastructure/03-CONTEXT.md` — D-12 DeepSeek input-cache header (Phase 7 inherits — note: cache is AUTOMATIC per `deepseek.ts:52` no header needed); D-15 eval-harness bypass (Phase 7 inherits); D-17 Wave 3 stub contract (`runWave3(payload, deepseekResult, callback)`, returns `PersonaSimulationResult[]`); D-07 SignalAvailability forward-compat (Phase 7 adds `personas` key per D-15 above); D-19 stub return types are forward-compatible (Phase 7 widens `PersonaSimulationResult` per D-19).
- `.planning/phases/04-wave-0-content-type-niche-detection/04-CONTEXT.md` — D-08 Wave 0 niche output shape (Phase 7 consumes `Wave0NicheResult.primary` for niche-instantiation lookup); D-11 content-type categories (7-row allocation table in D-10 covers all 7); D-13 niche-archetype mappings field on `taxonomy.ts` (Phase 7 populates per-niche instantiation text); D-10 mixed_content_detected warning (Phase 7 falls back to `other` row when present).

### Codebase Maps
- `.planning/codebase/STACK.md` — TypeScript strict, Vitest 80% threshold, Next.js 15 App Router; DeepSeek client via OpenAI SDK; existing circuit breaker + retry pattern.
- `.planning/codebase/ARCHITECTURE.md` — Prediction pipeline wave structure (Wave 0 → Wave 1 parallel → Wave 2 sequential → Wave 3 (NEW — Phase 7 fills) → aggregator → stages 10/11 post-aggregator stubs).
- `.planning/codebase/INTEGRATIONS.md` — DeepSeek API integration (OpenAI-compatible, openai SDK v6, base URL `https://api.deepseek.com`, env `DEEPSEEK_API_KEY`).

### Existing Engine Code (to extend / instrument)
- `src/lib/engine/wave3.ts` — Current no-op stub (Phase 3 D-17). Phase 7 swaps the body for 10 parallel persona calls + aggregator. Contract: never throw; return empty array on full failure; emit `wave_3_personas` stage_start + stage_end pair (already wired).
- `src/lib/engine/types.ts` — `PersonaSimulationResult` interface (line 210). Phase 7 widens per D-19 (adds archetype, slot_type, niche, reasoning). Also extends `PredictionResult` (line 142) with `persona_behavioral_aggregate` + `persona_simulation_results` per D-20. Also extends `SignalAvailability` (line 198) with `personas: boolean` per D-15.
- `src/lib/engine/pipeline.ts` line 511 — `runWave3()` call site. Phase 7 reads `wave0Result.content_type` to drive allocation; passes `creatorContext` into Wave 3 for loyalist Card 6 grounding (Wave 0 already pre-fetches per Phase 4 D-17). Pipeline call signature may need a small additive extension or the existing args may suffice — planner picks.
- `src/lib/engine/deepseek.ts:19` — `DEEPSEEK_MODEL` constant (after Phase 4 D-03 = `"deepseek-v4-flash"`). Wave 3 reuses this client. Cache-aware pricing constants (lines 41–42) apply to Wave 3 cost telemetry per D-18.
- `src/lib/engine/deepseek.ts:54` — `STABLE_SYSTEM_PROMPT` cache pattern. Phase 7's persona system prompts MUST follow this discipline (stable prefix + variable tail per D-17).
- `src/lib/engine/aggregator.ts` — UNCHANGED in Phase 7 per D-08. Aggregator continues reading `deepseek.behavioral_predictions`. Phase 10 may revise.
- `src/lib/engine/events.ts` — `emitStageStart` / `emitStageEnd` helpers used by the current wave3 stub; Phase 7 reuses unchanged. Per-persona events likely use a structured stage name like `wave_3_persona_{archetype}_{slot_type}` to differentiate the 10 calls in event stream.
- `src/lib/engine/creator.ts` — `CreatorContext` interface (Phase 2 D-19 flat extension). Phase 7 loyalist persona reads `past_wins`, `niches[]`, `target_audience` from `creatorContext`.
- `src/lib/niches/taxonomy.ts` — Phase 4 D-13 added `personas: { archetype: string; weight: number }[]` field. Phase 7 populates per-niche instantiation text + extends the schema if richer per-niche data is needed (researcher proposes; planner locks per D-05).
- `src/lib/engine/corpus/` (Phase 1 modules) — Eval harness path; Phase 7's lightweight A/B (D-14) extends or wraps this. `bypassCache: true` semantics inherited (Phase 3 D-15).

### Phase 7 Outputs (will be created or extended)
- `src/lib/engine/wave3.ts` (rewritten body) — Orchestrates the 10 parallel persona calls + aggregation.
- `src/lib/engine/wave3/persona-registry.ts` (new) — Loads the 7-row allocation table (D-10) + the 6 archetype definitions (D-02) + per-niche instantiation (D-05).
- `src/lib/engine/wave3/persona-prompts.ts` (new) — `buildPersonaSystemPrompt()` + `buildPersonaUserMessage()` builders honoring D-17 cache discipline.
- `src/lib/engine/wave3/aggregator.ts` (new) — Per-metric different rule per D-06; top-3-enthusiast-weighted math; threshold logic per D-13.
- `src/lib/niches/taxonomy.ts` (extended) — Per-niche persona instantiation text per D-05.
- `src/lib/engine/types.ts` (extended) — Widened `PersonaSimulationResult` per D-19; `PredictionResult` additions per D-20; `SignalAvailability.personas` per D-15; matching Zod schemas.
- `src/lib/engine/__tests__/wave3.*.test.ts` (new) — Unit + integration tests per Claude's discretion notes.
- `.planning/research/persona-aggregate-ab-2026-05-XX.md` (new, post-Phase 7 ship) — Lightweight A/B comparison report per D-14.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`runWave3` no-op stub** (`src/lib/engine/wave3.ts`) — Phase 3 D-17 wired the event emission contract + null-on-failure scaffolding. Phase 7 only swaps the body.
- **`emitStageStart` / `emitStageEnd`** (`src/lib/engine/events.ts`) — Reused unchanged. Per-persona events likely structured by `wave_3_persona_{archetype}_{slot_type}` naming.
- **DeepSeek client + circuit breaker** (`src/lib/engine/deepseek.ts`) — Existing OpenAI-compatible client with circuit breaker (Phase 1 HARD-03 / HARD-04 mutex) + cache-aware pricing constants. Phase 7 invokes the same client 10 times in parallel via `Promise.all`.
- **Automatic DeepSeek input cache** — Per `deepseek.ts:52` comment: "DeepSeek caching is automatic — no opt-in header required." Phase 7's prefix-stable system prompts qualify automatically.
- **`STABLE_SYSTEM_PROMPT` cache pattern** (`deepseek.ts:54`) — The split between stable system prompt + dynamic user message is the proven cache-hit pattern. Phase 7 mirrors per D-17.
- **Zod schemas in `types.ts`** — Established validation-at-LLM-boundary pattern; Phase 7 adds `PersonaResponseSchema` (per-persona output) + extends Zod schemas for the widened `PersonaSimulationResult` (D-19).
- **`SignalAvailability` forward-compat pattern** — Phase 3 D-07 explicitly designed for additions; Phase 7 just adds the `personas` key.
- **`createLogger({ module: "..." })`** — Each new wave3 sub-module (`persona-registry`, `persona-prompts`, `aggregator`) logs under its own module name.
- **`fetchCreatorContext()`** (`src/lib/engine/creator.ts`) — Phase 4 D-17 pre-fetches creator context BEFORE Wave 0; Phase 7 reads the cached value from PipelineOptions for loyalist persona grounding. No duplicate fetch.
- **Phase 1 corpus + eval harness** (`src/lib/engine/corpus/`) — D-14 lightweight A/B extends or wraps the existing harness. Reuses `measureV21Baseline` -style entry point with a different aggregator-source patch.

### Established Patterns
- **Graceful degradation** — every detector / wave must catch thrown errors, return null/empty, push warning. Pipeline continues. (Phase 1 D-rule; Phase 3 / 4 inherits.)
- **Vitest 80% coverage** — new modules need tests; mock the DeepSeek client with deterministic responses.
- **Stage event emission at `timed()` granularity** — Phase 3 D-01; Phase 7 preserves per-persona events for the 10 calls.
- **`@sentry/nextjs` capture at error boundaries** — preserve at each persona call boundary.
- **DeepSeek input-cache discipline** (Phase 3 D-12) — stable prefix, variable tail. Phase 7's persona prompts are STRICTER on cache discipline than Phase 3's single wave_2 call because cache hits are load-bearing for the 10× cost factor.
- **Engine version constant** (Phase 3 D-06) — `import { ENGINE_VERSION } from "./version"` for any persona-aggregate provenance logging.
- **Engine-only env defaults** (Phase 4 D-03) — `DEEPSEEK_MODEL = "deepseek-v4-flash"` post-migration. Phase 7 uses the same env default; no per-call override (model selection is global to the milestone build).

### Integration Points
- **`pipeline.ts` ⟷ `runWave3`** — Existing call at line 511. Phase 7 may pass `wave0Result` + `creatorContext` if not already on the options bag.
- **`runWave3` ⟷ persona-registry** — Reads content_type → allocation row → activates exactly 10 personas with correct slot types + niche instantiation.
- **`runWave3` ⟷ persona-prompts** — Builds 10 distinct `{system, user}` prompt pairs.
- **`runWave3` ⟷ DeepSeek client** — `Promise.allSettled` over 10 parallel calls; surviving subset feeds aggregator per D-13.
- **`runWave3` ⟷ wave3/aggregator** — 10 `PersonaSimulationResult` (or fewer surviving) → per-metric different rule → `PersonaBehavioralAggregate` shape.
- **`runWave3` ⟷ pipeline result assembly** — Wave 3 output adds `persona_behavioral_aggregate` (null when threshold not met) + `persona_simulation_results` (empty on fallback) to `PredictionResult`.
- **`aggregator.ts` ⟷ Wave 3** — UNCHANGED in Phase 7 per D-08. Phase 10 may revise.
- **`SignalAvailability` ⟷ Wave 3** — aggregator sets `availability.personas = persona_behavioral_aggregate !== null` per D-15.
- **`taxonomy.ts` ⟷ Wave 3** — Phase 7's persona-registry reads `taxonomy.find(p => p.slug === primary).personas` to build per-niche archetype instantiation. Phase 4 D-13 already added the field; Phase 7 populates the content.
- **`creator.ts` ⟷ loyalist persona** — Loyalist's user message embeds `creatorContext.past_wins` (host-only URLs per Phase 2 PROFILE-16 mitigation). When `past_wins` is null, loyalist falls back to generic niche-loyal framing per D-03.
- **`Phase 1 corpus` ⟷ Phase 7 A/B eval** — D-14 lightweight A/B reads `training_corpus` rows + runs predictions with v2 vs persona-aggregate-substituted aggregator. Persists results to `benchmark_results` with distinct engine_version tags.

### NO changes to (preserved by additive-only constraint)
- `aggregator.ts` `SCORE_WEIGHTS` constant — behavioral 0.35 stays. Phase 10 may revise once persona aggregate is the source.
- `aggregator.ts` `selectWeights()` redistribution logic — preserved as-is.
- Existing Wave 1 + Wave 2 stage orchestration — Phase 7 only fills Wave 3, which is parallel and downstream.
- `gemini.ts` — Phase 7 does NOT touch Gemini; Wave 3 is text-only on `deepseek-chat`.
- Existing wave 1/2 cost telemetry contracts.
- Phase 4 Wave 0 detector outputs — Phase 7 consumes, does not modify.
- The 6/2/1/1 PROJECT.md framing — preserved at the level of "default allocation"; per-content-type table is the EXTENSION of that framing, not a replacement.

</code_context>

<specifics>
## Specific Ideas

- **User pushed back on the "demographically diverse FYP" framing** with "we need something which actually represents the FYP on TikTok" and later "the algo is smart". This re-framed the entire persona model from "random demographic mix" to "interest-cluster-aware archetypes." This is the most load-bearing user-vision insight of the discussion. Honor this voice in researcher / planner work: TikTok's FYP is a smart routing system; the audience for a video is the cluster it gets routed to, not a random slice. Per-niche persona instantiation flows from this.

- **User wanted me to "analyze yourself how we can improve"** when prompted on the first persona blueprint. This is an explicit invitation to push beyond the default proposal — surfacing the behavioral-archetype layer + scroll-stop triggers + psychographics + time-of-day context. The user's preference is for RICH persona prompts when cache makes them effectively free, NOT for minimum-viable. Apply this voice: prefer the richer option when cost permits.

- **User adjusted vlog allocation from my proposed 3/2/4/1 to 4/2/3/1** — small but signaling that even "community content" shouldn't go too loyalist-heavy. Vlogs can break out beyond the follower base; keeping 4 FYP slots preserves that upside. Apply this calibration when researcher proposes per-niche instantiation: don't over-fit to existing audience.

- **User chose "Add as new signal, Phase 10 decides swap"** over hard-swap or shadow-with-flag. This signals a preference for ADDITIVE / EVIDENCE-DRIVEN integration over LITERAL ROADMAP compliance. The "replaces" language in SC#4 is upgraded to "made available to replace" via the new field. Phase 10's calibration evidence drives the actual swap. Honor this voice in Phase 10 planning: don't swap without corpus evidence.

- **User chose "Lightweight A/B in Phase 7 eval"** for shadow validation. This signals a preference for FAST FEEDBACK over deferred risk. The ~$0.20 cost of running the corpus comparison once is worth the speed of knowing whether persona aggregate is working. Honor this voice: when shadow signals can be validated cheaply, do it now, not later.

- **User self-identified as non-technical** (carried from Phase 2 / 3 / 4): all schema / file / migration / SDK-config / test-surface decisions in this CONTEXT.md are Claude's discretion. User-facing questions were appropriately framed as "what does the engine DO" (persona identity, aggregation rule, content-type tuning, failure threshold) — schema details, retry mechanics, exact file splits stayed internal. Researcher / planner / executor follow-ups should preserve this division on Phase 7.

</specifics>

<deferred>
## Deferred Ideas

- **Aggregator swap from v2 DeepSeek behavioral → persona aggregate** — explicitly deferred to Phase 10 per D-08. Phase 10's ML audit + Platt calibration is the right place to make the swap with corpus evidence. Track as a Phase 10 input.

- **Creator-stage (Card 3) tuning on top of content-type allocation** — explicitly deferred to Phase 9 per D-12. Phase 9's REQUIREMENTS ALGO-05 owns creator-tier adjustments. Track as a Phase 9 input.

- **Per-archetype calibration (Platt scaling per archetype)** — once Phase 7 lightweight A/B (D-14) data is available, Phase 10 may discover certain archetypes are over- or under-predicting. Per-archetype calibration could correct for this. Defer until evidence justifies.

- **M2 audience-viz UI consuming `persona_simulation_results`** — Phase 7 persists the data with reasoning + archetype labels; M2 (Intelligence Surface milestone) designs the visualization. Track for M2 design phase.

- **Self-critique cross-reference against persona reasoning** — Phase 9's Stage 10 self-critique can read `persona_simulation_results[].reasoning` to check whether the aggregator's verdict is consistent with the personas' qualitative reactions. Track as a Phase 9 input.

- **Per-persona counterfactuals** — Phase 9's Stage 11 counterfactuals could go per-persona ("what change would make the tough crowd persona stop?") but Phase 9 is currently scoped to aggregate counterfactuals. If per-persona proves valuable in production, extend in a later milestone.

- **Persona expansion beyond 10** (e.g., 20 personas for higher-fidelity sims) — explicit cost / SC#1 hard-lock at 10. Defer until budget + accuracy data justify.

- **Cross-niche persona graph richness** — D-03 says cross-niche curiosity comes from "adjacent niche per taxonomy.ts edges". The adjacency graph is currently flat; a richer multi-edge graph (e.g., beauty has multiple adjacency types: skincare-adjacent, wellness-adjacent, makeup-adjacent) could improve cross-pollination signal. Defer until eval data shows current flat adjacency is the bottleneck.

- **Per-niche cache warmup script** (one-time, ~$0.20 cost) — Claude's discretion notes flag this; planner may include in Phase 7 plan if warmup latency on first user per niche becomes a real concern. Defer to planner-level decision.

- **Synthetic creator profiles for eval** — the 225-row Phase 1 corpus videos are competitor scrapes, no Card 6 wins/flops data. Loyalist persona reads as "loyal follower of [niche] creators generally" (null fallback) during eval. If eval shows loyalist signal is weak in this null-fallback configuration, future work could synthesize minimal creator profiles from corpus metadata. Defer until D-14 A/B reveals whether this matters.

- **Per-content-type tuning table revision (Phase 10)** — the locked table in D-10 is the v3.0-dev starting point. Phase 10 may revise based on corpus benchmark evidence. Track as a Phase 10 input (parallels Phase 4 D-12's weight-matrix revision-path).

- **PROFILE-16 re-prompt micro-card mechanism** — already deferred to Phase 11 per Phase 2 D-14. Not Phase 7 scope; included here as a reminder that the loyalist persona's Card 6 grounding depends on Card 6 being filled, which requires the modal flow already shipped in Phase 2.

</deferred>

---

*Phase: 7-Multi-Persona Simulation*
*Context gathered: 2026-05-18*
