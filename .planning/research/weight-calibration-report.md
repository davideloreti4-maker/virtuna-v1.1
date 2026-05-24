# Phase 10 Weight Calibration Report

**Date:** 2026-05-20
**Corpus version:** full.2026-05-11
**Corpus size:** 3 rows (text-mode eval; --max-rows=3 for cost)
**Eval mode:** text (completion_pct=null; audio signals absent — text-mode limitation)

## ML Classifier Decision

**Audit result:** accuracy=0.67, loo_delta_ml=+7.04
**Decision:** D-05 disable (ml=0, ml=false in availability)
**Rationale:** ML model was trained on real engagement metrics (shares/views, comment rates, etc.) that do not exist at prediction time. Inference substitutes AI quality scores as proxies with no empirical link, and 5 of 15 features are hardcoded defaults. Model accuracy is 31% per weights file. Signal disabled; weight slot kept at 0 for future retraining when outcome data enables a model trained on pipeline-available features.
**Confusion matrix summary:** 3-row sample: 1 under, 1 average, 1 viral — all classified correctly except 1 under misclassified as average.

## Signal Ablation — Retrieval

**LOO delta (retrieval):** Not computed — text-mode corpus; retrieval signal thin without video embeddings
**Previous weight:** 0.05 (Phase 8 D-03b placeholder)
**New weight:** 0.05
**Rationale:** Kept at placeholder. Retrieval relies on pgvector embedding similarity which requires video descriptions/transcripts for meaningful signal. Text-mode corpus has no video content. Weight stays at 0.05 until video-mode eval in Phase 12 can provide ablation data.

## Signal Ablation — Platform Fit

**LOO delta (platform_fit):** Not computed — text-mode corpus; platform analysis requires video analysis
**Previous weight:** 0.05 (Phase 9 D-07 placeholder)
**New weight:** 0.05
**Rationale:** Kept at placeholder. Platform fit scoring depends on platform-specific content analysis (algo-fit per platform) which requires video-mode analysis. Weight stays at 0.05 until Phase 12.

## Final SCORE_WEIGHTS (post Phase 10)

| Signal | Weight | Notes |
|--------|--------|-------|
| behavioral | 0.35 | Persona aggregate (Phase 7) |
| gemini | 0.25 | Video analysis (Phases 5-6) |
| ml | 0 | D-05 disabled after Phase 10 audit — model uses engagement features unavailable at prediction time |
| rules | 0.15 | Rule-based scoring |
| trends | 0.10 | Trend enrichment |
| audio | 0.07 | Audio perceptual score (Phase 6) |
| retrieval | 0.05 | pgvector top-K retrieval (Phase 8) — kept at placeholder |
| platform_fit | 0.05 | Per-platform fit score (Phase 9) — kept at placeholder |

*Note: selectWeights() normalizes these to sum=1.0 at runtime.*
