-- Drop Platt calibration entirely (2026-05-24).
--
-- Rationale: see .planning/phases/15-calibration-refit-on-qwen-corpus/15-DISCUSSION-LOG.md.
-- The corpus-based eval-runner calibrated against text-only Qwen-on-captions,
-- but production runs video_upload + Omni-Plus. Calibrating one path to apply
-- to another is a category error. Additionally, training_corpus carries
-- post-publication engagement metrics that production never sees at inference,
-- so the corpus input distribution does not match the deployed engine's input
-- distribution. The Platt block in aggregator.ts was dead code (is_calibrated
-- has been hardcoded false since the Qwen migration). Dropping cleanly.
--
-- Note: training_corpus, scraped_videos, and benchmark_results are NOT touched
-- here — training_corpus is used by retrieval-stage.ts (RPC match_corpus_videos)
-- for similarity search at production inference time and remains load-bearing.

DROP TABLE IF EXISTS platt_parameters CASCADE;
