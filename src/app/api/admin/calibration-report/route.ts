import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { generateCalibrationReport } from "@/lib/engine/calibration";

/**
 * GET /api/admin/calibration-report
 *
 * Returns ECE (Expected Calibration Error) and per-bin accuracy breakdown.
 * Protected by CRON_SECRET Bearer token auth (same as cron routes).
 *
 * Query params:
 *   ?days=30  — filter outcomes to last N days (default: all time)
 *
 * Response: CalibrationReport JSON
 *   { ece, bins, totalSamples, generatedAt }
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    // Parse optional days filter from query params
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const sinceDays = daysParam ? parseInt(daysParam, 10) : undefined;

    // Validate days param if provided
    if (daysParam && (isNaN(sinceDays!) || sinceDays! <= 0)) {
      return NextResponse.json(
        { error: "Invalid 'days' parameter — must be a positive integer" },
        { status: 400 }
      );
    }

    const report = await generateCalibrationReport(
      sinceDays ? { sinceDays } : undefined
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error("[calibration-report] Failed to generate report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
