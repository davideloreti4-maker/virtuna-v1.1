# Virtuna Prediction Engine — Audit & Optimization Report

*Scope: full pipeline E2E, all layers, model I/O (Qwen), scoring math, and what surfaces to users.*
*Engine v3.0.0 · branch `feat/actions-frame-inline-redesign` · 2026-05-31.*

---

## 0. TL;DR — The one finding that matters

**The engine has no ground-truth loop. Nothing in the pipeline is validated against real TikTok outcomes.** Every "prediction" is an LLM judgment, a hardcoded heuristic, or a fabricated number. The components meant to anchor predictions to reality are all disabled:

- ML model: **31% accuracy**, weight `0`, disabled.
- Platt calibration: **dropped 2026-05-24**, never replaced. Raw weighted sum is the user-facing score.
- Anti-virality threshold: **fallback value (N<50 outcomes)**, never calibrated.
- `calibration-baseline.json`: empirically derived from 7,321 videos but **never read in scoring**.

The 0–100 score is an *internally consistent* blend of two correlated LLM calls — but its mapping to "will this go viral" is **unmeasured**. You can improve consistency without data; you cannot improve *accuracy* without closing the loop. That is the central recommendation.

Close second: **the engine fabricates concrete engagement counts and presents them as "Predicted Performance"** (Finding 2).

---

## 1. End-to-End Pipeline

```
POST /api/analyze
  → auth → size check (287MB) → Zod validate → rate limit (free/starter 50/day, pro ∞)
  → content hash → cache lookup (L1 in-mem 24h + L2 Supabase 24h, key = hash::v3.0.0::userId)
  → placeholder row insert → open SSE stream
  ↓
runPredictionPipeline:
  Stage 1 Validate ─ Stage 2 Normalize ─ pre_creator_context (DB read)
  ↓
  Wave 0 (video only): qwen3.5-omni-plus  ← single multimodal call
      ├─ fire-and-forget filmstrip extraction (ffmpeg, never counted vs SLA)
  ↓
  Wave 1 ‖ : gemini_analysis (precomputed from Omni, or Qwen text) · audio_fingerprint (null, deferred M2)
            · creator_context (passthrough) · rule_scoring (weight 0)
  ↓
  Wave 2 ‖ : deepseek_reasoning (qwen3.6-plus) · trend_enrichment
  ↓
  Wave 3 (seq): 10 persona sims, Pass 1 (qwen3.6-flash)
  ↓
  Wave 3 Pass 2 (seq, video only): 10 persona sims, segment attention (qwen3.6-plus + thinking)
  ↓
  Wave 4 (seq): platform_fit (qwen fast)
  ↓
aggregateScores → Stage 10 critique (qwen3.6-plus) → Stage 11 counterfactuals (qwen3.6-plus)
  → DB upsert + cache populate → SSE "complete"
```

**~24 LLM calls per analysis** (1 Omni + 1 reasoning + 10 Pass1 + 10 Pass2 + platform-fit + critique + counterfactuals). **Cost ≈ $1–2/video**, dominated by Wave 3.

**Models (all Qwen via Alibaba DashScope International, OpenAI-compatible endpoint):**

| Role | Model | Where | Notes |
|---|---|---|---|
| Multimodal video | `qwen3.5-omni-plus` | Wave 0 | preview = $0 cost in pricing table |
| Reasoning | `qwen3.6-plus` | DeepSeek, Pass2, Stage10/11 | $0.40/$2.40 per 1M |
| Fast persona | `qwen3.6-flash` | Wave 3 Pass 1 | $0.25/$1.50 per 1M |

`deepseek.ts` / `gemini.ts` filenames are legacy — pipeline is Qwen-only.

---

## 2. Model I/O Deep-Dive (Qwen)

### Wave 0 — `qwen3.5-omni-plus`
- **Input:** video via signed Supabase URL (`{type:"video_url"}`) + system prompt. 60s timeout, 1 retry, `response_format: json_object`. **No temperature, no seed.**
- **Output (one JSON):** content_type, niche slugs, 5 factors (Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge, 0–10), hook decomposition (7 sub-scores incl. **inverted-polarity `cognitive_load`**), video_signals, cta_segment, audio_signals (ratio-sum validated), `audio_perceptual_score`, emotion_arc (3–8 pts), segment grid (normalized: enforces 0–3s hook zone, merges sub-1s, fixed-bucket fallback if <4 boundaries).

### Wave 2 — `qwen3.6-plus` reasoning (the "behavioral" 40%)
- **Input:** TEXT ONLY. Caption + **Gemini rationales with numeric scores stripped** (anti-anchoring) + matched rule *names* + trend context + creator context + calibration percentile benchmarks. Stable system prompt (cache-prefix) + volatile user message. 90s timeout, 2 retries, circuit breaker (3-fail → open, backoff 1/3/9s, half-open mutex).
- **Output:** behavioral_predictions (completion/share/comment/save % + percentile strings), 7 component_scores (0–10), suggestions, warnings, confidence enum.

### Wave 3 — 10 personas × 2 passes
- **Pass 1** (`qwen3.6-flash`, 10 parallel): each persona = hardcoded archetype role-play. Input = caption + Wave2 hook/retention context (+ creator past_wins for loyalist). Output = scroll_past_second, watch_through_pct, 4 intents, reasoning.
- **Pass 2** (`qwen3.6-plus` + thinking budget 8000, 10 parallel, 90s): adds keyframe images + segment grid → per-segment attention curve [0,1] + swipe prediction. Has a Pass1→Pass2 drop fallback that *injects* a swipe point when the model returns an unrealistic full-watch curve.

**All scoring-critical calls run default temperature, no seed, single sample** → same video yields different scores on re-run; only the 24h cache hides it.

---

## 3. How the score is computed

```
raw = behavioral·0.40 + gemini·0.35 + trends·0.10 + audio·0.05 + platform_fit·0.05
      (+ ml·0 + rules·0 + retrieval·0)        ← clamped [0,100], rounded
overall_score = raw                            ← NO calibration (aggregator.ts:953-956)
```

- `behavioral` = mean of 7 reasoning component_scores ×10. `gemini` = mean of 5 Omni factors ×10 (minus CTA penalty 3–5 pts for tutorial/b_roll w/o CTA).
- Missing signals → `selectWeights()` redistributes weight proportionally (clean impl).
- **Reality:** `audio_fingerprint` returns null (deferred M2), `trending_sounds` = **0 rows**, so `trends` + fingerprint half of `audio` contribute ~nothing. **Live score ≈ 75% two LLM calls (behavioral + gemini) that share inputs.**

**Confidence** = signal-availability points + model-agreement (0.4 if gemini & behavioral same side of 50). Magic `15`-pt tolerance. User-facing band = `±(1−conf)·22` — cosmetic, **not a calibrated interval**.

---

## 4. Data-driven vs fabricated

| Component | Status | Backing |
|---|---|---|
| Omni factors / hook / segments | LLM judgment | model only, no validation |
| Behavioral component scores | LLM judgment | model only |
| 10 personas + archetypes | **Synthetic** | hardcoded narratives; 5/10 niches = `[PLACEHOLDER]` |
| Persona weights 0.65/0.20/0.10/0.05 | **Undocumented** | "R2.3 default mix", no derivation |
| Percentile labels ("Top 5%") | **Heuristic** | intent deciles → DeepSeek string conversion, not real distribution |
| Predicted engagement (views/likes) | **Fabricated** | `Math.sin()` jitter seeded by score |
| Audio perceptual | Data-driven | locked content-type coefficient formula |
| Optimal post time | Data-driven | `niche_post_windows` materialized aggregate |
| Creator context | Data-driven | `creator_profiles` + `scraped_videos` |
| Trends | Heuristic | hashtag freq + (empty) trending_sounds |
| ML / calibration / rules / retrieval | **Disabled** | weight 0 |

---

## 5. Critical Findings (ranked)

**F1 — No outcome feedback loop (CRITICAL, accuracy-defining).** No table joins predictions to real post-performance. The `outcomes` table anti-virality reads is empty (N<50). Every threshold, weight, and the 0–100 scale is guessed; no signal tells you if accuracy is 90% or 10%. Everything below is downstream.

**F2 — Fabricated "Predicted Performance" (CRITICAL, trust).** `tiktok-result-card.tsx:195–214` renders concrete view/like/comment/share counts under "Predicted Performance". Source = `derivePredictedEngagement()`/`computePredictedEngagement()` — `Math.sin(seed·12.9898 + score·78.233)·43758.5453` deterministic jitter off the score (`predicted-engagement.ts:16-40`, `aggregator.ts:1092`). User sees "127K views predicted"; it's a sine wave.

**F3 — Calibration dropped, raw score has no anchored meaning (HIGH).** `aggregator.ts:953-956`. You own `calibration-baseline.json` (7,321 real videos, tiered share/save/comment rates) but never read it.

**F4 — Behavioral (40%) synthetic + score self-correlated (HIGH).** Largest weight feeds 10 hardcoded personas (50% placeholder); Wave-2 reasoning ingests Gemini rationales → "agreement" confidence partly circular.

**F5 — Non-determinism (MEDIUM-HIGH).** No temperature/seed/self-consistency on scoring calls. Re-run = different score.

**F6 — Percentile labels aren't percentiles (MEDIUM-HIGH).** "Top X% of niche" = intent decile buckets, not corpus distribution. ARIA announces `overall_score` as "{score}th percentile" (`verdict-constants.ts:28`) — it's an absolute score.

**F7 — Half the architecture is dead scaffolding (MEDIUM).** rules=0, ml=0, retrieval=0, audio_fingerprint=null, trending_sounds=0. ~1,500+ lines carried but inert.

**F8 — Wave 3 cost vs value (MEDIUM).** 20 of ~24 calls go to synthetic personas; Pass 2 = reasoning model + 8000 thinking tokens × 10, 90s each. Highest cost, lowest grounding.

**Strengths:** graceful degradation (never fatal); clean weight redistribution; cache-stable prompt prefixes; prompt-injection delimiters; circuit breaker; SSE per-stage + filmstrip streaming; version-keyed cache (no cross-user contamination).

---

## 6. Optimization Roadmap

### P0 — Close the loop (accuracy-defining)
1. **Build the outcomes dataset.** Capture real views/likes/shares/saves at 24h/7d, join to prediction by `analysisId`. Highest leverage.
2. **Re-introduce calibration** from `calibration-baseline.json` now (percentile/isotonic), refit on live outcomes. Make 0–100 mean "beats X% of niche."
3. **Eval harness + golden set.** Track Spearman/AUC of score-vs-outcome on every `ENGINE_VERSION` bump.

### P1 — Honesty (low effort, high trust)
4. **Remove/relabel fabricated engagement.** Stop calling `Math.sin()` "Predicted Performance."
5. **Ground or rename percentile labels.** Fix ARIA "percentile" string.

### P2 — Model quality
6. **Determinism + self-consistency.** temperature=0 + seed; 3-sample median for behavioral; report spread as uncertainty.
7. **De-correlate signals.** One scoring input independent of Omni vision, or model the correlation.
8. **Ground or shrink Wave 3.** Finish 5 placeholder niches; validate persona weights vs real audience splits; lower behavioral weight until validated.
9. **Decide ML's fate.** Retrain on inference-time-available features (current model trained on engagement rates it can't see at predict time) or delete it.

### P3 — Cost / perf
10. **Batch/gate Wave 3 Pass 2.** Fewer calls, smaller model, or paid-only.
11. **Delete dead scaffolding** (rules/retrieval/corpus/`_dormant`) or document re-enable plan.

### P4 — Data freshness
12. **Populate `trending_sounds` or drop trend/fingerprint dependency.** Weights ride on empty tables.

---

### Bottom line
Engineering is solid — graceful, instrumented, cache-aware. The **science is unvalidated**: a sophisticated machine for confident-looking numbers with no measurement of correctness, and two places present invented numbers as data. What matters now isn't more stages — it's **a feedback loop, calibration against real outcomes, and honest labeling**.
