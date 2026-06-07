# HANDOFF — Engine Audit Remediation (post-v3.9.0)

> Self-contained brief for a fresh session. Fixes the 4 tiers from the v3.9 engine audit.
> All findings below were **verified against source** (file:line confirmed) — not agent guesses.
> Author session: 2026-06-06. Branch: `milestone/engine-opt`.

## 0. Where things stand

**Just shipped this session (UNCOMMITTED — commit first):** sense-complete perception, ENGINE_VERSION 3.8.0→**3.9.0**.
- Read = `qwen3.5-omni-flash` (unchanged) · Fold = `qwen3.5-omni-plus` + **video** · Reason/Apollo = `qwen3.6-plus` + **video**.
- Files modified: `wave3/fold-prompts.ts`, `wave3/fold.ts`, `pipeline.ts`, `deepseek.ts`, `version.ts` + 2 test version-pins (`__tests__/version.test.ts`, `__tests__/aggregator.test.ts`).
- Live E2E verified: 78.3s, score 71, 0 warnings, 958 engine tests pass.
- ⚠️ `.planning/MILESTONES.md` + `.planning/PROJECT.md` have **pre-existing `UU` merge conflicts** — DO NOT `git stash`/`git add -A`. Commit ONLY the engine source/test files explicitly. (See memory `git-autocommit-during-merge`.)

**Model facts (don't re-research):** omni-plus/flash = video+audio (only models that hear). qwen3.6-plus/flash = video+text, **NO audio**. qwen3-max = text-only. See memory `engine-model-assignment`.

**Cross-cutting rule:** every change to scoring math OR any prompt MUST bump `ENGINE_VERSION` (`src/lib/engine/version.ts:38`) to invalidate cached rows (L1 in-memory + L2 Supabase keyed on it). If shipping this whole remediation in one batch, **one cumulative bump** (3.9.0→3.10.0) + update the 2 test pins (`version.test.ts:10`, `aggregator.test.ts:436`). Run `npx vitest run src/lib/engine` after each tier.

---

## 1. The 4 tiers (verified findings + tasks)

### TIER 1 — Honesty (engine shows dead chrome / fabricated numbers) — HIGHEST VALUE

**T1.1 — Fold the fold INTO `overall_score` ⭐ (the headline fix).** **[M]**
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

**T3.2 — Strip phantom rule/trend injection.** **[S]** VERIFIED: `pipeline.ts:663-672` passes `rule_result:{rule_score:50}` + `trend_context:"…running in parallel"` (both stages DELETED) into Apollo; renders as "Rule Matches: None" + empty trend block (`deepseek.ts:284-297`), then asks for `component_scores.trend_alignment` (`:321`) the model guesses from nothing. Remove the Rule/Trend sections from `buildDeepSeekUserMessage` + `trend_alignment` from the contract + the fields from `DeepSeekInput`. (Note: `trend_alignment` feeds `behavioralAvg` at `aggregator.ts:792` — adjust the 7→6 component average.)

**T3.3 — Stop asking Apollo for `behavioral_predictions` on video runs.** **[S-M]** VERIFIED: `aggregator.ts:952-958` fold wins; Apollo's `behavioral_predictions` (`deepseek.ts:309-314`) is fallback-only on video. Make it `.optional()` in the schema / gate to text mode so Apollo doesn't spend output tokens + reasoning on 4 discarded numbers. Verify text-mode fallback still has a behavioral source.

**T3.4 — Make the Omni read prompt byte-stable.** **[S]** VERIFIED: `omni-analysis.ts:59-60` interpolates niche/content-type hints into the SYSTEM role → busts omni prefix-cache per niche. Move the 2 hint lines into the USER message. Cheap; omni input is $0.10/M so low $ impact but free win.

### TIER 4 — Dead code / type hygiene (no behavior change) — LOWEST RISK

- **T4.1** Delete `feature_vector` + `assembleFeatureVector` (`aggregator.ts:353-428`); ML consumer deleted, board reads only `{niche, content_type, durationSeconds}` (persist those directly). **[M]**
- **T4.2** Drop the 6 hardcoded constant "scores" from `PredictionResult`: `rule_score:50`, `trend_score:0`, `ml_score:0`, `retrieval_score:null`, `platform_fit:null`, `audio_fingerprint:null` (`:480-483,1080-1084,1090,1154`). Keep DB columns nullable for back-compat. **[S]**
- **T4.3** Collapse `selectWeights` 2-key renorm + the unreachable "weights redistributed" warning (`:256-273,870-880`) — both flags share one boolean. **[S]**
- **T4.4** Delete dead branches: `enrichedMatchedTrends`/`effectiveTrendEnrichment` (`:569-584`, guarded by always-null fingerprint). **[S]**
- **T4.5** Reduce number-soup: 3 different "hook" scores + 2 retention numbers across Score/Audience/Content-craft (`verdict-derive.ts:61-77` literally adds disambiguation sub-labels). Pick one owner each (Hook→Content-craft, Retention→Audience), drop Score's "Engine signals" tile row. **[M]**
- **T4.6** Drop/relabel the synthetic `sin(i*1.7)` waveform bars (`content-analysis-derive.ts:384-392`) — keep the real energy-grading. **[S]**
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
