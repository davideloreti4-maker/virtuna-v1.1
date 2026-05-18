# Phase 4: Wave 0 — Content Type + Niche Detection - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the existing Wave 0 no-op stub (`src/lib/engine/wave0.ts`, scaffolded in Phase 3) with two parallel classifier calls that run BEFORE Wave 1, plus the downstream weighting that consumes their output. Three coupled artifacts:

1. **Content-type classifier** — Gemini 3 Flash call on the first 5 seconds of video (via `videoMetadata: { startOffset: 0, endOffset: 5 }`). Returns one of 7 categories (locked-6 + `other`) with confidence + dominant-vs-mixed flag.

2. **Hierarchical niche detector** — DeepSeek V4 Flash text call reading caption + hashtags + creator handle + Card 5 reference creators + Card 6 past wins. Returns `{ primary, sub, micro, confidence }`. Falls back to creator profile Card 1 only at low confidence with Card 1 filled; otherwise returns AI's best guess + warning.

3. **Content-type × signal weight matrix in aggregator** — locked 7-row matrix multiplies Gemini sub-signals (`visual_production_quality`, `hook_visual_impact`, `pacing_score`, `transition_quality`) before they contribute to the Gemini score. Multipliers capped at [0.5, 1.5] floor/ceiling.

Plus two taxonomy extensions:

4. **Niche → persona-archetype mappings** — extend `src/lib/niches/taxonomy.ts` so each primary niche maps to a default persona-allocation profile (consumed by Phase 7's 10-persona simulation).

5. **Niche → benchmark-filter mappings** — extend taxonomy so each primary niche maps to a benchmark-pool filter rule (consumed by Phase 8's pgvector retrieval).

**Forced upgrade (independent of Phase 4 scope, folded in):** DeepSeek V3 (`deepseek-reasoner`) deprecates 2026-07-24. Migrate the `DEEPSEEK_MODEL` env default from `deepseek-reasoner` → `deepseek-v4-flash` AS PART OF Phase 4 (covers both the new Wave 0 niche call AND the existing Wave 2 reasoning call). One env-default flip, no per-call divergence.

**Out of scope this phase:**
- ML retrain + Platt calibration on new signals — Phase 10 (Aggregator Extension + ML Audit).
- Persona simulation execution against new niches — Phase 7 consumes mappings.
- Benchmark retrieval pipeline implementation — Phase 8 consumes mappings.
- Upgrading Gemini 2.5 Pro/Flash → Gemini 3 in Wave 1 (Phase 5 segment analysis) — flagged as deferred milestone-level question; Phase 5 scope.
- Per-content-type sub-classifier specialization (e.g., "dance subtype") — deferred.

</domain>

<decisions>
## Implementation Decisions

### Model Choice (foundational — applies pipeline-wide)

- **D-01: Content-type classifier uses Gemini 3 Flash on first 5s of video.** Native `videoMetadata: { startOffset: 0, endOffset: 5 }` window matches the pattern Phase 5 will use for hook/body/CTA. Cost ~$0.0008/call (5s × 258 tokens/sec × $0.50/M input + small output). Rationale: 6-way perceptual classification doesn't need Pro's reasoning; Flash is sufficient. First 5s gives enough visual evidence to distinguish slideshow / talking-head / B-roll without paying for full-video analysis (Phase 5 owns that). User selected 5s over 2s during discussion to boost confidence on edge cases (videos opening with title cards).

- **D-02: Niche detector uses DeepSeek V4 Flash with rich text context.** Inputs concatenated: caption + hashtags + creator handle + creator profile Card 1 (primary+sub) + Card 4 (style) + Card 5 reference creator handles + Card 6 past wins URLs (host-only, no URL bodies per Phase 2 prompt-injection mitigation). Cost ~$0.0001/call (~500 input tokens). Rationale: niche is a text-readable signal; V4 Flash is the cheapest competent text classifier; rich context is essentially free and improves confidence.

- **D-03: DeepSeek V3 → V4 migration folded into Phase 4.** Flip `DEEPSEEK_MODEL` env default from `deepseek-reasoner` → `deepseek-v4-flash` in the same phase. Forced by 2026-07-24 deprecation; doing it now means Wave 0 ships on V4 from day one and the existing Wave 2 reasoning call (the only other DeepSeek consumer today) migrates simultaneously. Update `DEEPSEEK_CACHE_HIT_PRICE_PER_TOKEN` / `DEEPSEEK_CACHE_MISS_PRICE_PER_TOKEN` constants if V4 pricing differs from current constants (verify against api-docs.deepseek.com/quick_start/pricing).

- **D-04: Gemini 3 Flash for content type; Gemini 2.5 Pro/Flash UNCHANGED for Wave 1 (Phase 5).** Phase 4 introduces Gemini 3 only for the new Wave 0 video segment call. Phase 5's hook (2.5 Pro) + body/CTA (2.5 Flash) decisions are NOT touched here. Whether to upgrade Wave 1 to Gemini 3 is a Phase 5 / milestone decision, deferred.

### Niche Detector Behavior

- **D-05: Confidence threshold = 0.6 for Card 1 fallback (per SC#3).** When AI confidence ≥ 0.6 → use AI output. When AI confidence < 0.6 AND Card 1 is filled → fall back to Card 1 (primary + sub). When AI confidence < 0.6 AND Card 1 is empty → return AI's best guess + emit `niche_low_confidence_no_fallback` pipeline warning. Eval harness flags these for audit. Downstream stages still get a niche to work with; aggregator can soft-handle via the warning.

- **D-06: AI wins disagreements when confident.** When AI confidence ≥ 0.6 but the detected primary niche disagrees with Card 1 (creator marked "Beauty", AI detects "Fitness"), use AI's value and emit a `niche_drift_detected` warning containing both values. Rationale: creators experiment, pivot, cross-post; the per-video AI signal is more accurate for THIS video than the static profile choice. Warning surfaces in eval harness so we can spot systematic creator-mislabeling patterns. (User raised "extend Gemini to 5s for more confidence" during this question — applied via D-01.)

- **D-07: `micro_niche` returns null at low confidence.** The third taxonomy level (e.g., "skincare-reviews" vs "skincare") is AI-only (Phase 2 D-09 — not in user-input). When AI confidence on micro < 0.6, return null. Downstream consumers (Phase 7 personas, Phase 8 benchmark retrieval) filter on primary + sub only when micro is null — graceful, no synthetic guesses pollute downstream signals.

- **D-08: Returned shape.**
  ```ts
  type Wave0NicheResult = {
    primary: string;          // always present (slug from NICHE_TREE)
    sub: string;              // always present (slug from NICHE_TREE)
    micro: string | null;     // null when AI low-confidence on micro
    confidence: number;       // 0..1 — overall niche-detection confidence
    source: "ai" | "card1_fallback";
    warning?: "niche_drift_detected" | "niche_low_confidence_no_fallback";
  }
  ```
  Replaces the placeholder `{ primary, sub, micro }` shape in `Wave0Result.niche` from `src/lib/engine/types.ts` lines 205–209. Type widen happens in Phase 4's migration of `Wave0Result`.

### Content-Type Classifier Behavior

- **D-09: 7-category vocabulary.** Locked 6 from REQUIREMENTS CONTENT-01 + `other` as the 7th catch-all. Categories: `talking_head`, `b_roll`, `slideshow`, `action`, `tutorial`, `vlog`, `other`. TikTok-native types not in the locked 6 (dance, ASMR, music, gameplay, animation, etc.) map to `other` with 1.0× passthrough weights (no signal adjustment applied). Future phase can promote frequently-seen `other` categories to first-class (e.g., add `dance` as 8th type) when corpus volume justifies it.

- **D-10: Mixed-content handling — dominant + warning.** When a video shifts mid-stream (talking-head 5s → B-roll 25s), classifier returns the dominant type (B-roll in this example) AND emits a `mixed_content_detected` warning. Aggregator can choose to soften weight multipliers when this warning is present (Phase 4 ships the warning emit; warning-soft behavior is Claude's discretion in aggregator integration).

- **D-11: Returned shape.**
  ```ts
  type Wave0ContentTypeResult = {
    type: "talking_head" | "b_roll" | "slideshow" | "action" | "tutorial" | "vlog" | "other";
    confidence: number;       // 0..1
    warning?: "mixed_content_detected" | "low_confidence";
  }
  ```
  Replaces `Wave0Result.content_type: string | null` from `src/lib/engine/types.ts` line 207. Null no longer returned — `other` covers the unknown case; total-failure path emits the existing graceful-degradation warning from the wave0.ts contract.

### Content-Type × Signal Weight Matrix (D-12 — LOAD-BEARING)

The aggregator multiplies each Gemini sub-signal (`visual_production_quality`, `hook_visual_impact`, `pacing_score`, `transition_quality`) by the content-type-specific multiplier BEFORE the Gemini sub-signals are combined into the Gemini score that contributes 0.25 to overall.

```
Content type   | visual_quality | hook_visual | pacing | transition
---------------+----------------+-------------+--------+-----------
talking_head   |     1.0        |     1.1     |   1.0  |    0.8
b_roll         |     1.2        |     1.0     |   1.0  |    1.2
slideshow      |     0.8        |     0.9     |   0.5  |    0.7
action         |     1.3        |     1.2     |   1.2  |    1.3
tutorial       |     1.0        |     1.2     |   1.1  |    1.0
vlog           |     0.9        |     0.8     |   0.9  |    0.9
other          |     1.0        |     1.0     |   1.0  |    1.0
```

**Caps:** multipliers floor at 0.5 and ceiling at 1.5 (no signal can be killed or dominate).

**Rationale (user-confirmed):**
- Slideshows: pacing is irrelevant (static), transitions don't apply (no cuts)
- Action: everything matters (motion-heavy, production quality visible)
- Talking head: visual quality + transitions matter less (it's about the person)
- B-roll: aesthetic + transitions matter most (storytelling-driven)
- Tutorial: hook + pacing matter most (people drop fast if confused)
- Vlog: casual baseline (viewers tolerate lower production)
- Other: passthrough — we don't know enough to weight

**Phase 10 evolution path:** Phase 10 (ML Audit + Calibration + Aggregator Extension) may revise the matrix based on corpus benchmark evidence. The matrix locked here is the v3.0-dev starting point; Phase 12's acceptance benchmark validates whether the matrix improves accuracy vs v2.1 baseline.

### Taxonomy Extensions

- **D-13: Persona-archetype mappings extend `src/lib/niches/taxonomy.ts`.** Each `NichePrimary` gets a new optional field: `personas: { archetype: string; weight: number }[]` describing the default persona-allocation profile for Phase 7's 10-persona simulation. Researcher proposes the per-niche persona mix during phase planning, grounded in Phase 1 corpus characteristics. Default fallback when niche is `other` or null: balanced 6/2/1/1 from PROJECT.md ("6 FYP + 2 niche + 1 loyalist + 1 cross-niche").

- **D-14: Benchmark-filter mappings extend `src/lib/niches/taxonomy.ts`.** Each `NichePrimary` gets a new optional field: `benchmark_filters: { tag_filters: string[]; min_corpus_size: number }` describing the pgvector retrieval query Phase 8 will use. Researcher proposes per-niche tag filter list during phase planning, grounded in Phase 1 corpus video tagging.

- **D-15: Single migration scope.** All taxonomy extensions live in `taxonomy.ts` (per Phase 2 D-10's "hardcoded TS module" principle — no Supabase table). The file grows by ~100-200 lines of mapping data. Alternative considered: split into `taxonomy.ts` (tree) + `niche-mappings.ts` (downstream consumer mappings) — Claude's discretion at plan time.

### Pipeline Integration

- **D-16: Wave 0 stub fills in place — no new pipeline orchestration.** `runWave0(payload, onStageEvent)` in `src/lib/engine/wave0.ts` already exists with the correct event-emission contract (Phase 3 D-16). Phase 4 swaps the no-op body for two parallel calls: `Promise.all([detectContentType(payload, onStageEvent), detectNiche(payload, creatorContext, onStageEvent)])`. Preserves null-return-on-failure: if either call throws, that call's result is null, the OTHER result still returns, pipeline continues with a warning. Per-call event emission preserved: `wave_0_content_type` + `wave_0_niche_detector` stage_start + stage_end pairs (already wired).

- **D-17: Wave 0 reads `creatorContext` from Wave 1.** Niche detector needs Card 1 fallback + Card 4/5/6 context, which lives on `creatorContext` from `fetchCreatorContext()`. But `creatorContext` is computed in Wave 1's parallel block (after Wave 0 in the current sequence). Fix: pre-fetch creator context BEFORE Wave 0 (it's a cheap DB read, ~50ms), pass it to `runWave0()`. Wave 1 then reuses the cached value. Adds a `pre_creator_context` timing event before `wave_0_*` events; pipeline call site updates accordingly. (Alternative considered: defer the niche detector to AFTER Wave 1; rejected because it breaks "Wave 0 fires before Wave 1" contract from P3 D-16.)

- **D-18: Cache pre-fetched creatorContext on the pipeline options bag.** Add `creatorContext?: CreatorContext` to `PipelineOptions`; if absent, Wave 0 fetches it; Wave 1 reads from options. Avoids double-fetch. Claude's discretion on whether `creatorContext` becomes a first-class pipeline argument vs stays on the options bag — planner picks.

- **D-19: Aggregator integration is a function-signature extension, not a rewrite.** `aggregateScores()` currently consumes a `PipelineResult`. Phase 4 adds `wave0Result.content_type.type` lookup → multiplier table → applies to each `geminiAnalysis.video_signals.*` field before they contribute to the `gemini_score`. Per "additive only" milestone constraint, this is an in-place extension of existing aggregator logic, not a new module.

### Eval / Telemetry

- **D-20: Wave 0 outputs feed `signal_availability` JSONB persistence.** Add `content_type: boolean` + `niche: boolean` keys to the `SignalAvailability` interface in `src/lib/engine/aggregator.ts` lines 197–203 (and matching DB JSONB shape). `true` when classifier returned a value; `false` when stage failed gracefully. Phase 3's persistence pipeline already handles new keys via D-07's "forward-compat: future phases add their own keys".

- **D-21: Cost telemetry.** Wave 0 stage_end events carry `cost_cents` per call. Gemini-3-Flash on 5s ≈ 0.08 cents; V4-Flash text ≈ 0.01 cents. Two calls total ≈ 0.09 cents added to per-analysis cost (~1.4% bump from current ~$0.065 baseline). Within milestone cost budget.

- **D-22: Eval harness bypass behavior unchanged.** Wave 0 inherits Phase 3 D-15's `bypassCache: true` semantics for the eval harness — every eval run produces fresh Wave 0 outputs, no memoization masking real-engine behavior. Wave 0 itself does NOT introduce a stage-level cache (cost is too low to bother, and L1/L2 prediction cache already covers the full result).

### Claude's Discretion

- **Persona-archetype mapping content** (D-13) — researcher proposes per-primary-niche persona mix during planning, grounded in Phase 1 corpus. User does not need to spec each niche's mix.
- **Benchmark-filter mapping content** (D-14) — researcher proposes per-primary-niche pgvector filter rules during planning, grounded in Phase 1 corpus tagging.
- **File organization** — single `taxonomy.ts` vs split into `taxonomy.ts` + `niche-mappings.ts`. Planner picks based on file size after additions.
- **Detector implementations** — separate files `src/lib/engine/wave0/content-type-detector.ts` + `src/lib/engine/wave0/niche-detector.ts` invoked from `wave0.ts`, vs inline in `wave0.ts`. Planner picks.
- **Confidence-threshold knobs** — 0.6 (niche fallback per spec), 0.6 (micro_niche null cutoff per D-07). Both become env-overridable constants OR hardcoded; planner picks.
- **Gemini structured-output schema** — Zod schema for the content-type classifier response. Likely: `{ type: enum-of-7, confidence: number(0..1), mixed: boolean, dominant_seconds: number, secondary_type?: enum-of-7 }`. Planner refines.
- **DeepSeek structured-output prompt** — system prompt + user prompt template for V4 Flash niche detection. Includes the NICHE_TREE primary list inline so the model picks from the locked vocabulary. Researcher locks the prompt; planner integrates.
- **Aggregator weight-application location** — inside `aggregateScores()` body vs a new `applyContentTypeWeights(videoSignals, contentType)` helper. Planner picks.
- **Migration scope** — Wave 0 needs NO SCHEMA change (results flow into `analysis_results` via existing JSON columns + `signal_availability` extension). Confirm no migration is needed; if Phase 4 still needs one, it must be additive-only.
- **Test surface** — Vitest unit tests for: content-type classifier (mocked Gemini), niche detector (mocked V4), confidence-threshold edge cases (0.59 vs 0.60), Card 1 fallback path, AI-wins-disagreement path, micro_niche null path, mixed-content warning emission, weight-matrix application, weight-cap enforcement. Integration test for wave0.ts emitting both event pairs correctly. 80% Vitest threshold per project policy.
- **V4 Flash cache header continuation** — Phase 3 D-12's DeepSeek input-cache header pattern applies to the new niche detector call; planner verifies header still works on V4 endpoint (DeepSeek docs may have updated for V4).
- **Niche slug normalization** — Detector returns slugs (e.g., `"skincare-reviews"`), not labels. Slugs live in `src/lib/niches/taxonomy.ts`. Detector prompt instructs model to return slugs only. Planner enforces via Zod enum validation against `NICHE_TREE`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 4: Wave 0 — Content Type + Niche Detection" — phase goal, depends-on Phase 3, 5 success criteria (#1 Wave 0 parallel calls; #2 content type 6-category enum; #3 niche hierarchical + 0.6 fallback; #4 taxonomy persona/benchmark mappings; #5 content-type-aware aggregator weighting).
- `.planning/REQUIREMENTS.md` §"Content Type + Niche Detection (Wave 0)" (CONTENT-01..04) — 4 requirements covering classifier + niche detector + taxonomy tree + content-type-aware signal weighting.
- `.planning/PROJECT.md` §"Engine architecture (all additive — no rewrite of existing pipeline.ts or aggregator.ts)" — Wave 0 sits before Wave 1; Wave 1 is parallel Gemini + audio + creator + rules.
- `.planning/STATE.md` §"Accumulated Context: Decisions" — milestone constraints (additive-only, ~$0.065 budget, eval harness bypass).

### Prior Phase Context (Carry-Forward)
- `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md` — graceful-degradation pattern (Wave 0 must inherit: null + warning, never throw); corpus 5-niche anchor (Beauty/Fitness/Edu/Comedy/Lifestyle) reused for niche detector calibration; eval-harness `bypassCache` semantics extend to Wave 0 stages.
- `.planning/phases/02-creator-profile-9-card-interview/02-CONTEXT.md` — D-09 2-level user input depth (Phase 4 owns `micro_niche`); D-10 hardcoded TS taxonomy module (extend, not migrate to DB); D-19 CreatorContext flat extension already done (Phase 4 reads Card 1/4/5/6 fields directly). PROFILE-16 prompt-injection mitigation: past wins/flops URLs surface as host-only in LLM context.
- `.planning/phases/03-pipeline-infrastructure/03-CONTEXT.md` — D-07 SignalAvailability forward-compat (Phase 4 adds `content_type`/`niche` keys); D-12 DeepSeek input-cache header (Phase 4 niche call reuses); D-15 eval harness bypass (Phase 4 inherits); D-16 Wave 0 stub contract (Phase 4 fills); D-19 stub return types are explicit + forward-compatible (Phase 4 may widen `Wave0Result` shape).

### Codebase Maps
- `.planning/codebase/STACK.md` — TypeScript strict, Vitest 80% threshold, Next.js 15 App Router; DeepSeek client via OpenAI SDK; Gemini client via @google/generative-ai.
- `.planning/codebase/ARCHITECTURE.md` — prediction pipeline wave structure (Wave 0 → Wave 1 parallel → Wave 2 sequential → aggregator → stages 10/11 critique/counterfactual).
- `.planning/codebase/INTEGRATIONS.md` — DeepSeek API integration shape; Gemini API integration shape (videoMetadata pattern).

### Existing Engine Code (to extend / instrument)
- `src/lib/engine/wave0.ts` — current no-op stub (Phase 3 D-16). Phase 4 swaps the body. Contract: never throw, return `{ content_type: null, niche: null }` on full failure, emit `wave_0_content_type` + `wave_0_niche_detector` event pairs.
- `src/lib/engine/types.ts` lines 205–209 — `Wave0Result` interface (Phase 3 D-19). Phase 4 widens `content_type: string | null` → `Wave0ContentTypeResult | null` and `niche: { primary, sub, micro }` → `Wave0NicheResult | null`. Add Zod schemas for both new shapes.
- `src/lib/engine/pipeline.ts` line 269 — `runWave0(payload, onStageEvent)` call site. Phase 4 adds creator-context pre-fetch BEFORE this line (D-17) and passes it to `runWave0()`.
- `src/lib/engine/aggregator.ts` lines 25–35 — `SCORE_WEIGHTS` constant (top-level signal weights). Phase 4 leaves SCORE_WEIGHTS untouched; weight matrix applies INSIDE the Gemini sub-signal aggregation BEFORE the Gemini score contributes 0.25 to overall.
- `src/lib/engine/aggregator.ts` lines 197–203 — `SignalAvailability` interface. Phase 4 adds `content_type: boolean` + `niche: boolean` keys (matches Phase 3 D-07 forward-compat).
- `src/lib/engine/deepseek.ts` line 19 — `DEEPSEEK_MODEL` constant default. Phase 4 flips `"deepseek-reasoner"` → `"deepseek-v4-flash"` (D-03). Verify cache-pricing constants lines 41–42 still match V4 pricing.
- `src/lib/engine/gemini.ts` line 17 — `GEMINI_MODEL` constant default. Phase 4 does NOT change this (it's the Wave 1 model). Wave 0's Gemini 3 Flash model lives separately, likely as `GEMINI_WAVE0_MODEL` env var defaulting to `"gemini-3-flash"`.
- `src/lib/niches/taxonomy.ts` — Existing 2-level NICHE_TREE (10 primaries × 8-12 subs). Phase 4 extends `NichePrimary` type with `personas` + `benchmark_filters` fields (D-13, D-14).
- `src/lib/engine/events.ts` — `emitStageStart` / `emitStageEnd` helpers used by current wave0.ts stub; Phase 4 reuses unchanged.
- `src/lib/engine/creator.ts` — `fetchCreatorContext()` + `CreatorContext` interface (Phase 2 extension). Phase 4's niche detector reads Card 1/4/5/6 fields off this. Phase 4 may add a `prefetchCreatorContext()` export if D-17 pre-fetch lives there.

### Phase 4 Outputs (will be created or extended)
- `src/lib/engine/wave0/content-type-detector.ts` (new) — Gemini 3 Flash call on video[0-5s].
- `src/lib/engine/wave0/niche-detector.ts` (new) — DeepSeek V4 Flash text call.
- `src/lib/engine/wave0.ts` (rewritten body) — orchestrates the two parallel calls.
- `src/lib/engine/wave0/content-type-weights.ts` (new) — exports the locked 7×4 matrix + `applyContentTypeWeights(videoSignals, contentType)` helper.
- `src/lib/niches/taxonomy.ts` (extended) — adds `personas` + `benchmark_filters` per primary niche.
- `src/lib/engine/types.ts` (extended) — `Wave0ContentTypeResult`, `Wave0NicheResult`, widened `Wave0Result`; matching Zod schemas.
- `src/lib/engine/aggregator.ts` (extended) — adds `content_type` + `niche` keys to `SignalAvailability`; applies content-type weight matrix inside Gemini sub-signal aggregation.
- `src/lib/engine/pipeline.ts` (extended) — pre-fetch creator context, pass to runWave0.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`runWave0` no-op stub** (`src/lib/engine/wave0.ts`) — event-emission contract + null-on-failure scaffolding already correct. Phase 4 only swaps the body.
- **`emitStageStart` / `emitStageEnd`** (`src/lib/engine/events.ts`) — Phase 4 reuses; no new event helpers needed.
- **`fetchCreatorContext()`** (`src/lib/engine/creator.ts`) — read-once contract; Phase 4 invokes BEFORE Wave 0 (D-17) and caches via PipelineOptions.
- **OpenAI SDK client pattern in `deepseek.ts`** — `client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" })`. Phase 4 niche detector reuses this client; same circuit-breaker / timeout / retry pattern.
- **Gemini SDK + videoMetadata pattern** — Phase 5 will heavy-use this; Phase 4 introduces it earlier for the 5-second content-type window. Native `videoMetadata: { startOffset, endOffset }` on the Gemini Files API upload.
- **Zod schemas in `types.ts`** — established validation-at-LLM-boundary pattern; Phase 4 adds `Wave0ContentTypeResultSchema` + `Wave0NicheResultSchema`.
- **`SignalAvailability` forward-compat pattern** — Phase 3 D-07 explicitly designed for Phase 4 additions; just add the new keys + persist via existing path.
- **`createLogger({ module: "..." })`** — every new detector file logs under its own module name.

### Established Patterns
- **Graceful degradation** — both detectors must catch thrown errors, return null, push warning. Pipeline continues. (Phase 1 D-rule; Phase 3 inherits.)
- **Vitest 80% coverage** — new modules need tests; mock the LLM clients with deterministic responses.
- **Stage event emission at `timed()` granularity** — Phase 3 D-01; Phase 4 preserves per-call events (`wave_0_content_type` + `wave_0_niche_detector` already wired).
- **`@sentry/nextjs` capture at error boundaries** — preserve at both detector boundaries.
- **DeepSeek input-cache header** (Phase 3 D-12) — Phase 4's niche detector reuses the cache directive to qualify for the 80% cached-input discount on prefix tokens.
- **Service client for DB reads in pipeline** — `createServiceClient()` for the pre-fetched creator context.
- **Engine version constant from dedicated module** (Phase 3 D-06) — `import { ENGINE_VERSION } from "./version"` for any version-aware logging.

### Integration Points
- **`pipeline.ts` ⟷ creator pre-fetch** — Phase 4 inserts a `preCreatorContext` step before `runWave0`, passes the result via PipelineOptions.
- **`runWave0` ⟷ two detectors** — `Promise.all([detectContentType(...), detectNiche(...)])` inside `runWave0`. Each detector emits its own start/end events. Stub event emit pairs already correct.
- **`Wave0Result` ⟷ `aggregator.ts`** — `aggregateScores()` reads `wave0Result.content_type.type` to look up multipliers from the locked matrix; applies to `geminiAnalysis.video_signals.*` BEFORE Gemini sub-score computation.
- **`Wave0Result` ⟷ `SignalAvailability`** — aggregator sets `availability.content_type = wave0Result.content_type !== null` + `availability.niche = wave0Result.niche !== null`.
- **`taxonomy.ts` ⟷ Phase 7 (downstream)** — Phase 7's persona allocator reads `taxonomy.find(p => p.slug === primary).personas` to build the 10-persona mix.
- **`taxonomy.ts` ⟷ Phase 8 (downstream)** — Phase 8's pgvector retrieval reads `taxonomy.find(p => p.slug === primary).benchmark_filters` to scope the similarity query.

### NO changes to (preserved by additive-only constraint)
- `aggregator.ts` `SCORE_WEIGHTS` constant — top-level signal weights stay (`behavioral 0.35 / gemini 0.25 / ml 0.15 / rules 0.15 / trends 0.10`). Phase 4 weights apply at Gemini sub-signal level.
- `aggregator.ts` `selectWeights()` redistribution logic — preserved as-is.
- Existing Wave 1 stage orchestration — Phase 4 only adds the pre-fetch before Wave 0; does NOT reorder Wave 1.
- `gemini.ts` GEMINI_MODEL default — stays `gemini-2.5-flash` for Wave 1. Wave 0 uses a separate model env (D-04).
- Existing wave 1/2 cost telemetry contracts.

</code_context>

<specifics>
## Specific Ideas

- **User questioned model choice up-front** ("verify model choice should be gemini 3 vision and deepseek v4 flash. if not lets discuss this too"). This instinct surfaced the forced DeepSeek V3 → V4 migration (July 24 deprecation) and validated Gemini 3 as the right tier. Honor this voice when researcher/planner review model defaults — prefer modern + cheap (V4 Flash / Gemini 3 Flash) unless evidence demands stepping up to Pro tier.

- **User chose to extend Gemini analysis from 2s → 5s for more confidence** (during niche disagreement question, applied to content-type window). This signals a preference for "spend a tiny bit more for confidence" when costs are still <$0.001 — biases the planner toward generous compute for classifier confidence, not absolute minimum.

- **User accepted the LOCKED weight matrix as-is** — including the qualitative rationale I drafted. The matrix is now load-bearing; Phase 10's revision must justify any deviation against Phase 1 corpus benchmark data, not just intuition.

- **User self-identified as non-technical** (carried from Phase 2/3): "i dont have much technical knowleadge". All schema/file/migration/SDK-config/test-surface decisions in this CONTEXT.md are Claude's discretion. User-facing questions in this phase were appropriately framed as "what should the engine DO" — schema details were not surfaced. Researcher/planner should preserve this division on follow-ups.

</specifics>

<deferred>
## Deferred Ideas

- **Gemini 2.5 Pro/Flash → Gemini 3 upgrade for Wave 1 (Phase 5 segment analysis)** — flagged during model-choice discussion. Phase 4 only introduces Gemini 3 Flash for the new Wave 0 video segment. Whether Phase 5 should upgrade hook (currently 2.5 Pro) and body/CTA (currently 2.5 Flash) is a milestone-level question deferred to Phase 5 discussion. Cost implication: Gemini 3 Pro is significantly more expensive than 2.5 Pro; cost-benefit needs corpus-grounded evaluation.

- **Promoting frequent `other` categories to first-class** (D-09) — when corpus volume on dance / ASMR / music / gameplay grows, future phase can add them as 8th/9th content types with their own weight rows. Defer until eval data shows category misclassification hurting accuracy.

- **Phase 10 weight-matrix revision based on corpus evidence** (D-12) — the locked matrix is the v3.0-dev starting point. Phase 10 may revise based on which weight adjustments actually correlate with outcome improvements in the 225-video corpus. Track as a Phase 10 input.

- **Per-content-type sub-classifier specialization** — e.g., a "dance subtype" classifier inside `other`-routed dance videos, or a "tutorial step count" detector inside `tutorial`-routed videos. Domain-specific signal extraction. Deferred to post-M1 milestone (Intelligence Surface or later).

- **Caching Wave 0 outputs separately from full PredictionResult** (D-22) — Wave 0 results would be identical across users for the same content_hash (niche + content_type don't depend on user). A content-hash-only Wave 0 cache could save re-runs across users. Deferred until hit-rate data justifies the complexity; current L1/L2 prediction cache (Phase 3 D-11) already covers single-user re-uploads.

- **DeepSeek V4 Pro evaluation for niche detection** — V4 Flash chosen for cost/sufficiency. If eval harness shows V4 Flash misclassifying systematically on edge niches, evaluate V4 Pro as a quality upgrade. Cost delta is real (V4 Pro is several× V4 Flash). Defer until data justifies.

- **Aggregator soft-handling of `mixed_content_detected` warning** (D-10) — Phase 4 emits the warning but does not change weight-application behavior in response. Future phase can introduce e.g. "blend dominant + secondary weights weighted by `dominant_seconds`" when the warning is present. Track for Phase 10 aggregator extension consideration.

- **Niche taxonomy expansion (10 primaries → 15-20)** — current taxonomy covers Beauty/Fitness/Education/Comedy/Lifestyle/Food/Tech/Gaming/Fashion/Music. If corpus data shows specific niches consistently mismapped (e.g., "Travel" forcing into Lifestyle), add new primaries. Defer until corpus reveals the gap.

- **`micro_niche` user-input field re-introduction** (Phase 2 D-09 — UI dropped level 3) — if AI-only `micro_niche` proves unreliable, a future phase can re-add a level-3 picker to Card 1 as an optional drill-down. Track based on detector confidence distribution in eval harness.

</deferred>

---

*Phase: 4-Wave 0 — Content Type + Niche Detection*
*Context gathered: 2026-05-18*
