# Phase 5: Video Segmentation + Hook Decomposition - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing single-call `analyzeVideoWithGemini` (`src/lib/engine/gemini.ts` line 409) with **three parallel scoped Gemini calls** against ONE Gemini Files API upload, plus a richer hook decomposition output. Two coupled artifacts:

1. **3-segment video analysis** — Single upload, three parallel `generateContent` calls scoped by `videoMetadata: { startOffset, endOffset }`:
   - **Hook segment (0-5s):** Gemini 3 Pro produces the 5 TikTok factors restricted to hook scope + 4 hook sub-modality scores + visual-audio coherence + cognitive load.
   - **Body segment (5s → end-3s):** Gemini 3 Flash produces 4 video_signals (visual_production_quality, hook_visual_impact passthrough, pacing_score, transition_quality) + body-scope factor refinement.
   - **CTA segment (last 3s):** Gemini 3 Flash produces CTA presence + strength + type (when present) per D-03.

2. **Hook decomposition output (6 scores)** — Pro hook call returns: `visual_stop_power`, `audio_hook_quality`, `text_overlay_score`, `first_words_speech_score` (each 0-10), plus `weakest_modality` (one of the four), plus `visual_audio_coherence` (0-10) and `cognitive_load` (0-10, higher = more load).

The three results merge into a widened `GeminiVideoAnalysis` shape that aggregator consumes; per-segment SignalAvailability flags (`gemini_hook`, `gemini_body`, `gemini_cta`) enable graceful degradation per D-04.

**Out of scope this phase:**
- Real audio analysis stage (HOOK-02 audio_hook_quality is Gemini-derived multi-modal; the no-op audio stage stays no-op until **Phase 6**).
- Trending-sound fingerprint matching — **Phase 6**.
- Polished result-card UI surfacing per-modality breakdown — **M2 (Intelligence Surface)**.
- Persona simulation consuming hook decomp — **Phase 7**.
- Benchmark retrieval consuming hook decomp — **Phase 8**.
- ML retrain / Platt calibration on the new hook sub-scores — **Phase 10** (Aggregator Extension + ML Audit).
- GA migration when GA Gemini 3 Pro / Flash ship (currently using preview per D-01 override; see Deferred Ideas for the migration task).
- Migration of legacy `analyzeVideoWithGemini` single-call path — kept as a callable export for the eval harness corpus replay until Phase 12 cleanup.

</domain>

<decisions>
## Implementation Decisions

### Model Tier (3-segment cost ≈ 2.0¢/video, well under the ~6.5¢ milestone budget)

- **D-01: Hook → `gemini-3.1-pro-preview`; Body + CTA → `gemini-3-flash-preview`. Env-overridable.** Hook gets Pro because the 6-dimension decomposition (4 sub-modality scores + weakest_modality + coherence + cognitive load) is reasoning-heavy and is the most user-differentiated output of this phase. Body and CTA are description/scoring tasks that Flash handles well at ~3-6× cheaper. **Preview override (2026-05-18, post-research):** the original "always GA, never preview" rule cannot be honored — no GA Pro tier exists in the Gemini 3 family (only `gemini-3.1-flash-lite` is GA), and the literal `gemini-3-pro` / `gemini-3-flash` IDs in earlier drafts of this doc are invalid SDK strings (verified against `ai.google.dev/gemini-api/docs/models`, 2026-05-18). Decision: accept preview for top-notch quality; mitigate via env-var indirection. All three models routed through env vars: `GEMINI_HOOK_MODEL` (default `gemini-3.1-pro-preview`), `GEMINI_BODY_MODEL` (default `gemini-3-flash-preview`), `GEMINI_CTA_MODEL` (default `gemini-3-flash-preview`). Single-flip upgrade path when GA equivalents ship. Migration follow-up tracked in Deferred Ideas.

  Cost breakdown (30s video, Gemini 3 pricing as of 2026-05-18):
  - Hook Pro on 5s window: ~1.3¢ ($2/M in × ~1290 video tokens + ~500 prompt + $12/M out × ~800 decomp tokens)
  - Body Flash on ~22s: ~0.5¢
  - CTA Flash on 3s: ~0.2¢
  - **Total: ~2.0¢/video** (~3× current single-call cost; absorbed by the budget)

- **D-02: SEGMENT-06 (model selection per segment configurable via env) is satisfied by D-01's three env vars.** Planner verifies env-var-with-default pattern matches the existing `GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"` idiom in `src/lib/engine/gemini.ts` line 17.

### Hook Segment Window

- **D-03: Hook window = 0-5s.** Matches Phase 4 D-01 Wave 0 content-type window for consistency. Rationale: first-words / speech hook score (HOOK-04) commonly needs 3-5s for the opener sentence to complete ("Want to know the #1 secret? Here it is" ≈ 4s); visual-audio coherence (HOOK-06) gets more evidence; cost delta vs 3s is ~$0.001 (negligible). Body segment shifts to `5s → end-3s`; CTA segment stays `last 3s`. For videos ≤10s where `5s + 3s ≥ duration`, planner picks the body-skip strategy (Claude's discretion — see below).

- **D-04: HOOK-02 `audio_hook_quality` is derived from the Gemini Pro hook call's multi-modal analysis** (audio track is bundled into the Files API video upload). The "real audio stage" replacing the no-op (AUDIO-01) is **Phase 6's** responsibility — Phase 5 produces the hook-segment-scoped audio hook score that Phase 6's stage can compare against / supersede later. This is intentional decoupling: Phase 5 doesn't depend on Phase 6 shipping first.

### CTA Handling (Presence-Aware)

- **D-05: CTA segment returns presence-aware shape, NOT a forced 0-10.** Schema:
  ```ts
  type CtaSegmentResult = {
    cta_present: boolean;
    strength: number | null;         // 0-10 when cta_present, null otherwise
    type: "follow" | "comment" | "link_in_bio" | "watch_next" | "engage_question" | "other" | null;
    rationale: string;               // 1-2 sentences (what the CTA is, or why none detected)
  }
  ```

- **D-06: Aggregator applies CTA penalty ONLY for content types that conventionally require a CTA.** Wave 0 (Phase 4) provides `content_type` to aggregator. CTA penalty rule:
  ```
  Content type      | Penalty when cta_present=false
  ------------------+-------------------------------
  tutorial          | -0.5 score units (CTA expected)
  b_roll            | -0.3 score units (CTA expected)
  talking_head      | neutral (varies)
  vlog              | neutral (CTA optional)
  comedy / other    | neutral (CTA not expected)
  slideshow         | neutral
  action            | neutral
  ```
  When `cta_present=true`, `strength` contributes to the Gemini score normally (Claude's discretion: blend strength into existing aggregator video_signals math or surface as a separate sub-score; planner picks). The penalty values above are starting points — Phase 10's ML audit revisits based on corpus benchmark evidence.

- **D-07: User-facing copy when no CTA is detected** — result emits `cta_present=false` + `rationale="No call-to-action detected — typical for [content_type] content"` (or similar wording when content type is one of the penalty types: "No CTA detected — consider adding one to drive [follows/comments/link]"). M2's result-card UI will choose how to display; M1 surfaces the data shape.

### Partial Segment Failure Behavior

- **D-08: 1-of-3 failure → ship partial result + warning.** Each segment call is independent (`Promise.allSettled` pattern over the three calls). On any segment failure, that segment's contribution to `geminiAnalysis` is null and `SignalAvailability` gets `gemini_<segment>=false`. Aggregator redistributes weight across successful segments. Pipeline emits one `pipeline_warning` event:
  ```
  { type: "pipeline_warning", message: "Gemini <segment> analysis unavailable — score uses other segments", stage: "gemini_<segment>" }
  ```
  Matches Phase 1/3/4 graceful-degradation discipline. No fallback to the legacy single-call path; no extra latency; no extra cost.

- **D-09: All 3 segments fail → emit `gemini_video_unavailable` warning + return null GeminiVideoAnalysis.** Pipeline continues — other signals (rules, behavioral, trends, ml) still contribute. Matches existing aggregator behavior when a wave returns null. SignalAvailability gets `gemini=false` (in addition to all three per-segment keys=false).

- **D-10: Single Files API upload shared across the 3 calls.** SEGMENT-04 invariant. Upload happens once before the three parallel `generateContent` calls fire; cleanup (file delete) happens after all three settle (success or fail) via existing `finally` block pattern in `analyzeVideoWithGemini`. If the upload itself fails, all 3 segments are null + `gemini_video_unavailable` warning.

### Pipeline & Aggregator Integration (additive-only, milestone constraint)

- **D-11: New module `src/lib/engine/gemini/segmented.ts` exports `analyzeVideoSegmented(buffer, mimeType, opts)`.** Returns the merged 3-segment result. `runPredictionPipeline` Wave 1 calls `analyzeVideoSegmented` instead of `analyzeVideoWithGemini` when `mode=video`. The existing `analyzeVideoWithGemini` export stays callable so the eval harness corpus-replay path can compare segmented vs un-segmented outputs during the Phase 12 acceptance benchmark. Phase 12 owns the eventual cleanup.

- **D-12: Aggregator changes are additive.** `SignalAvailability` gets three new keys: `gemini_hook`, `gemini_body`, `gemini_cta` (Phase 3 D-07 forward-compat). Existing `gemini` key is computed as `gemini_hook || gemini_body || gemini_cta` (any successful segment = gemini signal available). The CTA penalty (D-06) is a new branch inside `aggregateScores` reading `wave0Result.content_type.type` and `geminiAnalysis.cta_segment` — both already in scope after Phase 4 + this phase.

- **D-13: PredictionResult schema extension** — `GeminiVideoAnalysis` widens to include `hook_decomposition: { visual_stop_power, audio_hook_quality, text_overlay_score, first_words_speech_score, weakest_modality, visual_audio_coherence, cognitive_load }` and `cta_segment: CtaSegmentResult | null`. Existing `video_signals` shape preserved (still 4 fields). Existing 203 tests must still pass (Phase 3 D-04 invariant carries).

- **D-14: Per-segment events.** Three start/end event pairs emitted under `wave: 1` per Phase 3 D-01/D-02 schema: `gemini_hook`, `gemini_body`, `gemini_cta`. Each carries its own `cost_cents` and `duration_ms`. Today's single `gemini_video_analysis` event is replaced by the three segment events (Phase 3 explicitly designed for this).

### Niche-Aware Prompts

- **D-15: Wave 0 niche + content_type flow into all 3 segment prompts.** `analyzeVideoSegmented(buffer, mimeType, { niche, contentType, creatorContext })`. Niche slug + sub-niche injected as prompt context (e.g., "Niche: beauty / skincare-reviews"). Content type tells the body prompt how to weight pacing/transitions. Hook prompt mentions niche so first-words scoring can be niche-aware (an opener that works for beauty differs from one that works for fitness). Creator context (Card 4 content style, Card 5 references) is available but Claude's discretion whether to inject into prompts — planner picks based on token-budget assessment.

### Claude's Discretion

- **File organization** — `src/lib/engine/gemini/segmented.ts` (orchestrator) with helpers `src/lib/engine/gemini/hook-segment.ts`, `body-segment.ts`, `cta-segment.ts`; alternative is one `segmented.ts` containing all three. Planner picks based on file-size threshold.
- **Prompt templates per segment** — three new prompt builders (`buildHookPrompt`, `buildBodyPrompt`, `buildCtaPrompt`). Hook prompt embeds the 6-score decomposition rubric + niche; body prompt is a stripped-down 4-signal version of current `buildVideoPrompt`; CTA prompt is a presence-detection + strength scoring prompt. Researcher locks the prompt wording; planner integrates.
- **Zod schemas** — three new structured-output schemas (`HOOK_SEGMENT_SCHEMA`, `BODY_SEGMENT_SCHEMA`, `CTA_SEGMENT_SCHEMA`) added to `src/lib/engine/gemini/schemas.ts` (or inline — planner picks). All three pass `responseMimeType: "application/json"` + `responseSchema` to Gemini per existing pattern at line 332.
- **Merge function** — how the three segment results combine into `GeminiVideoAnalysis`. Likely: hook segment owns the 5 factor scores (because hook is the strongest viral-prediction signal); body fills `video_signals.visual_production_quality / pacing_score / transition_quality`; CTA fills `cta_segment`. Planner refines.
- **Short-video handling (≤10s)** — when video duration < 8s (5s hook + 3s CTA), body window is empty or negative. Planner picks: (a) skip body call, mark `gemini_body=false` (graceful per D-08); (b) clamp body window to `min(5s, duration/2) → max(duration-3s, duration/2+1)` and run anyway; (c) fall back to single-call for short videos only. Recommendation: (a) — cleanest, body signal absence is gracefully handled by D-08.
- **Promise.allSettled vs Promise.all + try/catch** — both work. `allSettled` is the cleaner pattern for D-08. Planner picks.
- **Cost accounting** — each segment call computes its own `cost_cents` via the existing `calculateCost(promptTokens, candidateTokens)` helper in `gemini.ts` line 96. Three cost values sum to total Gemini-stage cost. Planner verifies `calculateCost` uses model-specific pricing (current function assumes one model; may need extension to take model name + per-model price table).
- **Test surface** — Vitest unit tests for: each segment call (mocked Gemini with `videoMetadata`), merge function, short-video body-skip branch, partial-failure graceful degradation (1/2/3 segments fail), CTA presence-aware shape, aggregator CTA-penalty branch per content type, niche injection into prompts. Integration test for `analyzeVideoSegmented` end-to-end with mocked uploads. 80% Vitest threshold per project policy.
- **Eval harness opt-in** — researcher decides whether the corpus benchmark runs segmented (matches production) or both segmented + un-segmented (A/B accuracy comparison for Phase 12 gate). Recommendation: segmented only for v3 baseline; Phase 12 may add the comparison run separately.
- **Sentry tags** — each segment captures with `tags: { stage: "gemini_hook" | "gemini_body" | "gemini_cta" }` per existing per-stage Sentry pattern (gemini.ts line 526).
- **Files API delete timing** — current code deletes the uploaded file in the `finally` block after the single call. With three parallel calls, delete must happen after ALL three settle. Planner uses a shared `finally` after the orchestrating `Promise.allSettled`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 5: Video Segmentation + Hook Decomposition" — phase goal, depends-on Phase 3 + Phase 4, 5 success criteria (#1 three parallel calls on single upload via videoMetadata; #2 Pro hook + Flash body/CTA (D-01 upgrades to Gemini 3); #3 hook returns 4 sub-scores + weakest modality; #4 visual-audio coherence + cognitive load; #5 existing analyzeVideoWithGemini tests still pass).
- `.planning/REQUIREMENTS.md` §"Video Segmentation" (SEGMENT-01..06) — 6 requirements covering the 3 parallel scoped calls, single upload reuse, model-per-segment env config.
- `.planning/REQUIREMENTS.md` §"Multi-Modal Hook Decomposition" (HOOK-01..07) — 7 requirements covering 4 sub-modality scores, weakest modality, visual-audio coherence, cognitive load.
- `.planning/REQUIREMENTS.md` §"Acceptance Benchmark" (BENCH-01..06) — milestone cost cap ≤$0.075 average; Phase 5 cost (~2.0¢) sits inside budget.
- `.planning/PROJECT.md` §"Engine architecture (all additive — no rewrite of existing pipeline.ts or aggregator.ts)" — additive-only milestone constraint; Wave 1 is parallel Gemini + audio + creator + rules.
- `.planning/STATE.md` §"Accumulated Context: Decisions" — milestone-start decisions (additive-only, ~$0.065 budget, video segmentation via native Gemini videoMetadata locked).

### Prior Phase Context (Carry-Forward)
- `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md` — graceful-degradation pattern (Phase 5 must inherit: null + warning, never throw); corpus 5-niche anchor (Beauty/Fitness/Edu/Comedy/Lifestyle) shapes niche-aware prompt validation; eval-harness `bypassCache` semantics extend to segmented Gemini calls.
- `.planning/phases/02-creator-profile-9-card-interview/02-CONTEXT.md` — D-19 CreatorContext extended with 9-card fields; Phase 5's niche-aware prompts may read Card 4 (content style) + Card 5 (reference creators) when budget allows.
- `.planning/phases/03-pipeline-infrastructure/03-CONTEXT.md` — D-01 per-stage event emission (Phase 5's three segment events replace the single `gemini_video_analysis` event); D-02 StageEvent shape (wave=1 carries the three new stage names); D-07 SignalAvailability forward-compat (Phase 5 adds `gemini_hook`/`gemini_body`/`gemini_cta` keys); D-15 eval harness bypass (Phase 5 inherits).
- `.planning/phases/04-wave-0-content-type-niche-detection/04-CONTEXT.md` — D-01 (Gemini 3 Flash on 5s window for Wave 0 sets the precedent Phase 5 follows for hook window); D-04 (Wave 1 Gemini upgrade is Phase 5's question — answered here in D-01); D-09 7-category content_type vocabulary (Phase 5's CTA-penalty rule keys on this); D-10 mixed_content_detected warning (Phase 5 acknowledges but does not implement segment-shift logic); D-17/D-18 creator context pre-fetched (available to Phase 5 prompts without extra DB hit); Deferred Idea "Gemini 2.5 → Gemini 3 upgrade for Wave 1" closed by Phase 5 D-01.

### Codebase Maps
- `.planning/codebase/STACK.md` — TypeScript strict, Vitest 80% threshold, Next.js 15 App Router; Gemini client via `@google/genai` v1.41.0.
- `.planning/codebase/ARCHITECTURE.md` — prediction pipeline wave structure; Wave 1 parallel Gemini + audio + creator + rules + (Phase 8) retrieval.
- `.planning/codebase/INTEGRATIONS.md` — Gemini API integration (Files API upload pattern, videoMetadata field is native to `@google/genai`).

### Existing Engine Code (to extend / instrument)
- `src/lib/engine/gemini.ts` lines 17, 96, 332, 409–545 — current `analyzeVideoWithGemini` single-call implementation; Phase 5 keeps this export callable for eval-harness legacy path (D-11) and adds `analyzeVideoSegmented` alongside.
- `src/lib/engine/gemini.ts` line 17 — `GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"`. Phase 5 adds three new env defaults: `GEMINI_HOOK_MODEL` (`gemini-3.1-pro-preview`), `GEMINI_BODY_MODEL` (`gemini-3-flash-preview`), `GEMINI_CTA_MODEL` (`gemini-3-flash-preview`).
- `src/lib/engine/gemini.ts` line 96 — `calculateCost(promptTokens, candidateTokens)`. Phase 5 verifies this function supports per-model pricing OR extends it to take `(model, promptTokens, candidateTokens)`.
- `src/lib/engine/gemini.ts` lines 200–250 — `buildVideoPrompt` builder. Phase 5 splits into 3 prompt builders (hook/body/CTA), each scoped + niche-aware.
- `src/lib/engine/gemini.ts` lines 270–340 — `VIDEO_RESPONSE_SCHEMA` Zod schema. Phase 5 splits into 3 schemas matching per-segment output shapes.
- `src/lib/engine/types.ts` — `GeminiVideoAnalysis` type. Phase 5 widens with `hook_decomposition` + `cta_segment` fields (D-13). Adds `HookDecomposition`, `CtaSegmentResult`, `BodySegmentResult` types + matching Zod schemas.
- `src/lib/engine/pipeline.ts` — Wave 1 `Promise.all` block. Phase 5 swaps `analyzeVideoWithGemini` call → `analyzeVideoSegmented` call. Event emission upgraded from single `gemini_video_analysis` → three per-segment events (Phase 3 D-01).
- `src/lib/engine/aggregator.ts` — `SignalAvailability` interface lines 197–203. Phase 5 adds `gemini_hook`/`gemini_body`/`gemini_cta` keys (Phase 3 D-07 forward-compat). CTA penalty branch added inside `aggregateScores` keyed on `wave0Result.content_type.type` × `geminiAnalysis.cta_segment.cta_present` (D-06).
- `src/lib/engine/wave0.ts` — Phase 4 outputs `content_type` consumed by Phase 5's CTA penalty rule + niche-aware prompts.
- `src/lib/engine/events.ts` — `emitStageStart` / `emitStageEnd` helpers (Phase 3); Phase 5 reuses unchanged for the three new segment events.

### Phase 5 Outputs (will be created or extended)
- `src/lib/engine/gemini/segmented.ts` (new) — `analyzeVideoSegmented` orchestrator, single Files API upload + 3 parallel `generateContent` calls + merge.
- `src/lib/engine/gemini/hook-segment.ts` (new, or inline in segmented.ts) — Gemini 3 Pro call for 0-5s window producing hook decomposition.
- `src/lib/engine/gemini/body-segment.ts` (new, or inline) — Gemini 3 Flash call for 5s→end-3s window producing body video_signals.
- `src/lib/engine/gemini/cta-segment.ts` (new, or inline) — Gemini 3 Flash call for last-3s window producing CTA presence/strength/type.
- `src/lib/engine/gemini/schemas.ts` (new, or extended types.ts) — three new structured-output Zod schemas + TypeScript types (`HookDecomposition`, `CtaSegmentResult`, `BodySegmentResult`).
- `src/lib/engine/types.ts` (extended) — widened `GeminiVideoAnalysis` shape (D-13).
- `src/lib/engine/aggregator.ts` (extended) — new SignalAvailability keys + CTA-penalty branch (D-06, D-12).
- `src/lib/engine/pipeline.ts` (extended) — Wave 1 swap + per-segment event emission.
- `src/lib/engine/__tests__/gemini-segmented.test.ts` (new) — Vitest unit + integration tests for segmented path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Files API upload + polling pattern** (`src/lib/engine/gemini.ts` lines 425–455) — Phase 5 reuses verbatim; only the post-upload `generateContent` block changes (one call → three parallel calls).
- **Structured output schema + `responseMimeType: "application/json"` pattern** (lines 470–495) — Phase 5 applies to each of the three segment schemas.
- **`calculateCost(promptTokens, candidateTokens)` helper** (line 96) — Phase 5 reuses per segment; may need extension to take model name if pricing diverges between Gemini 3 Pro and Flash.
- **`AbortController + VIDEO_TIMEOUT_MS` pattern** (lines 466–469) — Phase 5 applies per-segment so a slow segment doesn't block the others.
- **`Sentry.captureException` per-stage tags** (lines 525–529) — Phase 5 tags each segment failure with its stage name (`gemini_hook` / `gemini_body` / `gemini_cta`).
- **Files API delete in `finally`** (lines 535–544) — Phase 5 moves this to AFTER `Promise.allSettled` over the three segments so the file isn't deleted while a call is still running.
- **`emitStageStart` / `emitStageEnd`** (`src/lib/engine/events.ts`) — Phase 5 emits per segment, three pairs total.
- **`Wave0Result.content_type.type`** (Phase 4 D-11) — already in pipeline scope before Wave 1 runs; Phase 5 reads it for CTA-penalty rule.
- **`CreatorContext.niche_primary` / `niche_sub` / `card_4_content_style`** (Phase 2 D-19, Phase 4 D-17) — pre-fetched into pipeline options; Phase 5 prompts read directly.
- **`createLogger({ module: "..." })`** — Phase 5 logs under `engine.gemini.hook`, `engine.gemini.body`, `engine.gemini.cta` (or one module name + stage field).

### Established Patterns
- **Graceful degradation** — every Phase 5 segment call catches errors, returns null, emits warning. Pipeline never throws on Gemini failure. (Phase 1 D-rule.)
- **Vitest 80% coverage** — new segment modules need tests; mock the Gemini client with deterministic responses per segment.
- **Stage event emission at `timed()` granularity** — Phase 3 D-01; Phase 5 emits three pairs (`wave_1` parent stage stays, with three children).
- **`@sentry/nextjs` capture at error boundaries** — preserved per segment.
- **DeepSeek input-cache header pattern** (Phase 3 D-12) — does NOT apply to Gemini; Gemini has its own context-caching mechanism. Researcher verifies whether Gemini context caching is worth adopting for the hook segment's reused prompt prefix (deferred — see Deferred Ideas).
- **Service client for DB reads in pipeline** — N/A for Phase 5 (no new DB reads; CreatorContext + Wave 0 already fetched).
- **Engine version constant** (Phase 3 D-06) — `ENGINE_VERSION` from `./version` for any version-aware telemetry.
- **Zod-at-LLM-boundary validation** — every Gemini response parsed through its Zod schema before flowing into the merge function.

### Integration Points
- **Pipeline ⟷ `analyzeVideoSegmented`** — Wave 1's existing `analyzeVideoWithGemini` call site swaps to `analyzeVideoSegmented`, passing `{ niche, contentType, creatorContext, onStageEvent }`. Per-segment events bubble up to /api/analyze SSE.
- **`analyzeVideoSegmented` ⟷ three segment calls** — single Files API upload, then `Promise.allSettled([hook(), body(), cta()])`. Each segment owns its prompt + schema + cost computation + Sentry tags.
- **Three segment results ⟷ merge function** — produces widened `GeminiVideoAnalysis`. Hook result owns the 5 factor scores; body fills 3 of 4 `video_signals`; CTA fills `cta_segment`. Merge is null-safe per D-08.
- **`GeminiVideoAnalysis` ⟷ aggregator** — `aggregateScores` reads `hook_decomposition` (new fields available but not yet weighted at aggregator level — Phase 10 may add weights) + `cta_segment` (new CTA-penalty branch keyed on Wave 0 content_type per D-06).
- **`SignalAvailability` ⟷ DB persistence** — `gemini_hook`/`gemini_body`/`gemini_cta`/`gemini` keys persisted to `analysis_results.signal_availability` JSONB (Phase 3 D-07 path).
- **Existing `analyzeVideoWithGemini` ⟷ eval harness** — legacy path stays callable for corpus comparison runs until Phase 12 cleanup.

### NO changes to (preserved by additive-only constraint)
- `aggregator.ts` `SCORE_WEIGHTS` constant — top-level signal weights stay (`behavioral 0.35 / gemini 0.25 / ml 0.15 / rules 0.15 / trends 0.10`). Phase 5 changes happen at sub-signal level inside the gemini contribution + the new CTA-penalty branch.
- `aggregator.ts` `selectWeights()` redistribution logic — preserved as-is.
- Existing 203 tests — must pass unchanged (Phase 3 D-04 invariant; SEGMENT/HOOK-related tests are net-new).
- `analyzeVideoWithGemini` export signature — preserved for eval-harness legacy path.
- `Wave0Result` shape from Phase 4 — read-only consumer.
- `pipeline.ts` Wave 0 / Wave 2 / Stage 10 / Stage 11 orchestration — only Wave 1 Gemini call swaps.

</code_context>

<specifics>
## Specific Ideas

- **User questioned model lineage up-front** ("but what about gemini 3.1 pro / flash?"). Researcher web-verified on 2026-05-18: no GA Pro tier exists in the Gemini 3 family (only `gemini-3.1-flash-lite` is GA); `gemini-3.1-pro-preview` and `gemini-3-flash-preview` are the top-quality options. User reviewed the verified evidence and **explicitly approved the preview override** for top-notch quality, accepting the trade-off (preview = no SLA, API may change before GA). Mitigation: env-var indirection (`GEMINI_HOOK_MODEL` / `_BODY_MODEL` / `_CTA_MODEL`) so GA migration is a config flip. Phase 4's instinct "modern + cheap unless evidence demands stepping up" stays, with the explicit clarification that "GA-only" is suspended for this phase pending Gemini 3 Pro/Flash GA release.

- **User extended Phase 4 Wave 0 window from 2s → 5s for confidence** (carried forward). Applied here to choose 0-5s hook segment over 0-3s. Trade-off: ~$0.001 extra cost. Pattern: when costs are sub-cent and the signal is user-differentiated, prefer generous compute.

- **User chose presence-aware CTA handling** — not "always score 0-10" and not "never penalize." The middle ground: penalize content types that SHOULD have CTAs (tutorial, B-roll); neutral on comedy/vlog/talking-head. This requires the CTA segment to surface a `cta_present` boolean separate from `strength` so the aggregator can apply the content-type rule. Researcher's prompt design must explicitly instruct the model to return `cta_present=false` when no CTA exists rather than forcing a low score on a missing signal.

- **User chose graceful partial-failure** (no fallback to single-call backup, no hard-fail). This means M2's result-card UI must be designed to display a result with one or two missing segments without looking broken. Carry this to the M2 milestone discussion.

- **User self-identified as non-technical** (carried from Phase 2/3/4): all schema/file/migration/SDK-config/test-surface decisions in this CONTEXT.md are Claude's discretion. User-facing questions in this phase were framed as "what should the engine DO" — Pro vs Flash tier (with cost numbers), hook window length, CTA UX behavior, failure UX behavior. Researcher/planner should preserve this division on follow-ups.

</specifics>

<deferred>
## Deferred Ideas

- **Gemini 3 Pro / Flash GA migration** — Phase 5 ships using preview models (`gemini-3.1-pro-preview` hook, `gemini-3-flash-preview` body/CTA) per the D-01 override. When Google promotes Gemini 3 Pro and/or Flash to GA (track via Google AI Studio release notes), flip the relevant `GEMINI_*_MODEL` env defaults to the GA IDs. No code change required, just env-var update + benchmark validation against the Phase 12 reference set. Watch for the June 17, 2026 `gemini-2.5-*` deprecation cliff — by then either GA 3.x must exist or we accept preview indefinitely. Track for Phase 10 / Phase 12 / next milestone.

- **Gemini 3.2 Flash adoption** — appeared in apps 2026-05-05 but not officially announced. When announced + GA, evaluate for body/CTA replacement of Gemini 3 Flash. Cost/quality delta unknown until benchmarks land.

- **Gemini context caching for hook prompt prefix** — Gemini has its own context-caching mechanism (separate from DeepSeek's input cache). The hook prompt prefix (system message + 6-score rubric + calibration data) stays byte-identical across users; cached prefix could cut input-token cost on the heavy Pro call. Deferred until hit-rate measurement justifies the complexity; current per-call cost (~1.3¢) is already inside budget.

- **Per-segment Sentry breadcrumbs ↔ Phase 10 ML audit** — each segment's `cost_cents` + `duration_ms` flows through SSE today (Phase 3 D-02). If Phase 10 / Phase 12 want to audit per-segment cost drift across engine versions, a `stage_cost_telemetry` table extension would help. Deferred until pre-Phase 12 budget review.

- **Real audio analysis stage replacing Gemini-derived `audio_hook_quality`** — Phase 6's `AUDIO-01..06` requirements deliver the standalone audio stage. Phase 5's hook decomposition produces an interim audio_hook_quality from Gemini Pro's multi-modal video analysis; Phase 6 may supersede or supplement this. Reconciliation rule (Gemini vs real-audio-stage) is Phase 6's question.

- **Watermark detection ↔ ALGO-06** — Phase 5 hook segment could detect TikTok watermark for the IG-Reels-penalty signal (ALGO-06). Currently scoped to Phase 9 (Platform Algorithm Fit). Phase 9 may choose to fold detection into existing Phase 5 prompts (free Gemini extension) vs run a separate call. Track for Phase 9 discussion.

- **A/B segmented vs un-segmented eval comparison** — Phase 12's acceptance benchmark could run both paths to quantify "does segmentation help accuracy?" beyond just "does v3 beat v2.1." Adds eval cost (2× LLM calls for benchmark rows) but produces strong evidence. Track for Phase 12 discussion.

- **Hook decomposition surfaced in result-card UI** — `weakest_modality` + per-modality scores + coherence + cognitive load are M2's job to display. M2 milestone owns the UX. Phase 5 ships the data shape M2 will consume.

- **Mixed-content soft-handling for body segment** — Phase 4 D-10 emits `mixed_content_detected` warning when video shifts mid-stream. Phase 5 body prompt could read this warning and adjust its lens (e.g., "this video shifts from talking-head to B-roll — score both modes"). Currently NOT in Phase 5 scope; planner doesn't add the branching unless researcher's prompt design needs it. Track for Phase 10 aggregator extension.

- **Promote frequent `other` content types to first-class** (carry-forward from Phase 4 deferred) — Phase 5 CTA-penalty matrix (D-06) has 7 rows matching Phase 4 D-09's vocabulary. If Phase 4 expands the vocabulary later (e.g., adds `dance` as 8th type), Phase 5 must add its penalty row.

- **Cross-modal coherence as standalone signal** — currently bundled into hook decomposition (HOOK-06). Phase 10 may pull `visual_audio_coherence` out as a standalone aggregator signal if eval shows it carries independent predictive power. Phase 5 ships it inside hook_decomposition; aggregator extension is Phase 10's call.

</deferred>

---

*Phase: 5-Video Segmentation + Hook Decomposition*
*Context gathered: 2026-05-18*
