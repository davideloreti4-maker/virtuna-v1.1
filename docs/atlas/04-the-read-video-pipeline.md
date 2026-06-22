# Atlas 04 — The Read (video analysis pipeline)

> Trace-level companion to `docs/PLATFORM-MAP.md` §3 (Lane B). This goes deeper:
> `path:line`, model params, scoring math, latency. The map tells you *that* a stage
> exists; this tells you *exactly* what it sends, what it returns, and what it costs.
>
> Engine version at trace time: **`3.19.0`** (`src/lib/engine/version.ts:127`).
> Provider: DashScope (Qwen, OpenAI-compatible) — `src/lib/engine/qwen/client.ts:3,15`.
> SDK `maxRetries:0` (`client.ts:15`) — every stage owns its own retry loop.
> Determinism on every scoring call: `temperature:0` + `QWEN_SEED=7` (`client.ts:28`).

---

## ASCII pipeline (execution order)

```
POST /api/analyze (route.ts:397)
  auth (406) → 413 content-length guard (417) → body validation (431-488)
  → tier rate-limit (529) → retention/handle prefetch (506) → Zod parse (565)
  → creator_handle thread-in (580) + follower backfill F&F (596)
  → contentHash (612) → CACHE LOOKUP (615)  ──hit──> single SSE `complete` (<2s)
                                              │miss
                                              ▼
  mode:"remix"? ──yes──> runDecodeStream (326): resolve+rehost → Omni → runDecode → variants.remix.decode
                                              │no (mode:"score")
                                              ▼
  placeholder INSERT (855) → SSE stream open (946)
        │
        ▼  runPredictionPipeline (pipeline.ts:320)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ 1 validate (336)  2 normalize (352)  [sub-ms]                              │
  │ pre_creator_context  fetchCreatorContext (385) [DB, ~50ms, NO LLM]        │
  │ INPUT RESOLVE:                                                             │
  │   video_upload → createSignedUrl(3600s) (404)                             │
  │   tiktok_url   → Apify resolveVideoUrl (445) + SSRF gate + download +      │
  │                  re-host to videos bucket + sign (465-491) [25-38s+dl]     │
  │                                                                            │
  │ WAVE 0  analyzeVideoWithOmni(signedUrl)  [QWEN_OMNI_MODEL=omni-flash]      │
  │   (pipeline.ts:554; omni-analysis.ts:210)  ~8-17s                          │
  │     └─ fire-and-forget triggerFilmstripGeneration (577) [NOT awaited]      │
  │                                                                            │
  │ WAVE 1 (Promise.all, 656): geminiPromise + creatorPromise                 │
  │   video → precomputed from Omni (passthrough). text/url → Qwen text call. │
  │   retrievalResult = createEmptyRetrievalResult()  [DISABLED, weight 0]    │
  │                                                                            │
  │ ── these three run CONCURRENTLY (all use signedVideoUrl) ──               │
  │ APOLLO  reasonWithDeepSeek (pipeline.ts:704; deepseek.ts:497)             │
  │         [QWEN_APOLLO_MODEL=qwen3.7-plus, thinking 1500] ~44-50s           │
  │ FOLD    runFold (pipeline.ts:776; fold.ts:305)                           │
  │         [FOLD_MODEL=omni-flash ⚠] ~8-54s, 90s hard ceiling               │
  │   (Apollo awaited via wave2Promise:740; fold awaited inline:776)         │
  │                                                                            │
  │ finalize (836): total_duration_ms, cost sum                              │
  └──────────────────────────────────────────────────────────────────────────┘
        │ PipelineResult
        ▼  aggregateScores (aggregator.ts:520)
  scoring math (below) + Stage-10 critique (1276, deterministic TS, sub-ms)
  + computeOptimalPostWindow (736, DB read) + assembleHero (1308)
        │ PredictionResult
        ▼
  UPSERT analysis_results by id (1031) → populate L1 cache (1040)
  → persistCraft/Apollo to variants JSONB (1045-1048) → usage upsert (1053)
  → safety-net UPDATE (1070) → send `complete` (1121)
```

---

## 1. Input modes, normalization, SSRF, Apify resolve+rehost

Four `input_mode` values, validated by `AnalysisInputSchema` (`route.ts:565`) and a
separate `mode` axis (`"score" | "remix"`, drives the decode branch).

**Pre-pipeline validation (`route.ts`):**
- `413` early reject if `content-length > 287MB` (`route.ts:416`).
- `content_text`: 10–10000 chars, anti-spam >90% repeated-char reject (`431-461`).
- `tiktok_url`: shared `TIKTOK_URL_PATTERN` regex (`467`, `src/lib/tiktok-url.ts`) — byte-identical to client check.
- `video_upload`: `video_storage_path` must be non-empty, not `"pending-upload"` (`477`).
- Rate limit is **mode-agnostic** and runs BEFORE the pipeline (`529`) — the cost guard against tiktok_url Apify paste-spam (`free/starter=50/day`, `pro=∞`, `route.ts:379-383`).

**Normalization (`normalize.ts:42`):** `AnalysisInput → ContentPayload`.
- `video_url = input.tiktok_url ?? null`; `video_storage_path` carried explicitly. **GAP-04-01 fix** (`normalize.ts:49`): video_upload's `video_url` is `null` — never aliased to the storage key (the alias used to make `fetch()` throw TypeError).
- Pulls hashtags + a duration hint from text (regex, `normalize.ts:7,18`).

**Input resolve (inside `pipeline.ts`):**
- **video_upload** → `createSignedUrl(path, 3600)` (`pipeline.ts:404`). Pure Supabase, no LLM. Throws if signing fails.
- **tiktok_url** → 5-step Apify resolve+rehost (`pipeline.ts:440-512`):
  1. `resolver.resolveVideoUrl(url)` (`apify-provider.ts:284`) — clockworks `tiktok-scraper` single-URL, `shouldDownloadVideos:true`, `waitSecs:180`. Returns a **private `api.apify.com` KV-store mp4 URL**.
  2. **SSRF gate** `isAllowedMp4Host` (`apify-provider.ts:99,333`): HTTPS-only, rejects `PRIVATE_IP_PATTERNS` (`62-71`), allowlist suffixes = `.apify.com / .apifyusercontent.com / .tiktokcdn.com / .tiktokcdn-us.com` (`54-59`). Paste-URL itself guarded by `isAllowedPostUrl` (`.tiktok.com / .tiktokv.com`, `79-97`).
  3. Download mp4 **server-side** with `?token=APIFY_TOKEN` (`pipeline.ts:452`) — token is **never** put in the URL handed to Omni (would leak to Alibaba/DashScope).
  4. Re-host bytes to `videos` bucket. Owner-prefixed `${userId}/tiktok-${requestId}.mp4` if `opts.userId` present (kept for the retention scrubber, surfaced as `PipelineResult.video_storage_path`); else legacy `remix-temp/${requestId}.mp4` (derive-and-drop).
  5. Sign (1h) → assign to `signedVideoUrl` (`491`). **`dropRehostTemp()`** (`520`) deletes the temp object unconditionally in a post-pipeline `finally` (`822`) — F7 race fix: must run AFTER Omni+fold fetch the URL.
- **text** → no video; `signedVideoUrl` stays null; Wave 0 skipped, gemini text call runs.

**remix branch** (`route.ts:892`, `runDecodeStream:326`): resolve+rehost → Omni (perception only) → `runDecode` → persist `variants.remix.decode`. **Never** calls `runPredictionPipeline`/`aggregateScores`/usage-tracking. `overall_score:null`; completion marker is `variants.remix != null`.

## 2. `fetchCreatorContext` (DB, no LLM)

`pipeline.ts:385` (stage `pre_creator_context`) → `creator.ts:134`. Reads
`creator_profiles` (`creator.ts:171`) + aggregates `scraped_videos` views/likes
(`creator.ts:76`). ~50ms. Graceful: any error → `DEFAULT_CREATOR_CONTEXT`
(`pipeline.ts:215`, `found:false`, platform averages baked in). The Wave-1
`creator_context` stage (`645`) is a **passthrough** that re-emits the event name for
back-compat — no second DB read. Feeds: niche hint to Omni, creator string to Apollo,
`follower_count` to `computeEngagementRange`.

## 3. WAVE 0 — `analyzeVideoWithOmni` (`QWEN_OMNI_MODEL`)

`pipeline.ts:554` → `omni-analysis.ts:210`. Model default **`qwen3.5-omni-flash`**
(`client.ts:36`; flipped plus→flash 2026-06-06, ~halved read latency). This is a
**pure perception sensor** (D-R1, 2026-06-11) — it no longer grades.

**Input sent to Qwen** (`omni-analysis.ts:235-263`): a multimodal message —
`{type:"video_url", video_url:{url: signedVideoUrl}}` + a text instruction. **The whole
video URL is handed to the omni model**; the model watches video+audio directly (not
frames, not a pre-extracted transcript). `temperature:0`, `seed:7`, `max_tokens:8000`
(`OMNI_MAX_TOKENS`, `omni-analysis.ts:34` — F47: an unset cap truncated long videos mid-JSON).
`response_format: json_object`. `TIMEOUT_MS=60_000`, `MAX_RETRIES=1` (2 attempts).
System prompt is **byte-stable** (T3.4: niche/content-type hints moved to the volatile
user message via `buildUserHints`, `omni-analysis.ts:204`, so the DashScope prefix-cache
doesn't bust per niche).

**Outputs** (`omni-analysis.ts:328-367`, schema `OmniAnalysisZodSchema`):
- `content_type` (8-value enum) + `niche_primary/micro_slug` → `wave0Result`. ⚠ Both carry `confidence:1.0` — a **DEAD placeholder** (`omni-analysis.ts:316,320` F12); nothing reads it.
- `hook_decomposition` (visual_stop_power, audio_hook_quality, text_overlay_score, first_words_speech_score, weakest_modality, visual_audio_coherence, cognitive_load [inverted polarity], watermark_detected).
- `video_signals` (visual_production_quality, hook_visual_impact, pacing_score, transition_quality).
- `audio_signals` (clarity, audio-hook, silence/voiceover/music ratios sum≈1, audio_description) + `audio_perceptual_score` 0-100.
- `emotion_arc` (3-8 points), `hook_verbatim` (spoken/on-screen, no translation), `segments` (`SegmentGrid[]`, hook 0-3s forced own segment, normalized by `normalizeSegments`).
- `signalAvailability {gemini_hook/body/cta:true}` on success.
- **Critical-field drift guard** (`detectCriticalFieldDrift:79`): Zod can pass yet `emotion_arc`/`hook_verbatim` be empty → one bounded retry, then `read_drift` log instead of silent drop.

**Filmstrip fire-and-forget** (`pipeline.ts:574` → `filmstrip/queue.ts:19`): POSTs
`{analysisId, segments, videoUrl}` to `/api/filmstrip/extract`, never awaited. Skipped if
`FILMSTRIP_EXTRACT_SECRET` unset. Gated on `opts.analysisId` (route threads it at `:979`).

## 4. APOLLO — `reasonWithDeepSeek` (`QWEN_APOLLO_MODEL`)

`pipeline.ts:704` (stage `deepseek_reasoning`, "deepseek" is a **legacy name** — it runs
Qwen, `deepseek.ts:18`) → `deepseek.ts:497`. Model **`qwen3.7-plus`** (`client.ts:50`,
scoped separately so Apollo moves independently of chat/decode). Deaf (no audio), but
**sighted**: when `videoUrl` present it's prepended so Apollo *watches* the hook
(`deepseek.ts:531`).

**Params** (`deepseek.ts:537-557`): `temperature:0`, `seed:7`, `response_format:json_object`,
`max_tokens:3000`, `enable_thinking:true`, `thinking_budget:1500` (`DEEPSEEK_THINKING_BUDGET`,
`deepseek.ts:36` — A/B showed insight not thinking-bound; 3000→1500 cut ~76s→44s).
`TIMEOUT_MS=120_000`, `MAX_RETRIES=2` (3 attempts) + **circuit breaker** (`deepseek.ts:49`,
open after 3 failures, backoff 1/3/9s, half-open probe mutex). Returns `null` if open →
aggregator degrades.

**System prompt = `APOLLO_SYSTEM_PROMPT`** (`apollo-core.ts:254`) = `KNOWLEDGE_CORE`
(craft brain §1-§6, `apollo-core.ts:40`) + `APOLLO_INSTRUCTION` (§4 contract, `:235`).
**Byte-stable** (no interpolation) → DashScope input-cache hits. T3.1 lean variant drops
§2.6/§7/§8 + provenance meta (sections the rubric never scores). User message is volatile
(`buildDeepSeekUserMessage:353`): verbatim hook, `formatGeminiSignals` perceptual reading
(`:293` — sensor numbers, explicitly NOT grades), creator context, JSON output contract.

**The 6 dimensions** (`deepseek.ts:445-450`): `hook, retention, clarity, share_pull,
substance, credibility`. Each gets a band (strong/mid/weak) → **fixed numeric anchor
strong=85 / mid=50 / weak=20** (the determinism lever).

**Composite formula** (`deepseek.ts:226-234`) — computed in **TypeScript, not the LLM**
(the model's holistic composite was dropped; schema `.optional()`):
```
HOOK_WEIGHT = 0.80;  BODY_WEIGHT = 0.20/5 = 0.04   (each of 5 body dims)
composite_score = round( clamp( Σ dim.score · w , 0, 100 ) )
                = 0.80·hook + 0.04·(retention+clarity+share_pull+substance+credibility)
```

**Rewrites** (`:454`): 2-3 hook variants, each fixing a *different* §2 lever; `original`
must copy the verbatim hook (R2 backstop overwrites paraphrase, `deepseek.ts:253`).
**§-cite guard** (`guardApolloCites:182`): strips dangling §-tokens from metadata + ALL
§-tokens from user-facing prose.

## 5. FOLD — `runFold` (`FOLD_MODEL`)  ⚠ default mismatch

`pipeline.ts:776` (stage `wave_3_fold`) → `fold.ts:305`. The **20→1 fold**: ONE bounded
call emits behavioral intents + per-segment attention for **all 10 archetypes**
(replaced 10×Pass-1 + 10×Pass-2). Only runs when `omniSegments.length > 0` (video mode);
text/tiktok_url → `foldOutcome` stays null.

**⚠ `FOLD_MODEL` default = `"qwen3.5-omni-flash"`** (`fold.ts:83-87`). Memory
`[[engine-model-assignment]]` says fold should be **omni-plus (PAID)**; omni-flash is the
"unstable-diversity WRONG variant". **The flip + cost-fix is still pending** (also flagged
in PLATFORM-MAP §9.1). Escape hatch: `FOLD_MODEL=omni-plus` (rollback), `=plus` (deaf
reasoning, diagnostic), `=flash` (deaf+blind text). The 2026-06-11 commit message claims
omni-flash is 5-6× faster, ~3.5× cheaper, diversity within ±0.04 — but the memory still
marks it a live gap, so treat the default as **contested**.

**Params** (`fold.ts:326-348`): `temperature:0`, `seed:7`, `json_object`, `max_tokens:4000`
(`FOLD_MAX_TOKENS`), thinking off by default (omni doesn't think; `FOLD_THINKING_BUDGET=1000`
only used if `FOLD_THINKING=1`). System = `STABLE_FOLD_SYSTEM_PROMPT` (byte-stable). Video
URL passed (sense-complete — watches video+audio). **`PER_CALL_TIMEOUT_MS=90_000` is a HARD
ceiling** (`fold.ts:54`) — the fold only "earns the flip" if it beats the old 10-pass on
wall-clock; never raise it. Retry: 2 attempts (omni) bounded by `FOLD_ATTEMPT_TIMEOUT_MS=40s`
each (`fold.ts:98`); 1 attempt if thinking. Salvage floor `MIN_VALID_PERSONAS=6`
(`fold.ts:102`) — keeps personas whose `segment_reactions.length === segments.length`, drops
mismatches. Diversity guard `DIVERSITY_FLOOR=0.10` (`fold.ts:116`) — warn + one retry-nudge,
then accept homogenized (F19 fallback, `fold.ts:457`).

**Persona weights** (`persona-weights.ts:22`, `DEFAULT_PERSONA_WEIGHT_CONFIG`):
`fyp 0.65 / niche 0.20 / loyalist 0.10 / cross_niche 0.05`. Resolved via `resolveWeights`
(`persona-weights.ts:33`, precedence analysis>creator>niche>default, always normalized).
Applied in the aggregator's `buildWeightedCurve` / `assembleHeatmapPayload`
(`aggregator.ts:1110-1121`). `niche_deep` slot maps → `niche` bucket (`fold.ts:180`).

Output adapted to `PersonaSimulationResult[]` + `Pass2PersonaResult[]` (`fold.ts:218,257`);
`fold_success` reflects only that the parse succeeded.

## 6. RETRIEVAL — `runBenchmarkRetrieval` — DISABLED

`pipeline.ts:666` calls `createEmptyRetrievalResult()` (`retrieval-empty.ts:9`) — NOT the
real RAG. Returns `{evidence:[], score:null, availability:false, cost_cents:0}`. The full
pgvector pipeline exists dormant under `engine/retrieval/` + `engine/corpus/embedder.ts`.
Aggregator treats `score:null` as weight 0; nothing redistributes (it was already removed
from `SCORE_WEIGHT_KEYS`). Re-enable = M2 embedding migration.

## 7. `aggregateScores` — scoring math + confidence

`aggregator.ts:520`. Live blend keys = **`behavioral` + `apollo` only**
(`SCORE_WEIGHTS = {behavioral:0.40, apollo:0.35}`, `:78`). Sub-scores:
- `behavioral_score` = round(avg of Apollo's 7 component_scores ×10) (`:818-828`).
- `apollo_score` = `deepseek.composite_score` (`:848`).
- `fold_audience_score` (`:864`) = `round(0.50·completion + 0.25·share + 0.15·save + 0.10·comment)` over the fold persona aggregate (retention-dominant).

**Overall score** (`aggregator.ts:883-897`):
```
video + both signals: overall = 0.5·apollo_score + 0.5·fold_audience_score
text / no-fold:        overall = behavioral_score·w.beh + apollo_score·w.apollo
                                 (w renormalized to 53.3/46.7 from 0.40/0.35)
apollo dead, fold ok:  overall = fold_audience_score (100%)
both dead:             overall = 0   (+ analysis_unavailable flag, :912)
```
No Platt calibration (dropped 2026-05-24, `:899`). `partial_analysis` flag when exactly one
core signal dead (`:917`).

**Confidence** (`calculateConfidence:299`): `signal (0-0.6)` [base 0.2 + video 0.1 + deepseek
conf] + `agreement (0-0.4)` [**Apollo composite vs independent fold audience score** on video,
F22/F44 — fixes the old self-agreement bug; falls back to apollo-vs-behavioral when no fold].
HIGH ≥0.7 / MEDIUM ≥0.4 / LOW (`:347`). HARD-03 forces LOW when both LLMs dead (`:941`).
Stage-10 critique can only adjust confidence **downward**, clamped `[-0.20, 0]` (`:1286`).

Persisted on `PredictionResult` (`:1133`): `apollo_reasoning`, `hero`, `heatmap`,
`weighted_*`, `behavioral_predictions`, `predicted_engagement` (follower×quality, null if no
baseline, `computeEngagementRange:185`), `engine_version`, `signal_availability`.

## 8. Caching + persistence

**Cache** (`prediction-cache.ts`): L1 in-memory (`L1_TTL_MS=24h`, `:11`) + L2 Supabase
`analysis_results` SELECT. **Key = `${contentHash}::${ENGINE_VERSION}::${userId}`**
(`cacheKey:20`). `contentHash` = SHA-256 of buffer/url/text + `::mode=remix` segment only
for remix (`computeContentHash:31`). user_id scoping = cross-tenant guard (kept even with
service role, `:86`). **`ENGINE_VERSION` bump auto-invalidates** all prior L1+L2 rows
(currently `3.19.0`, `version.ts:127`). Lookup before SSE/JSON branch (`route.ts:615`),
<2s on hit → single `complete` event. `bypass_cache` via query/body (`route.ts:605`).

**Persistence** (`route.ts`): placeholder INSERT before stream (`:855`, sentinels
`engine_version:"pending"`, `overall_score:null`) so `/api/analyze/[id]/stream` can poll
→ UPSERT by id after pipeline (`:1031`) → L1 populate (`:1040`) → variants JSONB merges
(`persistCraft :1045`, `persistApollo :1048`; read-merge-write to survive the racing
filmstrip writer) → usage upsert (`:1053`) → safety-net UPDATE of score columns (`:1070`).
`variants` JSONB holds: `craft`, `apollo`, `hero`, `engagement_range`, `remix.decode`,
`filmstrip_segments`.

---

## Latency notes (the ~312s E2E)

`maxDuration=300` (`route.ts:376`). The pipeline self-reports `total_duration_ms`; route
adds aggregate time and persists the true E2E.

**Stage cost (video mode, current defaults):**
| Stage | ~Latency | Notes |
|---|---|---|
| pre_creator_context (DB) | ~50ms | no LLM |
| tiktok resolve+rehost | **25-38s + download** | Apify `waitSecs:180`; only tiktok_url |
| WAVE 0 Omni read | ~8-17s | omni-flash; 60s timeout, 1 retry |
| APOLLO | ~44-50s | thinking 1500; 120s timeout, ≤3 attempts |
| FOLD | ~8-54s | omni-flash; **90s hard ceiling**, ≤2×40s attempts |
| Stage-10 critique | sub-ms | deterministic TS |
| optimal_post_window (DB) | small | |
| filmstrip | **0 on critical path** | fire-and-forget |

**Serial vs parallel:** Wave 0 (Omni) is **serial and gating** — Apollo + Fold both consume
its `signedVideoUrl`/segments, so they cannot start until Omni returns. After Wave 0, **Apollo
and Fold do run concurrently** (Apollo via `wave2Promise` await at `pipeline.ts:820`, Fold
awaited inline at `:776`, both fired before either is awaited). Fold gates the critical path
(~54s) and Apollo (~49s) is tuned to hide *under* it (`deepseek.ts:32`).

**Where 312s comes from:** the budget memories (`[[engine-latency-optimization]]`, goal
E2E 312s→<90s) predate the flash flips. The dominant stage today is whichever of {tiktok
resolve+rehost, Fold, Apollo} is slowest — for a tiktok_url run, **resolve+rehost + Omni +
Fold serialize** (resolve must finish before Omni, Omni before Fold) so a tiktok_url path is
structurally ~2× a video_upload path. Retries (Apollo 3× / Omni 2× / Fold 2×) multiply the
tail on a flaky provider; the circuit breaker + bounded timeouts cap it.

**Where DashScope calls could parallelize further:** they already do post-Wave-0. The
remaining serialization is **Omni → {Apollo, Fold}** (genuine data dependency — both need the
read). The only structural win left is splitting Fold by persona group across 2 calls (noted
deferred in `fold.ts:74`) or running Omni cheaper. Apollo is already hidden under Fold.

---

## Lean lens / cut-candidates

**Dead engine signals (emit null / removed from blend, dormant):**
- `ml_score`, `rule_score`, `trend_score` — F43 prune, now emit `null` (were fake constants 0/50; `aggregator.ts:1170-1174`). DB columns kept for back-compat only.
- `audio_fingerprint` — always null, stage stripped (`aggregator.ts:1183`, `:796`). pgvector trending-sound match dormant.
- `platform_fit` — removed from blend, module dormanted, null passthrough (`aggregator.ts:1253`).
- `audio_perceptual_score` — computed but **removed from the weighted sum** (Plan 04); surfaced only as a craft pillar. Cut candidate.
- `gemini_score` — null on video (the Read no longer scores); provenance/legacy only.
- `wave0Result.*.confidence:1.0` — **fabricated** dead placeholder, no consumer (`omni-analysis.ts:316,320` F12). Cut.
- `applyCtaPenalty` (`aggregator.ts:138`) + `CTA_PENALTY_POINTS` — dead since gemini left the blend; no caller.
- `assembleFeatureVector` (`:367`) builds a large `FeatureVector` with `ruleScore/trendScore` fallbacks and **null component fields on video** (F24) — persisted for a learning loop that doesn't run yet. Bloat.
- `pass2Outcome` — always null (10-pass deleted); field kept only for type back-compat.

**Disabled-RAG dormant pgvector pipeline:** `engine/retrieval/*`, `engine/corpus/embedder.ts`,
`retrieval-empty.ts`. Entire retrieval lane is a no-op weight-0 stub. Largest single dormant
subsystem. Either commit to M2 embedding or delete the dormant tree.

**Dead percentile UI:** `behavioral_predictions` carries `*_percentile:"N/A"` fields
(`aggregator.ts:1025-1031` FALLBACK) that have no real percentile source — the percentile
columns are placeholders.

**Other cut candidates:**
- `predicted_engagement` (`computeEngagementRange`) — a deterministic follower×score formula presented as a range; not validated against outcomes. R&D-grade, surfaces a number.
- Stage-10 critique (`stage10-critique.ts`) — an extra (sub-ms) self-critique that only nudges confidence down ≤0.20; low value, consider folding into the band logic.
- `optimal_post_window` — a niche-table DB lookup with a hardcoded fallback; cosmetic.

## Open questions

1. **FOLD_MODEL default** — omni-flash (code) vs omni-plus PAID (memory `[[engine-model-assignment]]`). Is the 2026-06-11 flash A/B trustworthy (only 2 short clips, no retention ground truth) or should the default flip back? This is the single highest-stakes engine config question.
2. **Why 0.5/0.5 apollo·fold** with no calibration? The split is asserted, not fit. If fold runs on omni-flash with contested diversity, is it earning its 50%?
3. **tiktok_url serialization** — resolve+rehost (25-38s) → Omni → Fold serialize. Could the resolved mp4 be streamed to Omni without a full re-host round-trip (the SSRF/token-leak constraint is real, but is a proxy-stream cheaper than download+upload+sign)?
4. **Retrieval** — commit to M2 pgvector or delete the dormant tree? It's the biggest dead weight and the claimed moat ("grounded model"), yet 100% off.
5. **Filmstrip coupling** — fire-and-forget POST to a self-route with a shared secret; if it fails the board filmstrip silently degrades. Is the keyframe extraction worth a network round-trip vs deriving in-pipeline?
6. **Two Omni reads on remix** — remix decode runs its own `analyzeVideoWithOmni` (`route.ts:350`) separate from the score path; a user who scores then remixes pays for two reads of the same video. Cacheable?
7. **`behavioral_score` vs `apollo_score`** — both derive from the *same* Apollo call (component avg vs composite). On the text/no-fold path the blend mixes two views of one call — is that a real ensemble or double-counting?
