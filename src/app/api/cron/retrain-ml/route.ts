import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { trainModel } from "@/lib/engine/ml";

/**
 * GET /api/cron/retrain-ml
 *
 * Weekly cron — triggers ML model retraining using scraped video training data.
 * Training data comes from training-data.json (extracted from scraped_videos),
 * NOT from outcomes. Outcome count is included in response for monitoring only.
 *
 * NOTE: Training runs ~200 epochs on ~7000 samples, taking 5-15 seconds.
 * Vercel Pro plan (60s timeout) recommended. Hobby plan (10s) may time out.
 *
 * Weights are persisted to Supabase Storage (ml-weights bucket) for
 * production durability across Vercel redeployments.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();

    // Count outcomes for monitoring (training uses scraped_videos, not outcomes)
    const { count, error: countError } = await supabase
      .from("outcomes")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("[retrain-ml] Failed to count outcomes:", countError);
      // Non-fatal — outcome count is informational only
    }

    const outcomeCount = count ?? 0;

    // Train the model using training-data.json (derived from scraped_videos)
    console.log("[retrain-ml] Starting ML model training...");
    const result = await trainModel();

    console.log(
      `[retrain-ml] Training complete — train accuracy: ${(result.trainAccuracy * 100).toFixed(1)}%, test accuracy: ${(result.testAccuracy * 100).toFixed(1)}%`
    );

    return NextResponse.json({
      status: "completed",
      trainAccuracy: Math.round(result.trainAccuracy * 1000) / 1000,
      testAccuracy: Math.round(result.testAccuracy * 1000) / 1000,
      confusionMatrix: result.confusionMatrix,
      outcomeCount,
      trainedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[retrain-ml] Training failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        status: "failed",
        error: `Training failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
