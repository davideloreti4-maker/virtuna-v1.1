import { describe, it, expect } from "vitest";
import { buildPredictedUpdate } from "../predict-sweep";
import { buildLabelUpdates, type LabelInputRow } from "../label";
import type { BlindEnginePrediction } from "../predict";
import type { FeatureVector } from "../../types";

describe("buildPredictedUpdate", () => {
  it("maps a blind prediction to the predicted UPDATE payload", () => {
    const p = {
      feature_vector: { hookScore: 7 } as unknown as FeatureVector,
      signal_scores: { behavioral: 60, gemini: 80 },
      overall_score: 73.5,
      predicted_bucket: "viral",
      engine_version: "omni-1.2.3",
      cost_cents: 4,
      prediction: {} as never,
    } as BlindEnginePrediction;

    const update = buildPredictedUpdate(p, "2026-05-31T00:00:00.000Z");
    expect(update).toEqual({
      engine_feature_vector: { hookScore: 7 },
      engine_prediction: { signal_scores: { behavioral: 60, gemini: 80 }, overall_score: 73.5 },
      engine_overall_score: 73.5,
      engine_predicted_bucket: "viral",
      engine_version: "omni-1.2.3",
      engine_evaluated_at: "2026-05-31T00:00:00.000Z",
      status: "predicted",
    });
  });
});

describe("buildLabelUpdates", () => {
  // fitness: 8 rows (meets MIN_NICHE_COHORT) ; beauty: 3 rows (skipped)
  const fitness: LabelInputRow[] = [
    { id: "f1", niche: "fitness", real_views: 100_000, engine_predicted_bucket: "viral" },
    { id: "f2", niche: "fitness", real_views: 60_000, engine_predicted_bucket: "average" },
    { id: "f3", niche: "fitness", real_views: 40_000, engine_predicted_bucket: "average" },
    { id: "f4", niche: "fitness", real_views: 25_000, engine_predicted_bucket: "average" },
    { id: "f5", niche: "fitness", real_views: 15_000, engine_predicted_bucket: "under" },
    { id: "f6", niche: "fitness", real_views: 9_000, engine_predicted_bucket: "average" },
    { id: "f7", niche: "fitness", real_views: 4_000, engine_predicted_bucket: "under" },
    { id: "f8", niche: "fitness", real_views: 1_000, engine_predicted_bucket: "viral" },
  ];
  const beauty: LabelInputRow[] = [
    { id: "b1", niche: "beauty", real_views: 5_000_000, engine_predicted_bucket: "viral" },
    { id: "b2", niche: "beauty", real_views: 1_000_000, engine_predicted_bucket: "average" },
    { id: "b3", niche: "beauty", real_views: 100_000, engine_predicted_bucket: "under" },
  ];

  it("skips niches below the min cohort, labels the rest", () => {
    const { updates, skippedNiches } = buildLabelUpdates([...fitness, ...beauty]);
    expect(skippedNiches).toContain("beauty");
    expect(updates.every((u) => u.id.startsWith("f"))).toBe(true);
    expect(updates).toHaveLength(8);
  });

  it("labels top of niche viral, bottom under, with 0-100 percentile", () => {
    const { updates } = buildLabelUpdates(fitness);
    const top = updates.find((u) => u.id === "f1")!;
    const bottom = updates.find((u) => u.id === "f8")!;
    expect(top.real_bucket).toBe("viral");
    expect(bottom.real_bucket).toBe("under");
    expect(top.real_percentile).toBeGreaterThan(bottom.real_percentile);
    expect(top.real_percentile).toBeLessThanOrEqual(100);
  });

  it("computes bucket_match + ordinal prediction_error vs engine bucket", () => {
    const { updates } = buildLabelUpdates(fitness);
    const top = updates.find((u) => u.id === "f1")!; // engine said viral, real viral
    expect(top.bucket_match).toBe(true);
    expect(top.prediction_error).toBe(0);

    const f8 = updates.find((u) => u.id === "f8")!; // engine said viral, real under
    expect(f8.bucket_match).toBe(false);
    expect(f8.prediction_error).toBe(2); // viral↔under = max distance
  });
});
