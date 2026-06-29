# Numen Backend — SCORE Path / Video Pipeline Audit ("the Read")

> **Scope:** the `/api/analyze` prediction engine end-to-end — Wave-0 omni sensor → Apollo scoring → the fold (audience video-sim) → aggregator + anti-virality → the Read UI. The SCORE half of the two-brain engine (companion to `docs/subsystems/skills-grounding.md`, the GENERATE half).
> **Branch:** `main` · **Date:** 2026-06-27 · **Method:** code-verified (5 parallel deep-trace agents + direct reads). Every claim cites `file:line`.
> **Related SSOTs:** `docs/MODEL-POLICY.md`, `docs/ENGINE-ATLAS.md`, `docs/subsystems/skills-grounding.md`, `.planning/NUMEN-GSI-VISION.md`.
> **⚠️ Audit snapshot, not a contract.** Code wins on disagreement; re-verify before acting.

---

## 0. TL;DR — the corrected mental model

The Read is **a flat 50/50 ensemble on video**: `overall_score = 0.5·apollo_score + 0.5·fold_audience_score` (`aggregator.ts:889`). Two independent signals — Apollo (craft judgment) and the fold (audience reaction) — each own half the headline number.

Three corrections to commonly-assumed wiring (all verified):
1. **There is NO follower-count multiplier in `overall_score`.** It's a pure 0–100 quality read. The "follower_count × quality read" formula is `computeEngagementRange` → the `predicted_engagement` *reach-band side output* (live-only, never persisted, never fed back). `getFollowerTier` is not in the score path.
2. **Apollo is audience-agnostic.** The calibrated-audience moat reaches **only the fold** (via repaint), never Apollo. On a video the audience moves the score through the fold's 50%, not through Apollo's craft verdict.
3. **The SCORE route creates no "reading thread."** It inserts only an `analysis_results` row. No `threads.type:"grounded"` insert exists anywhere in `src`; the thread is the *follow-up* substrate (ReadingChat), created lazily, and the SCORE path only *reads* the open thread to resolve `active_audience_id` for the fold.

Grounding inputs to the Read (where quality comes from):
- **Apollo** = `KNOWLEDGE_CORE` rubric (craft IP) + the omni **sensor dump** (raw perceptual measurements) + **creator/account context** (incl. coarse demographics). Audience-agnostic.
- **The fold** = the same omni-sensed substrate + the **calibrated-audience repaint** (the moat).

---

## 1. Pipeline wave structure — `src/lib/engine/pipeline.ts`

`runPredictionPipeline` (`:332`). The "10-stage" docstring is stale; real shape:

| # | Stage | file:line | par/serial | Gate? |
|---|---|---|---|---|
| — | validate + normalize input | `:348`, `:364` | serial | **GATES** (throws) |
| — | `fetchCreatorContext` (DB read) | `:390` | serial | non-fatal → `DEFAULT_CREATOR_CONTEXT` |
| — | sign video URL (video_upload) / resolve+rehost mp4 (tiktok_url) | `:415`, `:452` | serial | upload gates; url non-fatal → degrades to text |
| **0** | **Omni sensor** `analyzeVideoWithOmni(signedVideoUrl)` | `:564` | serial await | non-fatal → `DEFAULT_GEMINI_RESULT`. Runs only when `signedVideoUrl` present. Fires filmstrip (fire-and-forget) |
| 1 | **Wave 1** `Promise.all([geminiPromise, creatorPromise])` | `:679` | **parallel** | non-fatal. gemini = precomputed-from-Omni (video) OR text analysis (no-video) |
| — | `retrievalResult = createEmptyRetrievalResult()` | `:689` | serial | **EMPTY STUB** (dead, §7) |
| 2 | **Apollo** `reasonWithDeepSeek` promise created | `:706` | **not awaited until after fold** | non-fatal → null (circuit breaker) |
| 3 | **Fold** `runFold(slots, segments, …, repaint)` | `:777` | awaited (overlaps in-flight Apollo) | non-fatal → null. Only when omni segments present (video) |
| — | await Apollo promise + `dropRehostTemp()` finally | `:848` | serial | rehost cleanup on every path |
| 9 | **Aggregate** — delegated to the route (`aggregateScores`) | — | — | — |

**Concurrency:** Apollo (Wave 2) is kicked off at `:763`, awaited at `:850` — *after* `runFold` (`:805`). So **Apollo (~49s) and the fold (~54s) run concurrently**, Apollo hidden under the fold. Both gate on the same `signedVideoUrl`.

---

## 2. Route I/O — `src/app/api/analyze/route.ts`

`POST /api/analyze` (`:402`), `runtime=nodejs`, `maxDuration=300`. Auth (`:408`, **no CSRF** — same-origin Supabase cookie); 287 MB content-length cap (`:420`); input validation (`content_text` 10–10k + anti-spam, TikTok URL pattern, `video_storage_path`); **rate limit** `DAILY_LIMITS` free/starter=50, pro=∞ via `usage_tracking` (`:503`); cache lookup `computeContentHash` → `lookupPredictionCache` *before* the pipeline (`:617`); active audience resolved from the open thread's `active_audience_id` (`:770`).

**Three response branches:**
1. **JSON** (`Accept: application/json`) — inline pipeline → `aggregateScores` → insert.
2. **Remix decode** (`mode:"remix"`) — early-return SSE; `resolveAndRehost → analyzeVideoWithOmni → runDecode`; `overall_score:null`. **Not the score path.**
3. **SSE default** — the SCORE spine: placeholder insert (`overall_score:null`, `engine_version:"pending"`) → `started{id}` → `phase:analyzing` → `runPredictionPipeline` (stage events forwarded) → `phase:scoring` → `aggregateScores` → UPSERT by id → cache/craft/apollo variants → `usage_tracking` increment (after success) → `complete{finalResult}`.

`GET /api/analyze/[id]/stream` = the **reconnect/permalink replay** stream (not the live first-run channel): cookie auth + IDOR guard (`.eq(user_id)`, `.is(deleted_at,null)`); terminal → single `complete`; in-flight → 2s short-poll (45 attempts/90s) + 15s heartbeat; live delta = `filmstrip_segment_ready`.

**Input modes:**

| | signedVideoUrl | Omni Wave 0 | gemini source | Apollo sighted | Fold | overall_score |
|---|---|---|---|---|---|---|
| **video_upload** | signed (gates) | runs | precomputed from Omni | yes | runs | `0.5·apollo + 0.5·fold` |
| **tiktok_url** | rehost+sign (non-fatal) | iff rehost OK | Omni or text fallback | iff rehost OK | iff segments | fold-blend or text-blend |
| **text** | null | skipped | **text analysis** (`qwen3.7-plus`) | no | skipped | `behavioral·w + apollo·w` (Apollo-only) |

---

## 3. Wave-0 omni sensor — `src/lib/engine/qwen/omni-analysis.ts`

The single multimodal call that "watches" the video and distills it to structured text. **Post D-R1 it is a PURE PERCEPTION SENSOR — it senses, it does not judge.** Apollo is the sole judge; the fold reasons over the same substrate.

- **Call** (`:259`): model `qwen3.5-omni-flash` (`QWEN_OMNI_MODEL`, the only audio-capable model); thinking NOT set (flash default off); `max_tokens 8000`; `temperature:0`, `seed:7`; input `[{video_url:signed}, {text:hints}]`; 60s timeout; 2 attempts.
- **System prompt** (`buildSystemPrompt`, `:127`): "operate as a pure PERCEPTION sensor… all scores are 0–10 PERCEPTUAL measurements (how loud/clear/fast), NOT quality verdicts." Niche/content-type hints moved to the volatile user message (cache stability). `cognitive_load` is **inverted** (higher = worse).
- **Output `OmniAnalysisZodSchema`** (`schemas.ts:176`) — the grounding substrate Apollo + fold consume: `content_type` (8-slug taxonomy), `niche` (primary+micro), `hook_decomposition` (4 modality scores: visual_stop_power, audio_hook_quality, text_overlay_score, first_words_speech_score + weakest + coherence + cognitive_load), `video_signals` (production/pacing/transition), `cta_segment`, `audio_signals` (ratios + clarity + description), `emotion_arc`, `hook_verbatim` (spoken + on-screen, the rewrite-grounding anchor), `segments`.
- **Salvage:** `coerceOmniRead` (fills null'd required prose pre-Zod), `detectCriticalFieldDrift` (1 bounded retry for empty emotion_arc / missing speech verbatim). Total fail → null → pipeline degrades to text.
- **`normalize-segments.ts`** (live): post-parse segment grid — hook-zone boundary split at 3s, sub-1s merges (verbatim-preserving), fixed-bucket fallback, `is_hook_zone`/`idx` annotation. Always non-empty.
- **`audio-perceptual.ts`** (live): the **aggregator** recomputes `audio_perceptual_score` deterministically from sensed `audio_signals` (content-type-adaptive: voice/ambient/balanced) — the **model-emitted `audio_perceptual_score` is dead** (never read). Audio's blend contribution is gated down (R9).
- **`content-type-weights.ts`** (live): `CONTENT_TYPE_WEIGHT_MATRIX` multiplies the 4 video signals per content type (clamped [0.5,1.5]); applied in `aggregator.ts:610`.

**No-video text path** (`pipeline.ts:606`): model `qwen3.7-plus`, thinking off, `max_tokens 2000`. **Asymmetry ⚠️:** the text path still self-emits **judgment factors** (`factors[5]` + `overall_impression` + `content_summary`) — it is **NOT a pure sensor** and bypasses D-R1. No content_type/niche/audio/segments/emotion_arc in text mode.

---

## 4. Apollo scoring — `src/lib/engine/deepseek.ts` ("deepseek" = legacy name; runs Qwen)

The video reasoning moat. `reasonWithDeepSeek` → `chat.completions.create` (`:537`).

- **Call:** model `qwen3.7-plus` (`QWEN_APOLLO_MODEL`, scoped); system = `APOLLO_SYSTEM_PROMPT` (byte-stable `KNOWLEDGE_CORE` + `APOLLO_INSTRUCTION`); `temperature:0`, `seed:7`; **`enable_thinking:true`, `thinking_budget:1500`** (A/B-tuned); `max_tokens:3000`; 120s timeout; 2 retries (3 attempts).
- **Sighted vs deaf** (`:531`): when `videoUrl != null` (video_upload only), prepends `{video_url}` so qwen3.7-plus **watches** the hook — but it is **deaf** (audio reaches it as text via `audio_signals`).
- **INPUT — what Apollo sees** (`buildDeepSeekUserMessage`, `:353`): (1) verbatim hook (spoken + on-screen), (2) verbatim segments, (3) content_type + content_text, (4) the omni **sensor dump** (`formatGeminiSignals`, labeled "objective signals — YOU interpret them; measurements NOT grades": hook modalities, production signals, audio reading, emotion curve), (5) **creator context** (`formatCreatorContext`: follower_count, avg_views, engagement_rate, niche, platform averages, and the 9-card profile fields incl. **`target_audience` demographics**). The D-R1 intent: Apollo gets raw *perceptual* measurements, not quality grades, so the sensor doesn't anchor its verdict.
- **OUTPUT `DeepSeekResponseSchema`** (`types.ts:863`): 6 `dimensions` (hook/retention/clarity/share_pull/substance/credibility, each band + 0–100 score), 7 `component_scores`, `suggestions` (≥1), 2–3 `rewrites` (verbatim original + variant + a *different* lever each), `ceiling_capper` (prose), `confidence_scope`. `behavioral_predictions` only in text mode (fold owns it on video).
- **Composite recompute (deterministic TS, `:226`):** `composite = clamp(0,100, round(Σ dim.score·(name==="hook" ? 0.80 : 0.04)))`. Band anchors fixed: **Strong→85 / Mid→50 / Weak→20**. So a Weak hook (20) with all-Strong body (85) → `0.80·20 + 0.20·85 = 33` — the 80% hook weight IS the "weak hook caps the ceiling" mechanism (no separate ceiling math). **Apollo owns the 80/20 composite; the aggregator owns the final 50/50 overall_score.**
- **Guards:** §-cite resolution (strips §-tokens not in `PRESENT_SECTIONS`; all §-tokens stripped from user-facing prose); R2 verbatim backstop (overwrites a paraphrased rewrite `original` with the literal feed hook); `stripModelOutput` + first-balanced-JSON extraction; circuit breaker (3 failures → open, backoff [1s,3s,9s], half-open probe mutex); fail → null (pipeline treats as non-critical, degrades to fold/fallback).
- **Audience-agnostic ✅ confirmed:** `buildAudienceRepaint` is threaded only into `runFold`, never into Apollo. Apollo's input has no audience field. Creator/account demographics reach it; the calibrated audience reaction frames do not.

---

## 5. The fold — `src/lib/engine/wave3/fold.ts` (audience video-sim)

ONE LLM call emits behavioral intents + per-segment attention for all 10 archetypes (replacing the deleted 10×Pass-1 + 10×Pass-2 loops). Runs **only in video mode** when omni segments exist.

- **Call** (`:352`): model `qwen3.7-plus` (`FOLD_MODEL`), **thinking OFF** (the independence directive is the divergence lever), `max_tokens 8000`, `seed:7`, base `temperature:0` → perturbs to **0.7 on a diversity-collapse retry**; sighted/deaf (watches video, audio as text); `PER_CALL_TIMEOUT_MS 90s` hard ceiling, 2 attempts (45s each).
- **The 10 personas** (`persona-registry.ts`): fixed `ARCHETYPES` (high_engager, saver, lurker, sharer, tough_crowd, purposeful_viewer, niche_deep_buyer, niche_deep_scout, loyalist, cross_niche_curiosity), mapped to 4 slots (fyp/niche_deep/loyalist/cross_niche); `selectPersonaSlots(contentType, niche)` fills 10 slots via `ALLOCATION_TABLE`.
- **System prompt** `STABLE_FOLD_SYSTEM_PROMPT` (byte-stable): all 10 archetype defs + the **Critical Divergence Requirement** (near-identical curves = FAILURE; tough_crowd drops earliest, loyalist latest) + the **independence directive** (simulate each on its own profile, don't average/copy).
- **Calibrated-audience repaint (R1′b):** `buildAudienceRepaint(audience)` → per-archetype `reaction_frame` appended to each slot line in the USER block + a guidance line making it "the authoritative lens." General/null → undefined → byte-identical baseline (system prefix untouched, ENGINE_VERSION stable). **This is where the moat moves the Read.**
- **Output `FoldResponseSchema`**: exactly 10 personas, each `{watch_through_pct, share/comment/save/rewatch_intent (0–100), scroll_past_second, segment_reactions[{attention 0–1, swipe_predicted}]}`. Adapters → `PersonaSimulationResult[]` (Pass-1) + `Pass2PersonaResult[]` (Pass-2).
- **Scored-in (not display-only):** the fold feeds FOUR aggregator consumers — `fold_audience_score` (**50% of overall_score on video**), `behavioral_predictions`, heatmap + weighted retention, and confidence (Apollo-vs-fold agreement).
- **Reliability:** per-persona salvage (keep personas with matching segment count, succeed if ≥6/10); diversity floor 0.10 → temp-perturb retry; homogenized fallback ("a homogenized fold beats no fold"); hard fail → Apollo-only score.
- **⚠️ Slot↔archetype incoherence:** on non-talking_head content (b_roll/action/vlog), `selectPersonaSlots` can duplicate/omit archetypes while the prompt demands "exactly 10 distinct archetypes" → per-archetype weight bucketing can be miscategorized (loyalist absent on b_roll defaults to fyp/general).

---

## 6. Scoring math — `src/lib/engine/aggregator.ts`

`aggregateScores(pipelineResult, onStageEvent?, options?)` (`:520`) owns the final number end-to-end (the pipeline returns raw stage outputs; the route calls this).

**The composite (`:882`):**
```
apolloOn = deepseek != null
foldOn   = foldOutcome.fold_success && personaBehavioralAggregate != null
overall_score = clamp(0,100, round(
    apolloOn && foldOn  →  0.5·apollo_score + 0.5·fold_audience_score   // video — flat 50/50
    apolloOn (no fold)  →  behavioral_score·w + apollo_score·w          // text/tiktok fallback (~0.53/0.47)
    foldOn (no apollo)  →  fold_audience_score
    neither             →  0
))   // Platt calibration DROPPED 2026-05-24
```
- `apollo_score = deepseek.composite_score` (the 80/20 hook composite from §4).
- `fold_audience_score = round(0.50·completion + 0.25·share + 0.15·save + 0.10·comment)` (`:864`).
- `behavioral_score` = mean of Apollo's 7 component_scores ×10 — **only the text-mode fallback term** (not the fold).
- **Stage-10 critique** (`stage10-critique.ts`): deterministic, adjusts **confidence only** (clamped [-0.20,0]); does NOT touch overall_score. Stage 11 counterfactuals removed.

**Anti-virality gate** (`anti-virality.ts`): a **confidence + retention-dropoff dual gate** that flips a "don't post yet" UI verdict — it does **NOT** detect paid inflation and does **NOT** cap `overall_score`. `gated = confidence < 0.4 OR (≥40% attention lost in first 5s across ≥70% of personas)`. Sets `anti_virality_gated/_reason` + hero `verdict_line`/`go_no_go`. (Boosted/paid detection is only a *prompt instruction* to Apollo for decode videos, `apollo-core.ts:217` — not a runtime gate.)

**Flop warning** (`flop-warning.ts`): pushes a `LIKELY_FLOP` string to `warnings[]` when `overall_score < 30 && confidence > 0.70`. Non-mutating to the score.

**`predicted_engagement`** (`computeEngagementRange`, `:185`): the reach band — `mid = follower_count · (quality_ratio²·0.20 + 0.005)`, ±uncertainty. Null when follower_count ≤ 0. **Live-only, never persisted** → null on reload. THIS is the "follower × quality" formula — downstream of overall_score, never feeding back.

**`optimal_post.ts`**: DB lookup of best post window per niche → side output, never scored-in.

---

## 7. The score-side grounding map (for quality work)

Improving "the Read's" quality splits into three distinct levers, by where grounding enters:

| Grounding input | Lives in | Drives | To improve |
|---|---|---|---|
| **Craft rubric** | `apollo-core.ts` `KNOWLEDGE_CORE` (§2 frameworks, §2.0a anchors) | Apollo's 6-dimension verdict (the craft 50%) | sharpen the §2 detect-triples / band anchors (in-place; regen path broken — see skills-grounding §8) |
| **The sensor dump** | omni `OmniAnalysisZodSchema` → `formatGeminiSignals` | what Apollo can *see* (its evidence) | richer/more-accurate sensed signals = better-grounded verdict; close the text-path "self-judge" asymmetry |
| **Audience repaint** | `AudienceSignature.reaction_frame` → fold | the audience 50% | the moat — stronger calibrated reaction frames; same `build-reaction-panel.ts` the text SIM uses |
| **Creator/account context** | `formatCreatorContext` | Apollo's framing (demographics, follower stats) | only coarse today (same thinness as the GENERATE live tier — see skills-grounding §5) |

Note: unlike the GENERATE skills, the SCORE path's Apollo judgment is **audience-agnostic** — the audience only moves the score through the fold's 50%. If you want the creator's calibrated audience to influence the *craft verdict* too, that's a wiring change (thread the repaint into Apollo), not a tuning one.

---

## 8. GSI wrap (lives on `milestone/numen-gsi`, not `main`)

`packs/socials.ts` wraps the whole engine **by reference**, no refactor:
```ts
scoring: { systemPrompt: APOLLO_SYSTEM_PROMPT, run: aggregateScores }   // reference assignment
run: runPredictionPipeline                                              // reference assignment
```
`resolvePack(mode)` dispatches (`switch`, zero scoring logic). `DomainPackScoring.run` is typed to mirror `aggregateScores`'s arity verbatim so `run: aggregateScores` is a drop-in. ENGINE_VERSION stays 3.20.0; the virality fold / anti-virality / composite math is **wrapped whole, opaque, NOT parameterized** — refactoring `aggregator.ts` is explicitly out-of-scope. The GSI seam is the *new* `scoring` field a future pack supplies, not a refactor of the socials one.

---

## 9. Dead / dormant (don't chase ghosts)

- **Retrieval** — not even in the blend: `SCORE_WEIGHT_KEYS = ["behavioral","apollo"]` (`aggregator.ts:87`); the "0.05 weight" comment is **stale**. `createEmptyRetrievalResult()` contributes zero. `runBenchmarkRetrieval` has no live caller.
- **Stage 11 counterfactuals** — removed; always null.
- **ml / rules / trends / audio_fingerprint / platform_fit** — removed from blend; emit null; retained as provenance flags.
- **Platt calibration** — dropped 2026-05-24.
- **`applyCtaPenalty`** (`aggregator.ts:138`) — defined, never called.
- **Model-emitted `audio_perceptual_score`** — dead (aggregator recomputes from `audio_signals`).
- **`persona-prompts.ts` + `persona-prompts-pass2.ts`** — fully dead (zero importers; the deleted Pass-1/Pass-2 loops' prompt modules).
- **`pass2.ts`** — vestigial (`applyPass1DropFallback` uncalled; `Wave3Pass2Outcome` only for the always-null `pass2Outcome`).
- **`weighted-aggregator-client.ts`** — orphaned (no non-test importer).
- **`wave0/prompts.ts`** — gutted (only `tryUrlHost` survives).
- **`gemini_score`** — always null on video (Read = pure sensor).
- **`predicted_engagement`** — never persisted (null on reload).
- **GET-stream `partial` personas event** — no writer; dead (`filmstrip_segment_ready` is the live delta).
- **Stale "omni-plus" / "qwen3.6" comments** — `omni-analysis.ts:1`, `pipeline.ts:556`, `schemas.ts:173`, `fold.ts:5,274`, `aggregator.ts:854` — live models are omni-flash + 3.7-plus.

---

## 10. Open findings / corrections (running list)

1. **No reading thread on the SCORE path** — only `analysis_results`; no `threads.type:"grounded"` insert in `src`. (Corrects the assumption that `/api/analyze` writes a reading thread.)
2. **overall_score has no follower multiplier** — pure 0–100 quality read; follower math is the `predicted_engagement` side output only. (Corrects the GSI brief's attribution.)
3. **Apollo is audience-agnostic** — the moat reaches only the fold. Consider threading the repaint into Apollo if the audience should move the craft verdict (wiring change).
4. **Text-path self-judges** — the no-video path emits `factors`/`overall_impression`/`content_summary` (not a pure sensor; bypasses D-R1). Grounding-quality asymmetry vs the video path.
5. **Fold slot↔archetype incoherence** on non-talking_head content — per-archetype weight bucketing can be miscategorized (b_roll/action/vlog).
6. **Creator-context grounding is coarse** — same thinness as the GENERATE live tier (demographics-only). Shared improvement surface with skills-grounding §5/§7.
7. **`predicted_engagement` not persisted** — disappears on reload; if it's product-visible, needs a column.
8. **Large dead-code surface** (§9) — retrieval/ml/rules/trends/audio-fingerprint/platform_fit/counterfactuals/CTA-penalty/Pass-1-2 prompt modules. Hygiene-deletable; quality-neutral.
9. **Stale model-name comments** across the engine — omni-plus/qwen3.6 references; live = omni-flash + 3.7-plus.
</content>
