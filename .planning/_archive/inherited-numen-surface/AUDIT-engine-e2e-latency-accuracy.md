# Prediction Engine — E2E Audit: Latency, Accuracy & Output Quality

**Date:** 2026-05-29
**Branch:** `feat/actions-frame-inline-redesign`
**Author:** engine audit (code-level, cross-referenced w/ measured run `z05dIjbz4v4W`)
**Goal of this doc:** explain why an analysis takes ~5.6 min today, lay out a concrete path to **<90s → results on board**, and audit what the engine actually computes, what it shows users, and how trustworthy the numbers are.

---

## 0. TL;DR (read this first)

1. **It's slower than the deadline that kills it.** Measured run: pipeline **211s** + post-pipeline tail **~121s** = **~332s (5.6 min)**. The Vercel function cap is `maxDuration = 300` (`vercel.json`, `route.ts:89`). **Every full run currently exceeds the cap and is at risk of being terminated mid-stream.** The architecture awaits the *entire* pipeline before responding — there is no background/queue offload.

2. **~22 LLM calls, run as serial waves, with no output-token caps.** The hot path fires: 1 Omni video call → (Wave 1) → 1 reasoning call (deepseek) → 10 persona calls (Pass 1) → 10 persona calls (Pass 2, thinking-mode) → 1 platform-fit call → 2 reasoning calls (Stage 10 + 11). **Not one of these LLM calls sets `max_tokens`.** Reasoning models (`qwen3.6-plus`) emit unbounded chain-of-thought; that is the dominant latency driver.

3. **Roughly half the LLM spend produces fields the user never sees.** `platform_fit`, `critique`, `counterfactuals` (null in prod anyway), `retrieval_evidence`, `audio_*`, `predicted_engagement` numbers, `feature_vector`, and the per-source score breakdown are all computed at cost and rendered **nowhere** on the live board. Cutting the non-shown LLM stages off the synchronous path removes ~100–150s with zero UX loss.

4. **The "parallel" waves may not be parallel at the provider.** The handoff (`HANDOFF-board-pipeline-fixes.md:31,42`) notes that wrapping Stage 10/11 in `Promise.all` did **not** improve latency — strong signal that DashScope is **serializing concurrent requests at the account-concurrency limit**. If true, "10 personas in parallel" actually queues. This must be verified — it changes which fix matters most.

5. **The score has no empirical grounding.** Platt calibration was removed (`aggregator.ts:932-935`); `overall_score = raw_overall_score`. The `outcomes` table, `trending_sounds` table, and retrieval corpus are all **empty (0 rows)**. So ML is off, trends contribute 0, audio-fingerprint never fires, retrieval never fires. The score is effectively **two LLM opinions (behavioral 40% + visual 35%)** renormalized, and the "Nth percentile" shown to users is a heuristic decile label, **not a real rank against any corpus**.

---

## 1. The pipeline, end to end

### 1.1 Request flow (synchronous, in-request)

```
POST /api/analyze  (maxDuration=300, memory=3008, nodejs runtime)
  │
  ├─ pre-flight (SERIAL awaited DB reads):
  │    auth → subscription → creator profile → usage → cache lookup → placeholder INSERT
  │    (overall_score=null is the "in-flight" sentinel)
  │
  ├─ new ReadableStream({ start(controller) {            ← SSE frames over ONE long-lived response
  │     await runPredictionPipeline(...)        ~211s    ← whole engine awaited here
  │     await aggregateScores(...)              ~121s    ← Stage10/11 + ML + optimal-post + 3 serial DB writes
  │     send("complete", finalResult)
  │     controller.close()
  │  }})
```

- The POST stream **runs the pipeline live** and forwards stage events; it is **not** a background job. `route.ts:540-710`.
- The GET `/api/analyze/[id]/stream` route is a **reconnect** path only — it polls the DB every 2s (90s ceiling), never re-runs the engine. `stream/route.ts`.
- Filmstrip generation is genuinely **fire-and-forget** (`triggerFilmstripGeneration` → `void fetch`, `pipeline.ts:539-547`) and does not block — but see Bugs §10 for two latent breakages.

### 1.2 Stage map (models, params, parallelism)

| # | Stage | File | Type | Model | Output cap | Timeout | Parallel? |
|---|-------|------|------|-------|-----------|---------|-----------|
| 1 | validate | pipeline.ts:429 | code | — | — | — | — |
| 2 | normalize | pipeline.ts:445 | code | — | — | — | — |
| 3 | pre_creator_context | pipeline.ts:471 | DB (~50ms) | — | — | — | — |
| 4 | sign video URL | pipeline.ts:496 | storage | — | — | — | — |
| 5 | **Omni video analysis** | qwen/omni-analysis.ts | **LLM** | `qwen3.5-omni-plus` | **none** | 60s/attempt ×2 | single call |
| 6 | Wave 1: gemini | pipeline.ts:564 | (precomputed from Omni in video mode) | — | — | — | ✓ Promise.all |
| 6 | Wave 1: audio_fingerprint | audio-fingerprint.ts | **NO-OP stub → null** | — | — | — | ✓ |
| 6 | Wave 1: creator_context | pipeline.ts:657 | passthrough (no I/O) | — | — | — | ✓ |
| 6 | Wave 1: rule_scoring | rules.ts | regex + 1 semantic call | `qwen3.6-flash` | **none** | 15s | ✓ |
| 7 | Wave 2: **deepseek reasoning** | deepseek.ts | **LLM** | `qwen3.6-plus` | **none** | 90s ×3 retries | ✓ Promise.all |
| 7 | Wave 2: trend_enrichment | trends.ts | DB + fuzzy (cached) | — | — | — | ✓ |
| 8 | **Wave 3 Pass 1** (10 personas) | wave3.ts | **10× LLM** | `qwen3.6-flash` | **none** | 45s each | ✓ allSettled |
| 9 | **Wave 3 Pass 2** (10 personas) | wave3/pass2.ts | **10× LLM** | `qwen3.6-plus` **+thinking (budget 8000)** | thinking only | 90s each | ✓ allSettled |
| 10 | **platform-fit** | wave4/platform-fit.ts | **LLM** | `qwen3.6-flash` | **none** | 45s | single, **serial** |
| — | (return to route) `aggregateScores`: | aggregator.ts | | | | | |
| 11 | **Stage 10 critique** | stage10-critique.ts | **LLM** | `qwen3.6-plus` **+thinking (4000)** | thinking only | 60s | Promise.all w/ 11 |
| 12 | **Stage 11 counterfactuals** | stage11-counterfactuals.ts | **LLM** | `qwen3.6-plus` | **none** | 60s | Promise.all w/ 10 |
| 13 | predict ML | (ml.ts) | model (cold start) | — | — | — | serial |
| 14 | optimal-post window | optimal-post.ts | DB lookup | — | — | — | serial |
| 15 | 3× DB writes | route.ts:609/626/643 | Supabase (serial) | — | — | — | serial |

**Critical structural fact:** stages 5 → 7 → 8 → 9 → 10 → 11/12 are **strictly sequential waves**. Wave 1 and Wave 2 are internally parallel, but everything from Wave 3 onward is awaited one after another. Platform-fit (10) does not depend on Pass 2 (9) yet runs after it.

### 1.3 Total LLM call count per analysis (video upload)

| Path | Calls | Model | Notes |
|------|-------|-------|-------|
| Omni | 1 (×2 attempts max) | omni-plus | + hidden SDK retries — see Bugs §10 |
| Rules semantic | 1 | flash | only if DB rules have `evaluation_prompt` |
| DeepSeek reasoning | 1 (×3 attempts max) | qwen3.6-plus | |
| Wave 3 Pass 1 | 10 | flash | +1 retry each on Zod fail |
| Wave 3 Pass 2 | 10 | qwen3.6-plus + thinking | +1 retry each; **dominant cost** |
| Platform-fit | 1 | flash | not shown to user |
| Stage 10 critique | 1 | qwen3.6-plus + thinking | not shown to user |
| Stage 11 counterfactuals | 1 | qwen3.6-plus | null in prod |
| **Total** | **~26 calls** | | **~14 on the slow reasoning model** |

Text / tiktok-url mode skips Omni + Pass 2 (no segments) → ~14 calls.

---

## 2. Latency budget — where the 332s goes

Reconstructed critical path (video upload), reconciled against measured 211s pipeline + 121s tail:

```
PIPELINE (211s measured)
  Omni video analysis          ~30–60s   (single call, uncapped output, 60s timeout)
  Wave 1 (parallel)            ~5–15s    (gated by rules semantic flash call)
  Wave 2 (parallel)            ~45–61s   (deepseek qwen3.6-plus, uncapped CoT)   ← BIG
  Wave 3 Pass 1 (parallel*)    ~10–30s   (10× flash; *if provider parallelizes)
  Wave 3 Pass 2 (parallel*)    ~46–56s   (10× qwen3.6-plus thinking-8000)        ← BIGGEST
  Platform-fit (serial)        ~10–20s   (not shown to user)

POST-PIPELINE TAIL (~121s measured)
  Stage 10 critique            ~50–60s   (qwen3.6-plus thinking-4000, not shown)  ← BIG
  Stage 11 counterfactuals     ~50–60s   (qwen3.6-plus, returns NULL in prod)     ← BIG, WASTED
  predict ML + optimal-post    ~few s
  3 serial DB writes           ~1–3s     (1 is fully redundant)
```

\*The handoff's observation that Stage10/11 `Promise.all` didn't help strongly implies **DashScope is serializing concurrent calls at the account concurrency limit.** If concurrency is capped low (e.g. ≤5), then the "10 parallel personas" actually run in ~2–3 serialized batches, and Pass 1 + Pass 2 alone could be 100s+. **This single unknown dominates the whole analysis — verify it before anything else** (fire 10 timestamped calls, compare wall-clock to single-call latency).

### Ranked root causes
1. **No `max_tokens` on any call** + thinking-mode budgets of 4000–8000 → reasoning models generate huge outputs. Output tokens are the latency you pay for.
2. **Too many reasoning-model calls on the hot path** (≈14 of 26 on `qwen3.6-plus`, several with thinking).
3. **Serial late stages** (Wave3-P1 → P2 → platform-fit → Stage10/11) that don't all have data dependencies.
4. **Provider concurrency serialization** (suspected) defeating the `Promise.all` parallelism.
5. **Computed-but-hidden stages** (platform-fit, critique, counterfactuals) spending ~120s+ for zero on-screen value.
6. **Synchronous, await-everything architecture** under a 300s cap with no streaming of partial results.
7. **Caching never hits for video** (hashes `video_storage_path`, not bytes; L1 cache is per-instance in-memory → cold on serverless). Every upload is a full cold run.

---

## 3. Path to <90s (phased, with estimated savings)

### Phase A — Quick wins (no architecture change, ~1 day) → target ~150–180s
- **A1. Cap `max_tokens` on every LLM call.** Personas 600–900, reasoning 1500–2000, critique 1200. Drop Pass 2 `thinking_budget` 8000→2000, Stage 10 4000→1500. *Est. −40–90s.* Highest ROI, lowest risk.
- **A2. Set `maxRetries: 0` on the OpenAI/DashScope client** (`qwen/client.ts:11`). Today the SDK default (2) stacks on top of the manual retry loops → up to 6 HTTP attempts × 60s on Omni alone. *Removes worst-case tail blowups.*
- **A3. Pin `temperature: 0`** on scoring/critique calls — reproducibility + slightly shorter outputs.
- **A4. Drop the redundant safety-net DB UPDATE** (`route.ts:643-672`) — fully redundant with the UPSERT. *Est. −1 round-trip.*
- **A5. Bump `maxDuration` to 800** (Pro) as a stopgap so runs stop getting killed while you optimize. *Stops data loss; not a real fix.*

### Phase B — Cut hidden work off the hot path (~1–2 days) → target ~90–110s
- **B1. Remove `platform_fit`, `critique` (Stage 10), `counterfactuals` (Stage 11) from the synchronous path.** None are shown on the board (§5). Counterfactuals returns **null in prod anyway** (schema-validation failure, handoff §2) and the board already falls back to top-level `suggestions`. *Est. −110–170s of tail.* This is the single biggest structural win and costs nothing in UX.
  - If you want critique's confidence nudge, compute a cheap heuristic version instead of a 60s thinking call.
- **B2. Fix video caching** (`prediction-cache.ts:31-48`): hash the video **bytes** (or a content fingerprint), not the storage path; persist L2 properly. Re-analysis of the same content → near-instant. Also makes dev iteration fast.

### Phase C — Collapse persona calls + stream partials (~3–5 days) → target <90s, perceived <30s
- **C1. Merge Pass 1 + Pass 2 into one call per persona.** One call returns both the aggregate intents *and* the per-segment curve. 20 calls → 10. *Est. −40–55s.* (Pass 2 already receives Pass 1's verdict, so they're coupled — dedupe them.)
- **C2. Or batch personas:** one prompt simulates 3–4 personas → 10 calls → 3. Trade some per-persona prompt-cache benefit for far fewer round-trips. Best if DashScope concurrency is the bottleneck (C2 > C1 in that case).
- **C3. Stream partial results to the board.** The SSE infra + frontend `partial`/`stage` handlers already exist (`use-analysis-stream.ts`). Emit `overall_score + verdict + factors` the moment Wave 1/2 finish (~60s), then stream personas/curve as Wave 3 completes. **Perceived latency drops to the first meaningful paint, not the full run.** This is what makes "<90s → results on board" feel instant even if the long tail (now async) keeps running.
- **C4. Move the truly-async, non-shown enrichment (retrieval, platform-fit, critique) to a Vercel `after()`/`waitUntil` job** that writes back to the row; the board picks it up via the existing reconnect/poll path. (Note: the handoff already flags that post-`complete` fire-and-forget is unsafe on serverless **without** `waitUntil`/`after` — use them.)

### Phase D — Verify & right-size provider concurrency (parallel track)
- **D1. Measure DashScope account concurrency** (the suspected serializer). If capped, either request a higher limit, add a client-side concurrency pool sized to it, or lean on C2 (fewer, batched calls). This determines whether "parallel" is real.

**Expected trajectory:** A (≈170s) → B (≈100s) → C (<90s wall, <30s perceived). The board shows a usable verdict in ~1 min, full persona detail shortly after, and the invisible enrichment finishes in the background.

---

## 4. Inputs we feed vs outputs we receive

### Inputs (per `AnalysisInput` / `ContentPayload`, normalize.ts)
- **Content:** video upload (signed URL, sent inline to Omni — no upload/poll), OR `content_text` (text mode), OR `tiktok_url`.
- **Context:** `niche`, `content_type`, creator handle → `creatorContext` (follower tier, avg views, engagement, 9-card profile from `creator_profiles`), target platforms, hashtags.
- **Derived at runtime:** `DemographicContext` (time-of-day + scrolling-state from the **server clock** — note: server UTC, not the audience's timezone), follower_tier band, segments (from Omni).

### Outputs (`PredictionResult`, types.ts:217-339) — every top-level field
Score: `overall_score`, `confidence`, `confidence_label` · Breakdown: `rule_score`, `trend_score`, `gemini_score`, `behavioral_score`, `ml_score`, `audio_perceptual_score`, `score_weights`, `feature_vector` · `factors[]`, `suggestions[]`, `reasoning` (always `""`), `warnings[]` · `behavioral_predictions`, `persona_behavioral_aggregate`, `persona_simulation_results[]` · `heatmap` (weighted_curve, per-persona attentions, swipe points, segment reasons, weights, vs_niche), `weighted_completion_pct`, `weighted_top_dropoff_t`, `weighted_hook_score`, `emotion_arc`, `hook_decomposition` · `platform_fit` · `optimal_post_window` · `matched_trends` (declared but **not set**), `audio_fingerprint`, `audio_description`, `audio_signals` (not set) · `signal_availability` · `anti_virality_gated/reason`, `dropoff_segment_indices` · `predicted_engagement` {views,likes,comments,shares,saves} · `retrieval_score`, `retrieval_evidence[]` · `critique`, `counterfactuals` · `cost_cents`, `latency_ms`, `engine_version`, model names, `input_mode`, `has_video`.

---

## 5. What we SHOW users vs compute-but-hide

**Live results UI = the Board only** (`analyze/layout.tsx` mounts `<Board>`; `[id]/page.tsx` returns null). The old `result-card.tsx`, `src/components/app/simulation/*` (ResultsPanel, behavioral-predictions, impact-score), `viral-results/*` and `visualization/*` are **dead / test-page-only**. There is **no engine→UI mapper layer** — board components read `PredictionResult` directly off `useAnalysisStream().result`.

### Shown (real engine output)
- `overall_score` → "Nth percentile" big number (Verdict) + VsHistory bars
- `confidence` / `confidence_label` → confidence pill
- `anti_virality_gated` → orange gate banner + cross-frame ripple
- `factors[]` → Verdict "why works / might not" buckets (⚠️ **mid-range 4–6 factors dropped**) + Actions scorecard (all factors w/ bars)
- `counterfactuals.suggestions` / top-level `suggestions` → "What to fix", Hook fixes
- `reasoning` intro, filtered `warnings[]`
- `heatmap.personas[]` (**all 10 shown**, open by default) + attentions + swipe points + segment reasons
- client-recomputed **survival curve** (prefers its own calc; engine `weighted_curve` is fallback)
- headline chips: `weighted_completion_pct` (Watch), loop_pct (Loop), `weighted_top_dropoff_t` (Drop), `weighted_hook_score` (Hook), `vs_niche_diff_pct` (vs Niche)
- `behavioral_predictions.*_percentile` (Input card)
- `emotion_arc` (when present — often null), `hook_decomposition`, `optimal_post_window`, `dropoff_segment_indices`

### Computed but NOT shown — pure latency/cost tax
| Hidden field | Cost to produce | Verdict |
|---|---|---|
| `retrieval_evidence[]` (similar viral videos: handle, views, similarity, hashtags) | pgvector retrieval | **Richest unused asset.** Would directly answer "show me similar videos & how they did" AND enable real percentiles. |
| `platform_fit` (per-platform score + rationale + watermark) | 1 LLM call (~15s) | Cut from hot path. |
| `critique` (self-consistency score/flags) | 1 thinking call (~60s) | Cut from hot path. |
| `counterfactuals.band` + structured CFs | 1 call (~60s, **null in prod**) | Cut / fix offline. |
| `matched_trends`, `audio_fingerprint`, `audio_description`, `audio_perceptual_score`, `audio_signals` | Omni + trends | Entire audio/trend surface invisible (and data tables empty). |
| `predicted_engagement` numbers (views/likes/shares/saves) | synthetic compute | Not shown (good — it's fake; §6). |
| `feature_vector` (~25 signals), `behavioral_score`/`gemini_score`/`rule_score`/`trend_score`/`ml_score`, `score_weights` | core compute | No score-decomposition shown — users can't see "why the score is X". |
| `signal_availability` | compute | Users can't tell when a verdict is degraded. |
| `niche_completion_pct`, `anti_virality_reason` | compute | Unused. |

**Net:** roughly half the payload is computed and never seen. Three of those (platform_fit, critique, counterfactuals) are slow LLM calls — moving them off the synchronous path is free latency.

### Things shown that are low-value / questionable
- "Nth percentile" is a heuristic decile label, not a corpus rank (§6) — borderline misleading.
- VsHistory niche cohort is hard-locked to "coming soon" (`data.niche` always null) — occupies space, no data.
- Actions placeholder copy literally says **"Phase 6"** / "Coming in Phase 6" to end users while a slot loads — leaked dev copy.
- WhyVerdict silently drops mid-range factors (4–6).

---

## 6. Prediction accuracy & output-data quality

### The core problem: no ground truth, so nothing is calibrated
- **Platt calibration removed** — `overall_score = raw_overall_score` (`aggregator.ts:932-935`). The number has no mapping to real-world view outcomes.
- **`outcomes` table = 0 rows** → ML disabled (`ml` weight 0), `ANTI_VIRALITY_THRESHOLD = 0.4` is a **fallback calibrated against an empty table** (`anti-virality.ts:18-22`).
- **`trending_sounds` = 0 rows** → audio-fingerprint match never fires; trend_score ≈ 0.
- **Retrieval corpus empty / weight 0** → `retrieval_score` null, no real percentiles possible.
- **Effective scoring model** after weight redistribution ≈ **behavioral (persona) + visual (Gemini factors)** — two LLM opinions. ml/rules/retrieval weights are hardcoded 0; trends/audio contribute ~nothing given empty data.

### Fields that are theater / heuristic (not real signal)
- **`predicted_engagement`** — views = `5000 + (score/100)^2.2 · 450000 · (0.8 + jitter)`, with a **sin-hash jitter** explicitly added to make numbers "feel authentic" (`aggregator.ts:435-468`). Pure function of the score. (Not shown on board — keep it that way, or label it clearly as an estimate.)
- **`*_percentile`** labels — decile mapping of an intent score, or a free-text LLM string, or `"N/A"` (`wave3/aggregator.ts:117-123`). The board renders these as "Nth percentile" — reads like a corpus rank, isn't one.
- **`confidence`** — hand-built bonus math with hardcoded thresholds.
- **Omni `content_type`/`niche` confidence = hardcoded 1.0**; `signalAvailability` hardcoded all-true (`omni-analysis.ts:226-231,255`) — defeats downstream confidence gating.

### Reliability/quality weaknesses found
- **No `temperature` pinned** anywhere → non-deterministic outputs run-to-run; undermines any future calibration and makes the score jittery for the same input.
- **`json_object` not `json_schema`** on Omni → not grammar-constrained; malformed output triggers a **full second video re-analysis** (expensive) instead of a cheap repair.
- **`emotion_arc` is optional in the prompt and dropped from the Omni output struct** → panel frequently null (handoff §5).
- **Stage 11 counterfactuals null in prod** — strict per-band discriminated-union schema fails validation (handoff §2).
- **5/10 niches ship `[PLACEHOLDER]` persona text** to the model (`persona-registry.ts:302-361`) → weaker grounding for food/tech/gaming/fashion/music.
- **Pass-1 drop fallback hack** (`pass2.ts:55-76`) exists because Pass 2 keeps returning `swipe_predicted=false` everywhere (retention pinned at 100%) → the prompt isn't reliably eliciting realistic drop-off.
- **DemographicContext time-of-day uses server UTC**, not the target audience's timezone — `scrolling_state`/`time_of_day` are likely wrong for most analyses.

### Accuracy remediation (ordered by leverage)
1. **Seed ground truth.** Turn on the Apify scrape + the `outcomes` capture loop. Without real data, calibration/ML/percentiles/trends are all permanently fake. This is the #1 accuracy lever and it's mostly **operational, not code** (crons exist: `scrape-trending`, `calculate-trends`, `retrain-ml`).
2. **Populate the retrieval corpus** → (a) enables genuine percentiles ("top X% vs N similar videos") and (b) lights up `retrieval_evidence` (the highest-value unused surface). Two wins from one fix.
3. **Re-introduce calibration** once outcomes exist (Platt or isotonic) so `overall_score` maps to real virality probability.
4. **Pin `temperature: 0`** on scoring/persona/critique calls for reproducibility.
5. **Switch Omni + structured stages to `json_schema`/structured output** → fewer expensive validation-retry loops, fewer nulls.
6. **Fix the persona drop-off prompt** (or keep the Pass-1 fallback but tune it) so retention curves aren't artificially flat.
7. **Either show or stop computing `predicted_engagement`** — if shown, label as estimate; the sin-hash jitter should not ship to users as a real forecast.
8. **Fill the placeholder persona niches** and use the audience's timezone for demographic context.

---

## 7. Bugs & correctness issues found during the audit

1. **Run exceeds `maxDuration` (300s) → analyses killed.** `vercel.json` / `route.ts:89`. (Phase A5 stopgap, real fix = get under 90s.)
2. **Omni double-retry hazard** — SDK `maxRetries` default (2) not overridden + manual loop (2) = up to 6 HTTP attempts × 60s. `qwen/client.ts:11` + `omni-analysis.ts:25`.
3. **Video cache never hits** — hashes `video_storage_path` (unique per upload), not bytes; L1 is per-instance in-memory (cold on serverless). `prediction-cache.ts:31-48`.
4. **Redundant safety-net DB UPDATE** fully duplicates the UPSERT. `route.ts:643-672`.
5. **Filmstrip schema drift** — extract route writes `variants.filmstrip_segments` but GET-stream reads `heatmap.segments[].keyframe_uri` → `filmstrip_segment_ready` never fires. `stream/route.ts:15-20` vs `filmstrip/extract/route.ts:206-256`.
6. **Filmstrip uuid mismatch** — extract route requires `analysisId: z.string().uuid()` but the route generates `nanoid(12)` IDs → Zod rejects every real request with 400. `extract/route.ts:51`.
7. **Pass 2 keyframes always null from DB** — `readKeyframeUris` reads table `analyses` (route writes `analysis_results`). `pipeline.ts:304-332`.
8. **`audio-fingerprint` is a no-op stub** returning null (`audio-fingerprint.ts:18-25`); the pgvector match it advertises isn't running, yet `trends.ts` has a gating branch assuming it might.
9. **Stage 11 `_videoContext` is unused** and `aggregateScores` is always called with `undefined` options (`route.ts:442,577`) → no video frames ever reach counterfactuals despite the threading scaffolding.
10. **`matched_trends` / `audio_signals` declared on `PredictionResult` but never set** in the result literal → consumers reading them get `undefined`.
11. **Stale comments / module names** — `deepseek.ts` runs `qwen3.6-plus`; platform-fit comments say "deepseek-chat/V3" but run `qwen3.6-flash`. Cosmetic but misleading.

---

## 8. Recommended sequencing

**This week (latency, low risk):** A1 `max_tokens` caps → A2 `maxRetries:0` → A5 bump cap to 800 → B1 cut platform-fit/critique/counterfactuals off hot path. Re-measure. Likely lands ~100–120s immediately.

**Verify in parallel:** D1 DashScope concurrency (decides C1 vs C2).

**Next:** C1/C2 persona-call collapse + C3 stream partials → <90s wall, <30s perceived. B2 cache fix for fast iteration.

**Strategic (accuracy):** seed outcomes + corpus (§6.1/6.2) → calibration → real percentiles + surface `retrieval_evidence`. This is what turns the score from "two LLM vibes" into a defensible prediction.

---

## Appendix — key files
- Orchestration: `src/lib/engine/pipeline.ts`, `src/app/api/analyze/route.ts`, `[id]/stream/route.ts`
- Scoring/output: `src/lib/engine/aggregator.ts`, `types.ts`, `anti-virality.ts`, `predicted-engagement.ts`, `optimal-post.ts`
- LLM stages: `qwen/omni-analysis.ts` + `client.ts`/`cost.ts`, `deepseek.ts`, `wave3.ts`, `wave3/pass2.ts`, `wave4/platform-fit.ts`, `stage10-critique.ts`, `stage11-counterfactuals.ts`
- Personas: `wave3/persona-registry.ts`, `persona-prompts*.ts`, `wave3/aggregator.ts`, `weighted-aggregator.ts`
- Caching: `cache/prediction-cache.ts`, `cache.ts`
- Board (what's shown): `src/components/board/*` (Board.tsx, audience/*, verdict/*, actions/*, content-analysis/*), `use-analysis-stream.ts`
- Dead/test-only: `analyze/[id]/result-card.tsx`, `components/app/simulation/*`, `viral-results/*`, `visualization/*`
- Prior context: `.planning/HANDOFF-board-pipeline-fixes.md`, `.planning/reference/session-640dc7c5-prediction-engine.md`
</content>
</invoke>
