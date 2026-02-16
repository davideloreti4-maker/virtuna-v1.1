import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Per-rule contribution stored in analysis_results.rule_contributions JSONB
 */
interface RuleContribution {
  rule_id: string;
  rule_name: string;
  score: number;
  max_score: number;
  tier: "regex" | "semantic";
}

/**
 * Accumulated per-rule accuracy data across analysis+outcome pairs
 */
interface RuleAccuracyData {
  rule_id: string;
  rule_name: string;
  total_analyses_with_rule: number;
  correct_direction_count: number;
}

/**
 * GET /api/cron/validate-rules
 *
 * Computes per-rule accuracy by comparing rule_contributions from each
 * analysis against actual outcomes, then adjusts rule weights via EMA.
 *
 * Runs daily via Vercel Cron.
 *
 * RULE-03: Per-rule accuracy tracking replaces global MAE approach.
 * Each rule's weight is adjusted based on its individual accuracy,
 * not the overall prediction accuracy.
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

    // -------------------------------------------------------
    // Fetch analysis results with rule_contributions + matching outcomes
    // -------------------------------------------------------
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Query 1: Get outcomes from last 30 days with their analysis_id
    const { data: outcomes, error: outcomesError } = await supabase
      .from("outcomes")
      .select("id, analysis_id, predicted_score, actual_score")
      .is("deleted_at", null)
      .gte("created_at", thirtyDaysAgo)
      .not("actual_score", "is", null);

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

    // Filter to outcomes that have both predicted and actual scores + analysis_id
    const validPairs = outcomes.filter(
      (o) =>
        o.predicted_score != null &&
        o.actual_score != null &&
        o.analysis_id != null
    );

    if (validPairs.length === 0) {
      return NextResponse.json({
        processed: outcomes.length,
        message: "No outcomes with both predicted and actual scores",
      });
    }

    // Query 2: Get analysis_results for those IDs with rule_contributions + overall_score
    // Note: rule_contributions is a v2 column (Phase 4 migration) not yet in generated
    // Supabase types. We cast the query result to include it — PostgREST returns it at runtime.
    const analysisIds = validPairs.map((o) => o.analysis_id as string);

    interface AnalysisRow {
      id: string;
      overall_score: number;
      rule_contributions: RuleContribution[] | null;
    }

    const { data: analysisResults, error: analysisError } = await supabase
      .from("analysis_results")
      .select("id, overall_score")
      .in("id", analysisIds) as unknown as {
        data: AnalysisRow[] | null;
        error: { message: string } | null;
      };

    if (analysisError) {
      console.error(
        "[validate-rules] Failed to fetch analysis results:",
        analysisError
      );
      return NextResponse.json(
        { error: "Failed to fetch analysis results" },
        { status: 500 }
      );
    }

    // Build lookup: analysis_id -> { rule_contributions, overall_score }
    const analysisMap = new Map<
      string,
      { rule_contributions: RuleContribution[] | null; overall_score: number }
    >();
    for (const ar of analysisResults ?? []) {
      analysisMap.set(ar.id, {
        rule_contributions: ar.rule_contributions ?? null,
        overall_score: ar.overall_score,
      });
    }

    // -------------------------------------------------------
    // Compute per-rule accuracy from rule_contributions vs outcomes
    // -------------------------------------------------------
    const ruleAccuracy = new Map<string, RuleAccuracyData>();

    for (const outcome of validPairs) {
      const analysis = analysisMap.get(outcome.analysis_id as string);
      if (!analysis) continue;

      const contributions = analysis.rule_contributions;
      if (!contributions || !Array.isArray(contributions) || contributions.length === 0) {
        continue;
      }

      const predictedScore = outcome.predicted_score as number;
      const actualScore = outcome.actual_score as number;

      for (const contrib of contributions) {
        if (!contrib.rule_id) continue;

        // Initialize accumulator if first time seeing this rule
        if (!ruleAccuracy.has(contrib.rule_id)) {
          ruleAccuracy.set(contrib.rule_id, {
            rule_id: contrib.rule_id,
            rule_name: contrib.rule_name,
            total_analyses_with_rule: 0,
            correct_direction_count: 0,
          });
        }

        const acc = ruleAccuracy.get(contrib.rule_id)!;
        acc.total_analyses_with_rule++;

        // Determine "correct direction":
        // - Rule gave high score (> 50% of max_score) AND actual >= predicted → correct
        // - Rule gave low score (<= 50% of max_score) AND actual < predicted → correct
        const ruleGaveHighScore = contrib.score > contrib.max_score * 0.5;
        const actualBetterThanPredicted = actualScore >= predictedScore;

        if (ruleGaveHighScore === actualBetterThanPredicted) {
          acc.correct_direction_count++;
        }
      }
    }

    // -------------------------------------------------------
    // Update each rule with per-rule accuracy (EMA smoothed)
    // -------------------------------------------------------
    let updatedCount = 0;
    let skippedCount = 0;
    const ruleUpdates: Array<{
      name: string;
      accuracy: number;
      weight: number;
      sampleCount: number;
    }> = [];

    for (const rule of rules ?? []) {
      const acc = ruleAccuracy.get(rule.id);

      if (!acc || acc.total_analyses_with_rule < 10) {
        // Not enough data for statistical significance — skip
        skippedCount++;
        continue;
      }

      const perRuleAccuracy =
        acc.correct_direction_count / acc.total_analyses_with_rule;

      // EMA: new_accuracy = alpha * per_rule_accuracy + (1 - alpha) * prev_accuracy
      const alpha = 0.3;
      const prevAccuracy = rule.accuracy_rate ?? perRuleAccuracy;
      const newAccuracy =
        Math.round(
          (alpha * perRuleAccuracy + (1 - alpha) * prevAccuracy) * 1000
        ) / 1000;

      // Weight adjustment: higher accuracy → higher weight (0.5 to 2.0 range)
      const newWeight =
        Math.round(
          Math.max(0.5, Math.min(2.0, 0.5 + newAccuracy * 1.5)) * 100
        ) / 100;

      const newSampleCount =
        (rule.sample_count ?? 0) + acc.total_analyses_with_rule;

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
          sampleCount: newSampleCount,
        });
      }
    }

    console.log(
      `[validate-rules] Per-rule accuracy: updated ${updatedCount}/${rules?.length ?? 0} rules, skipped ${skippedCount} (< 10 samples). Processed ${validPairs.length} outcome pairs.`
    );

    return NextResponse.json({
      processed: validPairs.length,
      rulesUpdated: updatedCount,
      ruleDetails: ruleUpdates.map((r) => ({
        name: r.name,
        accuracy: r.accuracy,
        weight: r.weight,
        sample_count: r.sampleCount,
      })),
      skippedRules: skippedCount,
    });
  } catch (error) {
    console.error("[validate-rules] Failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
