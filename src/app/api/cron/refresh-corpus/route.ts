import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/refresh-corpus" });

export const maxDuration = 60;

/**
 * GET /api/cron/refresh-corpus
 *
 * D-12 / CORPUS-02: 30-day rolling corpus refresh.
 *
 * STUB ONLY in Phase 1. CONTEXT line 15 explicitly defers the full mechanism
 * to Phase 11/12 (operational concern). Phase 1 only needs:
 *   1. Route exists with cron-auth guard
 *   2. vercel.json registers the schedule
 *   3. Returns 200 to confirm the schedule fires successfully
 *
 * When Phase 11/12 lands, this stub is replaced with the actual scrape trigger
 * that creates a new `full.YYYY-MM-DD` corpus_version and runs the orchestrator.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    log.info("Refresh-corpus stub invoked (no-op until Phase 11/12)");
    return NextResponse.json({
      status: "stubbed",
      message:
        "Phase 1 stub; full 30-day refresh implemented in Phase 11/12",
      next_steps: "See .planning/ROADMAP.md Phase 11/12",
    });
  } catch (error) {
    log.error("Failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
