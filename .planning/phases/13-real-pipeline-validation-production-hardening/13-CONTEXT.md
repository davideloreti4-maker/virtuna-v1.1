# Phase 13: Real Pipeline Validation + Production Hardening - Context

**Gathered:** 2026-05-22
**Status:** Ready for UI-SPEC then planning

<domain>
## Phase Boundary

Real-video end-to-end validation is **the actual milestone acceptance gate** — Phase 12 text-mode benchmark is superseded as the wrong tool. The engine ships only after 10 real TikTok video uploads pass cleanly through the UI flow.

**Five concurrent deliverables:**

1. **Stage 11 rebuild** — counterfactuals/suggestions become the user-visible value-prop output. Video-grounded, signal-rich, always-on, adaptive per score band.
2. **Pipeline-wide Gemini audit** — verify model IDs resolve in production, drop `-preview` suffix, fix silent fallback paths.
3. **Caption-less engine audit** — primary user flow uploads video file without caption; engine must work from video bytes alone. Comprehensive audit catches every silently-degraded path.
4. **Pipeline cleanup + optimization** — fold Wave 0 niche into Gemini, share `fileUri` across stages, lift upload cap, re-tune signal weights for video-mode reality.
5. **1 → 5 → 10 real video E2E validation** — user uploads via UI, Claude diffs prediction vs post-publish metrics (manual fetch, no Apify dep at this scale). Iterate and fix.

**Only after 10 videos pass:** `ENGINE_VERSION` flip `3.0.0-dev` → `3.0.0`, milestone `milestone/engine-foundation` merges to `main`.

**Out of scope:**
- New UI features (M2 — Intelligence Surface)
- Retraining ML signal (M2 — needs post-publish engagement training)
- Retrieval corpus re-embedding from video features (M2 — ~$2300 compute lift, not blocking)
- Rules signal rebuild from video transcript (M2)
- CHANGELOG / release notes (no ceremony needed)
- Phase 12 text-mode benchmark (superseded — archived as historical)

</domain>

<decisions>
## Implementation Decisions

### Stage 11 Rebuild (the value prop)

- **D-01: Video-grounded via Wave 1 `fileUri` reuse.** Wave 1 already uploads the video once and keeps `fileUri` persistent through `ai.files.upload()` (Google Files API, 48h TTL). Stage 11 sends a NEW Gemini call referencing the same `fileUri` + full signal context. Zero re-upload cost. Stage 11 actually "sees" the video while reasoning.

- **D-02: Model = `gemini-3.1-pro`.** Replaces `deepseek-v4-flash`. Flagship reasoning, 2M context window, ~$0.13/analysis. This is the user-visible value output — worth the cost. Sidesteps DeepSeek hang risk for the most important suggestion surface.

- **D-03: Full signal context in the prompt.** Stage 11 receives all of:
  - Gemini factor scores per factor (which of the 5 failed/passed)
  - Fired rules (`matched_rules[]` from rule scoring) — note: rules signal itself is being disabled, but if any survive in video-derived form they enter
  - Trend matches (`matched_trends[]` from trend enrichment, audio-based)
  - Persona dissent rate (Wave 3, ≥7-of-10 threshold + dissent flags)
  - Platform fit per platform (Wave 4 TikTok/IG/YT)
  - Hook decomposition (when available from Wave 1)
  - Full DeepSeek reasoning (no 500-char truncation — previous bug)
  - Video access via `fileUri`

- **D-04: Skip removed.** No more `overall_score >= 70` short-circuit at `stage11-counterfactuals.ts:66`. Stage 11 always runs.

- **D-05: Adaptive shape per score band.**
  - `<50` → 3 hyper-specific fixes (ranked by impact). Framing: "what to change"
  - `50-70` → 2 fixes + 1 reinforcement of strongest signal. Framing: "improvements + what's working"
  - `≥70` → 1 stretch optimization + 2-3 "what's working" reinforcements tied to specific factors. Framing: "what's working" + "to push higher"

- **D-06: Replace the legacy suggestions surface.** `<SuggestionsSection>` reads `result.counterfactuals.suggestions` (Stage 11) NOT `result.suggestions[]` (legacy per-stage stream). Legacy `result.suggestions[]` becomes internal-only — feeds the Stage 11 prompt as additional context, never user-visible. Section header adapts per band per D-05.

- **D-07: UI-SPEC pass before planning.** Run `/gsd-ui-phase 13` after this CONTEXT.md to produce a `UI-SPEC.md` for the rebuilt suggestions section — adaptive band visual treatment, fix/strength/stretch type indicators, timestamp anchors (when available), Raycast aesthetic per `CLAUDE.md`. Then `/gsd-plan-phase 13`.

### Pipeline-Wide Gemini Model Assignment

- **D-08: Model split by task complexity.**
  | Stage | Model |
  |---|---|
  | Wave 0 content-type + niche (folded) | `gemini-3.1-flash-lite` |
  | Wave 1 hook segment | `gemini-3.1-pro` |
  | Wave 1 body segment | `gemini-3-flash` |
  | Wave 1 CTA segment | `gemini-3-flash` |
  | Stage 11 counterfactuals | `gemini-3.1-pro` |

  Total ~$0.26 Gemini cost per analysis (+ ~$0.05 DeepSeek = ~$0.31).

- **D-09: Drop `-preview` suffix from all model IDs.** All listed models are GA as of 2026-05. Plan 1 includes a single live probe call per slot, asserts `response.model === requested.model`, fails loudly on mismatch.

- **D-10: Investigate Gemini silent-fallback to 2.5.** User observed 3.x calls falling back to 2.5. Likely sources: (a) Google SDK substituting unknown IDs, (b) `gemini/cost.ts:50-52` legacy `GEMINI_MODEL` pinning for cost calc misleading telemetry, (c) `gemini.ts:185` calculateCost shim pinning `GEMINI_MODEL=gemini-2.5-flash`. Plan 1 task: response-model inspection in a self-test script.

### Caption Demotion + Three-Mode Engine Contract

- **D-11: Caption demoted to non-signal.** Engine derives predictions from video bytes only. Caption (when present in any mode) is stored for record but ignored by all derivation stages. User insight: "users upload tiktok videos and just type something random or emojis or hashtags" — caption is low-trust regardless of mode.

- **D-12: Three modes, contract per mode.**
  - `video_upload` (PRIMARY 90%+) — full pipeline, caption ignored. Video bytes only.
  - `tiktok_url` (minority) — full pipeline + post-publish metrics fetch for self-calibration; caption still ignored.
  - `text-only / script` (minority) — graceful degraded prediction. `signal_availability` chips show every visual signal as ✕. Output is best-effort from text content only. Phase 11 D-02 chip list pattern handles this.

- **D-13: Comprehensive Plan 1 caption-less audit.** Produces `AUDIT-CAPTION-LESS.md` cataloguing every stage that reads `payload.content_text` / `caption` / similar, with fix-or-document verdict per stage. Gates any E2E test run. Avoids the silent-degradation pattern that bit phases 9-12.

### Signal Weight Re-Tuning (Video-Mode Reality)

- **D-14: Rules signal disabled (weight=0).** All 17 regex-tier rules in `rules.ts:138-171` operate on caption text. Without caption: every rule returns false. Signal is dead-weight in the primary flow. Mirrors ML disable pattern (Phase 10 D-05). M2 = rebuild rules from video transcript.

- **D-15: Retrieval signal disabled (weight=0).** Embedder subject text formula at `retrieval/embedder.ts:116` = `[niche:{slug}] @{handle}: {caption}\n{hashtags}` — caption-derived. Without caption, query embedding is sparse, corpus cosine matches unreliable. Corpus itself (7614 rows) potentially sloppy from DeepSeek-executed Phase 8. M2 = re-embed from video features (~$2300 compute).

- **D-16: Re-tuned weights.**
  ```
  behavioral:   0.40  (primary CoT, video-aware via Wave 2 input)
  gemini:       0.35  (now drives Stage 11 too; video understanding is core)
  audio:        0.10  (real audio signal, more important in primary flow)
  trends:       0.10  (audio-fingerprint based, video-derived)
  platform_fit: 0.05  (video-derived from Wave 4)
  ml:           0     (disabled — Phase 10)
  retrieval:    0     (disabled this phase — D-15)
  rules:        0     (disabled this phase — D-14)
  ```
  Sum = 1.00. Update `SCORE_WEIGHTS` in `aggregator.ts:53`. Honest engine — ships only with signals that work.

### Pipeline Optimizations

- **D-17: Fold Wave 0 niche detector into Gemini.** `wave0/niche-detector.ts:62` currently calls DeepSeek with caption text. Won't work for caption-less video. Extend `wave0/content-type-detector.ts` schema to return `{ content_type, content_type_confidence, niche, niche_confidence }` in a single Gemini call. Removes 1 of 6 DeepSeek call sites, saves ~50-100ms latency. After migration: `wave0/niche-detector.ts` can be deleted.

- **D-18: Share `fileUri` across stages.** Currently `wave0/content-type-detector.ts:123` + Wave 1 segments + (new) Stage 11 each call `ai.files.upload()`. Three uploads of the same video per analysis. Refactor: upload once at pipeline entry, pass `fileUri` through context to every stage. Saves bandwidth + Files API quota.

- **D-19: Lift upload cap to 287MB.** `VIDEO_MAX_SIZE_BYTES` in both `gemini.ts:40` and `gemini/segmented.ts:43` currently `50MB`. Real TikTok videos commonly 100-287MB. Gemini File API itself supports up to 2GB — the 50MB cap was self-imposed. Bump to 287MB (TikTok max known).

- **D-20: Cost budget $0.40 per analysis.** Replaces obsolete $0.075 BENCH-03 target (which was text-mode-only). Per-analysis cap enforced via existing `maxTotalCostCents` pattern in `eval-runner.ts`. Buffer over $0.31 estimate for outlier-size videos.

### Infrastructure Hardening

- **D-21: Gemini self-test upfront (Plan 1).** Build `scripts/engine-self-test.ts` — hits each Gemini slot (Wave 0, hook, body, CTA, Stage 11) with a 1-token probe, asserts `response.model === requested.model`, fails loudly on mismatch. Gate before any E2E run.

- **D-22: DeepSeek hang mitigation deferred to first manifestation.** Don't pre-build mitigation. Focus area: `deepseek-reasoner` (Wave 2, the 30-60s call), not `deepseek-v4-flash` (fast calls rarely hang). When hang first manifests during 1-video E2E, add `gtimeout`-style kill path at that call site as a targeted fix. Pragmatic — don't over-engineer ahead of evidence.

- **D-23: Cache invalidation on ENGINE_VERSION flip (CRITICAL).** Phase 3 caching layer keys on content hash + persona prompt + niche taxonomy. With Stage 11 logic + signal weights + Wave 0 changing, cached results from `3.0.0-dev` MUST be invalidated on flip. Plan task: verify `engine_version` is a cache key component; bust cache on flip. Without this: production users hit stale predictions post-merge.

- **D-24: Pre-existing 1191 tests need update (CRITICAL).** Many tests assert specific rule firings, suggestion shapes, caption-dependent paths. With D-11 + D-14 + D-15 + D-16: mass failures expected. Plan 1 audit includes explicit "test update" task — not a casual cleanup. CI red blocks milestone merge.

### Acceptance Gate

- **D-25: 1 → 5 → 10 real video cadence through the UI.** Pace:
  - User downloads TikTok video locally → uploads via Virtuna UI (real user flow)
  - Engine produces prediction
  - User pastes source TikTok URL back
  - Claude fetches the URL (WebFetch — no Apify dep at this scale), extracts post-publish metrics
  - Diff report written to `.planning/phases/13-.../validations/video-NN.md`
  - Per-video pass = crash-free + signal-completeness checklist + user thumbs-up on suggestion relevance

- **D-26: Video set strategy: user-picked, score-band stratified.** Loose target across 10 videos: 3-4 expected low-scorers (engine should flag issues), 3-4 expected high-scorers (engine should reinforce + give stretch), 2-3 mid-tier. Across at least 3 niches. Exercises Stage 11 adaptive bands D-05.

- **D-27: ENGINE_VERSION flip ONLY after 10 videos pass.** `src/lib/engine/version.ts` stays at `3.0.0-dev` until all 10 pass. Avoid revert risk. Carries Phase 11 D-06 + Phase 12 D-03.

- **D-28: User is the gate for milestone merge.** After 10 videos pass + Claude writes a final summary report, user gives explicit go-ahead before `milestone/engine-foundation` merges to `main`. Carries Phase 12 D-04 + D-07.

### Phase 12 Reconciliation

- **D-29: Archive Phase 12 as superseded.** ROADMAP.md marks Phase 12 status = "Superseded by Phase 13". Keep:
  - `--max-rows` flag in `scripts/eval.ts` (utility)
  - `platt_parameters` DB row (flag as "text-mode-trained, video-mode re-train pending")
  - All `12-*.md` planning artifacts (historical record, no deletion)

  Discard:
  - `.planning/research/smoke-v3.json` (invalid — force-disabled DeepSeek + text-mode)

  Update: `12-HANDOFF.md` closing note pointing forward to Phase 13.

### SignalAvailability Chip Three-State Semantics

- **D-30: Chip list distinguishes three states.** Update Phase 11 chip list to render:
  - `✓ Behavioral` — available, contributed
  - `✕ ML` — intentionally disabled (M1 design choice)
  - `⚠ Audio` — failed/unavailable for THIS video (e.g., audio fingerprint upload error)

  Rolls into `/gsd-ui-phase 13` design contract. Current chip list (Phase 11 D-02) only handles ✓/✕.

### Earlier-Phase Verification (Folded into Phase 13)

- **D-31: tiktok_url flow verification.** Phase 13 includes at least 1 `input_mode = "tiktok_url"` video in the 10-video cadence. Verifies the URL → scrape → analyze path that hasn't been E2E tested.

- **D-32: trending_sounds DB population check.** Audio signal (weight bumping 0.07 → 0.10) cosine-matches against `trending_sounds` table. Verify population has real data before relying on the bumped weight; if sparse, the bump is meaningless.

### Claude's Discretion

- Exact `engine-self-test.ts` CLI shape (single command vs subcommands per slot)
- Specific `AUDIT-CAPTION-LESS.md` structure (per-stage table vs flat findings list)
- Whether to introduce a shared `videoFileUri` field on the pipeline context or pass as function arg
- Per-band suggestion shape Zod schema details (single vs discriminated-union schema)
- Exact `WebFetch` prompt for TikTok metric extraction (will iterate per video)
- DeepSeek hang kill-path implementation when it manifests (gtimeout subprocess vs in-process timeout cascade)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase & Milestone
- `.planning/ROADMAP.md` §301-322 — Phase 13 definition (added 2026-05-22); supersedes Phase 12 acceptance gate
- `.planning/MILESTONE.md` — Engine Foundation milestone identity
- `.planning/STATE.md` — Current progress state
- `.planning/REQUIREMENTS.md` — Milestone requirements (note: BENCH-01..06 from Phase 12 superseded for video pipeline)

### Prior Phase Decisions (carries-forward)
- `.planning/phases/11-existing-ui-integration-privacy-policy/11-CONTEXT.md` §D-01 (score+availability only M1), §D-02 (chip list pattern — to be extended per D-30), §D-06 (ENGINE_VERSION flip deferred to gate)
- `.planning/phases/12-accuracy-benchmark-acceptance-gate/12-CONTEXT.md` §D-03 (flip after gate passes), §D-04 (user gate near-miss), §D-05 (hard gate on negative signals), §D-07 (user reviews before merge)
- `.planning/phases/12-accuracy-benchmark-acceptance-gate/12-HANDOFF.md` — Phase 12 abandonment context (will be updated with closing note per D-29)
- `.planning/phases/10-ml-audit-calibration-aggregator-extension/10-CONTEXT.md` — ML disabled rationale; Platt calibration approach (text-mode params kept per D-29)
- `.planning/phases/09-platform-algo-fit-self-critique-counterfactuals/` — Phase 9 sets the Stage 11 contract being rebuilt here

### Key Source Files (to be modified)
- `src/lib/engine/pipeline.ts` — pipeline orchestrator; will gain shared `fileUri` context per D-18
- `src/lib/engine/aggregator.ts:53` — `SCORE_WEIGHTS` update per D-16
- `src/lib/engine/aggregator.ts:1066-1067` — Stage 11 invocation site
- `src/lib/engine/stage11-counterfactuals.ts` — full rebuild per D-01..D-06
- `src/lib/engine/stage11-counterfactuals-prompts.ts` — schema + prompt rebuild
- `src/lib/engine/gemini.ts:34-36` — drop `-preview` suffix per D-09; lines 28, 185 — cost calc legacy `GEMINI_MODEL` pinning per D-10
- `src/lib/engine/gemini.ts:40` + `src/lib/engine/gemini/segmented.ts:43` — `VIDEO_MAX_SIZE_BYTES` → 287MB per D-19
- `src/lib/engine/wave0/content-type-detector.ts` — extend schema per D-17 (fold niche)
- `src/lib/engine/wave0/niche-detector.ts` — deletable after D-17 fold
- `src/lib/engine/rules.ts:53` (SCORE_WEIGHTS reference) — rules signal disabled per D-14
- `src/lib/engine/retrieval/embedder.ts:116` — caption-derived subject text; retrieval disabled in this phase per D-15, M2 rebuild
- `src/lib/engine/version.ts` — `ENGINE_VERSION` flip after gate per D-27
- `src/components/app/simulation/results-panel.tsx:207` — wire `result.counterfactuals.suggestions` per D-06
- `src/components/app/simulation/insights-section.tsx` (`SuggestionsSection`) — rebuild per UI-SPEC produced by D-07
- `src/components/viral-results/ViralScoreRing.tsx` — chip list three-state per D-30
- `src/app/api/analyze/route.ts` — verify `engine_version` cache key per D-23

### External Documentation
- Gemini API model lineup (May 2026) — Gemini 3.1 Pro/Flash-Lite, 3 Pro/Flash GA pricing — verified via WebSearch this session
- Google Files API — 48h TTL, 2GB max per file, `fileUri` persistence

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ai.files.upload()` + persistent `fileUri`** at `gemini.ts:515-540` — already used by Wave 1 segments. Stage 11 reuses same `fileUri` per D-01. Pattern proven at 48h TTL.
- **`videoMetadata: { startOffset, endOffset }`** — sibling of `fileData` in same parts[] object (per `hook-segment.ts:103` comment). Pattern can be reused by Stage 11 if it wants to focus on specific video segments.
- **`isCircuitOpen()`** from `deepseek.ts:741` — already implemented circuit breaker. Stage 11 currently calls it at line 75. After move to Gemini, no longer needed for Stage 11; remaining DeepSeek call sites can keep using it.
- **`scripts/eval.ts` `--max-rows` flag** (added by Phase 12) — kept as utility per D-29.
- **Apify TikTok scraper pattern** at `src/lib/engine/corpus/apify-jobs.ts` + `import-apify-data.ts` — NOT used in Phase 13 (Claude WebFetch per D-25 for the 10-video sample), but available for `tiktok_url` mode if needed.

### Established Patterns
- **Stable system prompt + volatile user message** for DeepSeek cache hits — `stage11-counterfactuals-prompts.ts:22-38` pattern. Stage 11 rebuild keeps this pattern when migrating to Gemini.
- **Signal availability tracking** in `aggregator.ts` via `signal_availability` field + chip list. Extend per D-30 for three-state.
- **Weight redistribution** in `aggregator.ts` `selectWeights()` — normalizes when sources unavailable. Already handles `rules=0` + `retrieval=0` per D-14 + D-15 if values change at runtime; D-16 makes those the locked default.
- **Stage event emission** via `emitStageStart` / `emitStageEnd` — Stage 11 keeps emitting for observability.
- **Zod boundary validation** — `CounterfactualsResponseSchema` pattern. Adaptive shape per D-05 needs schema rebuild (likely discriminated union by band).

### Integration Points
- **Pipeline context flow** — `runPredictionPipeline` orchestrates Wave 0 → 1 → 2 → 3 → 4 → aggregate → Stage 10 → Stage 11. Shared `fileUri` (D-18) threads through this context.
- **`PredictionResult.counterfactuals`** field at `types.ts:229` — already typed. Just needs UI consumer wired per D-06.
- **`SuggestionsSection`** in `results-panel.tsx:207` — currently reads `result.suggestions[]`. Rewrite to read `result.counterfactuals.suggestions` per D-06.
- **`CounterfactualResult` interface** at `types.ts:296-297` — schema-extend for adaptive shape per D-05.
- **Cache layer** (Phase 3) — verify `engine_version` is a key component per D-23.
- **`signal_availability` chip list** rendering site — needs three-state per D-30.

</code_context>

<specifics>
## Specific Ideas

- **Validation diff format** (per D-25): each video gets `validations/video-NN.md` with:
  - Section 1: prediction (overall_score, factor scores, signal_availability, Stage 11 suggestions)
  - Section 2: actuals (views, likes, shares, comments, completion %)
  - Section 3: diff analysis (was the prediction directionally right? did Stage 11 suggestions match obvious issues?)
  - Section 4: signal-by-signal calibration check

- **`AUDIT-CAPTION-LESS.md` shape** (per D-13): table of every stage entry point, columns:
  - Stage name + entry file:line
  - Reads `content_text` / caption? (yes/no)
  - Current behavior when text empty (degrades gracefully / throws / returns null / silent default)
  - Verdict (fix / accept-as-graceful / disable)
  - Fix scope estimate (lines / files / hours)

- **Adaptive shape Zod schema** (per D-05): likely discriminated union by `band: "low" | "mid" | "high"` with band-specific item shapes. Plan stage will finalize.

- **Suggestion item shape** (per D-05/D-06): each item carries `type: "fix" | "stretch" | "reinforcement"` + `headline` + `detail` + `timestamp_ms?` + `signal_anchor` (which Gemini factor / rule / signal grounds this item). UI renders type → badge/color per UI-SPEC.

- **Claude metric fetch pattern**: WebFetch the TikTok URL → extract metadata blob from page (TikTok embeds analytics in HTML for public videos) → fall back to user-pasted screenshot if scrape blocked. Will iterate per-video.

</specifics>

<deferred>
## Deferred Ideas

- **Re-embed corpus from video features** — M2. ~$2300 Gemini cost + ~4-6h compute for 7614 rows. Required for retrieval signal to come back online for primary user flow.
- **Rebuild rules from video transcript** — M2. All 17 regex-tier rules are caption-pattern-based; need a video-derived equivalent (transcript-keyed + visual-derived signals).
- **Retrain Platt calibration on video-mode predictions** — M2 or later. Current Platt params (Phase 12) were trained on 79 text-mode rows; video-mode predictions have different distribution.
- **Granular Sentry surface for model mismatch** — flagged but not in Phase 13 scope. The Plan 1 self-test handles startup verification; runtime alerting can be added in M2 if drift becomes a concern.
- **Caching scope for Stage 11 across users** — Stage 11 calls Gemini per analysis. Could cache by content hash + signal context hash to dedupe across users uploading the same video. M2.
- **Pre-upload compression / video trimming UX** — for videos > 287MB. M2.
- **Tighter cost budget once 10-video data lands** — D-20 sets $0.40 as a buffer-heavy initial; can re-tune in M2 after real distribution data.
- **TikTok URL flow auto-fetches actuals for the user** — currently `tiktok_url` mode predicts but doesn't surface live engagement to the user. Could add an "Actuals" panel in M2.

</deferred>

---

*Phase: 13-Real Pipeline Validation + Production Hardening*
*Context gathered: 2026-05-22*
