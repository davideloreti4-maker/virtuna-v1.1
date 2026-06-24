/**
 * predicted-pin.ts — FLYWHEEL-02 predicted-signature pin helper.
 *
 * Pins the PREDICTED disposition vector at SIM run time, paired with the audience_id
 * the run actually used (and the analysis_id when one exists). Reconciliation (Plan 03
 * Task 2) later reads this PINNED prediction — it is NEVER recomputed under a changed
 * audience (Pitfall 6). The predicted vector is computed exactly ONCE, here.
 *
 * Non-fatal by contract: a persistence failure must NEVER block the SIM card render
 * (mirrors the non-fatal insertMessage precedent in the runners — FLYWHEEL-02
 * "content-first"). General/null audience runs STILL pin a vector (reconciliation
 * simply may not propose for General — the confidence gate excludes it).
 *
 * History: this file used to also host the SIM-1 Flash `ToolRunner` implementation
 * (`flashRunner` const + `runFlashRunner`/`mapFlashResultToBlocks`). That dispatch
 * scaffolding (and `tools/tool-runner.ts`'s `ToolRunner`/`dispatchToolOutput`) was
 * never wired into the live pipeline — the 4 generative runners call `runFlashTextMode`
 * + `aggregateFlash` directly — and was removed in the dissection (backlog S4). Only the
 * pin helper below remained live, so the file was renamed to match its sole purpose.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlashPersona } from "../../../lib/engine/flash/flash-schema";
import { predictedSignature } from "@/lib/flywheel/signature";
import { insertOutcomeSignature } from "@/lib/flywheel/outcome-repo";

// ─── Pin context types ───────────────────────────────────────────────────────

/**
 * Context the SIM ran under. `audienceId` is the active audience the run used
 * (null for General/no-audience). `analysisId` ties the pin to an analysis when present.
 */
export interface PredictedPinContext {
  audienceId: string | null;
  analysisId?: string | null;
}

/**
 * Runner-level pin context (FLYWHEEL-02 wiring). Carries the Supabase client +
 * optional analysis_id from the route; the runner derives audience_id from the
 * run's active audience. Threaded through each pipeline's optional `pin` input
 * so a SIM run pins its predicted vector end-to-end (the moat's capture path).
 */
export interface RunnerPinContext {
  supabase: SupabaseClient;
  analysisId?: string | null;
}

// ─── pinPredictedSignature (FLYWHEEL-02, Pitfall 6) ──────────────────────────

/**
 * Compute predictedSignature(personas) ONCE and persist it (predicted_vector +
 * audience_id + analysis_id) so reconciliation reads a pinned prediction (Pitfall 6).
 *
 * Returns true on a successful pin, false on a (swallowed) persistence failure.
 * NEVER throws — the caller's SIM card path is unaffected either way.
 */
export async function pinPredictedSignature(
  supabase: SupabaseClient,
  personas: FlashPersona[],
  ctx: PredictedPinContext,
): Promise<boolean> {
  try {
    const predicted_vector = predictedSignature(personas);
    await insertOutcomeSignature(supabase, {
      predicted_vector,
      audience_id: ctx.audienceId ?? null,
      analysis_id: ctx.analysisId ?? null,
      source: "paste_url",
    });
    return true;
  } catch (err) {
    // Non-fatal: log only, never block the SIM card (FLYWHEEL-02 content-first).
    console.error(
      "[predicted-pin] predicted-signature pin failed (non-fatal):",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}
