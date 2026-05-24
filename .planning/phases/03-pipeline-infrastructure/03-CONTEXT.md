# Phase 3: Pipeline Infrastructure - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Three plumbing upgrades to `runPredictionPipeline()` and `/api/analyze` that unblock every subsequent engine phase:

1. **Stage event stream** — `runPredictionPipeline()` gains an optional `onStageEvent(event)` callback. Every `timed()` boundary inside the pipeline emits a start + end event with stage name, duration, cost, and any partial payload. `/api/analyze` consumes the callback and forwards events through its existing SSE stream as structured per-signal events (richer than today's three coarse `phase` messages). Granularity is parallel-aware: each Wave 1 sibling (gemini hook / body / CTA / audio / creator / rules) emits its own start+end events, not a single bundled event. Existing call sites continue passing `undefined` for the callback and observe ZERO behavioral change.

2. **Engine versioning + provenance** — A single source-of-truth `ENGINE_VERSION` constant moves from `aggregator.ts` to a dedicated `src/lib/engine/version.ts` module, bumped to `"3.0.0-dev"` for this milestone build (flips to `"3.0.0"` only when Phase 12's acceptance gate passes). Every `analysis_results` row is tagged with `engine_version` (already exists) + a new `signal_availability JSONB` column persisting the `SignalAvailability` object that aggregator already computes internally but does not currently store. The JSONB shape is forward-compatible — new fields (personas, audio, retrieval, hook_decomp, content_type, niche, platform_fit, critique, counterfactual) added as later phases ship signals; missing fields read as `false`.

3. **Caching layer** — Three caches at three different scopes:
   - **Content-hash cache (full prediction)** — SHA-256 of video buffer keyed with `(content_hash, engine_version, user_id)`; cache hit returns the prior `PredictionResult` JSON silently in <2s. TTL = 24h. Two-tier lookup: in-memory L1 (existing `src/lib/cache.ts` pattern) + Supabase L2 fallback (query `analysis_results WHERE content_hash = ? AND engine_version = ? AND user_id = ? AND created_at > now() - 24h` to survive Vercel cold starts).
   - **DeepSeek input cache (persona prompt prefix)** — `Cache-Control` header on DeepSeek chat completions to get the 80% input-token discount on cached prefixes. Phase 3 verifies the header works against the existing single DeepSeek call in `wave_2`; Phase 7's 10-persona simulation will benefit most. Cache key managed server-side by DeepSeek; we just emit the header + structure prompts so the cached prefix stays stable.
   - **Niche taxonomy in-memory cache** — Phase 2's D-10 already locks the taxonomy as a hardcoded TS module (`src/lib/niches/taxonomy.ts`). Module-init caching is implicit via Node's import resolution — no explicit cache needed. Phase 3 documents this as the satisfied path for CACHE-04 (no code change).

**Light scaffolding for future waves (in scope, per Q4):** Phase 3 wires no-op pass-through hooks into the pipeline for Wave 0 (Phase 4 fills with content-type + niche detector), Wave 3 (Phase 7 fills with 10-persona simulation), and post-aggregator Stage 10 (Phase 9 self-critique) + Stage 11 (Phase 9 counterfactuals). Each stub: calls `timed()`, emits start+end events, returns a typed empty result. Subsequent phases swap the no-op body for real logic without touching pipeline orchestration.

**Out of scope this phase:**
- The actual implementations of Wave 0 (Phase 4), Wave 3 (Phase 7), Stage 10/11 (Phase 9) — only the empty hooks.
- The /api/analyze SSE client-side consumer / M2 live signal dashboard UI — Phase 3 emits events; the M2 milestone designs the UI.
- A persistent cache tier beyond `analysis_results` lookup (no new `prediction_cache` table; no Vercel KV; no Redis).
- Cache invalidation policy beyond engine-version mismatch + TTL.

</domain>

<decisions>
## Implementation Decisions

### Stage Event Stream (PIPE-01..04)

- **D-01: Live signal dashboard granularity.** Stage events are fine-grained: each `timed()` boundary inside `runPredictionPipeline()` emits a start event and an end event. Wave 1's parallel siblings (`gemini_hook`, `gemini_body`, `gemini_cta` once Phase 5 ships them — for Phase 3 just the existing `gemini_analysis`/`gemini_video_analysis`, `audio_analysis`, `creator_context`, `rule_scoring`) each emit their own pair of events, not a single bundled wave event. User chose this in Q1 specifically to drive the M2 "live audience viz" UX. **Driving rule:** if a stage is its own `timed()` call today or will become one in future phases, it gets its own event pair.

- **D-02: Event payload shape (Claude's discretion — locking now to avoid bikeshed downstream).** Structured discriminated-union:
  ```ts
  type StageEvent =
    | { type: "stage_start"; stage: string; wave: 0|1|2|3|"aggregator"|"post"; timestamp_ms: number }
    | { type: "stage_end"; stage: string; wave: 0|1|2|3|"aggregator"|"post"; duration_ms: number; cost_cents: number; ok: boolean; warning?: string }
    | { type: "pipeline_warning"; message: string; stage?: string };
  ```
  Per-stage `cost_cents` defaults to 0 for non-LLM stages. The route translates each `StageEvent` to an SSE `event: stage` payload — preserving the existing `event: phase` envelope for backwards compat with whatever current /api/analyze client there is.

- **D-03: SSE-vs-not branching on `Accept` header.** Today the route ALWAYS returns SSE. SC#2 says "SSE response works when client sends `Accept: text/event-stream`" — interpreted as: existing SSE behavior stays, but a non-SSE caller (e.g., a script setting `Accept: application/json`) receives a JSON `PredictionResult` instead. Implementation: detect `Accept` header at route entry; if it does NOT include `text/event-stream`, run the pipeline and return `Response.json(result)`. If it does, run the existing stream path. Both share the same pipeline call. (Required to satisfy SC#2's wording.)

- **D-04: Existing 203 tests continue passing without modification.** Verified by Phase 3 SC#6. Implementation rule: `onStageEvent` is optional with `undefined` as default; pipeline behavior with `undefined` callback is byte-identical to today. Cache lookup is OPT-OUT (active by default in /api/analyze, bypassable for tests via a `bypassCache?: boolean` pipeline option — keep the eval harness from masking real-engine results in benchmarks). Engine version constant move is a refactor; aggregator re-exports `ENGINE_VERSION` from the new module so existing imports don't break.

### Engine Versioning + Provenance (PIPE-05..06)

- **D-05: Clean v3.0.0 launch at milestone gate.** `engine_version = "3.0.0-dev"` for every prediction made during the Engine Foundation milestone build (Phases 3 → 11). Phase 12's acceptance gate, on PASS, edits the constant to `"3.0.0"` as the gate's commit. User chose this in Q2 for a clean "we shipped v3" moment over per-phase or semver-pre-release bumps. Predictions made during the dev window are easily filterable from the production v3 corpus via the `-dev` suffix.

- **D-06: ENGINE_VERSION moves to its own module.** New file `src/lib/engine/version.ts` exports `ENGINE_VERSION` as the single source of truth. `aggregator.ts` and any other consumer re-exports or imports from there. Rationale: makes the version edit a one-line change for Phase 12's gate, makes the version greppable, lets future scripts (e.g., benchmarks, cron jobs) import the version without pulling in aggregator's full dependency tree.

- **D-07: `signal_availability JSONB` column on `analysis_results`.** New migration adds the column. JSONB shape:
  ```json
  {
    "behavioral": true,
    "gemini": true,
    "ml": true,
    "rules": false,
    "trends": true
  }
  ```
  Schema matches the internal `SignalAvailability` interface already in `aggregator.ts` lines 35–41. Phase 3 persists what aggregator computes — no shape change. Forward-compat: future phases (4: content_type + niche; 5: hook_decomp; 6: audio + audio_fingerprint; 7: personas; 8: retrieval; 9: platform_fit + critique + counterfactual; 10: calibration) add their own keys when those signals exist. Consumers MUST null-check / default-to-false missing keys.

- **D-08: Provenance is signal_availability ONLY — no separate degradation_reasons or per-stage cost column.** Per-stage cost lives in the SSE stream (D-02). Degradation reasons remain in the existing `warnings TEXT[]` column (already on `analysis_results`). Keeps the migration small, avoids a column the eval harness has to learn about. Claude's discretion to add finer telemetry tables later if the M2 viz needs it.

### Caching Layer (CACHE-01..06)

- **D-09: Silent instant replay, 24h TTL.** Cache hits return the prior `PredictionResult` JSON in <2s with NO banner or modal. User chose this in Q3 for lowest friction and biggest perceived-speed win. Users can force a re-run by editing the video (changes the content hash). TTL = 24h from prior prediction's `created_at`.

- **D-10: Cache key = (content_hash, engine_version, user_id).** Three-part key ensures: (a) different engine versions don't return stale predictions (cache auto-invalidates on engine bump per CACHE-06); (b) different users don't share predictions (a user's `CreatorContext` shapes their result — privacy + correctness); (c) the same user re-uploading the same buffer hits the cache. Content hash = SHA-256 of the uploaded video buffer (CACHE-01). For `tiktok_url` and `content_text` modes, content hash falls back to a deterministic hash of the input (SHA-256 of the URL or trimmed text) — not as precise but symmetric.

- **D-11: Two-tier cache lookup.** L1 = in-memory `createCache<PredictionResult>(24 * 60 * 60 * 1000)` keyed by the three-part composite. L2 = a single Supabase query: `SELECT * FROM analysis_results WHERE content_hash = ? AND engine_version = ? AND user_id = ? AND created_at > now() - interval '24 hours' ORDER BY created_at DESC LIMIT 1`. L1 miss → check L2; L2 hit → hydrate L1, return cached row; L2 miss → run pipeline as normal. New migration adds `content_hash TEXT` column + index `(user_id, content_hash, engine_version, created_at DESC)` on `analysis_results`. No new `prediction_cache` table.

- **D-12: DeepSeek input-token cache header (CACHE-03).** Existing `src/lib/engine/deepseek.ts` chat call gets a `Cache-Control` header (or DeepSeek-specific cache directive — verify in their API docs) to opt into the 80% input-token discount on cached prefixes. Phase 3 structures the existing deepseek prompt so the prefix portion (system message + creator context + rules + scoring rubric) stays byte-identical across calls; the suffix (per-request content) varies. Phase 3 ships ONE deepseek call (`wave_2`); Phase 7 will benefit most when 10 personas all share the same prompt prefix.

- **D-13: Niche taxonomy "cache" is satisfied by Phase 2's D-10 (hardcoded TS module).** No additional code for CACHE-04. The taxonomy is a TS export read at module-init by Node — no DB roundtrip, no per-request cost. Document in the plan that CACHE-04 is satisfied by upstream; no Phase 3 work required.

- **D-14: Cache invalidation on engine version bump (CACHE-06) is automatic via the key.** Because `engine_version` is part of the cache key, bumping `ENGINE_VERSION` constant invalidates every L1 entry implicitly (next lookups miss) and isolates new predictions from old. No explicit `cache.clear()` call needed when Phase 12 flips `3.0.0-dev` → `3.0.0`.

- **D-15: Eval harness MUST bypass the cache.** The `runPredictionPipeline()` signature gets a `bypassCache?: boolean` option (Claude's discretion: pass via the existing options bag alongside `onStageEvent`). The eval harness sets it to `true` for every prediction so benchmark accuracy reflects real engine behavior, not memoized prior runs. Default = `false` everywhere else.

### Light Scaffolding for Future Waves (PIPE-07..09)

- **D-16: Wave 0 no-op stub added before Wave 1.** New function `wave0(payload, callback)` that emits `stage_start: "wave_0_content_type"` + `stage_start: "wave_0_niche_detector"` (parallel), runs both as no-op promises returning `null`, emits `stage_end` with `cost_cents: 0`. Returns `{ content_type: null, niche: null }`. Phase 4 swaps the no-op bodies for real V3 calls.

- **D-17: Wave 3 no-op stub added after Wave 2.** New function `wave3(personas, payload, deepseekResult, callback)` that emits `stage_start: "wave_3_personas"`, runs as a no-op returning `[]`, emits `stage_end` with `cost_cents: 0`. Phase 7 swaps for real 10-persona simulation.

- **D-18: Stage 10 + Stage 11 no-op stubs added after aggregator.** In `aggregateScores` (or a new wrapper in pipeline.ts — Claude's discretion), call `stage10_critique(aggregateResult)` + `stage11_counterfactuals(aggregateResult)` as no-ops emitting their own events. Both return `null`. Phase 9 swaps for real implementations.

- **D-19: Stub return types are explicit and forward-compatible.** Every stub returns a typed shape (e.g., `Wave0Result`, `PersonaSimulationResult[]`, `CritiqueResult | null`) defined in `src/lib/engine/types.ts`. Subsequent phases extend types as needed but the field names and basic shape are locked here so aggregator's signature doesn't churn.

### Claude's Discretion

- **`onStageEvent` mounting** — whether the callback lives in the existing pipeline options object (`{ requestId, onStageEvent, bypassCache }`) or a parallel arg. Planner's call.
- **Event timestamp source** — `Date.now()` vs `performance.now()` (the latter is what `timed()` already uses). Pick the one that doesn't drift; document in plan.
- **DeepSeek cache header exact spelling** — verify against current DeepSeek API docs (`Cache-Control: max-age=...` vs a vendor-specific directive). Researcher locks this.
- **Content-hash computation location** — inside pipeline (`normalize.ts`?) vs at the route handler (before pipeline call). Route is simpler for L2 lookup; pipeline is cleaner architecturally. Planner picks.
- **Pipeline options bag shape** — current pipeline takes `{ requestId }`; Phase 3 adds `onStageEvent`, `bypassCache`. Whether to keep flattening or wrap in a named `PipelineOptions` interface is Claude's call.
- **Stub file organization** — whether `wave0`, `wave3`, `stage10`, `stage11` no-op stubs live in `pipeline.ts`, in their own future-stage files (`src/lib/engine/wave0.ts`, etc.), or in a single `src/lib/engine/stubs.ts`. Planner picks; my recommendation is separate files because subsequent phases will fully replace them anyway.
- **SSE event payload encoding** — JSON.stringify of the `StageEvent` discriminated union, as `event: stage\ndata: {...}\n\n`. Existing route already uses this pattern.
- **Migration filename** — single migration covering signal_availability column + content_hash column + index, vs two migrations. Single is simpler; planner picks.
- **Test surface** — Vitest unit tests for: stage event emission ordering, cache key composition, cache TTL expiry, engine version constant value. Integration test for SSE event sequence on a fake pipeline. NO test of the actual L2 Supabase lookup in CI (mock the client; live DB integration test ok if cheap).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 3: Pipeline Infrastructure" — phase goal, dependencies (Phase 1), 6 success criteria.
- `.planning/REQUIREMENTS.md` §"Pipeline Infrastructure" (PIPE-01..09) — 9 requirements covering callback, event schema, SSE, versioning, provenance, Wave 0 / Wave 3 / Stage 10–11 hooks.
- `.planning/REQUIREMENTS.md` §"Caching Layer" (CACHE-01..06) — 6 requirements covering content hash, lookup, DeepSeek prompt cache, niche taxonomy cache, TTL, invalidation.
- `.planning/PROJECT.md` §"Current Milestone: Engine Foundation" — milestone-level decisions (additive-only, version bump rationale, persona allocation, SSE intent).
- `.planning/STATE.md` §"Accumulated Context: Decisions" — milestone-start decisions (engine extension additive only, onStageEvent intent).

### Prior Phase Context (Carry-Forward)
- `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md` — Phase 1 D-21: `engine_version = "2.1.0"` bootstrap; Phase 3 picks up the structural versioning work and bumps to `"3.0.0-dev"`. Eval harness in `src/lib/engine/corpus/` MUST bypass the new cache (D-15).
- `.planning/phases/02-creator-profile-9-card-interview/02-CONTEXT.md` — Phase 2 D-10: niche taxonomy is a hardcoded TS module (`src/lib/niches/taxonomy.ts`); satisfies CACHE-04 with no Phase 3 work (D-13). Phase 2 D-19: `CreatorContext` is being extended with 9-card fields — does NOT affect cache key (user_id is what matters), but the richer context flows into every prediction.

### Codebase Maps
- `.planning/codebase/STACK.md` — TypeScript / Next.js / Supabase / Vitest 80% threshold; SSE in Vercel serverless context.
- `.planning/codebase/ARCHITECTURE.md` — prediction pipeline structure, wave-parallel execution, `timed()` wrapper, graceful degradation.
- `.planning/codebase/INTEGRATIONS.md` — DeepSeek API integration (relevant for input-cache header).

### Existing Engine Code (to extend / instrument)
- `src/lib/engine/pipeline.ts` — `runPredictionPipeline()` (435 lines). Already has `timed()` boundaries at validate, normalize, gemini_video_analysis/gemini_analysis, audio_analysis, creator_context, rule_scoring, wave_1, deepseek_reasoning, trend_enrichment, wave_2. Phase 3 wraps each in stage-event emission and adds Wave 0 / Wave 3 / Stage 10–11 stubs.
- `src/lib/engine/aggregator.ts` — `ENGINE_VERSION` constant (line 17) currently lives here — Phase 3 moves to `version.ts`. `SignalAvailability` interface (lines 35–41) currently computed internally — Phase 3 persists it to DB column.
- `src/lib/engine/types.ts` — type definitions (`PredictionResult`, etc.); Phase 3 adds `StageEvent` discriminated union, `Wave0Result`, `PersonaSimulationResult[]`, `CritiqueResult`, `CounterfactualResult` (all empty/null for now).
- `src/lib/engine/deepseek.ts` — single DeepSeek chat call; Phase 3 adds the input-cache header here.
- `src/app/api/analyze/route.ts` — Already streams SSE with coarse `event: phase` messages (lines 167–172, 175–178). Phase 3 enriches with `event: stage` events forwarded from pipeline's onStageEvent. Phase 3 also adds `Accept` header branching (D-03).
- `src/lib/cache.ts` — `createCache<T>(ttlMs)` factory, already used by `creator.ts` (platform averages) and `calibration.ts` (Platt params). Phase 3's L1 reuses this factory.
- `supabase/migrations/20260213000000_content_intelligence.sql` — `analysis_results` table base definition; Phase 3 adds columns via new migration (not modifying this).
- `supabase/migrations/20260216000000_v2_schema_expansion.sql` — `analysis_results` v2 columns (behavioral_predictions, feature_vector, reasoning, warnings, input_mode, has_video, gemini_score). Phase 3 adds `content_hash` + `signal_availability` in a sibling migration.
- `supabase/migrations/20260512000100_benchmark_results.sql` — `benchmark_results` already has `engine_version TEXT NOT NULL` (D-21 from Phase 1); confirms the column shape used in `analysis_results.engine_version`.

### Phase 3 Outputs (will be created)
- `src/lib/engine/version.ts` — single source of `ENGINE_VERSION = "3.0.0-dev"`.
- `src/lib/engine/events.ts` (or inlined in pipeline.ts — planner picks) — `StageEvent` type + emit helper.
- `src/lib/engine/cache/prediction-cache.ts` — content-hash cache layer (L1 wrapper + L2 Supabase lookup).
- `src/lib/engine/wave0.ts` (no-op stub).
- `src/lib/engine/wave3.ts` (no-op stub).
- `src/lib/engine/stage10-critique.ts` (no-op stub).
- `src/lib/engine/stage11-counterfactuals.ts` (no-op stub).
- `supabase/migrations/<timestamp>_phase3_pipeline_columns.sql` — adds `content_hash` + `signal_availability` columns + index to `analysis_results`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`createCache<T>(ttlMs)` factory** (`src/lib/cache.ts`) — exactly the pattern for L1 in-memory cache. Reuse without modification.
- **`SignalAvailability` interface** (`src/lib/engine/aggregator.ts` lines 35–41) — already computed at every prediction; Phase 3 lifts it into the persistence layer without changing its shape.
- **`ENGINE_VERSION` constant** (`src/lib/engine/aggregator.ts` line 17) — already imported by aggregator's return shape; Phase 3 relocates without breaking imports (aggregator re-exports for backwards compat).
- **`timed()` wrapper** (`src/lib/engine/pipeline.ts` lines 60–73) — the natural emission point for stage events. Phase 3 extends it to accept an optional event-emit callback, or wraps each call in a higher-order helper. Either approach preserves the existing call sites.
- **Existing SSE encoder in `/api/analyze`** (route.ts lines 154–162) — `send(event, data)` helper already emits `event: <name>\ndata: <json>\n\n`. Phase 3 reuses; only the event names + data shapes change.
- **`analysis_results` v2 columns pattern** (`supabase/migrations/20260216000000_v2_schema_expansion.sql`) — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` style; Phase 3's migration follows the same idiom.
- **Apify async-webhook pattern** (referenced in Phase 2 INTEGRATIONS.md) — NOT relevant here; Phase 3 stays on the synchronous /api/analyze path.

### Established Patterns
- **`timed()` wrapper at every pipeline boundary** — Phase 3 keeps this and emits events at the same granularity.
- **`createServiceClient()` for DB writes** — used in /api/analyze for the analysis_results insert; Phase 3's L2 cache lookup reuses (read access; respect user_id scoping in WHERE clause).
- **`createLogger({ module: "..." })`** — every new stub file logs under its own module name.
- **Vitest 80% coverage threshold** — new modules (`version.ts`, `events.ts`, `prediction-cache.ts`, the four no-op stubs) need tests.
- **Graceful degradation in engine stages** (Phase 1 D-rule) — Phase 3's stubs degrade trivially (return null); when later phases fill them, they must keep the same null-return-on-failure contract.
- **`@sentry/nextjs` capture** at every pipeline error boundary — preserved.

### Integration Points
- **`/api/analyze` route ⟷ pipeline `onStageEvent`** — route passes a callback into `runPredictionPipeline(input, { requestId, onStageEvent: send })` and forwards events through its existing SSE writer.
- **`runPredictionPipeline()` ⟷ cache** — route checks L1 + L2 BEFORE calling `runPredictionPipeline()`. On hit, return the cached row's PredictionResult. On miss, call pipeline as normal, then insert into `analysis_results` (existing path) AND populate L1.
- **Aggregator ⟷ `signal_availability`** — aggregator already computes `availability: SignalAvailability` internally. Phase 3 surfaces this through `PredictionResult` (add `signal_availability` field to the returned shape), so /api/analyze can write it directly to the new column without re-computing.
- **Pipeline ⟷ Wave 0 stub** — `runPredictionPipeline` calls `wave0(payload, opts.onStageEvent)` before the existing Wave 1 `Promise.all(...)`. Stub returns immediately. Phase 4 swaps the body.
- **Pipeline ⟷ Wave 3 stub** — after `await timed("wave_2", ...)`, call `wave3(payload, deepseekResult, opts.onStageEvent)`. Stub returns `[]`. Phase 7 swaps.
- **Aggregator ⟷ Stage 10 / 11 stubs** — after `aggregateScores()` finishes, call `stage10_critique(result)` + `stage11_counterfactuals(result)` (both no-ops returning null). Phase 9 swaps.
- **DeepSeek input-cache header** — added to `src/lib/engine/deepseek.ts` chat completion call. Existing wave_2 deepseek path is the proving ground; Phase 7's persona simulation will heavy-use it.

### NO changes to (preserved by additive-only constraint)
- `src/lib/engine/aggregator.ts` weight tables, calibration, confidence calculation — Phase 3 only touches the `ENGINE_VERSION` import path and the `availability` field on the return shape.
- `src/lib/engine/types.ts` `PredictionResult` core shape — only additions (`signal_availability`).
- Existing `timed()` call sites' arguments — only the orchestrator wraps them to also emit events.

</code_context>

<specifics>
## Specific Ideas

- **User explicitly chose "Live signal dashboard" granularity** for the live-analysis experience (Q1). This is the strongest user-vision signal for Phase 3: the stage event stream is not just an engineering convenience, it's a UX commitment for M2's "live audience viz." Every signal that fires in the pipeline must emit its own events — bundling Wave 1 into a single event would betray the chosen granularity.

- **User chose "Clean v3.0.0 at milestone gate" (Q2)** — the engine_version label change is a marketing/communication moment. The `-dev` suffix is the user-visible artifact during the build; the flip to `"3.0.0"` happens once and is the "we shipped v3" trigger. Phase 12's gate-passing commit edits the constant; ensure the commit message reflects the milestone moment.

- **User chose "Silent instant replay" (Q3)** with 24h TTL — lowest friction. No banner, no modal. The implication for downstream agents: do NOT add UI to the result page that announces a cached result. Test surface should verify silent-replay timing (<2s) and silent semantics (no banner element rendered).

- **User chose "Light scaffolding" (Q4)** — the right balance per their non-technical framing: future phases stay small without overcommitting Phase 3. The no-op stubs are LOAD-BEARING for the planner's downstream estimate: Phase 4/7/9 plans should assume the orchestration hook exists and they only fill in stage logic.

- **User self-identified as non-technical (carried from Phase 2 D-15):** "I don't have much technical knowledge, ask me all questions you need to know." All technical decisions in this CONTEXT.md were taken as Claude's discretion (event shape, cache key composition, migration structure, stub file organization, DeepSeek header exact spelling). Future researcher / planner / executor follow-ups should preserve this division: ask the user about user-facing behavior (timing, copy, what they see); decide schema / file layout / API design internally.

</specifics>

<deferred>
## Deferred Ideas

- **Persistent cache tier beyond `analysis_results` row lookup** — no separate `prediction_cache` table, no Vercel KV, no Redis. If hit rate measurement (post-launch) shows the L2 SELECT is a bottleneck or cold-start L1 misses dominate, revisit by adding a dedicated cache table. Track post-launch as part of Engine Foundation milestone retrospective.

- **Cross-user cache reuse** — explicitly rejected (D-10 user-scoped key). If trending viral videos hit /api/analyze a lot, a global anonymous cache of Gemini-only output (no creator context) could save real money. Future phase consideration after M2 ships and we have hit-rate data.

- **Per-stage cost telemetry table** — D-08 keeps cost in the SSE stream only. If post-launch we need to audit cost drift across engine versions, a `stage_cost_telemetry` table or extension of `benchmark_results` would help. Deferred until M2 / pre-Phase 12 budget review.

- **M2 live signal dashboard UI** — the consumer of Phase 3's stage events. M2's design phase will use Phase 3's event schema (D-02) as input. Carry the discriminated-union shape forward into the M2 milestone discussion.

- **DeepSeek prompt-prefix structure for Phase 7's 10 personas** — D-12 ships the cache header; the actual prefix engineering (keeping prefix bytes stable across personas while varying only the persona-specific suffix) is Phase 7's job. Phase 3 documents the header works; Phase 7 designs the prompt template.

- **Cache invalidation reasons beyond engine-version bump** — D-14 says version bump auto-invalidates via the key. Future: if we ever need to invalidate due to taxonomy edits, rule-library changes, or calibration retraining, that's a separate mechanism. Not Phase 3 scope.

- **Vercel cold-start mitigation** — the L1 cache wipes on every cold start, falling back to the L2 SELECT. If the SELECT proves too slow to satisfy the <2s SC#4 budget on cold-start machines, options (Vercel KV, edge caching, route handler `next-cache` directives) become live questions. Track with the persistent-tier note above.

- **SSE-vs-not Accept-header branching test surface** — D-03 ships this for SC#2; future test should verify both branches return semantically equivalent PredictionResult JSON. Not blocking Phase 3.

</deferred>

---

*Phase: 3-Pipeline Infrastructure*
*Context gathered: 2026-05-17*
