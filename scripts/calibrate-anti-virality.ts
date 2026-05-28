/**
 * Phase 1 (R1.9) — Offline anti-virality threshold calibration.
 *
 * Run: `npx tsx scripts/calibrate-anti-virality.ts`
 *
 * Reads from the `outcomes` table via service-role client, sweeps confidence
 * thresholds from 0.10 to 0.70 in 0.05 steps, prints the inversion rate at
 * each threshold. Recommends the LOWEST threshold where >50% of low-confidence
 * high-predicted-score analyses actually flopped (actual<0.4) — the cutoff
 * where the model is reliably wrong, so "Don't post yet" is statistically
 * defensible.
 *
 * If outcomes count < 50: prints "INSUFFICIENT DATA" + recommends threshold=0.4
 * with documented "no calibration corpus" rationale (per RESEARCH Open Question 1).
 *
 * Output: stdout only. Does NOT modify any source file.
 */

import { createServiceClient } from "@/lib/supabase/service";

const MIN_SAMPLE_SIZE = 50;
const FALLBACK_THRESHOLD = 0.4;

interface ConfidenceRow {
  predicted: number;
  actual: number;
  confidence: number;
}

async function loadConfidenceRows(): Promise<ConfidenceRow[]> {
  const supabase = createServiceClient();

  // fetchOutcomePairs (calibration.ts) returns { predicted, actual } only — for
  // the sweep we ALSO need confidence. Query outcomes joined with
  // analysis_results to get all three. Stored ranges:
  //   outcomes.actual_score    : 0-100 → normalize to 0-1
  //   analysis_results.overall_score : 0-100 → normalize to 0-1
  //   analysis_results.confidence    : already 0-1 (per types.ts)
  const { data, error } = await supabase
    .from("outcomes")
    .select(
      "analysis_id, actual_score, analysis_results!inner(overall_score, confidence)"
    )
    .is("deleted_at", null)
    .not("actual_score", "is", null);

  if (error) {
    console.error("Failed to load outcomes:", error.message);
    process.exit(1);
  }

  const rows: ConfidenceRow[] = (data ?? [])
    .map((r) => {
      const ar = (
        r as unknown as {
          analysis_results: {
            overall_score: number | null;
            confidence: number | null;
          };
        }
      ).analysis_results;
      if (!ar || ar.overall_score == null || ar.confidence == null) return null;
      const actualScore = (r as unknown as { actual_score: number }).actual_score;
      return {
        // Normalize 0-100 → 0-1 to match the sweep thresholds (which are in [0,1]).
        predicted: Math.max(0, Math.min(1, ar.overall_score / 100)),
        actual: Math.max(0, Math.min(1, actualScore / 100)),
        // confidence is already 0-1 per PredictionResult.confidence contract.
        confidence: ar.confidence,
      };
    })
    .filter((r): r is ConfidenceRow => r !== null);

  return rows;
}

function sweep(
  rows: ConfidenceRow[]
): {
  threshold: number;
  inversionRate: number;
  nLowConf: number;
  nHighPred: number;
} | null {
  let best: {
    threshold: number;
    inversionRate: number;
    nLowConf: number;
    nHighPred: number;
  } | null = null;
  console.log("\n--- Threshold Sweep ---");
  console.log("threshold | n_lowConf | n_highPred | flop_rate");
  console.log("----------+-----------+------------+-----------");
  for (let t = 0.1; t <= 0.7 + 1e-9; t += 0.05) {
    const lowConf = rows.filter((r) => r.confidence < t);
    const highPredicted = lowConf.filter((r) => r.predicted > 0.6);
    const actuallyFlopped = highPredicted.filter((r) => r.actual < 0.4);
    const inversionRate =
      highPredicted.length > 0
        ? actuallyFlopped.length / highPredicted.length
        : 0;
    console.log(
      `${t.toFixed(2)}     | ${String(lowConf.length).padStart(9)} | ${String(
        highPredicted.length
      ).padStart(10)} | ${(inversionRate * 100).toFixed(1)}%`
    );
    if (inversionRate > 0.5 && highPredicted.length >= 10 && !best) {
      best = {
        threshold: t,
        inversionRate,
        nLowConf: lowConf.length,
        nHighPred: highPredicted.length,
      };
    }
  }
  return best;
}

async function main() {
  // W6 precondition: verify outcomes table has data + FK shape exists BEFORE attempting the JOIN.
  // Falls through to documented fallback (threshold=0.4) without erroring if outcomes is empty
  // or FK to analysis_results is missing/broken.
  const supabasePrecheck = createServiceClient();
  try {
    const { count, error: countErr } = await supabasePrecheck
      .from("outcomes")
      .select("*", { count: "exact", head: true });
    if (countErr) {
      console.log("\n=== W6 PRECONDITION FAILED ===");
      console.log(`outcomes table access error: ${countErr.message}`);
      console.log(
        `Recommended: lock ANTI_VIRALITY_THRESHOLD = ${FALLBACK_THRESHOLD}`
      );
      console.log(
        "Rationale: outcomes table inaccessible — falling through to documented fallback per W6."
      );
      return;
    }
    if ((count ?? 0) === 0) {
      console.log("\n=== W6 PRECONDITION: NO OUTCOMES ===");
      console.log("outcomes table is empty (no analysis-outcome pairs yet).");
      console.log(
        `Recommended: lock ANTI_VIRALITY_THRESHOLD = ${FALLBACK_THRESHOLD}`
      );
      console.log(
        "Rationale: no calibration corpus available; documented fallback per W6."
      );
      return;
    }
    console.log(`outcomes precheck: ${count} total rows present.`);
  } catch (err) {
    console.log("\n=== W6 PRECONDITION THREW ===");
    console.log(
      `Error during outcomes precheck: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    console.log(
      `Recommended: lock ANTI_VIRALITY_THRESHOLD = ${FALLBACK_THRESHOLD}`
    );
    console.log(
      "Rationale: outcomes precheck failed (e.g., FK to analysis_results missing); fall through to fallback per W6."
    );
    return;
  }

  console.log("Loading outcomes...");
  const rows = await loadConfidenceRows();
  console.log(
    `Loaded ${rows.length} outcome rows with both predicted + actual + confidence.`
  );

  if (rows.length < MIN_SAMPLE_SIZE) {
    console.log("\n=== INSUFFICIENT DATA ===");
    console.log(`Need >=${MIN_SAMPLE_SIZE} outcome rows. Have ${rows.length}.`);
    console.log(
      `Recommended: lock ANTI_VIRALITY_THRESHOLD = ${FALLBACK_THRESHOLD}`
    );
    console.log("Rationale: insufficient calibration corpus; matches existing");
    console.log("calculateConfidence() LOW band cutoff. Revisit in M2-II as outcome");
    console.log("data accumulates.");
    return;
  }

  const result = sweep(rows);
  if (result === null) {
    console.log("\n=== NO INVERSION POINT FOUND ===");
    console.log(
      `Recommended: lock ANTI_VIRALITY_THRESHOLD = ${FALLBACK_THRESHOLD}`
    );
    console.log(
      "Rationale: no threshold in [0.10, 0.70] produced a >50% flop rate among low-confidence high-predicted-score analyses with n>=10."
    );
  } else {
    console.log("\n=== INVERSION POINT FOUND ===");
    console.log(
      `Recommended: lock ANTI_VIRALITY_THRESHOLD = ${result.threshold.toFixed(2)}`
    );
    console.log(
      `At this threshold: ${result.nHighPred} high-predicted analyses with confidence<${result.threshold.toFixed(2)},`
    );
    console.log(
      `${(result.inversionRate * 100).toFixed(1)}% of them actually flopped (actual<0.4).`
    );
  }
}

main().catch((err) => {
  console.error("Calibration script failed:", err);
  process.exit(1);
});
