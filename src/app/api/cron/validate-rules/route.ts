import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/validate-rules
 *
 * Checks rule accuracy against outcome data and adjusts rule weights.
 * Runs daily via Vercel Cron.
 *
 * For each active rule, compares predicted rule_score contributions
 * against actual outcomes to calculate accuracy. Rules with higher
 * accuracy get higher weights; poor performers get downweighted.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();

    // Fetch active rules
    const { data: rules, error: rulesError } = await supabase
      .from("rule_library")
      .select("*")
      .eq("is_active", true);

    if (rulesError) {
      console.error("[validate-rules] Failed to fetch rules:", rulesError);
      return NextResponse.json(
        { error: "Failed to fetch rules" },
        { status: 500 }
      );
    }

    // Fetch outcomes with their analysis results (last 30 days)
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: outcomes, error: outcomesError } = await supabase
      .from("outcomes")
      .select(
        "id, predicted_score, actual_score, delta, analysis_id"
      )
      .is("deleted_at", null)
      .gte("created_at", thirtyDaysAgo);

    if (outcomesError) {
      console.error("[validate-rules] Failed to fetch outcomes:", outcomesError);
      return NextResponse.json(
        { error: "Failed to fetch outcomes" },
        { status: 500 }
      );
    }

    if (!outcomes || outcomes.length === 0) {
      return NextResponse.json({
        processed: 0,
        message: "No outcome data available for validation",
      });
    }

    // Calculate overall prediction accuracy
    const validOutcomes = outcomes.filter(
      (o) => o.predicted_score != null && o.actual_score != null
    );

    if (validOutcomes.length === 0) {
      return NextResponse.json({
        processed: outcomes.length,
        message: "No outcomes with both predicted and actual scores",
      });
    }

    // Mean absolute error across all predictions
    const totalAbsError = validOutcomes.reduce(
      (sum, o) => sum + Math.abs(o.delta ?? (o.predicted_score! - o.actual_score!)),
      0
    );
    const mae = totalAbsError / validOutcomes.length;

    // Accuracy rate: 1 - normalized MAE (clamped 0-1)
    // Assuming scores are 0-100 scale
    const overallAccuracy = Math.max(0, Math.min(1, 1 - mae / 100));

    // Update each rule's accuracy_rate and sample_count
    // Adjust weight based on category performance
    let updatedCount = 0;
    const ruleUpdates: Array<{ name: string; accuracy: number; weight: number }> = [];

    for (const rule of rules ?? []) {
      // For now, all rules share the global accuracy since individual
      // rule contributions aren't tracked separately yet.
      // As the system matures, per-rule accuracy will be computed
      // from analysis_results.factors JSONB.
      const newSampleCount = (rule.sample_count ?? 0) + validOutcomes.length;

      // Exponential moving average for accuracy
      const prevAccuracy = rule.accuracy_rate ?? overallAccuracy;
      const alpha = 0.3; // Weight for new data
      const newAccuracy =
        Math.round((alpha * overallAccuracy + (1 - alpha) * prevAccuracy) * 1000) /
        1000;

      // Adjust weight: higher accuracy → higher weight (0.5 to 2.0 range)
      const newWeight =
        Math.round(Math.max(0.5, Math.min(2.0, 0.5 + newAccuracy * 1.5)) * 100) /
        100;

      const { error: updateError } = await supabase
        .from("rule_library")
        .update({
          accuracy_rate: newAccuracy,
          sample_count: newSampleCount,
          weight: newWeight,
        })
        .eq("id", rule.id);

      if (updateError) {
        console.error(
          `[validate-rules] Failed to update rule ${rule.name}:`,
          updateError
        );
      } else {
        updatedCount++;
        ruleUpdates.push({
          name: rule.name,
          accuracy: newAccuracy,
          weight: newWeight,
        });
      }
    }

    console.log(
      `[validate-rules] Updated ${updatedCount}/${rules?.length ?? 0} rules. MAE: ${mae.toFixed(2)}, Overall accuracy: ${(overallAccuracy * 100).toFixed(1)}%`
    );

    return NextResponse.json({
      processed: validOutcomes.length,
      totalOutcomes: outcomes.length,
      mae: Math.round(mae * 100) / 100,
      overallAccuracy: Math.round(overallAccuracy * 1000) / 1000,
      rulesUpdated: updatedCount,
      ruleUpdates,
    });
  } catch (error) {
    console.error("[validate-rules] Failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
