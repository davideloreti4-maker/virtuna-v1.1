import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  generateCalibrationReport,
  fetchOutcomePairs,
  fitPlattScaling,
  invalidatePlattCache,
} from "@/lib/engine/calibration";

const ECE_DRIFT_THRESHOLD = 0.15;
const MIN_SAMPLES = 50;

/**
 * GET /api/cron/calibration-audit
 *
 * Monthly cron — measures Expected Calibration Error (ECE), re-fits Platt
 * scaling parameters, and alerts (logs warning) when ECE exceeds the drift
 * threshold of 0.15.
 *
 * Configured in vercel.json for monthly execution.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    // 1. Generate calibration report with 90-day lookback window
    const report = await generateCalibrationReport({ sinceDays: 90 });

    // 2. Check minimum sample threshold
    if (report.totalSamples < MIN_SAMPLES) {
      console.log(
        `[calibration-audit] Skipped: only ${report.totalSamples}/${MIN_SAMPLES} outcome samples available`
      );
      return NextResponse.json({
        status: "skipped",
        reason: "Insufficient outcome data",
        samples: report.totalSamples,
        required: MIN_SAMPLES,
      });
    }

    // 3. Check ECE drift
    let driftDetected = false;
    if (report.ece > ECE_DRIFT_THRESHOLD) {
      console.warn(
        `[calibration-audit] DRIFT ALERT: ECE ${report.ece} exceeds threshold ${ECE_DRIFT_THRESHOLD}`
      );
      driftDetected = true;
    } else {
      console.log(
        `[calibration-audit] ECE ${report.ece} within acceptable range (threshold: ${ECE_DRIFT_THRESHOLD})`
      );
    }

    // 4. Re-fit Platt scaling parameters
    const supabase = createServiceClient();
    const pairs = await fetchOutcomePairs(supabase, { sinceDays: 90 });
    const plattParams = fitPlattScaling(pairs);

    let plattRefitted = false;
    if (plattParams !== null) {
      plattRefitted = true;
      console.log(
        `[calibration-audit] Platt parameters re-fitted: A=${plattParams.a.toFixed(4)}, B=${plattParams.b.toFixed(4)} (${plattParams.sampleCount} samples)`
      );

      // 5. Invalidate Platt cache so next request uses fresh params
      invalidatePlattCache();
    } else {
      console.log(
        `[calibration-audit] Not enough data for Platt fit (need ${MIN_SAMPLES}+ pairs)`
      );
    }

    // 6. Return structured JSON response
    return NextResponse.json({
      status: "completed",
      ece: report.ece,
      driftDetected,
      driftThreshold: ECE_DRIFT_THRESHOLD,
      bins: report.bins,
      totalSamples: report.totalSamples,
      plattRefitted,
      plattParams: plattParams
        ? { a: plattParams.a, b: plattParams.b }
        : null,
      auditedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[calibration-audit] Failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Calibration audit failed" },
      { status: 500 }
    );
  }
}
