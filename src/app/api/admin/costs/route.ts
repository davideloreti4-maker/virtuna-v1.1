import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "admin/costs" });

/**
 * GET /api/admin/costs
 *
 * Returns daily cost aggregates grouped by model combination.
 * Protected by CRON_SECRET Bearer token auth.
 *
 * Query params:
 *   ?days=30  — look back N days (default: 30)
 *
 * Response: JSON array of { date, model, total_cost_cents }
 *
 * Uses client-side aggregation (no RPC needed):
 * - Fetches rows from analysis_results for the date range
 * - Groups by date + gemini_model in JS
 * - Returns sorted by date DESC, model ASC
 *
 * Note: cost_cents is the total pipeline cost per analysis (Gemini + DeepSeek combined).
 * Grouped by gemini_model since that's always present (deepseek_model may be null).
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    // Validate days param
    if (isNaN(days) || days <= 0 || days > 365) {
      return NextResponse.json(
        { error: "Invalid 'days' parameter — must be 1-365" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Calculate date cutoff
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = cutoff.toISOString();

    // Fetch raw data — select only needed columns
    const { data, error } = await supabase
      .from("analysis_results")
      .select("created_at, cost_cents, gemini_model")
      .gte("created_at", cutoffISO)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side aggregation: group by (date, gemini_model)
    const aggregates = new Map<string, number>();

    for (const row of data ?? []) {
      const date = row.created_at?.split("T")[0] ?? "unknown";
      const model = row.gemini_model ?? "unknown";
      const cost = row.cost_cents ?? 0; // COALESCE null to 0
      const key = `${date}|${model}`;
      aggregates.set(key, (aggregates.get(key) ?? 0) + cost);
    }

    // Convert to sorted array
    const result = Array.from(aggregates.entries())
      .map(([key, total_cost_cents]) => {
        const [date, model] = key.split("|");
        return { date, model, total_cost_cents: Math.round(total_cost_cents) };
      })
      .sort((a, b) => {
        // Sort by date DESC, then model ASC
        const dateCompare = (b.date ?? "").localeCompare(a.date ?? "");
        if (dateCompare !== 0) return dateCompare;
        return (a.model ?? "").localeCompare(b.model ?? "");
      });

    return NextResponse.json(result);
  } catch (error) {
    log.error("Failed to aggregate costs", {
      error: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error, { tags: { stage: "admin_costs" } });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
