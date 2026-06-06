# Phase 1: Strip to Senses — Research

**Researched:** 2026-06-04
**Domain:** Codebase verification of a subtractive engine-strip (import-graph proof, blend-cut safety, UI null-degrade)
**Confidence:** HIGH — every claim verified against on-disk source with file:line evidence. This is a codebase-grounded audit, not external research.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D1–D4)
- **D1.1** Hard-delete sine-jitter engagement: `predicted-engagement.ts` + `computePredictedEngagement` in `aggregator.ts`. No dormant.
- **D1.2** Remove "top X%" percentile-label framing in `deepseek.ts` + `calibration-baseline.json` percentile dependency — **labels only**, do not touch reasoning/score derivation.
- **D1.3** KEEP `predicted_engagement` field/type, board card shell, `tiktok-result-card`, `results-panel`, `simulation-store`. Field becomes null in P1 → card renders only when present.
- **D1.4** KEEP score + confidence + derivation on live signals (behavioral + gemini).
- **D2.1** Move to `_dormant/`: `ml.ts`, `audio-fingerprint.ts`, `trends.ts`, `wave4/platform-fit*`, `stage11-counterfactuals*`, `rules.ts` semantic tier. Tests travel.
- **D2.2** `_dormant/` excluded from `tsconfig.json` + `vitest.config.ts`.
- **D2.3** Hard-delete only the truly fabricated/vestigial: `predicted-engagement.ts` jitter + vestigial stage10 critique flags.
- **D2.4** `rules.ts` regex tier: keep in active tree if any live consumer remains, else dormant whole module. Planner decides from import graph.
- **D3.1** Remove dead keys (`ml`, `trends`, `audio`, `retrieval`, `platform_fit`) from `SCORE_WEIGHT_KEYS` + `SignalAvailability`. Math becomes `behavioral + gemini`.
- **D3.2** Prove R8 determinism, then measure pre/post-strip score delta via `scripts/measure-pipeline.ts`. ~0 expected; any shift documented as honesty correction.
- **D3.3** Delete now-unreachable weight-redistribution / CTA-penalty / calibration scaffolding; keep `behavioral + gemini` intact.
- **D4.1** stage11 cut → counterfactuals null → HIDE `SuggestionsSection` (no `FALLBACK_ITEM`).
- **D4.2** platform_fit cut → `verdict-derive.ts:89` null-safe.
- **D4.3** KEEP `optimal-post.ts` pending audit that it is a real heuristic.

### Claude's Discretion (planner decides)
- Exact `_dormant/` layout + whether `rules.ts` regex tier travels (D2.4).
- Whether to add `_dormant/README.md`.
- Order of operations for green-at-each-step.
- Whether `calibration-baseline.json` is deleted or kept dormant.

### Deferred Ideas (OUT OF SCOPE)
- Score rederivation / directional band / Apollo composite — P3/P5.
- Grounded engagement rebuild (R11) — P5. Keep field/shell, null the data.
- Omni verbatim (R1) — P2.
- Remix path — verify intact only, do not touch.
- Retrieval / similar-videos / `/trending` dashboard — archived pre-Apollo P1.
- `learning/` loop, ingestion crons, scrapers — untouched.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R5 | Honest expert score + confidence still render | Score path (`behavioral + gemini`) is cleanly separable; computePredictedEngagement is independent of score (claim #4). Confidence calc has a stage10 coupling to audit (claim #12). |
| R6 | E2E under cap (<300s, target ≤90s) | `measure-pipeline.ts` exists + runs latency (claim #8); cuts remove stage11 (~30-35s) + platform_fit + rule-semantic calls. |
| R8 | Determinism (temp0+seed → identical score) | temp0+seed live on ALL calls; maxRetries is NOT 0 (claim #7 — CONTEXT assertion corrected). |
| R9 | No fabricated/dead signal | jitter engagement + dead blend keys identified + separable (claims #1,#4,#5). |
| R11 | (P5) grounded engagement — field kept, nulled here | `predicted_engagement` field retained; only derivation deleted (claim #6). |
| R12 | One brain across modes — remix not regressed | Remix path branches BEFORE `aggregateScores`; imports no cut module (claim #10 VERIFIED). |
</phase_requirements>

## Summary

This phase is a surgical subtraction. The good news: the engine was already architected for graceful degradation — every cut signal already redistributes to 0 weight, and several UI surfaces are already null-guarded. The score delta (D3.2) is genuinely expected near-0 because the dead keys (`ml`, `trends`, `audio`, `retrieval`, `platform_fit`) are already weighted 0 or redistributed by `selectWeights`.

**The bad news the planner MUST sequence around:** CONTEXT.md contains **four materially wrong location claims** that, if followed literally, break the build at intermediate steps:

1. **stage11 + stage10 are NOT called from `pipeline.ts`.** They are called from `aggregator.ts:1254-1269` (a `Promise.all`) and again from `analyze/route.ts:180` (deferred path). CONTEXT line 109 says to remove stage11 from `pipeline.ts` — there is no stage11 call there.
2. **`rules.ts` has no separable "semantic tier module."** Regex + semantic are two inline branches of one function (`scoreContentAgainstRules`), tier chosen by a DB column. You cannot "move the semantic tier" — you either edit the function to drop the semantic loop, or dormant the whole module.
3. **`calibration-baseline.json` is NOT used only for percentile labels.** It also feeds viral differentiators + duration sweet-spot into deepseek's user message. Deleting it (vs. keeping the file, removing only percentile lines) would strip non-label reasoning context — violating D1.2's "labels only" scope.
4. **The live "top X%" string the user wants gone is already de-fanged on the primary path.** Live video-mode `*_percentile` labels come from `wave3/aggregator.ts percentileLabel()` which already emits "high intent" / "moderate intent" (WR-05 rename), NOT "top X%". deepseek's "top X%" framing only surfaces on the persona-failure fallback. The label cut is still worth doing but is lower-stakes than CONTEXT implies, and touches a different file than CONTEXT names.

Additionally, **`ml.ts` has two LIVE importers** (`aggregator.ts:26` calls it every run; `cron/retrain-ml/route.ts:4`), and **`creator-rules.test.ts` imports the prompt files of two cut modules** (stage11 + platform-fit prompts) — both are dormant-move landmines.

**Primary recommendation:** Sequence strictly as **call-site removal → import-graph verify → dormant move → blend cut → UI null-degrade → cache bump → measure**. Do the aggregator/route call-site removals (not pipeline.ts for stage11) FIRST, fix the `creator-rules.test.ts` cross-import before moving prompt files, and treat `ml.ts`'s aggregator call as a required removal before any move.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Score blend + dead-key removal | API/Backend (`aggregator.ts`) | — | Scoring math is server-only; aggregator owns `SCORE_WEIGHT_KEYS` + `selectWeights`. |
| Pipeline stage calls (audio/trends/rules/platform_fit) | API/Backend (`pipeline.ts`) | — | Stage orchestration; these are the call sites that must be removed before dormanting. |
| stage10/stage11 calls | API/Backend (`aggregator.ts` + `analyze/route.ts`) | — | **NOT pipeline.ts** — CONTEXT correction. |
| Percentile labels | API/Backend (`wave3/aggregator.ts` live + `deepseek.ts` fallback) | UI (`verdict-derive.ts`, `input-derive.ts`, `behavioral-predictions.tsx`) | Two producers; UI consumes the string. |
| predicted_engagement null-degrade | UI (`results-panel.tsx`, `tiktok-result-card.tsx`) | Frontend store (`simulation-store.ts`) | Card render gated on field presence. |
| counterfactuals null-degrade | UI (`results-panel.tsx`, `insights-section.tsx`) | — | Already null-guarded at panel; FALLBACK_ITEM is the change. |
| Cache invalidation | API/Backend (`version.ts` → `cache/prediction-cache.ts`) | — | One-line `ENGINE_VERSION` bump. |
| Remix flow (must not regress) | API/Backend (`analyze/route.ts` remix branch → `remix/*`) | UI (`board/decode`, `board/adapt`) | Branches before the blend; isolated. |

---

## Claim-by-Claim Verdicts

### Claim 1 — Import graph for every `_dormant` candidate — CORRECTED (CONTEXT incomplete)

The complete active-tree importer set per module (all verified via grep, `_dormant/` and `.test` excluded unless noted):

| Module | Active-tree importers | Move-blocking call sites |
|--------|----------------------|--------------------------|
| **`ml.ts`** | `aggregator.ts:26` (`predictWithML`, `featureVectorToMLInput` — **called every run** at `aggregator.ts:791,794`); `cron/retrain-ml/route.ts:4` (`trainModel`, `stratifiedSplit`) | Remove the aggregator call (lines 791-798) + handle/keep the cron route. `corpus/metrics/bootstrap.ts:82` is a **comment reference only** (not an import). |
| **`audio-fingerprint.ts`** | `pipeline.ts:23` (`matchAudioFingerprint`, called at 739) | Remove pipeline call site (729-751) + the audio Promise.all slot (800). `aggregator.ts:74` is a comment. |
| **`trends.ts`** | `pipeline.ts:30` (`enrichWithTrends`, called at 868) | Remove pipeline call (865-883) + Promise.all slot (895). **`trends.ts` imports `./fuzzy` (`bestFuzzyMatch`)** — `fuzzy.ts` has NO other active importer, so it can travel into `_dormant/` with trends (or stay; harmless either way). |
| **`wave4/platform-fit.ts`** | `pipeline.ts:42` (`runPlatformFit`, called at 909); imports its own `./platform-fit-prompts` | Remove pipeline call (905-919) + the await (1018) + the `platformFitResult` result-field (1070) + aggregator reads (847,930-934,959,1227). |
| **`stage11-counterfactuals.ts`** | `aggregator.ts:49` (`runStage11Counterfactuals`, `maybeAppendLikelyFlopWarning`, called at 1265); **`analyze/route.ts:9`** (called at 180, deferred path); imports `./stage11-counterfactuals-prompts` | **NOT pipeline.ts.** Remove aggregator Promise.all slot (1263-1268) + the deferred re-run in analyze route (155-219). Keep `result.counterfactuals` field → null. |
| **`rules.ts`** | `pipeline.ts:29` (`loadActiveRules`, `scoreContentAgainstRules`, called at 771-772) | Single importer. See claim #2 for the regex/semantic split reality. |

**Cross-cut landmine:** `creator-rules.test.ts:9-10` imports `STABLE_COUNTERFACTUALS_SYSTEM_PROMPT` from `stage11-counterfactuals-prompts` AND `STABLE_PLATFORM_FIT_SYSTEM_PROMPT` from `wave4/platform-fit-prompts`. `creator-rules.ts` itself is KEPT. **Moving those prompt files to `_dormant/` breaks `creator-rules.test.ts` at compile.** Planner must update/trim that test before the move.

### Claim 2 — `rules.ts` regex-vs-semantic split (D2.4) — CORRECTED

There is **no separable semantic module**. `rules.ts` (344 lines) contains both tiers as inline branches of `scoreContentAgainstRules` (lines 280-337): a synchronous `regexRules` loop (280-305) and an async `evaluateSemanticRules` batch call (307-337). Tier is chosen at runtime from the DB `evaluation_tier` column (`rules.ts:59,277-278`), not at the code level.

- **Only consumer:** `pipeline.ts` (`loadActiveRules` + `scoreContentAgainstRules` together at 771-772).
- The regex tier has **no consumer the semantic tier doesn't** — they share one entry point and one importer.
- **Recommendation:** It is NOT cleanly splittable into two files. Two viable options: (a) dormant the whole module + remove the pipeline call (cleanest, matches D2.4 default "dormant the whole module"); or (b) keep `rules.ts` active but edit `scoreContentAgainstRules` to delete the semantic branch (307-337) + `evaluateSemanticRules` (169-257), leaving only the free regex tier. Given `rule_score` already has weight 0 (`SCORE_WEIGHTS.rules: 0`), option (a) is simpler and removes the 15s semantic LLM call entirely. **Default to dormant-whole-module.**

### Claim 3 — Exact `pipeline.ts` call sites — CORRECTED line numbers + assembly shape

CONTEXT line refs vs. actual (file re-numbered since CONTEXT was written):

| Call | CONTEXT ref | ACTUAL | Notes |
|------|-------------|--------|-------|
| `matchAudioFingerprint` | l.23, 739 | import l.23 ✓; call l.**739** ✓ | inside `audioFingerprintPromise` (729-751). |
| `enrichWithTrends` | l.30, 868 | import l.30 ✓; call l.**868** ✓ | inside `trendPromise` (865-883). |
| `runPlatformFit` | l.42, 907, 1018, 1070 | import l.42 ✓; call l.**909**; await l.**1018**; result-field l.**1070** | chained off `wave2Promise` (907-919). |
| `loadActiveRules`/`scoreContentAgainstRules` | (rule-semantic) | import l.29; call l.**771-772** | inside `rulePromise` (768-784). |
| stage11 | "in pipeline.ts" | **NOT in pipeline.ts** | actually `aggregator.ts:1265` + `analyze/route.ts:180`. |

**Awaited-set assembly shape (what changes):**
- **Wave 1 (`pipeline.ts:794-803`):** `Promise.all([geminiPromise, audioFingerprintPromise, creatorPromise, rulePromise])` destructured as `[geminiResult, audioFingerprintResult, , ruleResult]`. Removing audio + rules changes both the array AND the destructure. Cleanest: keep `geminiPromise` + `creatorPromise`, drop the audio + rule slots.
- **Wave 2 (`pipeline.ts:894-896`):** `Promise.all([deepseekPromise, trendPromise])`. Removing trends leaves `Promise.all([deepseekPromise])` or just `await deepseekPromise`. The `[deepseekRaw, trendEnrichment]` destructure (1011) changes.
- **platform_fit (907-919):** chained off `wave2Promise.then(([ds]) => runPlatformFit(...))`. Removed entirely; `platformFitResult` await (1018) + result field (1070) go.
- **Result object (1050-1077):** drop `trendEnrichment`, `audioFingerprintResult`, `ruleResult`, `platformFitResult` keys (and the `PipelineResult` interface fields).

### Claim 4 — `aggregator.ts` blend — VERIFIED, with computePredictedEngagement confirmed

- **`SCORE_WEIGHT_KEYS`** at `aggregator.ts:90`: `["behavioral", "gemini", "ml", "rules", "trends", "audio", "retrieval", "platform_fit"]`. `SCORE_WEIGHTS` at lines 70-79 (ml=0, retrieval=0, rules=0 already; trends=0.10, audio=0.05, platform_fit=0.05 nominal).
- **`selectWeights`** (167-277): redistributes missing sources proportionally so weights sum ~1.0. Confirms D3.2 expectation: the dead sources, when their availability flags go false, already redistribute to the live keys. **However**, `trends`/`audio`/`platform_fit` carry nonzero NOMINAL weights — they only hit 0 effective weight when their availability is false. In live runs: audio availability = `audioSignals != null` (often true → 0.05 enters), trends always emits `trend_score=0` (its 0.10 weight multiplies 0 → no score contribution but DOES dilute), platform_fit availability true when the call ran. **So the pre/post delta may be slightly nonzero** (the documented "honesty correction" in D3.2): removing the trends 0.10 term that always multiplied `trend_score=0` redistributes that weight to behavioral+gemini, nudging the score up. **Document this; it is the expected honesty correction, not a bug.**
- **Scoring math** (`aggregator.ts:942-962`): weighted sum of `behavioral_score*w + ctaPenaltyApplied_gemini_score*w + (mlScore??0)*w + ruleResult.rule_score*w + trend_score*w + audio_score*w + retrieval*w + platformFitMeanScore*w`. After cut: `behavioral_score*w.behavioral + ctaPenaltyApplied_gemini_score*w.gemini`. The ml/rules/trends/audio/retrieval/platform_fit terms become removable.
- **CTA penalty** (94-152, `applyCtaPenalty` + `CTA_PENALTY_POINTS`): applies to `gemini_score`. This is NOT a dead-key artifact — it modifies the LIVE gemini term. D3.3 says CTA-penalty "evaporates" — **it does NOT automatically evaporate**; it is coupled to the kept gemini path. Planner decision: CTA penalty is arguably score-machinery scaffolding, but it touches a live term. **Recommend keeping it unless the user explicitly scopes it out** — removing it changes the live score (a non-honesty-correction shift). Flag as an open question.
- **`computePredictedEngagement`** mirror CONFIRMED at `aggregator.ts:436-469` (identical `Math.sin` jitter as `predicted-engagement.ts:17-39`). Called at 1103, assigned to result at 1154. Plus the helper `rescalePersonaIntentToViewRate` (485-499) feeds it. **Hard-delete target:** lines 436-469 (`computePredictedEngagement`), 485-499 (`rescalePersonaIntentToViewRate`, only feeds engagement), 1098-1106 (the call + `engagementBehavioral`), and the `predicted_engagement,` field at 1154 (or set null). The `PredictedEngagement` import (line 13) becomes unused.
- **`behavioral + gemini` path cleanly separable:** YES. `behavioral_score` (868-879 from deepseek component_scores) and `gemini_score` (885-888 from gemini factors) are computed independently of all cut sources.

### Claim 5 — `deepseek.ts` percentile labels (D1.2) — CORRECTED scope

- **Lines verified:** `75` (STABLE_SYSTEM_PROMPT step 5 instructs "top X%" framing); `84-90` (output schema `*_percentile` string fields); `320` (loads `calibration-baseline.json`); `387-389,434-437` (`buildDeepSeekUserMessage` injects percentile benchmarks). All confirmed.
- **CORRECTION — `calibration-baseline.json` is NOT used only for percentile labels.** `loadCalibrationData` (314-335) is read ONCE (`deepseek.ts:320` is the **only** repo consumer — verified via grep). But `buildDeepSeekUserMessage` (383-439) uses the loaded object for THREE things: (a) percentile benchmarks (387-389,434-437 — the labels), (b) **viral differentiators** (392-394,429-430), (c) **duration sweet-spot** (396,432). Deleting the JSON or the whole calibration load would strip (b)+(c) too — violating D1.2's "labels only." **Recommendation:** Keep `calibration-baseline.json` (dormant or in place — it has a `FALLBACK_DEEPSEEK_CALIBRATION` so it's non-fatal). Scope the edit to: remove the percentile-framing instruction (line 75), the `*_percentile` schema fields (84-90), and the "Percentile benchmarks for percentile framing" block (434-437). Leave differentiators + duration. This is a tighter, label-only cut.
- **Separable from score/reasoning?** YES — the percentile labels are output-formatting instructions + schema strings; the 5-step component-score derivation (steps 1-5, lines ~40-75) is independent.
- **DELETE-vs-DORMANT the JSON:** KEEP (it still feeds live differentiators/duration). Per Claude's-discretion-D, keep in place (not even dormant) since deepseek stays active and reads it.

### Claim 6 — UI null-degrade surfaces — VERIFIED (most already null-safe)

| Surface | Current shape | Crashes on null? | Action needed |
|---------|---------------|------------------|---------------|
| `verdict-derive.ts:89` (platform_fit) | `(result.platform_fit as {...} \| null \| undefined)?.fit_score` then `typeof fit === 'number'` guard (90) | **NO — already null-safe** | **None.** Reverify #7 already satisfied. Add a test asserting null input. |
| `results-panel.tsx:206` (counterfactuals) | `{result.counterfactuals && (<SuggestionsSection .../>)}` | **NO — already null-guarded** | **None at panel.** D4.1 is about the inner FALLBACK_ITEM, see below. |
| `insights-section.tsx:44,61` (FALLBACK_ITEM) | `const items = suggestions.length === 0 ? [FALLBACK_ITEM] : suggestions` | NO | D4.1: when panel already hides on null counterfactuals, FALLBACK_ITEM only fires on EMPTY (not null) suggestions. To fully honor D4.1 ("don't show fake fallback advice"), change line 61 so empty → render nothing (or keep, since the panel-level null-guard means this rarely fires). Low-stakes. |
| `results-panel.tsx:160` (predicted_engagement) | `{result.predicted_engagement && (<TikTokResultCard engagement={...}/>)}` | **NO — already null-guarded** | **None.** Reverify #5 already satisfied — card hides when field null/absent. |
| `tiktok-result-card.tsx:12` | `engagement: PredictedEngagement` (non-null prop) | Only rendered inside the null-guard above | None — guarded by caller. |
| `simulation-store.ts:17,37` | `predictedEngagement: PredictedEngagement \| null` (defaults null) | NO | None — already nullable. `setAnalysisResult` (39) has **no live caller** (verified). |
| `predicted-engagement.ts` `derivePredictedEngagement` | client helper | **NO live caller** (verified via grep) | Safe to hard-delete with the module. |
| `board-constants.ts` | only layout comments mention "engagement" — no `predicted_engagement` field access | NO | None. |

**Headline:** Reverify #5 and #7 (the two riskiest UI null-degrades) are **already implemented**. The phase's UI work is mostly verification + tests, not new null-handling. D4.1's FALLBACK_ITEM tweak is the only real UI edit.

### Claim 7 — Determinism gate (reverify #1) — CORRECTED (maxRetries:0 is NOT live)

- **temp0 + seed:** LIVE on all score-affecting calls. `deepseek.ts:493-494` (`temperature: 0, seed: QWEN_SEED`); `omni-analysis.ts:195-196`; `wave3.ts:164-165`; `wave3/pass2.ts:175,177`; `stage11-counterfactuals.ts:120-121`. `QWEN_SEED = 7` (`qwen/client.ts:28`).
- **maxRetries:0 — NOT live anywhere.** `deepseek.ts:26` `MAX_RETRIES = 2` (3 attempts); `omni-analysis.ts:25` `MAX_RETRIES = 1` (2 attempts); stage11 has a single retry. **CONTEXT reverify #1's "maxRetries:0" assertion is false on disk.** Retries do not break determinism (a retry re-sends the same seeded request), but they are not 0. The memory `engine-determinism-gate` ("shipped step 0, uncommitted") appears to refer to temp0+seed, which IS shipped+committed — there is no separate uncommitted maxRetries:0 change in the working tree (git status clean).
- **Recommendation for the planner:** reframe reverify #1 as "temp0+seed live (VERIFIED) + assert same-video-twice score identity via measure-pipeline." Do NOT add a `maxRetries:0` task unless the user specifically wants retries disabled — that is a behavior change, not a verification.

### Claim 8 — `scripts/measure-pipeline.ts` — VERIFIED (latency yes, score-delta needs extension)

- **Exists** (`scripts/measure-pipeline.ts`, 9.1KB). Runs the REAL engine (`runPredictionPipeline` + `aggregateScores`) exactly as `/api/analyze` does, uploading a local video and reconstructing a wall-clock timeline from `StageEvents`. Run: `npx tsx scripts/measure-pipeline.ts [/path/to/video.mp4]`. Requires `.env.local` (Supabase + `DASHSCOPE_API_KEY`).
- **Measures latency** (per-stage + total wall) — answers R6 / reverify #2,#12 directly.
- **Does NOT currently emit a pre/post score delta.** It logs the timeline; it has `aggregateScores`' result in scope but doesn't print/compare `overall_score`. **Planner action:** add a small extension to print `result.overall_score` + run on the same fixed video before and after the strip, then diff. A sibling `scripts/smoke-tiktok-pipeline.ts` also exists (remix/tiktok smoke).
- **Recommendation:** D3.2 needs a tiny harness add (log `overall_score`), not a new script.

### Claim 9 — DB row counts (reverify #3) — VERIFIED path, do not run

- Tables: `trending_sounds`, `scraped_videos`, `outcomes`. ENGINE-MAP S11/S7 already note `trending_sounds = 0 rows (2026-05-22)`.
- **Supabase MCP available** (`mcp__supabase__execute_sql`, `mcp__supabase__list_tables`). The planner should specify a `[BLOCKING]` verification task: `SELECT count(*) FROM trending_sounds; SELECT count(*) FROM scraped_videos; SELECT count(*) FROM outcomes;` via `mcp__supabase__execute_sql`. Expected 0 each — confirms trends/audio truly dead before dormanting. **Do not run during research** (per instruction); specify as an execution-time gate.

### Claim 10 — Remix path intact (reverify #4, R12) — VERIFIED

- Flow: `analyze/route.ts` → `if (validated.mode === "remix")` (**line 805**) branches into `runDecodeStream` (278) → `runDecode` (303, from `remix/decode.ts:22`) → persist to variants. Adapt is a separate route: `/api/remix/adapt/route.ts:23` → `generateAdaptConcepts` (`remix/adapt.ts`).
- **Bypasses the blend — CONFIRMED.** `analyze/route.ts:274` + 800 comments: the remix branch "NEVER calls runPredictionPipeline, aggregateScores, or usage_tracking upsert." It branches BEFORE those (line 805 is before the score-mode `aggregateScores` at 690).
- **decode.ts / adapt.ts import NO cut module** (verified: no platform-fit/stage11/trends/audio/ml/rules/aggregator imports). They share Omni (`analyzeVideoWithOmni`) only.
- **Smoke test surface:** `POST /api/analyze` with `mode:'remix'` + a tiktok_url (exercises resolve-and-rehost → Omni → decode), then `POST /api/remix/adapt` with the decode result. `scripts/smoke-tiktok-pipeline.ts` + `remix/__tests__/` + `analyze/__tests__/decode-route.test.ts` already cover this — running them post-strip proves no regression.
- **Verdict:** The strip cannot structurally regress remix; it touches neither the remix branch nor its imports. Reverify #4 = run the existing remix tests + one smoke after the strip.

### Claim 11 — Cache key (reverify #13) — VERIFIED one-line change

- Defined: `version.ts:9` `export const ENGINE_VERSION = "3.0.0";`. Consumed by `cache/prediction-cache.ts:5,21` (L1 key `${contentHash}::${ENGINE_VERSION}::${userId}`) + L2 Supabase query (`.eq("engine_version", ENGINE_VERSION)`, line 88).
- **Bumping is a one-line edit** to `version.ts:9` (e.g., `"3.1.0"`). Auto-invalidates L1 + L2 (the file's own doc comment confirms the invariant). **Required** because outputs change (no more fabricated engagement / percentile labels) — stale cached rows would otherwise serve.

### Claim 12 — stage10 vestigial flags (reverify #14) — VERIFIED, with a confidence-calc coupling to watch

- `stage10-critique.ts` is already **0-LLM deterministic TS** (its own header confirms: was a ~42s qwen call, rewritten). `deriveCritique` (54-126) runs 4 checks → `confidence_adjustment` (clamped [-0.20,0]) + `flags[]`.
- **Flags ARE vestigial** (header: "flags are never persisted (no critique DB column) nor rendered"). Deleting the `flags.push(...)` strings orphans nothing — verified no consumer reads `critique.flags`.
- **BUT `confidence_adjustment` is NOT vestigial** — it is applied at `aggregator.ts:1273` (`applyCritiqueAdjustment`) and feeds `result.confidence` + the anti-virality gate (1279-1282). **Deleting stage10 entirely would change the live confidence value** (a kept signal per D1.4/R5). Check #4 references `sa.audio` + `sa.retrieval` (lines 109-110) — dead keys being removed — so those checks become inert after the blend cut, but Check #1 (gemini vs behavioral gap) + Check #2 (score vs factors) stay live.
- **Recommendation:** D2.3 says "delete vestigial stage10 critique flags" — scope this to the **flag strings only** (the `flags.push` calls), NOT the whole `deriveCritique` / `confidence_adjustment` path, unless the user wants confidence to stop being penalized. Removing the audio/retrieval sub-conditions in Check #4 (109-110) is safe cleanup. **Flag as open question:** does "delete vestigial stage10" mean kill the whole stage (changes confidence) or just the unused flag strings (safe)? CONTEXT D2.3 + ENGINE-MAP S16 ("delete with the blend") lean toward deleting the stage, but that alters R5's confidence — needs confirmation.

### Claim 13 — `optimal-post.ts` audit (D4.3, reverify #11) — VERIFIED HONEST → KEEP

`optimal-post.ts` (109 lines) `computeOptimalPostWindow` is a **real deterministic 0-LLM DB lookup**: queries `niche_post_windows` by niche (72-76), returns a real window with `source:'niche'` + sample size on hit, `FALLBACK_POST_WINDOW` (Tue 18-21 UTC, documented rationale) on unknown niche, null on DB error. No fabrication, no `Math.sin`, no LLM. **Verdict: KEEP ACTIVE.** It is honest. Its output `optimal_post_window` is plucked at `aggregator.ts:1201`. (Note: the FALLBACK is a defensible neutral default, transparently labeled `source:'fallback'` — not a fake stat.)

### Claim 14 — tsconfig + vitest exclude (D2.2, reverify #9) — VERIFIED ALREADY DONE

- `tsconfig.json:38`: `"exclude": ["node_modules", "extraction", "verification", "scripts", "e2e", "**/_dormant/**"]` — **already excludes `_dormant`.**
- `vitest.config.ts:23`: test `exclude` includes `"**/_dormant/**"`; coverage `exclude` (29-30) also includes `"**/_dormant/**"`.
- `_dormant/` directory **already exists** with prior content (`components/`, `corpus/`, `engine/`, `retrieval/`) — the convention is established and live.
- **No config edit needed for the exclude glob.** Reverify #9 becomes a verification task: confirm the moved files land under `**/_dormant/**` and `npm run build` + `npm test` stay green (no active-tree import reaches in). The exclude already works.

### Claim 15 — Test suite reconciliation (reverify #15) — VERIFIED breakage set

197 test files total. Tests that **mock the cut stages** (will break when the awaited set / availability changes) — verified via grep:
- `pipeline.test.ts` — mocks runPlatformFit/matchAudioFingerprint/enrichWithTrends/scoreContentAgainstRules; asserts Wave1/Wave2 event counts. **Will break** on stage removal.
- `aggregator.test.ts`, `aggregator-cta-penalty.test.ts`, `aggregator-anti-virality.test.ts`, `aggregator-audio.test.ts`, `aggregator-optimal-post.test.ts` — assert blend math / availability / predicted_engagement. **Will break** on key removal + computePredictedEngagement delete. `aggregator-audio.test.ts:100` + `aggregator.test.ts:147` import `predictWithML` from `../ml` → **break on ml dormant.**
- `aggregator-platform-fit.test.ts`, `wave4/__tests__/platform-fit*.test.ts` — **travel into `_dormant/`** with platform-fit.
- `trends.test.ts`, `stage11-counterfactuals.test.ts`, `rules.test.ts`, `ml.test.ts`, `fuzzy.test.ts` — **travel with their source** into `_dormant/`.
- `tiktok-url-branch.test.ts`, `analyze/__tests__/derive-and-drop.test.ts`, `analyze/__tests__/decode-route.test.ts` — mock cut stages or the deferred stage11; **update** to assert post-strip behavior.
- **`creator-rules.test.ts:9-10`** — imports stage11 + platform-fit PROMPT files (KEPT module's test importing CUT modules' prompts). **Must be edited before the prompt files move** (see claim #1 landmine).

**Travel-with-source** (into `_dormant/__tests__/`): `ml.test.ts`, `trends.test.ts`, `fuzzy.test.ts`, `rules.test.ts`, `stage11-counterfactuals.test.ts`, `wave4/__tests__/platform-fit*.test.ts`.
**Update in place** (assert post-strip): `pipeline.test.ts`, all `aggregator*.test.ts`, `stage10-critique.test.ts`, `tiktok-url-branch.test.ts`, `analyze/__tests__/*`, `creator-rules.test.ts`.

---

## Validated Order of Operations

Sequenced for green-at-each-step against the real dependency graph. Each step compiles + tests green before the next.

1. **Cut-site removal in `aggregator.ts` + `analyze/route.ts` (NOT pipeline.ts for stage11).**
   - Remove stage11 from `aggregator.ts:1263-1268` (Promise.all slot) + the import (49) + `maybeAppendLikelyFlopWarning` if it depends on stage11 output; remove the deferred re-run in `analyze/route.ts:155-219` + import (9). `result.counterfactuals` → stays null.
   - Remove the `computePredictedEngagement` call + `rescalePersonaIntentToViewRate` (aggregator 1098-1106, 436-469, 485-499); set `predicted_engagement` field → null/omit (1154).
   - Remove the `predictWithML`/`featureVectorToMLInput` call (aggregator 791-798) + import (26). (Cron route `retrain-ml` keeps importing ml.ts for now — see step 3.)
2. **Cut-site removal in `pipeline.ts`** (audio, trends, rules, platform_fit):
   - Audio: delete `audioFingerprintPromise` (729-751) + Wave1 slot/destructure (794-803) + import (23).
   - Rules: delete `rulePromise` (768-784) + Wave1 slot + imports (29).
   - Trends: delete `trendPromise` (865-883) + Wave2 destructure (1011) + import (30).
   - Platform_fit: delete `platformFitPromise` (905-919) + await (1018) + result field (1070) + import (42).
   - Update the `PipelineResult` interface + result object to drop the four fields.
3. **Blend cut in `aggregator.ts`:** remove dead keys from `SCORE_WEIGHT_KEYS` (90) → `["behavioral","gemini"]`; trim `SCORE_WEIGHTS` (70-79); simplify `selectWeights` (167-277) to the 2-key path; reduce the scoring sum (942-962) to `behavioral + gemini`; remove `SignalAvailability` dead flags (803-852); remove `platform_fit`/`audio`/`retrieval`/`ml`/`trends`/`rules` reads (847, 930-934, 959, 1227, etc.). Decide CTA-penalty (open question) + Platt scaffolding. **Score delta measured here.**
4. **stage10 flag scope:** remove vestigial `flags.push` strings + Check#4's audio/retrieval sub-conditions; KEEP `confidence_adjustment` unless user confirms otherwise (open question).
5. **Deepseek label-only cut:** remove percentile-framing (deepseek 75), `*_percentile` schema (84-90), percentile benchmark block in user message (434-437). KEEP `calibration-baseline.json` (still feeds differentiators + duration). Optionally drop `*_percentile` from the persona path `wave3/aggregator.ts:57-65` + the type `types.ts:615-626` if the user wants the labels fully gone from the live path — coordinate with UI consumers (`verdict-derive.ts:149-152`, `input-derive.ts:46-49`, `behavioral-predictions.tsx:13-16`).
6. **Fix cross-import landmine:** edit `creator-rules.test.ts:9-10` to not import the stage11/platform-fit prompt files (inline the constants or drop those assertions).
7. **Dormant move:** move `ml.ts`, `audio-fingerprint.ts`, `trends.ts`(+`fuzzy.ts`), `wave4/platform-fit*`, `stage11-counterfactuals*`, `rules.ts` + their tests into `src/lib/engine/_dormant/`. Handle the `cron/retrain-ml/route.ts` ml import (move the route to dormant too, or point it at the dormant path / disable it — it's a cron, not request-path). Build + test green (exclude glob already in place).
8. **UI null-degrade:** verify `verdict-derive.ts:89` + `results-panel.tsx:160,206` already null-safe (they are); apply the `insights-section.tsx:61` FALLBACK_ITEM → hide tweak (D4.1). Add null-input tests.
9. **Cache bump:** `version.ts:9` `ENGINE_VERSION` → `"3.1.0"`.
10. **Measure + prove:** run extended `measure-pipeline.ts` for score-delta (D3.2) + latency (R6); run remix smoke + tests (R12); run full suite.

**Why this order:** Call sites MUST go before the module moves (else a move strands a live import — reverify #10). The aggregator/route stage11 + ml removals (step 1) precede the pipeline.ts removals (step 2) because they're independent and lower-risk. Blend cut (step 3) needs the cut sources already gone so the score reflects only live signals. The cross-import fix (step 6) MUST precede the dormant move (step 7) or `creator-rules.test.ts` breaks. Cache bump + measure last (outputs are final).

---

## Common Pitfalls (sequencing landmines)

### Pitfall 1: Following CONTEXT line 109 literally (stage11 in pipeline.ts)
There is no stage11 call in pipeline.ts. Removing "stage11 from pipeline.ts" is a no-op; the real calls are `aggregator.ts:1265` + `analyze/route.ts:180`. Missing the route call leaves a dangling import after the module moves → build break.

### Pitfall 2: Moving prompt files before fixing creator-rules.test.ts
`creator-rules.test.ts` imports `STABLE_COUNTERFACTUALS_SYSTEM_PROMPT` + `STABLE_PLATFORM_FIT_SYSTEM_PROMPT` from the cut modules. Move-first → test compile failure. Fix the test (step 6) before the move (step 7).

### Pitfall 3: Treating ml.ts as purely dead
`ml.ts` is imported + CALLED every run (`aggregator.ts:791,794`) AND by the cron route. It is not a dead stub like audio-fingerprint. Remove the aggregator call first; decide the cron route's fate.

### Pitfall 4: Deleting calibration-baseline.json
It feeds live differentiators + duration sweet-spot, not just percentile labels. Deleting it violates D1.2 "labels only." Keep the file; cut only the percentile lines.

### Pitfall 5: Deleting the whole stage10 stage
`confidence_adjustment` is a LIVE input to `result.confidence` (kept per D1.4/R5). Scope D2.3 to the vestigial flag strings unless the user confirms killing the confidence penalty.

### Pitfall 6: Assuming a 0 score delta
trends carries a nonzero nominal 0.10 weight that always multiplies `trend_score=0`. Removing it redistributes weight to behavioral+gemini → small upward nudge. This is the D3.2 "honesty correction" — expect it, document it, don't treat it as a regression.

### Pitfall 7: Removing CTA penalty silently
`applyCtaPenalty` modifies the LIVE gemini term. It is scaffolding-adjacent but not a dead-key artifact. Removing it shifts the live score for tutorial/b_roll content (not an honesty correction). Confirm scope before touching.

---

## Open Questions

1. **CTA penalty (`aggregator.ts:94-152`):** D3.3 says scaffolding "evaporates," but CTA penalty touches the kept gemini term. Remove it (changes live score for some content) or keep it? **Recommend keep** unless user scopes it out.
2. **stage10 scope (D2.3):** delete vestigial flag strings only (safe), or the whole stage incl. `confidence_adjustment` (changes live confidence)? ENGINE-MAP S16 says "delete with the blend"; D1.4/R5 says keep confidence. **Recommend flags-only; confirm with user.**
3. **Live "top X%" label removal scope (D1.2):** the user's canonical "top 8%" example. The LIVE persona path already says "high intent" (WR-05). Does the user also want the `*_percentile` fields/labels removed from the persona path (`wave3/aggregator.ts`) + UI, or only the deepseek "top X%" instruction? **Recommend: remove deepseek's "top X%" framing (clear fabrication-framing) + audit whether the "intent" labels stay (they're honest per WR-05).**
4. **Cron `retrain-ml/route.ts` fate:** it imports ml.ts (`trainModel`/`stratifiedSplit`). Move the route to dormant, disable the cron, or leave ml.ts's training exports out of the dormant move? **Recommend: dormant the route too (it trains a disabled, 0-weight model).**
5. **calibration-baseline.json placement:** keep in `src/lib/engine/` (deepseek still reads it) vs. anything else. **Recommend: leave in place.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Supabase MCP (`execute_sql`) | reverify #3 row counts | ✓ | — | — |
| `tsx` | run `measure-pipeline.ts` | ✓ (devDep, `npx tsx`) | — | — |
| `.env.local` (Supabase + DASHSCOPE_API_KEY) | measure-pipeline E2E | assumed present (live product) | — | mock/skip the E2E score-delta if absent |
| `npm run build` / `npm test` (vitest) | green-at-each-step gate | ✓ | — | — |

**Note:** `measure-pipeline.ts` makes real DashScope + Supabase calls (real money + latency). The pre/post score-delta requires running it twice on a fixed video — budget for ~2× E2E latency (~300s each pre-strip).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest.config.ts`) |
| Config file | `vitest.config.ts` (excludes `**/_dormant/**` already) |
| Quick run | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts` |
| Full suite | `npm test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | Exists? |
|-----|----------|-----------|---------|---------|
| R9 | jitter engagement gone | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts` | ✅ (update — assert predicted_engagement null) |
| R9 | dead keys gone from blend | unit | same | ✅ (update) |
| R8 | same video → identical score | integration | extended `measure-pipeline.ts` ×2 | ⚠️ harness add (log overall_score) |
| R6 | E2E < 300s | integration | `measure-pipeline.ts` | ✅ |
| R12 | remix not regressed | integration | `npx vitest run src/app/api/remix src/app/api/analyze/__tests__/decode-route.test.ts` | ✅ |
| R5 | score + confidence still render | unit | `aggregator.test.ts` + `stage10-critique.test.ts` | ✅ (update) |
| #9 | `_dormant` excluded, build green | smoke | `npm run build && npm test` | ✅ |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <touched test>`.
- **Per wave merge:** `npm test` (full suite, minus dormant).
- **Phase gate:** full suite green + `npm run build` + one `measure-pipeline.ts` run (latency + score-delta) + remix smoke.

### Wave 0 Gaps
- [ ] Extend `scripts/measure-pipeline.ts` to log `result.overall_score` (D3.2 score-delta).
- [ ] Add null-input test for `verdict-derive.ts` platform_fit path (assert no crash — confirms existing null-safety).
- [ ] Add test asserting `predicted_engagement` absent → `TikTokResultCard` not rendered.
- [ ] Reconcile `creator-rules.test.ts` cross-imports before the dormant move.

## Sources

### Primary (HIGH confidence — on-disk verification)
- `src/lib/engine/pipeline.ts` (call sites 23,29,30,42,739,771-772,868,909,1018,1070; Promise.all 794-803,894-896)
- `src/lib/engine/aggregator.ts` (SCORE_WEIGHT_KEYS 90; selectWeights 167-277; scoring 942-962; computePredictedEngagement 436-469; stage10/11 Promise.all 1254-1269; result assembly 1146-1228)
- `src/lib/engine/deepseek.ts` (percentile 75,84-90; calibration load 314-335; user message 383-439; determinism 493-494; MAX_RETRIES 26)
- `src/lib/engine/rules.ts` (inline regex+semantic 280-337), `stage10-critique.ts`, `optimal-post.ts`, `audio-fingerprint.ts`, `trends.ts`, `wave3/aggregator.ts` (percentileLabel 117-123), `predicted-engagement.ts`
- `src/app/api/analyze/route.ts` (stage11 9,180; remix branch 274,805), `src/app/api/remix/adapt/route.ts`, `src/app/api/cron/retrain-ml/route.ts`
- `src/components/board/verdict/verdict-derive.ts:89`, `src/components/app/simulation/results-panel.tsx:160,206`, `insights-section.tsx:44,61`, `src/stores/simulation-store.ts`
- `tsconfig.json:38`, `vitest.config.ts:22-30`, `src/lib/engine/version.ts:9`, `scripts/measure-pipeline.ts`
- grep import-graph across `src/` (all dormant candidates + cross-imports)

### Project SSOT
- `.planning/ENGINE-MAP.md`, `.planning/phases/01-strip-to-senses/01-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`

## Metadata

**Confidence breakdown:**
- Import graph + call sites: HIGH — grep + line-level reads of every file.
- Blend separability: HIGH — read the full scoring math + selectWeights.
- CONTEXT corrections (stage11 location, rules split, calibration json, percentile source, maxRetries): HIGH — each contradicted assertion verified against source.
- UI null-degrade already-done status: HIGH — read each guard.
- Score-delta magnitude: MEDIUM — reasoned from weight redistribution; exact value needs the measure run.

**Research date:** 2026-06-04
**Valid until:** ~14 days (active codebase; line numbers drift on edits — re-grep symbols, not lines, at execution time).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Score delta will be small-but-nonzero (trends 0.10 redistribution) | Claim 4 / Pitfall 6 | If larger, it's a bigger honesty correction to document — not a blocker, but surface it. |
| A2 | `setAnalysisResult` / `derivePredictedEngagement` have no live callers | Claim 6 | Grep found none; if a dynamic/string-keyed caller exists, deleting strands it. Low risk — re-grep at execution. |
| A3 | Cron `retrain-ml` can be dormanted without breaking a deployed schedule | Open Q4 | If a Vercel cron is configured against it, disabling needs a vercel.json edit too. Verify cron config at execution. |
