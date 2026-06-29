/**
 * 1:1 E2E learning loop — blind prediction wrapper.
 *
 * Runs a raw training video through the EXACT production path a user hits:
 * input_mode='video_upload' → runPredictionPipeline (full vision/audio/persona/
 * rules) → aggregateScores. NO engagement metrics enter the input, so the
 * resulting feature_vector + score are leak-free and identical to what the
 * deployed engine would produce for that file. This is the whole point — what we
 * train/validate here transfers 1:1 to production inference.
 *
 * Mirrors the proven invocation in corpus/eval-runner.ts (runPredictionPipeline
 * then aggregateScores), but feeds the real video file instead of caption text.
 */
import { ENGINE_VERSION } from "../aggregator";
import { resolvePack } from "../packs";
import { bucketFromScore } from "../corpus/metrics/score-to-bucket";
import type { AnalysisInput, PredictionResult, FeatureVector } from "../types";
import type { Niche, Bucket } from "../corpus/eval-config";
import type { SignalScores } from "./fit-weights";

export interface BlindEnginePrediction {
  feature_vector: FeatureVector;
  /** Per-signal scores the aggregator blended (the learnable inputs — all Qwen layers). */
  signal_scores: SignalScores;
  overall_score: number;
  predicted_bucket: Bucket;
  engine_version: string;
  cost_cents: number;
  prediction: PredictionResult;
}

/** Read the 8 weight-bearing signal scores off a PredictionResult (mirrors aggregator SCORE_WEIGHT_KEYS). */
export function extractSignalScores(p: PredictionResult): SignalScores {
  return {
    behavioral: p.behavioral_score,
    gemini: p.gemini_score,
    ml: p.ml_score,
    rules: p.rule_score,
    trends: p.trend_score,
    audio: p.audio_perceptual_score ?? null,
    retrieval: p.retrieval_score ?? null,
    platform_fit: p.platform_fit?.fit_score ?? null,
  };
}

export interface RunEngineArgs {
  /** Storage key in the `videos` bucket (under `training/`) — same bucket pipeline.ts reads, for a 1:1 run. */
  videoStoragePath: string;
  niche: Niche;
  societyId?: string | null;
}

/**
 * Predict on a single training video, blind, via the production pipeline.
 * Throws if the pipeline fails (caller decides retry / mark failed).
 */
export async function runEngineOnTrainingVideo(
  args: RunEngineArgs,
): Promise<BlindEnginePrediction> {
  const input: AnalysisInput = {
    input_mode: "video_upload",
    video_storage_path: args.videoStoragePath,
    content_type: "video",
    mode: "score",                    // learning loop trains on score-mode predictions
    niche: args.niche,
    society_id: args.societyId ?? undefined,
  };

  // Identical two-step the validation path + production analyze route use.
  const pack = resolvePack("socials");
  const pipelineResult = await pack.run(input);
  const prediction = await pack.scoring.run(pipelineResult);

  return {
    feature_vector: prediction.feature_vector,
    signal_scores: extractSignalScores(prediction),
    overall_score: prediction.overall_score,
    predicted_bucket: bucketFromScore(prediction.overall_score, args.niche),
    engine_version: ENGINE_VERSION,
    cost_cents: prediction.cost_cents ?? 0,
    prediction,
  };
}
