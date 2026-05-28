# Phase 15: Calibration Refit on Qwen Corpus - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 15-calibration-refit-on-qwen-corpus
**Areas discussed:** Approach selection, Wave 3/4 threshold semantics

---

## Approach Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Delegate to Claude (Phase 14 pattern) | Live-state research + Claude decisions + objection-surface; discuss inline so user can follow | ✓ |
| Discuss key gray areas | Walk 3-4 implementation decisions with user driving | |
| Skip discuss — go straight to plan | Phase well-scoped by REQUIREMENTS/ROADMAP alone | |

**User's choice:** "option 1 and then discuss with me so I can follow properly"
**Notes:** Hybrid mode — Claude decides, narrates findings + recommendations inline, asks only on genuine ambiguity.

---

## Wave 3 Threshold Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 7/10; validate empirically only | SUCCESS_THRESHOLD=7 is parse-success gate, not score-distribution. Validate empirically, leave constant | |
| Re-interpret as VIRAL_SCORE_CUT/UNDER_SCORE_CUT tune | Real score-distribution knob lives in eval-config.ts. Re-tune those, document REQ misread | |
| Both — validate 7/10 AND tune score-cuts | Validate parse-rate AND re-derive score-cuts from Qwen distribution | ✓ |

**User's choice:** "Yes, lock all three (Recommended)" (composite answer covering both Wave 3 and Wave 4)
**Notes:** User initially uncertain about the distinction. Claude explained:
- `SUCCESS_THRESHOLD=7` in `wave3.ts:38` is a parse-success gate (how many of 10 LLM calls returned valid JSON), unrelated to score distribution
- Real score-distribution knobs are `VIRAL_SCORE_CUT=70` and `UNDER_SCORE_CUT=30` in `eval-config.ts`
- "Re-tune for Qwen score distribution" only makes semantic sense for the score-cuts
- Recommendation: tune the score-cuts (real knob), empirically validate SUCCESS_THRESHOLD (cheap check), document REQ wording mismatch

User locked the recommended composite.

---

## Wave 4 Threshold Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Re-tune the weight (currently 0.05) | Sensitivity sweep on SCORE_WEIGHTS.platform_fit | ✓ |
| Introduce fit_score floor | Add numeric cutoff so platform_fit only contributes when ≥N | |
| Both — floor + weight sweep | Floor + sweep, more thorough but doubles tuning surface | |
| Skip Wave 4 tune — mark CALIB-03 partial | Defer to future phase, only Wave 3 in this phase | |

**User's choice:** "what do you think?"
**Notes:** Claude's recommendation accepted via composite "lock all three" answer above:
- Aggregator has NO numeric platform_fit threshold today — only a weight (`SCORE_WEIGHTS.platform_fit = 0.05`) on `mean(fit_scores)`
- The only numeric knob present is the weight
- Re-tune the weight via 0.03/0.05/0.07/0.10 sweep — same calibration pattern as score-cuts
- Document "threshold = weight" interpretation in CONTEXT.md so audit trail is clean

---

## Claude's Discretion

- Exact wording / structure of `qwen-stratified-validation.md` beyond required content checklist
- Whether to split migration into one plan or fold into 15-02
- Default rate-limit delay for Qwen rerun (M1 used 2s; Qwen may tolerate less)
- Persona success-count log format (Sentry breadcrumb vs. new logger.info line)

## Deferred Ideas

- Re-scrape corpus / new corpus_version (defer to future "Corpus Refresh" phase)
- Cron `calibration-audit` retraining path verification (defer to Phase 18 VERIF)
- Per-niche Platt parameters (structural change; defer)
- fit_score floor as availability gate (rejected — capture as tech-debt if needed)
- Persona success-rate auto-tune of SUCCESS_THRESHOLD (rejected — deliberate constant change is its own phase)
- VIRAL_SCORE_CUT/UNDER_SCORE_CUT per-niche (structural change; defer)

---

## 2026-05-24 — PHASE HALTED MID-EXECUTION (post-15-01)

**Trigger:** Operator question before Plan 15-02 kickoff: "lets only do a the run on 20 video, are we actually using the videos not only text"

**Finding (load-bearing):** `src/lib/engine/corpus/eval-runner.ts:113-119` builds `AnalysisInput` with `input_mode: "text"` and `content_text: row.caption`. `runPredictionPipeline` (`src/lib/engine/pipeline.ts:395-411`) only calls `analyzeVideoWithOmni` (which sends Qwen-Omni `type: "video_url"`, `omni-analysis.ts:151`) when `input_mode === "video_upload"` AND a `signedVideoUrl` is generated from Supabase Storage.

**Consequence:** Phase 15 as planned would calibrate Platt parameters against **text-only Qwen scoring TikTok captions**, then store those `(a, b)` for `aggregator.ts:844-846` to apply to **video-mode (Omni-Plus) predictions** in production `/api/analyze`. Calibration source ≠ calibration target. The fitted parameters would be a category error.

**eval-runner comment acknowledges the gap** (`eval-runner.ts:108-111`): "Phase 1 uses text-mode evaluation … corpus does not store raw video bytes … Re-fetching via tiktok_url would multiply cost+latency; deferred to Phase 10/12." — That deferral was never resolved before Phase 15 was planned.

**Operator decision:** "we need to rescope and frame to the actual e2e production engine otherwise it doesn't make sense" → halt and rescope.

**Phase 15 state at halt:**
- 15-01 LANDED on `milestone/engine-hardening` (engine_version discriminator across DB, types, query, CLI). Self-contained and useful regardless of rescope path. Tracking updated.
- 15-02, 15-03, 15-04 NOT executed. No live spend incurred.
- Live Supabase: 1 row in `platt_parameters` with `engine_version='2.1.0'`-style historical; the v3.0.0 row was NEVER inserted (no train-platt run happened).

**Rescope options for the next discuss-phase:**

| Option | Description | Scope |
|--------|-------------|-------|
| A. Pre-phase: video-mode eval-runner | Insert phase 14.5 (or 15a) — extend `eval-runner.ts` to accept `video_url` directly OR add tiktok_url → Supabase Storage uploader, then keep 15-02..15-04 contract as-is but running on actual video path | Medium (eval-runner + storage plumbing; ~1 dev day) |
| B. Rescope phase 15 entirely | Fold video-mode eval-runner into a new 15-01.5 plan; existing 15-02/15-03/15-04 become video-path versions | Large (rewrites three plan files + RESEARCH.md assumptions on cost/runtime) |
| C. Accept text-only calibration as a baseline | Document as "text-path baseline only, NOT applied to production aggregator." Defer production-path calibration to its own milestone. `aggregator.ts:844-846` stays hardcoded `false`. | Smallest scope — turns Phase 15 into research artifact only, no production wiring |
| D. Download-corpus-videos sub-plan | Add a pre-step that pulls all 225 `tiktok_url`s → Supabase Storage, sets `video_storage_path` on corpus rows, then 15-02 runs in `video_upload` mode | Largest — TikTok scraping reliability + storage cost (225 videos) |

**Recommended next step (not auto-applied — operator chooses):**
```
/gsd-discuss-phase 15
```
to re-open assumptions, OR
```
/gsd-add-phase
```
to insert a video-mode-eval-runner pre-phase before continuing.

---

## 2026-05-24 — Deeper finding (operator follow-up)

**Operator:** "well not only that the corpus video contains a lot of stuff which doesn't make sense (engagement metrics etc) this should instead work with the engine and e2e engine that we will deploy"

**Second mismatch — corpus-vs-production shape:**

`training_corpus` schema (per `eval-runner.ts:84` SELECT and `normalize-scrape.ts`):
```
id, niche, bucket, caption, hashtags,
views, likes, comments, shares, saves,
follower_tier, completion_pct,
sound_name, creator_handle, video_url
```

Production `/api/analyze` ingests a fresh creator upload — by definition there are **no** post-publication engagement metrics yet (`views/likes/comments/shares/saves`), no `completion_pct` (no watch data), no `bucket` (that's what we're trying to predict). The deployed engine sees:
- video bytes (signed URL → Omni-Plus)
- niche
- creator_handle (→ historical creator context fetch)

So the corpus contains a superset of features that the engine cannot have at inference. The bucket label is correctly derived from engagement (that's the ground truth), but the **input distribution** the corpus represents is not what production sees:
- The engagement signals were already in the universe when the row was scraped (post-hoc)
- Even if eval-runner doesn't pass them directly to `runPredictionPipeline`, the corpus selection bias (which videos got scraped, when, why) reflects post-engagement reality, not pre-engagement
- Any creator-context lookups by `creator_handle` will return the creator's CURRENT historical stats, which already include the engagement of these very corpus videos — circular leakage

**Combined problem:** Phase 15 calibrates against (a) the wrong path (text not video) and (b) the wrong data shape (corpus snapshot ≠ production inference inputs). Even fixing (a) leaves (b).

**Operator's framing:** Calibration must align with the **actual e2e production engine** as it will deploy — i.e., use real `/api/analyze` outputs on inputs that match production's input distribution, with ground-truth labels collected post-hoc (capture prediction at t=0, score engagement at t+7d/14d/30d).

**Implication for phase rescope:** Options A/B/D from the earlier table all still operate on the existing `training_corpus`. None of them address (b). The cleaner path is:

| New option | Description |
|------------|-------------|
| E. Live-data calibration loop | Drop corpus-based eval-runner for calibration purposes. Capture `/api/analyze` predictions in production (or staging with shadow traffic), record `(prediction, video_id, created_at)`. After N days, join with actual engagement outcomes. Refit Platt on that. This is the only calibration source whose input distribution matches inference. |
| F. Shadow-replay pipeline | Build a one-time replay: for each corpus row that has a fetchable video, run the FULL production `/api/analyze` (video_upload mode, Omni-Plus, all waves) and capture the prediction. Use those predictions (not corpus features) as calibration inputs. Acknowledges corpus videos are stale but at least the prediction pipeline IS the production one. |
| G. Defer calibration entirely | Don't refit Platt until live production data exists. Leave `aggregator.ts:844-846` `is_calibrated = false` as it stands. Phase 15 becomes: land the engine_version discriminator (15-01, done) and document the calibration-data dependency. |

**State:** Phase 15 remains halted. 15-01 stays merged (infrastructure is valid regardless of which option). 15-02/15-03/15-04 are not just deferred — they need rewriting against the new framing before they should run.

**Recommended next:** `/gsd-discuss-phase 15` to re-open assumptions (D-06 corpus reuse, D-08 cost model, D-10 SUCCESS_THRESHOLD) against the production-engine-aligned framing, OR archive Phase 15 (keeping 15-01 as a standalone landed plan) and open a new milestone for production-aligned calibration.
