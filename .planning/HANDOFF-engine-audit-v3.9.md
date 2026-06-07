# HANDOFF — Engine Audit Remediation (post-v3.9.0)

> Self-contained brief for a fresh session. Fixes the 4 tiers from the v3.9 engine audit.
> All findings below were **verified against source** (file:line confirmed) — not agent guesses.
> Author session: 2026-06-06. Branch: `milestone/engine-opt`.

## STATUS — shipped 2026-06-06 (update)

- ✅ **3.9.0 sighted perception** (omni-plus+video fold · 3.6-plus+video reason) — committed.
- ✅ **T1.1 fold→score** (commit `b5b35146`) — `overall_score` is now `0.5·apollo + 0.5·fold_audience` on video; text mode unchanged. Live: score 71→61. Regression test added. **ENGINE_VERSION 3.11.0.**
- ✅ **T3.2 phantom rule/trend injection removed** (commit `e08fd80a`) — dead Apollo prompt sections gone; Apollo output verified intact live.
- ✅ **T1.2 + T1.3 + T1.4 UI honesty** (commit `f1111513`) — Input + Score frames re-pointed off the dead "Top X%/PREDICTED RANK" framing onto the absolute predicted rates the engine actually emits (`behavioral_predictions.*_pct`) + intent-label chips; the board's "Projected views" range block CUT (formula off the score, not a measured view model); self-referential `parsePercentile` removed. Pure presentation (no scoring/prompt) → NO ENGINE_VERSION bump. **Visually verified live** against analysis `H4EwvOGMV0iu` (the digit-less "moderate intent" case): Input hero "PREDICTED COMPLETION 57% · Strong reach · Moderate intent", Score tiles render (Share 58%/Completion 57%/Comment 54%/Save 53% + intent), no "Projected views", 0 console errors. 469 board tests green.
- ✅ **T2.2 surface verbatim hook + fatal-flaw warnings** (commit `55212ea9`) — InsightHeroFrame now shows `verbatim.hook` as a "Your hook (as we heard it)" block above the rewrites (grounds the struck-through originals; verified live on H4EwvOGMV0iu) + `warnings[]` (DeepSeek Step-4 fatal flaws) as red bullets, filtering engine-status noise. Surfaced whenever real flaws exist (NOT gated on `anti_virality_gated` — that flag is ~never set, so gating on it kept flaws buried on weak videos). Flaw-bullet path is test-only verified (no prod row has apollo+warnings together). Pure presentation → no ENGINE_VERSION bump.
- ✅ **T2.1 promote Insight / demote Score** (commit `32250c08`) — DESKTOP: insight-hero now leads the lower-left+center block (was dead-last at the bottom); reordered GROUP_FRAMES + resolveBoardLayout + invariant tests; verified live (Insight top 241 above Content 454). MOBILE: insight-hero added to the card stack right after the video (was ENTIRELY ABSENT). "Score compact band" relative demotion delivered via reorder + Insight's own score band + T1.3 removing the projected-views block; true VerdictNode content-compaction (strip tabs/breakdown/distribution/history) DEFERRED — destructive, overlaps T4.5, and the frame is auto-height so a floor change is a visual no-op. Pure layout → no ENGINE_VERSION bump.
- ✅ **T3.1 + T3.3 + T3.4 Tier-3 prompt trims** (commit `59c61bd5`, **ENGINE_VERSION 3.12.0**) — bundled into one bump. **T3.1**: KNOWLEDGE_CORE runtime LEAN variant — dropped §2.6 (reserved/empty), §7 (defers to persona-registry), §8 (sources/provenance bookkeeping) + header provenance meta from the cached Apollo/decode/adapt system prefix. Craft layer §1–§6 byte-unchanged → scoring behavior unaffected (no A/B needed for a provenance-only cut). The §5→decode structural split stays DEFERRED (needs decode-consumer refactor + A/B). **T3.3**: `DeepSeekResponseSchema.behavioral_predictions` made `.optional()` + the prompt drops the 4-number ask on video runs (fold owns it; `videoUrl` presence gates); component_scores stays required. **T3.4**: niche/content-type hints moved from the omni SYSTEM prefix into the volatile USER message (`buildUserHints`) so the omni prefix-cache no longer busts per niche.
- ✅ **T1.5 degradation honesty** (commit `622d36df`, **ENGINE_VERSION 3.13.0**) — chose the **`analysis_unavailable` boolean flag** fork (user decision: contained blast radius, mirrors `anti_virality_gated`). REQUIRED field on `PredictionResult`, computed in aggregator as `!availability.gemini && !availability.behavioral` (the dual-failure condition). Board `VerdictNode` renders a distinct "Couldn't analyze this video" state (`verdict-unavailable` testid) in place of the fabricated 0 hero + its tiles/tabs. Reload route (`analysis/[id]`) derives the flag from the persisted `signal_availability` JSONB → no new DB column. Engine + UI tests added.
- ✅ **T4.4 dead-branch removal** (commit `ff2928af`, no version bump) — deleted `enrichedMatchedTrends`/`effectiveTrendEnrichment` (guarded by the now-always-null `audioFingerprintResult`; was byte-identical to the empty fallback every run). Downstream refs read `trendEnrichment` directly. Output byte-identical.
- ✅ **T4.5 number-soup reduction** (commit `ff2928af`, no version bump) — removed the Score frame's "Engine signals" tile row (`deriveSignalTiles` + tests). It restated the WEIGHTED persona-sim hook/completion numbers already owned by Content-craft (hook) + Audience (watch-through), forcing "weighted hold"/"weighted curve" disambiguation sub-labels. One owner per number now.
- ❌ **T4.1 + T4.2 + T4.3 — SKIPPED (obsolete/unsafe premise, documented).** Their "dead code, no behavior change" framing **predates the learning loop**, which resurrected the fields as live inputs:
  - **T4.1** (delete `feature_vector`): now consumed by `learning/predict.ts` + `label.ts` (leak-free training inputs), `creator-rulebook.ts` (`feature_vector.durationSeconds`), and the board reads `feature_vector.{niche,content_type,durationSeconds}` (`EngineGroup.tsx`, `ContentAnalysisFrame.tsx`). Deleting it breaks the learning loop AND the board's niche/type/duration display.
  - **T4.2** (drop the 6 constant score fields): `rule_score`/`trend_score`/`ml_score`/`retrieval_score`/`platform_fit` are read by `learning/predict.ts` + `fit-weights.ts` (feature reconstruction), the simulation components, `retrieval/bucket-derivation.ts`, and `platform_fit` by board `verdict-derive.ts`. Real blast radius, not hygiene.
  - **T4.3** (collapse `selectWeights` single-source branches): the "unreachable" branches ARE exercised by direct unit tests (`{behavioral:true, apollo:false}`) and are defensive guards — collapsing trades real coverage for cosmetic LOC.
- ⏳ **REMAINING:** nothing from the original 4 tiers is left actionable. Recommended NEXT verification before merge: **live E2E** (`npx tsx scripts/measure-pipeline.ts`) to (a) confirm Apollo still parses cleanly against the leaner §1–§6 core (T3.1), (b) confirm video-run Apollo tolerates the dropped behavioral_predictions ask (T3.3), and (c) measure the latency recovery the Tier-3 trims target. The legacy `simulation/EngagementRangeCard` still renders projected-views — separate non-board surface, out of scope. NOTE: a background auto-commit hook injects junk "test/feat: changes" commits — commit promptly with real messages.

## 0. Where things stand

**Current HEAD state (all committed + pushed, working tree clean):** `ENGINE_VERSION = 3.13.0`, **961 engine tests green** (board + engine suites: 1430 green).
- Engine: Read = `qwen3.5-omni-flash` · Fold = `qwen3.5-omni-plus` + **video** · Reason/Apollo = `qwen3.6-plus` + **video** (3.9.0). Fold folded into `overall_score` (T1.1, 3.10.0). Phantom Apollo-prompt injection removed (T3.2, 3.11.0).
- Live E2E: ~78s, score 61, 0 warnings.
- Git history is messy — a background auto-commit hook injected junk `"test/feat: changes"` commits between the real ones. **HEAD is correct** (verified); don't rebase (shared branch, concurrent session). When you work: **commit your own changes promptly with real messages** so the hook doesn't grab them.
- The earlier `.planning/*.md` `UU` merge conflicts are **RESOLVED** (working tree is clean now).

**Model facts (don't re-research):** omni-plus/flash = video+audio (only models that hear). qwen3.6-plus/flash = video+text, **NO audio**. qwen3-max = text-only. See memory `engine-model-assignment`.

**Cross-cutting rule:** every change to scoring math OR any prompt MUST bump `ENGINE_VERSION` (`src/lib/engine/version.ts`) to invalidate cached rows (L1 in-memory + L2 Supabase keyed on it). Update the 2 test pins (`version.test.ts`, `aggregator.test.ts` ~`:436`). Run `npx vitest run src/lib/engine` after each tier. **15 pre-existing tsc errors** in test/fixture files are NOT yours — ignore.

---

## 1. The 4 tiers (verified findings + tasks)

### TIER 1 — Honesty (engine shows dead chrome / fabricated numbers) — HIGHEST VALUE

**T1.1 — Fold the fold INTO `overall_score` ⭐ (the headline fix). ✅ DONE (commit `b5b35146`, ENGINE_VERSION 3.10.0).** **[M]**
> Shipped as `0.5·apollo_composite + 0.5·fold_audience` on video (fold_audience = 0.50·completion + 0.25·share + 0.15·save + 0.10·comment); text mode = Apollo-only fallback. Regression test added. Original analysis kept below for reference.
- VERIFIED: `aggregator.ts:785-796` `behavioral_score` = avg of Apollo's 7 `component_scores`; `:814` `apollo_score` = same call's `composite_score`; `:821-830` `raw_overall_score` blends only those two. The fold (`foldOutcome`/`personaBehavioralAggregate`) is **absent from score math**. `:744-748` `availability.behavioral` and `.apollo` are BOTH `deepseekResult !== null` → the `selectWeights` renorm can never split (theatre).
- The fold — just upgraded to omni-plus+video, the real audience sim — drives `behavioral_predictions` + heatmap (`:952-958`) but NOT the number creators see.
- **Change:** make `overall_score` a true ensemble of **expert read (Apollo composite)** + **simulated audience (fold)**. Recommended: replace the fake `behavioral_score` (Apollo component-avg) with a fold-derived 0-100 metric (e.g. `weighted_completion_pct`, or a blend of the persona aggregate's `watch_through` + `share_intent`). Net blend becomes `apollo_composite × w1 + fold_audience × w2`. Decide weights (start 0.5/0.5; the old 0.53/0.47 was arbitrary). Keep graceful fallback when fold absent (text mode → Apollo-only).
- **Acceptance:** score visibly moves when fold curves change; text mode degrades cleanly; `aggregator.test.ts` updated. Bump ENGINE_VERSION.
- **Watch:** this is the design-heavy one — do it FIRST, everything downstream displays this number.

**T1.2 — Delete the dead "PREDICTED RANK / Top X%" hero + percentile tiles.** **[M]**
- VERIFIED: engine emits digit-less intent labels (`wave3/aggregator.ts:117-123` `percentileLabel` → `"high intent"` etc, no digit). UI `input-derive.ts:5-9` `parsePercentile` regex-extracts a digit → returns `null` → `rankStatusWord(null)`=`"Predicted"` (`:62`), every tile `rank:null`. The Input frame hero (`InputResultCard.tsx:200-221`) is permanently `"Top —"`; Score behavioral tiles (`verdict-derive.ts:157-166`) `continue` to `[]`.
- **Change:** remove the "Top X%/PREDICTED RANK" framing entirely. Re-point Input + Score tiles to honest fields that exist: `behavioral_predictions.*_pct` (absolute predicted %) + the intent label as a qualitative chip (no fake rank). Files: `InputResultCard.tsx`, `input/input-derive.ts`, `verdict/verdict-derive.ts:121-166`.
- **Acceptance:** no `—` hero; no "Top X%" string anywhere; tiles show real % or honest intent chips.

**T1.3 — Cut (or honestly label) "Projected views lo–hi".** **[S]**
- VERIFIED: `aggregator.ts:1077` `predicted_engagement = computeEngagementRange(creatorContext, overall_score)`; `:182-231` = `followers × (score/100)² × 0.20` ± formula. No view model/corpus. `basis:"follower-tier × quality read"` exists but UI shows only "Medium confidence" (`VerdictNode.tsx:285-302`). (Note: `:431`/`:960` comments are STALE — the OLD jitter version was deleted; this is the R11 rebuild.)
- **Change (recommend CUT):** remove `predicted_engagement` from the board (VerdictNode) — it's the "invented engagement" layer VISION says must die, lightly rebuilt. If kept, surface the `basis` string so it reads as derived, not measured. Decision point — recommend cut.

**T1.4 — Kill self-referential percentiles.** **[S]**
- VERIFIED: `wave3/aggregator.ts:117-123` — `*_percentile` = bucket of the intent score it labels, not a corpus rank. The code comment (`:107-116`) admits the misleading semantics.
- **Change:** drop the `*_percentile` fields (or keep only as the qualitative chip from T1.2). Don't present as relative-to-other-videos.

**T1.5 — Degradation honesty.** **[S-M]**
- VERIFIED: fold gated on `omniSegments` (`pipeline.ts:707-711`) → text/tiktok_url mode skips audience sim but still ships a normal-shaped score. Dual Omni+Apollo failure → `behavioral_score=0`, `apollo_score=0`, weights `{0,0}` → `overall_score=0` (a confident "will flop"). `FALLBACK_BEHAVIORAL` (`aggregator.ts:937-946`) = zeros + `"N/A"`.
- **Change:** when both core signals dead → `overall_score = null` + distinct UI "couldn't analyze" state (not 0). Surface a prominent "text-only estimate" flag distinct from full-video confidence. Make fallback behavioral fields nullable so UI null-guards (already exist for engagement) catch them.

### TIER 2 — Buried value (the product is hidden) — HIGH VALUE

**T2.1 — Promote insight-hero to the top; demote Score to a compact band.** **[M]**
- VERIFIED: `board-constants.ts` — `verdict` (Score) at `x:864 y:0` (top-right, 952w, the visual hero); `insight-hero` at `x:0 y:1104` (**dead last, bottom**). VISION.md: *"insight is the hero."* `InsightHeroFrame.tsx` already self-demotes its band but the frame is buried on the canvas.
- **Change:** swap layout priority in `board-constants.ts` (`GROUP_FRAMES` bounds + `INITIAL_VIEWPORT`/camera presets) — insight-hero (`ceiling_capper` + `rewrites`) leads; verdict becomes a compact band. Effort = layout constants + camera presets + verify auto-height frames still fit.

**T2.2 — Surface computed-but-thrown-away signals.** **[M]**
- VERIFIED not-displayed: `verbatim.hook` (the exact judged line — only feeds Apollo rewrites server-side), `warnings[]` (the *fatal-flaw* text — only the derived `anti_virality_gated` bool surfaces), `reasoning`.
- **Change (cheap, high-trust):** show `verbatim.hook` as a "Your hook (as we heard it)" line atop the Insight frame so rewrites have visible grounding; render `warnings[]` as explicit red fatal-flaw bullets in the gated state. Files: `InsightHeroFrame.tsx`, the gated-state component.

### TIER 3 — Token/latency/cost (zero user-facing loss) — recovers the 78s budget

**T3.1 — Trim KNOWLEDGE_CORE.** **[M]** `apollo-core.ts:27-250`. ~7.4k tokens on every Apollo call (re-measure precisely via `tsx` — escaped backticks break naive char-count); ~40% is content the model is told to ignore: §2.6 ("Empty in v1"), §7 (defer to registry, not in call context), §8 (~2k chars IP/citation bookkeeping), §5 (Decode lens — Remix-only). Split a lean "scoring core" (§1, §2.0-2.5, §3, §4); move §5 to the Remix decode call (which imports `APOLLO_SYSTEM_PROMPT`). Keep byte-stability (no Date/random). Ensure §-number citations in the output contract still resolve. Bump ENGINE_VERSION.

**T3.2 — Strip phantom rule/trend injection. ✅ DONE (commit `e08fd80a`, ENGINE_VERSION 3.11.0)** — removed the Rule Matches + Trend Context prompt sections (creator_context kept). NOTE: `trend_alignment` was LEFT in the contract + `behavioralAvg` /7 (removing it is coupled to scoring math — deferred). Original below. **[S]** VERIFIED: `pipeline.ts:663-672` passes `rule_result:{rule_score:50}` + `trend_context:"…running in parallel"` (both stages DELETED) into Apollo; renders as "Rule Matches: None" + empty trend block (`deepseek.ts:284-297`), then asks for `component_scores.trend_alignment` (`:321`) the model guesses from nothing. Remove the Rule/Trend sections from `buildDeepSeekUserMessage` + `trend_alignment` from the contract + the fields from `DeepSeekInput`. (Note: `trend_alignment` feeds `behavioralAvg` at `aggregator.ts:792` — adjust the 7→6 component average.)

**T3.3 — Stop asking Apollo for `behavioral_predictions` on video runs.** **[S-M]** VERIFIED: `aggregator.ts:952-958` fold wins; Apollo's `behavioral_predictions` (`deepseek.ts:309-314`) is fallback-only on video. Make it `.optional()` in the schema / gate to text mode so Apollo doesn't spend output tokens + reasoning on 4 discarded numbers. Verify text-mode fallback still has a behavioral source.

**T3.4 — Make the Omni read prompt byte-stable.** **[S]** VERIFIED: `omni-analysis.ts:59-60` interpolates niche/content-type hints into the SYSTEM role → busts omni prefix-cache per niche. Move the 2 hint lines into the USER message. Cheap; omni input is $0.10/M so low $ impact but free win.

### TIER 4 — Dead code / type hygiene (no behavior change) — LOWEST RISK

- **T4.1** Delete `feature_vector` + `assembleFeatureVector` (`aggregator.ts:353-428`); ML consumer deleted, board reads only `{niche, content_type, durationSeconds}` (persist those directly). **[M]**
- **T4.2** Drop the 6 hardcoded constant "scores" from `PredictionResult`: `rule_score:50`, `trend_score:0`, `ml_score:0`, `retrieval_score:null`, `platform_fit:null`, `audio_fingerprint:null` (`:480-483,1080-1084,1090,1154`). Keep DB columns nullable for back-compat. **[S]**
- **T4.3** Collapse `selectWeights` 2-key renorm + the unreachable "weights redistributed" warning (`:256-273,870-880`) — both flags share one boolean. **[S]**
- **T4.4** Delete dead branches: `enrichedMatchedTrends`/`effectiveTrendEnrichment` (`:569-584`, guarded by always-null fingerprint). **[S]**
- **T4.5** Reduce number-soup: 3 different "hook" scores + 2 retention numbers across Score/Audience/Content-craft (`verdict-derive.ts:61-77` literally adds disambiguation sub-labels). Pick one owner each (Hook→Content-craft, Retention→Audience), drop Score's "Engine signals" tile row. **[M]**
- **T4.6** ✅ DONE (commit on `milestone/engine-opt`, 2026-06-07) — dropped the synthetic `sin(i*1.7)` flutter from `buildWaveBars`; the craft audio band now reflects only the real emotion-arc energy. Pure UI, no version bump. 51 tests green.
- Dormant modules (`_dormant/`: ml/rules/trends/retrieval/platform-fit/audio-fingerprint) confirmed zero live imports — safe to ignore or delete.

---

## 2. Recommended execution order (per-tier commits)

1. **Commit current 3.9.0 work first** (engine files only — NOT the `.planning` UU conflicts).
2. **T1.1 (fold→score)** — foundational; everything displays this number. Design weights, update tests, bump version.
3. **T1.2 + T1.3 + T1.4** — kill fabricated/dead UI surfaces (rank, engagement, percentile). Depends on final score shape.
4. **T1.5** — degradation honesty.
5. **T2.1 + T2.2** — board reorder + surface verbatim/warnings (insight-first).
6. **T3.1–T3.4** — prompt trims (bundle into ONE ENGINE_VERSION bump). Re-measure KNOWLEDGE_CORE first.
7. **T4.x** — dead-code cleanup (lowest risk, anytime).

## 3. Verification per change
- `npx vitest run src/lib/engine` (was 958 green) after every tier.
- `npx tsc --noEmit` — baseline has **15 pre-existing errors** in test/fixture files (EngagementRange fixtures, PersonaSlot fixtures, unused vars) NOT from engine source; don't chase them, just confirm no NEW source errors.
- Live E2E after scoring changes: `npx tsx scripts/measure-pipeline.ts` (watch `OVERALL_SCORE` moves with fold; latency).
- UI changes: the board renders via the analyze route → `Board.tsx`; screenshot/Playwright the score-mode board (authed `/analyze`).

## 4. Full audit reference
The complete 3-agent audit (LLM I/O + cache, pipeline + scoring, board + user value) with all evidence is in the originating session. Key consumer of the insight payload (don't break it): `src/lib/chat/seed-context.ts` + `seed-prompts.ts` read `dimensions/ceiling_capper/confidence_scope/rewrites/platform_note/suggestions`. Related memories: `engine-model-assignment`, `apollo-direction`, `engine-latency-optimization`.
