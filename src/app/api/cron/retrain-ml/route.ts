import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";

const MIN_OUTCOMES_FOR_TRAINING = 1000;

/**
 * GET /api/cron/retrain-ml (ML-01)
 *
 * Weekly cron — stub implementation until enough outcome data exists.
 * When 1000+ outcomes are available, this will trigger ML model retraining
 * to produce adaptive score weights.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();

  // Count outcomes available for training
  const { count, error } = await supabase
    .from("outcomes")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("[retrain-ml] Failed to count outcomes:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const outcomeCount = count ?? 0;

  if (outcomeCount < MIN_OUTCOMES_FOR_TRAINING) {
    console.log(
      `[retrain-ml] Not enough data: ${outcomeCount}/${MIN_OUTCOMES_FOR_TRAINING} outcomes`
    );
    return NextResponse.json({
      status: "skipped",
      reason: "Not enough data",
      outcomes: outcomeCount,
      required: MIN_OUTCOMES_FOR_TRAINING,
    });
  }

  // TODO: Phase 7 ML pipeline — train model on outcome data,
  // produce new score_weights, update analysis pipeline
  console.log(`[retrain-ml] ${outcomeCount} outcomes available — ML training not yet implemented`);

  return NextResponse.json({
    status: "pending_implementation",
    outcomes: outcomeCount,
    message: "ML training pipeline not yet active",
  });
}
