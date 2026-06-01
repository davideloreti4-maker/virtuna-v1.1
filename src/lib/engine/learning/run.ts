/**
 * 1:1 E2E learning loop — fit orchestrator (the close).
 *
 * Reads the labeled training pairs (engine signals vs real outcome), fits
 * per-niche aggregator weights, and MEASURES the lift over the current hand-set
 * weights. Output = the learned weights + a before/after macro-F1 readout.
 *
 * Deliberately does NOT write the learned weights into the live aggregator —
 * applying them changes production scoring and is a separate, explicit gate.
 * This step answers "did learning from real outcomes beat the hand-set weights?"
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import {
  fitNicheWeights,
  evaluateWeights,
  DEFAULT_WEIGHTS,
  type NicheWeights,
  type LabeledSignalRow,
  type SignalScores,
  type WeightEvalResult,
} from "./fit-weights";
import type { OutcomeBucket } from "./labeling";

const log = createLogger({ module: "learning/run" });

export interface FitWeightsReport {
  rowsUsed: number;
  fittedNiches: string[];
  defaultedNiches: string[];
  weightsByNiche: Record<string, NicheWeights>;
  baseline: WeightEvalResult; // current hand-set weights
  learned: WeightEvalResult; // fitted per-niche weights
  macroF1Lift: number; // learned − baseline
}

/** Map a labeled DB row → LabeledSignalRow (signals live in engine_prediction JSONB). */
function toLabeledRow(r: Record<string, unknown>): LabeledSignalRow | null {
  const realBucket = r.real_bucket as OutcomeBucket | null;
  const niche = r.niche as string | null;
  if (!realBucket || !niche) return null;
  const pred = (r.engine_prediction ?? {}) as { signal_scores?: SignalScores };
  const signals = pred.signal_scores ?? {};
  if (Object.keys(signals).length === 0) return null;
  return { id: String(r.id), niche, signals, real_bucket: realBucket };
}

export async function runFitWeights(
  opts: { supabase?: SupabaseClient } = {},
): Promise<FitWeightsReport> {
  const supabase = opts.supabase ?? createServiceClient();

  const { data, error } = await supabase
    .from("engine_training_videos")
    .select("id, niche, real_bucket, engine_prediction")
    .eq("status", "labeled");
  if (error) throw new Error(`fit-weights fetch failed: ${error.message}`);

  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map(toLabeledRow)
    .filter((r): r is LabeledSignalRow => r !== null);

  const { weightsByNiche, fittedNiches, defaultedNiches } = fitNicheWeights(rows);

  // Baseline = the same hand-set weights for every niche (current production behavior).
  const baselineWeights: Record<string, NicheWeights> = {};
  for (const niche of new Set(rows.map((r) => r.niche))) {
    baselineWeights[niche] = DEFAULT_WEIGHTS;
  }

  const baseline = evaluateWeights(rows, baselineWeights);
  const learned = evaluateWeights(rows, weightsByNiche);
  const macroF1Lift = learned.macroF1 - baseline.macroF1;

  log.info("fit-weights done", {
    rowsUsed: rows.length,
    fittedNiches,
    baselineF1: baseline.macroF1,
    learnedF1: learned.macroF1,
    macroF1Lift,
  });

  return {
    rowsUsed: rows.length,
    fittedNiches,
    defaultedNiches,
    weightsByNiche,
    baseline,
    learned,
    macroF1Lift,
  };
}
