# ENGINE-MAP — Apollo Teardown

**Branch:** `milestone/engine-opt` · **Started:** 2026-06-03 · **Lens:** is each LLM call a *sensor* (feeds expert insight → keep) or *score-machinery* (only sharpens the number → cut/demote)?

**Thesis (user):** if the knowledge core is built extremely well, ~90% of current engine LLM calls become redundant. Target end-state: **Omni (1, repurposed as observer/transcriber) + Apollo (1–2, knowledge-grounded reasoning/insight)**.

**Decision context:** see memory `apollo-direction`. Expert INSIGHT is the hero; score demoted to directional; outcome/learning loop deferred; engine = senses feeding Apollo (Chase Hughes–grounded knowledge core, cached not RAG to start).

---

## Running cut-list

| Station | Calls | What | Verdict | Note |
|---|---|---|---|---|
| S0 pre-flight | 0 | auth/sub/usage/cache/placeholder/SSE | **KEEP** | plumbing; cache short-circuit is the big existing latency lever |
| S5 Omni | 1 | video → content-type, niche, factors, hook decomp, video/audio signals, emotion arc, segments | **KEEP, narrow job** | irreplaceable sensor; cut the ~15 0–10 *judgments*, **add verbatim** (`hook_verbatim` + per-segment `spoken_text`/`on_screen_text`); becomes observer/transcriber |
| S6 gemini (text mode) | 0–1 | text/url-mode factor analysis | **KEEP (text fallback)** | 0 calls in video mode; text analog of Omni |
| S7 audio_fingerprint | 0 | pgvector match vs sound corpus | **ALREADY CUT** | dead stub: `return null`, deferred to M2 |
| S8 creator_context | 0 | passthrough (reuses S3 DB read) | **KEEP** | creator cards = context for both brains |
| S9 rule_scoring | 0+1 | regex tier (free) + semantic batch (1 fast-Qwen call) | **CUT semantic; regex optional** | regex patterns = primitive Chase-Hughes ancestor; Apollo subsumes |
| S10 deepseek_reasoning | 1 | cached-system-prompt reasoning → scores/suggestions/warnings | **KEEP → becomes Apollo Reasoner** | already the stable-knowledge + volatile-data cache pattern; swap 5-step → Chase Hughes, feed verbatim, add rewrites |
| S11 trend_enrichment | 0 | trends/hashtag DB lookup + fuzzy match | **CUT (dead)** | empty tables → feeds reasoner a null-signal string; crude even if populated; future Brain-2 context, not a stage |
| S12 platform_fit | 1 | platform-fit score + rationale + watermark | **CUT → fold into Apollo** | watermark already from Omni; platform-fit reasoning is one paragraph of Apollo's pass; −1 call |
| S13 personas Pass 1 | 10 | BLIND flash sims (react to caption+numbers, never see video) | **FOLD → Audience-Sim** | role-disappears: only existed to feed Pass 2 a drop-fallback |
| S14 personas Pass 2 | 10 | keyframe-grounded thinking sims → retention heatmap (BIGGEST wave, 44–70s) | **FOLD → Audience-Sim** | the real value; folds into 1 grounded call |
| S15 scoring math | 0 | 7-source weighted blend (5 sources dead); calibration dropped | **SIMPLIFY → directional band** | "blend" = 2 correlated LLM opinions; most of aggregator.ts (62K) deletes |
| S16 stage10 critique | 0 | deterministic confidence checks (was ~42s call, already cut) | **vestigial → delete with blend** | flags critique the old blend; no call to cut |
| S17 stage11 counterfactuals | 1 | always-on advice, per-band (brittle → null in prod) | **CUT call → becomes Apollo's rewrites** | fed scores not verbatim; THE convergence with first paste |
| S18 ML / optimal-post / pred-engagement | 0 | ML disabled; **engagement counts FABRICATED** (Math.sin jitter) | **DELETE (honesty)** | pred-engagement is invented "Predicted Performance"; ml off; optimal-post evaluate |
| S19 DB writes | 0 | 3 serial writes → SSE complete | **KEEP** | minor: parallelize writes |

**Today:** ~25 LLM calls. **Target end-state: ~3 calls** — **Omni** (observer/transcriber) + **Apollo Reasoner** (Brain 1, creator-craft) + **Audience Sim** (Brain 2, viewer-psych). ~88% cut. The collapse hinges on S13/S14 — whether one folded Audience-Sim call replaces 20 persona simulations without losing real signal (the milestone's central bet; validate with a few real-video A/B checks).

## FINAL TALLY — walkthrough complete (S0–S19)

**Today (video mode):** Omni 1 + deepseek 1 + Pass1 10 + Pass2 10 + platform_fit 1 + stage11 1 (+ rule-semantic 1) = **~24–25 LLM calls**, ~332s, over the 300s cap.

**Apollo end-state: 3 LLM calls** (~88% cut, comfortably under cap):
1. **Omni** — observer/transcriber (S5). Add `hook_verbatim` + per-segment `spoken_text`/`on_screen_text`; drop the 0–10 judgments.
2. **Audience-Sim** (Brain 2) — folds 20 personas (S13/S14). Knowledge = `persona-registry.ts` (already built). Fed verbatim + segments + keyframes + emotion arc → per-archetype × per-segment heatmap.
3. **Apollo Reasoner** (Brain 1) — reframed `deepseek.ts` (S10). Knowledge = distilled Chase Hughes (cached system prompt). Absorbs platform-fit (S12) + the rewrites that S17 was supposed to do. Output: critique + **audience-aware rewrites**.

(+ text-mode gemini, 1 call, non-video fallback only.)

**Sequencing:** `Omni → Audience-Sim → Apollo` (rewrites become audience-aware).

**DELETE:** fabricated `predicted-engagement` (honesty), `ml.ts` (off), most of `aggregator.ts` score-blend (5/7 sources dead), vestigial stage10 flags, dead `audio-fingerprint`/`trends`, the separate stage11/platform_fit/rule-semantic calls. Score → directional band.

**Build sequence (foundation → Apollo → surface):**
1. **Strip to senses** — cut score-machinery + fabrication + dead stages → gets under latency cap for free. (Mostly deletion; low risk.)
2. **Omni verbatim** — add `hook_verbatim` + per-segment text (zero-regret precondition).
3. **Apollo Reasoner** — swap deepseek's 5-step → distilled Chase Hughes core; add rewrites to output schema. (The moat. Biggest content effort.)
4. **Fold Audience-Sim** — 20 personas → 1 grounded call; **A/B vs current 20 on real videos** (the bet; test-rig cameo).
5. **Wire sequencing** + directional score + UI surface for rewrites/heatmap.
6. (later milestone) **Chat surface** — Apollo + engine-as-tool.

**Open bets / to verify:**
- Fold quality: does grounded-1 Audience-Sim reproduce/beat the 20-call retention curve? (A/B on real videos.)
- Cheap DB check: confirm trending_sounds/scraped_videos/outcomes row counts = 0.
- Archetype count in the fold: 10 vs ~5 core.
- `optimal-post.ts`: honest signal or cut?
- What exactly is the Chase Hughes corpus + distillation form (the moat — biggest unknown).

## Two-brain architecture (decided 2026-06-03)

Personas fold into ONE call, but with **different knowledge** than the reasoner (user's idea, confirmed):

| | Brain 1 — **Apollo Reasoner** (expert) | Brain 2 — **Audience Sim** (crowd) |
|---|---|---|
| Job | what's strong/weak + how to fix | moment-to-moment viewer reaction: bounce points, feeling, share intent |
| Knowledge | Chase Hughes — persuasion/hooks/triggers (creator-craft) — **THE MOAT** | audience/demographic/platform-consumption psych — **commodity, light corpus** |
| Output | critique + **rewrites** | retention curve + per-segment reaction + behavioral aggregate |
| Source | reframed `deepseek.ts` (S10) | folded personas (S13/S14) |

Sharpenings:
1. **Asymmetric moat** — pour corpus effort into Brain 1; Brain 2 ≈ base model + creator context (S8), no deep corpus.
2. **2 calls, not 1** — separate stable system prompts → independent prompt-cache hits + focused reasoning; the visual retention curve is a distinct output worth its own call.
3. **Sequencing OPEN** — richer wiring is `Omni → Audience Sim → Apollo` (rewrites become audience-aware: Apollo knows where viewers bounced). Decide at S13/S14.

## Apollo Reasoner = deepseek.ts re-knowledged (key realization)
`deepseek.ts` already is: 1 reasoning call · stable cached system prompt (generic 5-step framework) + volatile user message · temp 0 + seed · circuit breaker + retries · strips input scores to reason qualitatively. To become Apollo: (a) swap 5-step → distilled Chase Hughes knowledge core (system prompt, cached), (b) feed verbatim content from repurposed Omni, (c) drop calibration/percentile framing (loads `calibration-baseline.json` only for "top X%" labels = score-machinery), (d) extend output schema with `rewrites`. Keep all infra.

---

## S0 — Pre-flight + input prep
Route: auth → subscription → daily usage (free/starter 50/day, pro ∞) → content hash → cache (L1 in-mem 24h + L2 Supabase 24h, key `hash::v3.0.0::userId`) → placeholder row (`overall_score=null` = in-flight) → open SSE. Pipeline: Zod validate → normalize → pre-fetch creator cards → 1h signed video URL.
- **0 LLM calls.** All cheap serial DB reads.
- Cache key versioned to `v3.0.0` — any engine change that should invalidate results MUST bump this or stale scores serve.
- Architectural flag (not S0-specific): whole pipeline+tail (~332s) is awaited inside one SSE response under a 300s Vercel cap → mid-stream termination risk. Biggest latency lever. Revisit after cut-list (the cuts may bring it under cap without re-architecting).
- **Verdict: KEEP.**

## S5 — Omni call (qwen-omni, temp 0 + seeded → deterministic)
One call watches the whole video, returns JSON with two kinds of fields:
- **(a) Observations (real sensing):** `segments[]` (boundaries + visual/audio *event descriptions*), `emotion_arc[]`, `audio_signals` (ratios + `audio_description`), `content_type`/`niche` slugs, `watermark_detected`, `cta_segment`.
- **(b) Judgments (scoring baked into the sensor):** 5 `factors` (0–10 + rationale + tip), `hook_decomposition` (6 sub-scores), `video_signals` (production/pacing/transition), `audio_perceptual_score`, `hook_visual_impact`.

**Critical gap:** Omni **never emits the actual words.** `visual_event`/`audio_event` are paraphrases; the hook is scored, never quoted. The literal hook line / on-screen text / spoken transcript — the #1 raw material for behavioral rewrites — is discarded. Chase Hughes–grade rewrites are impossible without it.

**Verdict: KEEP the call, narrow its job.** Only call you can never cut (can't replace "look at the video"). But it's currently *both eyes and judge* — the judging moves to Apollo. Repurpose Omni to **observe + transcribe**: add `hook_verbatim` + per-segment `spoken_text`/`on_screen_text`; drop most 0–10 judgments. Eyes sharper, opinions move to the brain. (Cost: 1 video-heavy call; MAX_RETRIES=1, 60s timeout.)

## S6 — text-mode gemini (`pipeline.ts` inline)
Only fires in `text`/`tiktok_url` mode (non-video): 1 fast Qwen call → 5 factors + impression + summary. In `video_upload` mode this is a passthrough of Omni's result (0 calls). **Verdict: KEEP as text-mode sensor**; low priority for video-first Apollo.

## S7 — audio_fingerprint (`audio-fingerprint.ts`)
**Dead stub.** `matchAudioFingerprint()` = `return null` ("DEFERRED to M2 — re-embedding job required: gemini-embedding-001 → DashScope; changing model invalidates all `trending_sounds` pgvector data"). Audio's 5% weight redistributes automatically. **Verdict: ALREADY CUT** — leave dormant or delete.

## S8 — creator_context (passthrough)
Pre-fetched once at S3 (`fetchCreatorContext` — creator cards: niche, follower tier, etc.); this stage re-emits the event for back‑compat, **0 DB reads, 0 LLM.** Value: feeds creator context to both brains (esp. Brain 2 demographic grounding). **Verdict: KEEP.**

## S11 — trend_enrichment (`trends.ts`)
0 LLM. Reads `trending_sounds` (top 50) + `scraped_videos` (last 200); Jaro-Winkler fuzzy-match of sound names vs caption text + popularity-weighted hashtag scoring → `trend_score` (0–100) + `trend_context` string fed to reasoner. **Dead:** both tables are the empty ones (audio stub confirms `trending_sounds` pgvector data was invalidated) → every run emits `trend_score=0` + `"No trending sound or hashtag references detected."` Crude even if populated (sound name rarely in caption). **Verdict: CUT as built.** Remove `trend_context` from Apollo's input (it's noise). Trend-awareness = future Brain-2 context, not a stage, not the moat. _Verify-cheap: `SELECT count(*)` on trending_sounds/scraped_videos/outcomes._

## S12 — platform_fit (`wave4/platform-fit.ts`)
1 `QWEN_FAST_MODEL` call (stable-system + volatile-user cache pattern). Scores fit per target platform (TikTok/IG/YT) → `fit_score` + `rationale` + `watermark_penalty` (~5% weight). Watermark flags already come from Omni (S5). **Verdict: CUT the call → fold into Apollo.** `fit_score` dies with the demoted score; the useful part (cross-post/watermark warning + platform-tailoring advice) survives inside Apollo's single pass, grounded + free. −1 call.

## S15–S19 — post-pipeline tail (`aggregator.ts` `aggregateScores` + route)
**S15 scoring (`aggregator.ts:942`):** `raw_overall_score` = weighted sum of behavioral + gemini + ml + rules + trends + audio + retrieval + platform_fit. **5 of 7 dead** (ml=0, trends=0, audio dead, retrieval=0, platform_fit cut) → effectively `behavioral + gemini` = two correlated LLM opinions. `overall_score = raw_overall_score` (Platt calibration dropped 2026-05-24). **Verdict: SIMPLIFY → directional band (strong/mid/weak) off the two brains;** delete weight-redistribution + CTA penalty + calibration scaffolding. Most of the 62K file evaporates.
**S16 stage10 (`stage10-critique.ts`):** ALREADY deterministic TS, **0 LLM** (was ~42s thinking call; rewritten because it re-derived a formula + discarded output). 4 consistency checks → confidence penalty + creator-cited flags. Flags compare gemini_score vs behavioral_score = critique the blend. **Verdict: vestigial → delete with the blend.**
**S17 stage11 (`stage11-counterfactuals.ts`):** 1 `qwen-plus` thinking call (~30-35s, budget 2000, max_tokens 1800), always-on, per-band discriminated union (low=3 fix / mid=2+1 / high=1+2-3). **Brittle** — schema validation fails often → `counterfactuals_validation_failed` → null in prod. Fed `buildSignalContextUserMessage` = scores + content_summary blurb, **never verbatim words.** The advice layer that can't rewrite because it can't see the line (= first paste). **Verdict: CUT call → rewrites become a field in Apollo Reasoner's output,** grounded in verbatim + Chase Hughes.
**S18:** `predicted-engagement.ts` — **FABRICATED** views/likes/comments from score via `Math.sin` jitter, shown as "Predicted Performance" → **DELETE (dishonesty).** `ml.ts` — logistic reg, disabled (31% acc, weight 0) → delete/dormant. `optimal-post.ts` — 0-LLM posting-time heuristic → evaluate during build.
**S19:** 3 serial DB writes → SSE complete. **KEEP**; parallelize for minor latency.
**Tail nuance:** problem is NOT calls/latency (S15/S16/S18 already 0-LLM) — it's an elaborate score-and-fabrication machine the new direction makes obsolete. Cuts = delete dishonest/vestigial machinery; Apollo's grounded output replaces the advice layer.

## S13/S14 — personas (THE BET) (`wave3.ts`, `wave3/pass2.ts`, `wave3/persona-registry.ts`)
**S13 Pass 1:** 10 parallel `qwen-flash` (thinking off, temp 0+seed). Each role-plays 1 archetype → scroll_past_second, watch_through_pct, comment/share/save/rewatch intent + reasoning. **BLIND** — receives only caption + hashtags + duration + content_type + a few 0–10 craft scores; never sees video/hook words/transcript. ≥7/10 must succeed (D-13). Aggregated (mean watch-through; top-3-enthusiast-weighted intents) → behavioral aggregate.
**S14 Pass 2:** 10 parallel `qwen-plus` **thinking** (budget 2000, ~44–70s = **biggest wave in pipeline**). Keyframe-grounded per-segment reactions → user-visible **retention heatmap**. Falls back to Pass 1 drop-point when model returns no swipe.

**Honesty already in code:** `percentileLabel` renamed "top X%" → "X intent" (WR-05) because these are intent guesses, not corpus ranks; corpus calibration "deferred to Phase 10."

**Knowledge already built:** `persona-registry.ts` (553 lines) = 10 archetypes + scroll/stop triggers + 6 motivators + 4 time-of-day + niche instantiations. **This IS Brain 2's corpus.**

**Verdict: FOLD 20 → 1 Audience-Sim (Brain 2).** Knowledge = registry (distill to one cached system prompt). Feed the grounding today's personas LACK: verbatim hook/transcript + segments + emotion arc + keyframes. Emit per-archetype × per-segment reaction matrix → heatmap + aggregate. Likely **improves** quality (grounding > parallelism — today's curve is built from blind/semi-blind guesses) while cutting 19 calls + killing the biggest latency wave. Pass 1's separate existence evaporates (the grounded call does its job directly).
**Sub-decisions:** (1) archetype count — maybe ~5 core vs 10 (less homogenization risk in a single call); (2) sequencing `Omni → Audience-Sim → Apollo` so rewrites are **audience-aware** ("loses tough_crowd at 0:02 → rewrite: …").
**THE BET to validate:** A/B folded-grounded-1 vs current-20 on real videos — does it reproduce/beat the retention curve? (deferred test rig's cameo). Prediction: beats it.

## S9 — rule_scoring (`rules.ts`)
Hybrid: **regex tier** (deterministic, free — `question_hook`, `curiosity_gap`, `negative_bias`, `bold_claim`, `story_hook`, `pattern_interrupt`, `cta_clarity`, `authenticity`…) + **semantic tier** (1 batched `QWEN_FAST_MODEL` call over DB `rule_library` rows w/ `evaluation_prompt`, ~$0.001, 15s timeout). `rule_score` (0–100) feeds the blend = score-machinery. The regex patterns are a primitive behavioral-heuristic layer (Chase Hughes ancestor). **Verdict: CUT the semantic call** (Apollo subsumes, better + grounded); regex tier free so harmless but effectively dead under demoted score. Possible: mine the regex patterns + `rule_library` content as seed material when distilling the Apollo knowledge core.
